'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product, API_BASE } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Search, ChevronLeft, Store, Sparkles, Video as VideoIcon,
  Star, ShoppingBag, Play, Paperclip, Send, ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') || '';

  const [searchInput, setSearchInput] = useState(query);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiProducts, setAiProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showThoughtProcess, setShowThoughtProcess] = useState(false);
  const [chatHistory, setChatHistory] = useState<{user: string; ai: string}[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [view, setView] = useState<'ai' | 'products' | 'videos'>('ai');

  // Ref for the top search bar — dispatches visibility events to GlobalSpotlight
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
    setAiAnswer('');
    setAiProducts([]);
    setAllProducts([]);
    setVideos([]);

    // Search products + videos in parallel with AI
    const [searchResp, vidResp, aiResp] = await Promise.all([
      api.products.search(q, null),
      api.videos.feed(50).catch(() => ({ success: false, videos: [] })),
      fetch(`${API_BASE}/api/ai-chat`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `A user searched for "${q}" on Cellex (a Nigerian e-commerce marketplace). Provide a helpful, comprehensive answer about what's available. Mention types of products, price ranges, and shopping tips. Be friendly and informative (2-3 paragraphs).`,
          context: 'Search overview',
          history: [],
        }),
      }),
    ]);

    const products = searchResp.success
      ? (searchResp.results || searchResp.products || [])
      : [];
    setAllProducts(products);
    setAiProducts(products.slice(0, 4));
    setLoading(false); // Products are ready — show them immediately

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

    // AI response
    if (aiResp.ok) {
      const data = await aiResp.json();
      setAiAnswer(data.reply || data.message || data.content || `Here's what I found for "${q}": ${products.length} products available.`);
    } else {
      setAiAnswer(`Here's what I found for "${q}": ${products.length} products available on Cellex.`);
    }

  }, []);

  useEffect(() => {
    setSearchInput(query);
    doSearch(query);
  }, [query, doSearch]);

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

  return (
    <div className="bg-white/10 min-h-screen">
      {/* Header */}
      <div ref={searchBarRef} className="border-b border-white/10 sticky top-0 z-40 bg-white/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="shrink-0 w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <Link href="/" className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-extrabold text-base" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
            </div>
            <span className="text-lg font-extrabold text-white" style={{ fontFamily: 'var(--font-geist-mono)' }}>Cellex</span>
          </Link>
          <form onSubmit={handleSubmit} className="flex-1 flex items-center border-2 border-white/10 rounded-full px-4 py-2 focus-within:border-white/10 transition-colors">
            <Search className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Cellex..."
              className="flex-1 bg-transparent outline-none text-base text-white placeholder:text-slate-500"
            />
          </form>
        </div>
        {/* View toggle */}
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-1">
          {[
            { key: 'ai', label: 'AI', icon: Sparkles },
            { key: 'products', label: `Products (${allProducts.length})`, icon: ShoppingBag },
            { key: 'videos', label: `Videos (${videos.length})`, icon: VideoIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key as any)}
                className={`flex items-center gap-1.5 py-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
                  view === tab.key
                    ? 'border-white/10 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
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
          <div className="space-y-6 animate-fade-in">
            {/* User query bubble */}
            <div className="flex justify-end animate-slide-up">
              <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                <p className="text-sm">{query}</p>
              </div>
            </div>

            {/* Thought process toggle */}
            <button
              onClick={() => setShowThoughtProcess(!showThoughtProcess)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors animate-fade-in delay-100"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showThoughtProcess ? 'rotate-180' : ''}`} />
              Show thought process
            </button>

            {showThoughtProcess && (
              <div className="text-xs text-slate-500 bg-white/5 rounded-lg p-3 space-y-1 animate-slide-up">
                <p>1. Searched for "{query}" across {allProducts.length} products on Cellex</p>
                <p>2. Found {aiProducts.length} top matches based on relevance</p>
                <p>3. Generated answer using Llama-3.1-8B AI via NVIDIA NIM</p>
              </div>
            )}

            {/* AI response */}
            <div className="flex items-start gap-3 animate-slide-up delay-150">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                {loading ? (
                  <div className="space-y-2">
                    <div className="skeleton h-4 rounded w-full" />
                    <div className="skeleton h-4 rounded w-5/6" />
                    <div className="skeleton h-4 rounded w-4/6" />
                  </div>
                ) : (
                  <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                    {aiAnswer}
                  </div>
                )}
              </div>
            </div>

            {/* Product recommendations */}
            {aiProducts.length > 0 && !loading && (
              <div className="ml-11 animate-slide-up delay-200">
                <div className="inline-block bg-white/5 text-white text-xs font-bold px-2.5 py-1 rounded-md mb-3">
                  {query}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {aiProducts.map((p, i) => (
                    <Link key={p.id} href={`/product?id=${p.id}`} className="block group animate-scale-in" style={{ animationDelay: `${i * 50}ms` }}>
                      <Card className="overflow-hidden border-white/10 hover-lift card-transition">
                        <div className="aspect-square bg-white/5 img-zoom">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <Store className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium text-white line-clamp-1">{p.name}</div>
                          <div className="text-sm font-bold price">{formatPrice(p.price)}</div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up chat */}
            {chatHistory.map((msg, i) => (
              <div key={i} className="space-y-3 animate-fade-in">
                <div className="flex justify-end">
                  <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm">{msg.user}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                    {msg.ai}
                  </div>
                </div>
              </div>
            ))}

            {followUpLoading && (
              <div className="flex items-start gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="loading-dots pt-2">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS VIEW */}
        {view === 'products' && (
          <div className="animate-fade-in">
            <div className="text-sm text-slate-400 mb-4">
              {loading ? 'Loading...' : `${allProducts.length} results for "${query}"`}
            </div>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="skeleton w-24 h-24 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 rounded w-3/4" />
                      <div className="skeleton h-3 rounded w-1/2" />
                      <div className="skeleton h-3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {allProducts.map((p, i) => (
                  <SearchResult key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIDEOS VIEW */}
        {view === 'videos' && (
          <div className="animate-fade-in">
            <div className="text-sm text-slate-400 mb-4">
              {loading ? 'Loading...' : `${videos.length} videos for "${query}"`}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton rounded-lg aspect-[9/16]" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <VideoIcon className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">No videos found</p>
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
      {view === 'ai' && !loading && (
        <div className="fixed left-1/2 -translate-x-1/2 z-40" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)', width: 'calc(100% - 24px)', maxWidth: '446px' }}>
          <div className="glass-input flex items-center gap-2 rounded-full px-4 py-2.5">
            <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFollowUp()}
              placeholder="Ask a follow-up question..."
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-500"
            />
            <button
              onClick={sendFollowUp}
              disabled={!followUpInput.trim() || followUpLoading}
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center disabled:opacity-30 shrink-0 transition-all hover:scale-105"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Google-style search result */
function SearchResult({ product, index }: { product: Product; index: number }) {
  return (
    <Link href={`/product?id=${product.id}`} className="flex gap-3 group animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-white/5 shrink-0 img-zoom">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Store className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-400 flex items-center gap-1 mb-0.5">
          <Store className="w-3 h-3" />
          {product.category || 'Cellex'} · Verified Seller
        </div>
        <h3 className="text-base font-medium text-white group-hover:underline leading-snug line-clamp-2">
          {product.name}
        </h3>
        <div className="text-lg font-bold price mt-0.5">{formatPrice(product.price)}</div>
        {product.description && (
          <p className="text-sm text-slate-400 line-clamp-2 mt-0.5 leading-snug">{product.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span>{product.units_sold} sold</span>
          )}
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> 4.5
          </span>
          <span className="flex items-center gap-0.5 text-green-600">
            <ShoppingBag className="w-3 h-3" /> Pay on delivery
          </span>
        </div>
      </div>
    </Link>
  );
}

/* Video result */
function VideoResult({ video, index }: { video: any; index: number }) {
  const seller = video.seller || {};
  const sellerName = seller.business_name || 'Seller';
  const product = video.product;
  return (
    <Link href="/videos" className="block group animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
      <Card className="overflow-hidden border-white/10 hover-lift card-transition">
        <div className="aspect-[9/16] bg-white/5 relative">
          {video.video_url ? (
            <video src={video.video_url} muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-8 h-8 text-white/50" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Play className="w-2.5 h-2.5" /> {video.views_count || 0}
          </div>
        </div>
        <div className="p-2">
          <div className="text-xs font-medium text-white line-clamp-2 h-8 leading-tight">{video.caption || 'Video'}</div>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
              {sellerName.charAt(0)}
            </div>
            <span className="text-[10px] text-slate-400 truncate">@{sellerName}</span>
          </div>
          {product && (
            <div className="text-xs font-bold price mt-0.5">{formatPrice(product.price)}</div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh] bg-white/10">
        <div className="loading-dots"><span></span><span></span><span></span></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
