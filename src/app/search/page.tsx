'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Search, Camera, ChevronLeft, Store, Sparkles, Video as VideoIcon,
  Star, ShoppingBag, Play, Heart, MessageCircle
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'ai' | 'all' | 'videos';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') || '';

  const [searchInput, setSearchInput] = useState(query);
  const [tab, setTab] = useState<Tab>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [aiProducts, setAiProducts] = useState<Product[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Filter pills state
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const FILTER_PILLS = [
    'Free shipping',
    'Pay on delivery',
    'Bestseller',
    'Under ₦10,000',
    'Under ₦50,000',
    'Verified Seller',
    'Flash Deals',
  ];

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setProducts([]);
      setVideos([]);
      return;
    }
    setLoading(true);
    const result = await api.products.search(q, null);
    if (result.success) {
      setProducts(result.results || result.products || []);
    }
    // Also fetch videos matching the query (use the feed + filter client-side)
    const vidResp = await api.videos.feed(50);
    if (vidResp.success) {
      const q_lower = q.toLowerCase();
      const filtered = (vidResp.videos || []).filter((v: any) =>
        (v.caption || '').toLowerCase().includes(q_lower) ||
        (v.product?.name || '').toLowerCase().includes(q_lower) ||
        (v.seller?.business_name || '').toLowerCase().includes(q_lower)
      );
      setVideos(filtered);
    }
    setLoading(false);
  }, []);

  const doAiSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setAiLoading(true);
    setAiAnswer('');
    setAiProducts([]);

    // Search products first to ground the AI
    const searchResp = await api.products.search(q, null);
    const foundProducts: Product[] = searchResp.success
      ? (searchResp.results || searchResp.products || []).slice(0, 4)
      : [];

    setAiProducts(foundProducts);

    // Call AI chat endpoint for an overview-style answer
    try {
      const aiResp = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `A user searched for "${q}" on Cellex (a Nigerian e-commerce marketplace). Provide a helpful AI Overview answer (like Google's AI Overview) in 2-3 short paragraphs. Mention what types of products are available, price ranges, and any shopping tips. Be concise and friendly. ${
            foundProducts.length > 0
              ? `I found these products: ${foundProducts.map(p => `${p.name} (${formatPrice(p.price)})`).join(', ')}.`
              : 'No specific products were found, so give general shopping advice.'
          }`,
          context: 'Search overview',
          history: [],
        }),
      });
      if (aiResp.ok) {
        const data = await aiResp.json();
        setAiAnswer(data.reply || data.message || data.content || '');
      } else {
        setAiAnswer(`Here's what I found for "${q}": ${foundProducts.length} products available on Cellex. Browse the results below or try refining your search with filters.`);
      }
    } catch {
      setAiAnswer(`Here's what I found for "${q}": ${foundProducts.length} products available on Cellex. Browse the results below or try refining your search with filters.`);
    }
    setAiLoading(false);
  }, []);

  useEffect(() => {
    setSearchInput(query);
    doSearch(query);
  }, [query, doSearch]);

  // When user switches to AI tab, trigger AI search if not done yet
  useEffect(() => {
    if (tab === 'ai' && query && !aiAnswer && !aiLoading) {
      doAiSearch(query);
    }
  }, [tab, query, aiAnswer, aiLoading, doAiSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  // Apply client-side filters
  const filteredProducts = products.filter(p => {
    if (activeFilters.includes('Under ₦10,000') && p.price >= 10000) return false;
    if (activeFilters.includes('Under ₦50,000') && p.price >= 50000) return false;
    if (activeFilters.includes('Bestseller') && (p.units_sold || 0) < 200) return false;
    if (activeFilters.includes('Flash Deals') && (p.units_sold || 0) < 50) return false;
    return true;
  });

  return (
    <div className="bg-white min-h-screen">
      {/* ===== HEADER: Logo + Search bar ===== */}
      <div className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back arrow */}
          <button
            onClick={() => router.back()}
            className="shrink-0 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>

          {/* Logo (hidden on mobile when searching) */}
          <Link href="/" className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center">
              <span className="text-white font-extrabold text-base" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
            </div>
            <span className="text-lg font-extrabold brand-text" style={{ fontFamily: 'var(--font-geist-mono)' }}>Cellex</span>
          </Link>

          {/* Search bar (pre-filled) */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center border-2 border-slate-200 rounded-full px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Cellex..."
              className="flex-1 bg-transparent outline-none text-base text-black placeholder:text-slate-400"
            />
            <button type="submit" className="text-primary hover:text-primary/70 ml-2 shrink-0">
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* ===== TABS ROW: AI mode | All | Videos ===== */}
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-6">
          <button
            onClick={() => setTab('ai')}
            className={`flex items-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ai'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-slate-600 hover:text-black'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI mode
          </button>
          <button
            onClick={() => setTab('all')}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'all'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-slate-600 hover:text-black'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('videos')}
            className={`flex items-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'videos'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-slate-600 hover:text-black'
            }`}
          >
            <VideoIcon className="w-4 h-4" />
            Videos
          </button>
        </div>
      </div>

      {/* ===== FILTER PILLS (only on All + Videos tabs) ===== */}
      {tab !== 'ai' && (
        <div className="border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {FILTER_PILLS.map(pill => (
              <button
                key={pill}
                onClick={() => toggleFilter(pill)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  activeFilters.includes(pill)
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== RESULTS AREA ===== */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Result count */}
        {tab !== 'ai' && !loading && (
          <div className="text-sm text-slate-500 mb-4">
            {tab === 'all'
              ? `About ${filteredProducts.length} results for "${query}"`
              : `About ${videos.length} videos for "${query}"`
            }
          </div>
        )}

        {/* === AI MODE TAB === */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {/* AI Overview card */}
            <Card className="p-4 border-slate-100 bg-gradient-to-br from-cyan-50 to-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm text-black">AI Overview</span>
              </div>
              {aiLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
                </div>
              ) : (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {aiAnswer || 'Searching...'}
                </div>
              )}
            </Card>

            {/* AI-recommended products */}
            {aiProducts.length > 0 && (
              <div>
                <h3 className="font-bold text-sm text-black mb-2">Top products for "{query}"</h3>
                <div className="space-y-3">
                  {aiProducts.map(p => (
                    <GoogleStyleResult key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === ALL TAB (Google-style vertical list) === */}
        {tab === 'all' && (
          <div>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-20 h-20 bg-slate-100 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No products found for "{query}"</p>
                <p className="text-xs text-slate-400 mt-1">Try different keywords or remove filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map(p => (
                  <GoogleStyleResult key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* === VIDEOS TAB === */}
        {tab === 'videos' && (
          <div>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-slate-100 rounded-lg animate-pulse aspect-[9/16]" />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <VideoIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No videos found for "{query}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {videos.map(v => {
                  const seller = v.seller || {};
                  const sellerName = seller.business_name || 'Seller';
                  const product = v.product;
                  return (
                    <Link key={v.id} href="/videos" className="block group">
                      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-shadow">
                        <div className="aspect-[9/16] bg-slate-900 relative">
                          {v.video_url ? (
                            <video src={v.video_url} muted className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-8 h-8 text-white/50" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            ▶ {v.views_count || 0}
                          </div>
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium text-black line-clamp-2 h-8 leading-tight">{v.caption || 'Video'}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-4 h-4 rounded-full brand-gradient flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                              {sellerName.charAt(0)}
                            </div>
                            <span className="text-[10px] text-slate-500 truncate">@{sellerName}</span>
                          </div>
                          {product && (
                            <div className="text-xs font-bold price mt-0.5">{formatPrice(product.price)}</div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Google-style search result (thumbnail left + title/link + price + description + seller) */
function GoogleStyleResult({ product }: { product: Product }) {
  return (
    <Link href={`/product?id=${product.id}`} className="flex gap-3 group">
      {/* Thumbnail */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-slate-50 shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Store className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        {/* Seller "URL" (like Google's green URL) */}
        <div className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">
          <Store className="w-3 h-3" />
          {product.category || 'Cellex'} · Verified Seller
        </div>

        {/* Title (link blue/cyan, like Google) */}
        <h3 className="text-base font-medium text-primary group-hover:underline leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Price (cyan, bold) */}
        <div className="text-lg font-bold price mt-0.5">{formatPrice(product.price)}</div>

        {/* Description (gray, 2 lines) */}
        {product.description && (
          <p className="text-sm text-slate-600 line-clamp-2 mt-0.5 leading-snug">
            {product.description}
          </p>
        )}

        {/* Meta row: sold count + rating */}
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span>{product.units_sold} sold</span>
          )}
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            4.5
          </span>
          <span className="flex items-center gap-0.5 text-green-600">
            <ShoppingBag className="w-3 h-3" /> Pay on delivery
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <SearchContent />
    </Suspense>
  );
}
