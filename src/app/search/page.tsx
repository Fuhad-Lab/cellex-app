'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product, API_BASE } from '@/lib/api';
import { Search, ChevronLeft, Store, Sparkles, Video as VideoIcon,
  Star, ShoppingBag, Play, Send, Loader2, TrendingUp, Filter } from 'lucide-react';
import Link from 'next/link';
import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') || '';

  // Persisted state — survives navigation away and back.
  const [searchInput, setSearchInput] = usePersistedState<string>('search:input', query);
  const [aiAnswer, setAiAnswer] = usePersistedState<string>('search:aiAnswer', '');
  const [aiProducts, setAiProducts] = usePersistedState<Product[]>('search:aiProducts', []);
  const [allProducts, setAllProducts] = usePersistedState<Product[]>('search:allProducts', []);
  const [videos, setVideos] = usePersistedState<any[]>('search:videos', []);
  const [chatHistory, setChatHistory] = usePersistedState<{user: string; ai: string}[]>('search:chatHistory', []);
  const [view, setView] = usePersistedState<'ai' | 'products' | 'videos'>('search:view', 'ai');
  const [hasSearched, setHasSearched] = usePersistedState<string>('search:lastQuery', '');

  // Transient state.
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

    // Call smart search (AI-powered semantic search via edge function).
    const [searchResp, vidResp] = await Promise.all([
      api.smartSearch(q, 30),
      api.videos.feed(50).catch(() => ({ success: false, videos: [] })),
    ]);

    const products = searchResp.success
      ? (searchResp.products || searchResp.results || [])
      : [];
    setAllProducts(products);
    setAiProducts(products.slice(0, 4));
    setLoading(false);
    setHasSearched(q);

    // Filter videos
    if (vidResp.success) {
      const qLower = q.toLowerCase();
      const filtered = (vidResp.videos || []).filter((v: any) =>
        (v.caption || '').toLowerCase().includes(qLower) ||
        (v.product?.name || '').toLowerCase().includes(qLower) ||
        (v.seller?.business_name || '').toLowerCase().includes(qLower)
      );
      setVideos(filtered);
    }

    // AI response — call through /api/ai-chat (which proxies to edge function).
    try {
      const aiResp = await fetch(`${API_BASE}/api/ai-chat`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `A user searched for "${q}" on Cellex (a Nigerian e-commerce marketplace). Provide a helpful, comprehensive answer about what's available. Mention types of products, price ranges, and shopping tips. Be friendly and informative (2-3 paragraphs).`,
          context: 'Search overview',
          history: [],
        }),
      });
      if (aiResp.ok) {
        const data = await aiResp.json();
        setAiAnswer(data.reply || data.message || data.content || `Here's what I found for "${q}": ${products.length} products available.`);
      } else {
        setAiAnswer(`Here's what I found for "${q}": ${products.length} products available on Cellex.`);
      }
    } catch {
      setAiAnswer(`Here's what I found for "${q}": ${products.length} products available on Cellex.`);
    }
    setAiLoading(false);
  }, []);

  useEffect(() => {
    // Only search if the query is different from the last search.
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
      default: return 0; // relevance — keep original order
    }
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header — light theme, clean, premium */}
      <div ref={searchBarRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F5F5F5] text-[#111827]"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#111827]">
              <span className="font-extrabold text-base text-white" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
            </div>
            <span className="text-lg font-extrabold text-[#111827]" style={{ fontFamily: 'var(--font-geist-mono)' }}>Cellex</span>
          </Link>
          <form onSubmit={handleSubmit} className="flex-1 flex items-center rounded-full px-4 py-2 bg-[#F5F5F5] border-2 border-transparent focus-within:border-[#D4AF37] focus-within:bg-white transition-all">
            <Search className="w-4 h-4 mr-2 shrink-0 text-[#666666]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Cellex..."
              className="flex-1 bg-transparent outline-none text-base text-[#111827] placeholder:text-[#999999]"
            />
            {searchInput && (
              <button
                type="submit"
                className="ml-2 px-3 py-1 rounded-full bg-[#D4AF37] text-white text-xs font-semibold hover:bg-[#C4A030] transition-colors"
              >
                Search
              </button>
            )}
          </form>
        </div>
        {/* View toggle — pill style */}
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-1">
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
                className={`flex items-center gap-1.5 py-2.5 px-3 text-sm font-medium border-b-2 transition-all ${
                  isActive ? 'font-bold' : ''
                }`}
                style={{
                  borderColor: isActive ? '#D4AF37' : 'transparent',
                  color: isActive ? '#111827' : '#666666',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-32">
        {/* AI VIEW */}
        {view === 'ai' && (
          <div className="space-y-6">
            {/* User query bubble */}
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] bg-[#D4AF37] text-white">
                <p className="text-sm font-medium">{query}</p>
              </div>
            </div>

            {/* AI response */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[#D4AF37] to-[#C4A030] shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 bg-[#F9F9F9] rounded-2xl rounded-tl-md p-4 border border-[#EEEEEE]">
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#666666] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI is thinking...
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <div className="h-3 bg-[#E5E5E5] rounded animate-pulse w-full" />
                      <div className="h-3 bg-[#E5E5E5] rounded animate-pulse w-5/6" />
                      <div className="h-3 bg-[#E5E5E5] rounded animate-pulse w-4/6" />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">
                    {aiAnswer}
                  </div>
                )}
              </div>
            </div>

            {/* Product recommendations */}
            {aiProducts.length > 0 && !aiLoading && (
              <div className="ml-12">
                <div className="flex items-center gap-2 mb-3">
                  <div className="inline-block text-xs font-bold px-2.5 py-1 rounded-md bg-[#111827] text-white">
                    Top picks for "{query}"
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {aiProducts.map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/product?id=${p.id}`}
                      className="block group"
                    >
                      <div className="rounded-xl overflow-hidden border border-[#E5E5E5] bg-white hover:shadow-lg hover:border-[#D4AF37] transition-all duration-200">
                        <div className="aspect-square bg-[#F5F5F5] overflow-hidden">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#999999]">
                              <Store className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <div className="text-xs font-medium line-clamp-1 text-[#111827]">{p.name}</div>
                          <div className="text-sm font-bold text-[#D4AF37] mt-0.5">{formatPrice(p.price)}</div>
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
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] bg-[#D4AF37] text-white">
                    <p className="text-sm">{msg.user}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[#D4AF37] to-[#C4A030]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-[#F9F9F9] rounded-2xl rounded-tl-md p-4 border border-[#EEEEEE]">
                    <div className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">
                      {msg.ai}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {followUpLoading && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[#D4AF37] to-[#C4A030]">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-1 pt-3">
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS VIEW */}
        {view === 'products' && (
          <div>
            {/* Sort bar */}
            {!loading && allProducts.length > 0 && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5E5E5]">
                <div className="text-sm text-[#666666]">
                  <span className="font-bold text-[#111827]">{allProducts.length}</span> results for "{query}"
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-[#666666]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs font-medium bg-transparent border-0 outline-none cursor-pointer text-[#111827]"
                  >
                    <option value="relevance">Most Relevant</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="popular">Most Popular</option>
                  </select>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-24 h-24 rounded-lg bg-[#E5E5E5] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[#E5E5E5] rounded w-3/4" />
                      <div className="h-3 bg-[#E5E5E5] rounded w-1/2" />
                      <div className="h-3 bg-[#E5E5E5] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-12 h-12 mx-auto mb-3 text-[#CCCCCC]" />
                <p className="text-sm font-medium text-[#666666]">No products found for "{query}"</p>
                <p className="text-xs text-[#999999] mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedProducts.map((p, i) => (
                  <SearchResult key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIDEOS VIEW */}
        {view === 'videos' && (
          <div>
            <div className="text-sm mb-4 text-[#666666]">
              {loading ? '' : `${videos.length} videos for "${query}"`}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg bg-[#E5E5E5] aspect-[9/16] animate-pulse" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <VideoIcon className="w-12 h-12 mx-auto mb-3 text-[#CCCCCC]" />
                <p className="text-sm text-[#666666]">No videos found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {videos.map((v, i) => (
                  <VideoResult key={v.id} video={v} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Follow-up input (floating above bottom nav, AI view only) */}
      {view === 'ai' && !aiLoading && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)', width: 'calc(100% - 24px)', maxWidth: '446px' }}
        >
          <div className="flex items-center gap-2 rounded-full px-4 py-2.5 bg-white border-2 border-[#E5E5E5] focus-within:border-[#D4AF37] shadow-lg transition-all">
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFollowUp()}
              placeholder="Ask a follow-up question..."
              className="flex-1 bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#999999]"
            />
            <button
              onClick={sendFollowUp}
              disabled={!followUpInput.trim() || followUpLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 shrink-0 bg-[#D4AF37] hover:bg-[#C4A030] transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Premium search result card */
function SearchResult({ product, index }: { product: Product; index: number }) {
  return (
    <Link
      href={`/product?id=${product.id}`}
      className="flex gap-3 group"
    >
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-[#F5F5F5]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#999999]">
            <Store className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs flex items-center gap-1 mb-0.5 text-[#666666]">
          <Store className="w-3 h-3" />
          {product.category || 'Cellex'}
          <span className="text-[#D4AF37] font-medium ml-1">· Verified</span>
        </div>
        <h3 className="text-base font-medium text-[#111827] group-hover:text-[#D4AF37] transition-colors leading-snug line-clamp-2">
          {product.name}
        </h3>
        <div className="text-lg font-bold text-[#D4AF37] mt-0.5">{formatPrice(product.price)}</div>
        {product.description && (
          <p className="text-sm line-clamp-2 mt-0.5 leading-snug text-[#666666]">{product.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-[#666666]">
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> {product.units_sold} sold
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]" /> 4.5
          </span>
          <span className="flex items-center gap-0.5 text-green-600">
            <ShoppingBag className="w-3 h-3" /> Pay on delivery
          </span>
        </div>
      </div>
    </Link>
  );
}

/* Video result card */
function VideoResult({ video, index }: { video: any; index: number }) {
  const seller = video.seller || {};
  const sellerName = seller.business_name || 'Seller';
  const product = video.product;
  return (
    <Link href="/videos" className="block group">
      <div className="rounded-xl overflow-hidden border border-[#E5E5E5] bg-white hover:shadow-lg hover:border-[#D4AF37] transition-all duration-200">
        <div className="aspect-[9/16] relative bg-[#F5F5F5]">
          {video.video_url ? (
            <video src={video.video_url} muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-8 h-8 text-[#CCCCCC]" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-black/60 text-white">
            <Play className="w-2.5 h-2.5" /> {video.views_count || 0}
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-xs font-medium line-clamp-2 h-8 leading-tight text-[#111827]">{video.caption || 'Video'}</div>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 bg-[#D4AF37] text-white">
              {sellerName.charAt(0)}
            </div>
            <span className="text-[10px] truncate text-[#666666]">@{sellerName}</span>
          </div>
          {product && (
            <div className="text-xs font-bold text-[#D4AF37] mt-0.5">{formatPrice(product.price)}</div>
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
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
