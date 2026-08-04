'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product, API_BASE } from '@/lib/api';
import { Search, ChevronLeft, Store, Sparkles, Video as VideoIcon,
  Star, ShoppingBag, Play, Send, Loader2, X, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') || '';

  // Persisted state
  const [searchInput, setSearchInput] = usePersistedState<string>('search:input', query);
  const [aiAnswer, setAiAnswer] = usePersistedState<string>('search:aiAnswer', '');
  const [aiProducts, setAiProducts] = usePersistedState<Product[]>('search:aiProducts', []);
  const [allProducts, setAllProducts] = usePersistedState<Product[]>('search:allProducts', []);
  const [videos, setVideos] = usePersistedState<any[]>('search:videos', []);
  const [chatHistory, setChatHistory] = usePersistedState<{user: string; ai: string}[]>('search:chatHistory', []);
  const [view, setView] = usePersistedState<'ai' | 'products' | 'videos'>('search:view', 'ai');
  const [hasSearched, setHasSearched] = usePersistedState<string>('search:lastQuery', '');

  // Transient state
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'popular'>('relevance');

  useScrollPreservation('search');

  const searchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = searchBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.dispatchEvent(
          new CustomEvent('searchbar-visibility', { detail: { visible: entry.isIntersecting } })
        );
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setAiLoading(true);
    setAiAnswer('');
    setAiProducts([]);
    setAllProducts([]);
    setVideos([]);

    // Run product search, video search, AND AI answer IN PARALLEL for speed.
    const csrfToken = typeof document !== 'undefined'
      ? (document.cookie.match(/cellex_csrftoken=([^;]+)/) || [])[1] || ''
      : '';

    const [searchResp, vidResp, aiResp] = await Promise.all([
      api.smartSearch(q, 30),
      api.videos.feed(50).catch(() => ({ success: false, videos: [] })),
      fetch(`${API_BASE}/api/ai-chat`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          message: `A user searched for "${q}" on Cellex (a Nigerian e-commerce marketplace). Provide a helpful, comprehensive answer about what's available. Mention types of products, price ranges, and shopping tips. Be friendly and informative (2-3 sentences max).`,
          context: 'Search overview',
          history: [],
        }),
      }).catch(() => null),
    ]);

    // Process product results
    const products = searchResp.success
      ? (searchResp.products || searchResp.results || [])
      : [];
    setAllProducts(products);
    setAiProducts(products.slice(0, 4));
    setLoading(false);
    setHasSearched(q);

    // Process video results
    if (vidResp.success) {
      const qLower = q.toLowerCase();
      const filtered = (vidResp.videos || []).filter((v: any) =>
        (v.caption || '').toLowerCase().includes(qLower) ||
        (v.product?.name || '').toLowerCase().includes(qLower) ||
        (v.seller?.business_name || '').toLowerCase().includes(qLower)
      );
      setVideos(filtered);
    }

    // Process AI response
    if (aiResp && aiResp.ok) {
      const data = await aiResp.json();
      setAiAnswer(data.reply || data.message || data.content || `Here's what I found for "${q}": ${products.length} products available.`);
    } else {
      setAiAnswer(`Here's what I found for "${q}": ${products.length} products available on Cellex.`);
    }
    setAiLoading(false);
  }, []);

  useEffect(() => {
    if (query && query !== hasSearched) {
      setSearchInput(query);
      doSearch(query);
    }
  }, [query, doSearch, hasSearched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const sendFollowUp = async () => {
    if (!followUpInput.trim() || followUpLoading) return;
    const userMsg = followUpInput.trim();
    setFollowUpInput('');
    setFollowUpLoading(true);
    try {
      const aiResp = await fetch(`${API_BASE}/api/ai-chat`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          context: `User searched for "${query}" on Cellex. Previous AI answer: ${aiAnswer}. Available products: ${allProducts.slice(0, 5).map(p => `${p.name} (${formatPrice(p.price)})`).join(', ')}`,
          history: chatHistory.map(m => [{ role: 'user', content: m.user }, { role: 'assistant', content: m.ai }]).flat(),
        }),
      });
      let aiMsg = '';
      if (aiResp.ok) {
        const data = await aiResp.json();
        aiMsg = data.reply || data.message || data.content || 'I can help with that.';
      } else {
        aiMsg = 'I can help with that. Try browsing the products below.';
      }
      setChatHistory(prev => [...prev, { user: userMsg, ai: aiMsg }]);
    } catch {
      setChatHistory(prev => [...prev, { user: userMsg, ai: 'Sorry, please try again.' }]);
    }
    setFollowUpLoading(false);
  };

  // Sort products
  const sortedProducts = [...allProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      case 'popular': return (b.units_sold || 0) - (a.units_sold || 0);
      default: return 0;
    }
  });

  return (
    <div className="min-h-screen bg-white">
      {/* ===== STICKY HEADER — Google style ===== */}
      <div ref={searchBarRef} className="sticky top-0 z-50 bg-white border-b border-[#e5e5e5]">
        <div className="max-w-[692px] mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-[#171717]" />
          </button>
          <Link href="/" className="shrink-0 flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#171717]">
              <span className="font-extrabold text-base text-white" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
            </div>
            <span className="text-xl font-semibold text-[#171717] tracking-tight hidden sm:inline">Cellex</span>
          </Link>
          <form onSubmit={handleSubmit} className="flex-1 flex items-center h-11 px-4 bg-white border border-[#e5e5e5] rounded-full transition-all focus-within:border-[#d4d4d4] focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.08)]">
            <Search className="w-4 h-4 mr-3 shrink-0 text-[#737373]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Cellex..."
              className="flex-1 bg-transparent outline-none text-base text-[#171717] placeholder:text-[#a3a3a3]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="ml-2 shrink-0"
                aria-label="Clear"
              >
                <X className="w-4 h-4 text-[#737373] hover:text-[#171717]" />
              </button>
            )}
          </form>
        </div>

        {/* ===== TABS — Google style (black underline) ===== */}
        <div className="max-w-[692px] mx-auto px-4 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {[
            { key: 'ai', label: 'AI Answer', icon: Sparkles },
            { key: 'products', label: `Products (${allProducts.length})`, icon: ShoppingBag },
            { key: 'videos', label: `Videos (${videos.length})`, icon: VideoIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = view === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key as any)}
                className={`relative px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#171717] font-semibold' : 'text-[#737373] hover:text-[#525252]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute left-2 right-2 -bottom-px h-[3px] bg-[#171717] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-[692px] mx-auto px-4 py-5 pb-32">

        {/* ===== AI ANSWER VIEW (Google AI Overview style) ===== */}
        {view === 'ai' && (
          <div className="space-y-5">
            {/* AI Answer card */}
            <div>
              {/* Label with black accent bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-[#171717] rounded-full" />
                <span className="text-sm font-semibold text-[#171717]">AI Answer</span>
                {aiLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#737373]" />
                )}
              </div>

              {/* Card body — gray fill, rounded, subtle border */}
              <div className="bg-[#f5f5f5] rounded-xl p-4 border border-[#e5e5e5]">
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-[#e5e5e5] rounded animate-pulse w-full" />
                    <div className="h-3 bg-[#e5e5e5] rounded animate-pulse w-5/6" />
                    <div className="h-3 bg-[#e5e5e5] rounded animate-pulse w-4/6" />
                    <div className="h-3 bg-[#e5e5e5] rounded animate-pulse w-3/4" />
                  </div>
                ) : (
                  <p className="text-sm text-[#171717] leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
                )}
              </div>
            </div>

            {/* Top product picks — source chips style */}
            {aiProducts.length > 0 && !aiLoading && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-[#737373]">Top picks for "{query}"</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {aiProducts.map((p) => (
                    <Link key={p.id} href={`/product?id=${p.id}`} className="block group">
                      <div className="rounded-lg overflow-hidden border border-[#e5e5e5] bg-white hover:border-[#171717] hover:shadow-sm transition-all">
                        <div className="aspect-square bg-[#f5f5f5] overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#a3a3a3]">
                              <Store className="w-7 h-7" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium line-clamp-1 text-[#171717]">{p.name}</div>
                          <div className="text-sm font-bold text-[#171717] mt-0.5">{formatPrice(p.price)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up chat history */}
            {chatHistory.map((msg, i) => (
              <div key={i} className="space-y-3">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] bg-[#171717] text-white">
                    <p className="text-sm">{msg.user}</p>
                  </div>
                </div>
                {/* AI message */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#171717]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-[#f5f5f5] rounded-2xl rounded-tl-md p-3.5 border border-[#e5e5e5]">
                    <p className="text-sm text-[#171717] leading-relaxed whitespace-pre-wrap">{msg.ai}</p>
                  </div>
                </div>
              </div>
            ))}

            {followUpLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#171717]">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-1 pt-2.5">
                  <span className="w-2 h-2 bg-[#171717] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#171717] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#171717] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== PRODUCTS VIEW (Google organic results style) ===== */}
        {view === 'products' && (
          <div>
            {/* Result count + sort */}
            {!loading && allProducts.length > 0 && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#e5e5e5]">
                <div className="text-sm text-[#737373]">
                  <span className="font-semibold text-[#171717]">{allProducts.length}</span> results
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs font-medium bg-transparent border-0 outline-none cursor-pointer text-[#525252]"
                >
                  <option value="relevance">Most Relevant</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>
            )}

            {loading ? (
              <div className="space-y-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="w-24 h-24 rounded-lg bg-[#f5f5f5] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-[#f5f5f5] rounded w-1/3" />
                      <div className="h-5 bg-[#f5f5f5] rounded w-3/4" />
                      <div className="h-3 bg-[#f5f5f5] rounded w-full" />
                      <div className="h-3 bg-[#f5f5f5] rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 mx-auto mb-3 text-[#d4d4d4]" />
                <p className="text-sm font-medium text-[#525252]">No products found for "{query}"</p>
                <p className="text-xs text-[#a3a3a3] mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedProducts.map((p) => (
                  <ProductResult key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== VIDEOS VIEW ===== */}
        {view === 'videos' && (
          <div>
            <div className="text-sm mb-4 text-[#737373]">
              {loading ? '' : `${videos.length} videos for "${query}"`}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg bg-[#f5f5f5] aspect-[9/16] animate-pulse" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-20">
                <VideoIcon className="w-12 h-12 mx-auto mb-3 text-[#d4d4d4]" />
                <p className="text-sm text-[#525252]">No videos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {videos.map((v) => (
                  <VideoResult key={v.id} video={v} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== FOLLOW-UP INPUT (floating, AI view only) ===== */}
      {view === 'ai' && !aiLoading && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)', width: 'calc(100% - 24px)', maxWidth: '446px' }}
        >
          <div className="flex items-center gap-2 rounded-full px-4 py-2.5 bg-white border border-[#d4d4d4] focus-within:border-[#171717] shadow-md transition-all">
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFollowUp()}
              placeholder="Ask a follow-up question..."
              className="flex-1 bg-transparent outline-none text-sm text-[#171717] placeholder:text-[#a3a3a3]"
            />
            <button
              onClick={sendFollowUp}
              disabled={!followUpInput.trim() || followUpLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 shrink-0 bg-[#171717] hover:bg-[#333] transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Google-style organic product result ===== */
function ProductResult({ product }: { product: Product }) {
  return (
    <Link href={`/product?id=${product.id}`} className="flex gap-4 group">
      {/* Thumbnail */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden shrink-0 bg-[#f5f5f5]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#a3a3a3]">
            <Store className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Content — Google organic result structure */}
      <div className="flex-1 min-w-0">
        {/* URL/breadcrumb row (gray, small) */}
        <div className="flex items-center gap-1 text-xs text-[#737373] mb-0.5">
          <Store className="w-3 h-3" />
          <span>{product.category || 'Cellex'}</span>
          <span className="text-[#a3a3a3]">·</span>
          <span>Verified Seller</span>
        </div>

        {/* Title (black, large, underlined on hover) */}
        <h3 className="text-lg font-normal text-[#171717] group-hover:underline leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Price (bold, black) */}
        <div className="text-base font-semibold text-[#171717] mt-0.5">{formatPrice(product.price)}</div>

        {/* Snippet (gray, small) */}
        {product.description && (
          <p className="text-sm text-[#525252] line-clamp-2 mt-1 leading-snug">{product.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-[#737373]">
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {product.units_sold} sold
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-[#171717] text-[#171717]" /> 4.5
          </span>
          <span className="flex items-center gap-0.5 text-[#525252]">
            <ShoppingBag className="w-3 h-3" /> Pay on delivery
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ===== Video result ===== */
function VideoResult({ video }: { video: any }) {
  const seller = video.seller || {};
  const sellerName = seller.business_name || 'Seller';
  const product = video.product;
  return (
    <Link href="/videos" className="block group">
      <div className="rounded-lg overflow-hidden border border-[#e5e5e5] bg-white hover:border-[#171717] hover:shadow-sm transition-all">
        <div className="aspect-[9/16] relative bg-[#f5f5f5]">
          {video.video_url ? (
            <video src={video.video_url} muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-8 h-8 text-[#d4d4d4]" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-black/60 text-white">
            <Play className="w-2.5 h-2.5" /> {video.views_count || 0}
          </div>
        </div>
        <div className="p-2">
          <div className="text-xs font-medium line-clamp-2 h-8 leading-tight text-[#171717]">{video.caption || 'Video'}</div>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 bg-[#171717] text-white">
              {sellerName.charAt(0)}
            </div>
            <span className="text-[10px] truncate text-[#737373]">@{sellerName}</span>
          </div>
          {product && (
            <div className="text-xs font-bold text-[#171717] mt-0.5">{formatPrice(product.price)}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#171717]" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
