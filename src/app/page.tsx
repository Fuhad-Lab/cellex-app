'use client';

import { useEffect, useState } from 'react';
import { api, Product, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Flame, TrendingUp, Store, Radio, Video, Users, Sparkles, ChevronRight,
  Search, Camera, Zap, Tag, Gift, Crown, Heart, ShoppingBag, ChevronDown,
  Bot, Globe, Layers, Headphones, Truck, ShieldCheck, Award, Star
} from 'lucide-react';

export default function HomePage() {
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [homeResp, sellersResp] = await Promise.all([
          api.products.home(),
          api.social.discover(12),
        ]);

        if (homeResp.success) {
          setFlashDeals(homeResp.flashDeals || []);
          setTrending(homeResp.trending || []);
          setNewArrivals(homeResp.newArrivals || []);
        }
        if (sellersResp.success) {
          setSellers(sellersResp.sellers || []);
        }
      } catch (e) {
        console.error('Home load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Combine all products for the Temu-style infinite grid
  const allProducts = [...flashDeals, ...trending, ...newArrivals];

  return (
    <>
      {/* ============================================== */}
      {/* MOBILE LAYOUT (Temu/Pinduoduo style)            */}
      {/* ============================================== */}
      <div className="md:hidden home-mobile-layout">
        <MobileHome
          flashDeals={flashDeals}
          trending={trending}
          newArrivals={newArrivals}
          sellers={sellers}
          allProducts={allProducts}
        />
      </div>

      {/* ============================================== */}
      {/* DESKTOP LAYOUT (Alibaba.com style, rebranded)   */}
      {/* ============================================== */}
      <div className="hidden md:block home-desktop-layout">
        <DesktopHome
          flashDeals={flashDeals}
          trending={trending}
          newArrivals={newArrivals}
          sellers={sellers}
          allProducts={allProducts}
        />
      </div>
    </>
  );
}

/* ============================================================
   MOBILE HOME — Temu/Pinduoduo exact UI rebranded with cyan
   ============================================================ */
function MobileHome({ flashDeals, trending, newArrivals, sellers, allProducts }: {
  flashDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
  sellers: any[];
  allProducts: Product[];
}) {
  const categoryTabs = ['All', 'Phones', 'Food & Grocery', 'General Merchandise', 'Electronics', 'Fashion'];

  // 2x5 grid of category icons (Temu-style)
  const iconCategories = [
    { label: 'Flash Sale', icon: Zap, badge: 'Hot', href: '/categories?sort=flash', color: 'bg-primary' },
    { label: 'Trending', icon: TrendingUp, badge: '50%', href: '/categories?sort=trending', color: 'bg-primary' },
    { label: 'Group Buy', icon: Users, badge: null, href: '/group-buy', color: 'bg-pink-500' },
    { label: 'AI Mode', icon: Sparkles, badge: 'New', href: '/ai-chat', color: 'bg-violet-500' },
    { label: '₦9.9 Deals', icon: Tag, badge: 'Hot', href: '/categories?sort=flash', color: 'bg-primary' },
    { label: 'Live Now', icon: Radio, badge: null, href: '/live', color: 'bg-red-500' },
    { label: 'Top Up', icon: ShoppingBag, badge: null, href: '/categories', color: 'bg-blue-500' },
    { label: 'Save Big', icon: Crown, badge: null, href: '/categories?sort=flash', color: 'bg-primary' },
    { label: 'Coupons', icon: Gift, badge: null, href: '/categories', color: 'bg-orange-500' },
    { label: 'Free Gifts', icon: Heart, badge: null, href: '/categories', color: 'bg-blue-500' },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Search bar — full width */}
      <div className="px-3 pt-3 pb-2 bg-white sticky top-12 z-30">
        <div className="flex items-center bg-slate-100 rounded-full px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search for items you want"
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
            onChange={(e) => {
              if (e.target.value.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(e.target.value.trim())}`;
              }
            }}
          />
          <Link href="/categories">
            <Camera className="w-4 h-4 text-slate-500 ml-2" />
          </Link>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-4 px-3 py-2 overflow-x-auto no-scrollbar bg-white border-b border-slate-100">
        {categoryTabs.map((tab, i) => (
          <Link
            key={tab}
            href={tab === 'All' ? '/categories' : `/categories?category=${tab}`}
            className={`text-sm whitespace-nowrap pb-1 ${
              i === 0
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-slate-600'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {/* Friends / Social bar */}
      <Link href="/seller-profile" className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Friends</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          View friends' activity
          <ChevronRight className="w-3 h-3" />
        </div>
      </Link>

      {/* 2x5 category icon grid (Temu-style) */}
      <div className="grid grid-cols-5 gap-2 px-3 py-3 bg-white">
        {iconCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.label}
              href={cat.href}
              className="flex flex-col items-center gap-1"
            >
              <div className={`w-11 h-11 rounded-full ${cat.color} flex items-center justify-center relative`}>
                <Icon className="w-5 h-5 text-white" />
                {cat.badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0 rounded-full">
                    {cat.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-700 text-center leading-tight">{cat.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Promo strip — orange background like Temu's "Fast-selling products" */}
      <Link href="/categories?sort=flash" className="block mx-3 mb-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-orange-700">🔥 Fast-selling products</div>
            <div className="text-xs text-orange-600">Limited time deals — up to 50% off</div>
          </div>
          <ChevronRight className="w-4 h-4 text-orange-600" />
        </div>
      </Link>

      {/* Product grid — 2-column Temu-style */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-4">
        {allProducts.map((p) => (
          <MobileProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-2 px-3 pb-4">
        <Link href="/videos" className="bg-slate-900 rounded-xl p-2 text-center">
          <Video className="w-4 h-4 text-primary mx-auto mb-0.5" />
          <div className="text-[10px] font-semibold text-white">Videos</div>
        </Link>
        <Link href="/live" className="bg-primary rounded-xl p-2 text-center">
          <Radio className="w-4 h-4 text-white mx-auto mb-0.5" />
          <div className="text-[10px] font-semibold text-white">Live</div>
        </Link>
        <Link href="/group-buy" className="brand-gradient rounded-xl p-2 text-center">
          <Users className="w-4 h-4 text-white mx-auto mb-0.5" />
          <div className="text-[10px] font-semibold text-white">Group Buy</div>
        </Link>
        <Link href="/ai-chat" className="bg-violet-500 rounded-xl p-2 text-center">
          <Sparkles className="w-4 h-4 text-white mx-auto mb-0.5" />
          <div className="text-[10px] font-semibold text-white">AI</div>
        </Link>
      </div>
    </div>
  );
}

/* Temu-style product card (mobile) — image + title + badge + LARGE cyan price + secondary info */
function MobileProductCard({ product }: { product: Product }) {
  const isHot = typeof product.units_sold === 'number' && product.units_sold > 50;
  const isBestseller = typeof product.units_sold === 'number' && product.units_sold > 200;

  return (
    <Link href={`/product?id=${product.id}`} className="bg-white rounded-lg overflow-hidden border border-slate-100">
      {/* Product image */}
      <div className="aspect-square bg-slate-50 relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Store className="w-10 h-10" />
          </div>
        )}
        {isHot && (
          <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Hot
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-2">
        {/* Title */}
        <div className="text-xs font-medium text-slate-800 line-clamp-2 h-8 leading-tight">
          {product.name}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className="bg-green-50 text-green-700 text-[9px] font-bold px-1 py-0.5 rounded border border-green-200">
            Pay on delivery
          </span>
          {isBestseller && (
            <span className="bg-primary text-white text-[9px] font-bold px-1 py-0.5 rounded">
              Bestseller
            </span>
          )}
        </div>

        {/* Price — LARGE cyan */}
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-extrabold price leading-none">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-[10px] text-slate-400">
              {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
            </span>
          )}
        </div>

        {/* Secondary info */}
        {product.category && (
          <div className="text-[10px] text-slate-500 mt-0.5">With Coupon · {product.category}</div>
        )}
      </div>
    </Link>
  );
}

/* ============================================================
   DESKTOP HOME — Alibaba.com style, rebranded with Cellex cyan
   ============================================================ */
function DesktopHome({ flashDeals, trending, newArrivals, sellers, allProducts }: {
  flashDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
  sellers: any[];
  allProducts: Product[];
}) {
  return (
    <div className="bg-white min-h-screen">
      {/* Top thin row — small links (Alibaba-style) */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <Link href="/categories" className="hover:text-primary flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> All categories
            </Link>
            <Link href="/sellers" className="hover:text-primary">Featured sellers</Link>
            <Link href="/orders" className="hover:text-primary">Order protection</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="hover:text-primary">Buyer Central</Link>
            <Link href="/telegram" className="hover:text-primary">Help Center</Link>
            <Link href="/seller" className="hover:text-primary flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Sell on Cellex
            </Link>
          </div>
        </div>
      </div>

      {/* Logo + Big search bar */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center glow">
            <span className="text-white font-extrabold text-xl" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
          </div>
          <span className="text-2xl font-extrabold brand-text" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Cellex
          </span>
        </Link>

        {/* Big search bar — Alibaba style */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).querySelector('input');
            if (input?.value.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(input.value.trim())}`;
            }
          }}
          className="flex-1 max-w-3xl flex items-center border-2 border-primary rounded-full overflow-hidden"
        >
          <Link href="/categories" className="px-3 py-2.5 text-slate-500 hover:text-primary border-r border-slate-200 flex items-center gap-1">
            <Camera className="w-4 h-4" />
            <span className="text-xs">Image</span>
          </Link>
          <input
            type="text"
            placeholder="What are you looking for?"
            className="flex-1 px-4 py-2.5 outline-none text-base"
          />
          <button
            type="submit"
            className="brand-gradient text-white font-bold px-8 py-2.5 flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>

        <Link href="/cart" className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary">
          <ShoppingBag className="w-5 h-5" />
          <span>Cart</span>
        </Link>
      </div>

      {/* Tabs row — AI Mode | Products | Sellers | Live */}
      <div className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
          <Link href="/ai-chat" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
            <Sparkles className="w-4 h-4" /> AI Mode
          </Link>
          <Link href="/categories" className="flex items-center gap-1.5 py-3 text-sm font-bold text-primary border-b-2 border-primary">
            Products
          </Link>
          <Link href="/sellers" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
            <Store className="w-4 h-4" /> Sellers
          </Link>
          <Link href="/live" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
            <Radio className="w-4 h-4" /> Live
          </Link>
          <Link href="/videos" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
            <Video className="w-4 h-4" /> Videos
          </Link>
        </div>
      </div>

      {/* Welcome row + 3 circular CTAs */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-slate-900">Welcome to Cellex</h2>
        <div className="flex items-center gap-6">
          <Link href="/cart" className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-slate-700 font-semibold">Quick order</span>
          </Link>
          <Link href="/sellers" className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-slate-700 font-semibold">Top Ranking</span>
          </Link>
          <Link href="/seller" className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-slate-700 font-semibold">Fast delivery</span>
          </Link>
        </div>
      </div>

      {/* Main grid — left sidebar (categories) + right content */}
      <div className="max-w-7xl mx-auto px-6 pb-8 flex gap-6">
        {/* Left sidebar — category list */}
        <aside className="w-56 shrink-0">
          <Card className="p-3 border-slate-100">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2 px-2">Categories</div>
            {[
              { label: 'Electronics', icon: '📱' },
              { label: 'Fashion', icon: '👗' },
              { label: 'Home & Kitchen', icon: '🏠' },
              { label: 'Beauty', icon: '💄' },
              { label: 'Farm Fresh', icon: '🌱' },
              { label: 'Sports', icon: '⚽' },
              { label: 'Books', icon: '📚' },
              { label: 'Food', icon: '🍲' },
              { label: 'Toys', icon: '🧸' },
            ].map((c) => (
              <Link
                key={c.label}
                href={`/categories?category=${c.label.split(' ')[0]}`}
                className="flex items-center justify-between px-2 py-2 rounded hover:bg-slate-50 text-sm text-slate-700 hover:text-primary"
              >
                <span className="flex items-center gap-2">
                  <span>{c.icon}</span>
                  {c.label}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </Link>
            ))}
          </Card>

          {/* Promo card */}
          <Link href="/group-buy" className="block mt-3">
            <Card className="p-4 brand-gradient border-0 text-white">
              <Users className="w-6 h-6 mb-2" />
              <div className="font-bold text-sm">Group Buys</div>
              <div className="text-xs opacity-90 mt-0.5">Up to 20% off</div>
            </Card>
          </Link>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Hero strip */}
          <div className="brand-gradient rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10 max-w-md">
              <h3 className="text-xl font-extrabold mb-1">Nigeria's #1 social marketplace</h3>
              <p className="text-sm text-white/85 mb-3">Shop from local sellers, watch live shopping, join group buys.</p>
              <div className="flex gap-2">
                <Link href="/categories">
                  <Button variant="secondary" size="sm">Start shopping</Button>
                </Link>
                <Link href="/ai-chat">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Sparkles className="w-4 h-4 mr-1" /> AI Shopping
                  </Button>
                </Link>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          </div>

          {/* 4-column category cards (Alibaba-style) */}
          <div className="grid grid-cols-4 gap-3">
            <CategoryCard
              title="Categories for you"
              icon={Layers}
              href="/categories"
              accent="bg-primary/10 text-primary"
            />
            <CategoryCard
              title="Smart Watches"
              icon={Zap}
              href="/categories?category=Electronics"
              accent="bg-orange-100 text-orange-600"
            />
            <CategoryCard
              title="Fashion picks"
              icon={Crown}
              href="/categories?category=Fashion"
              accent="bg-pink-100 text-pink-600"
            />
            <CategoryCard
              title="Fast-selling"
              icon={Flame}
              href="/categories?sort=flash"
              accent="bg-orange-100 text-orange-700"
              highlighted
            />
          </div>

          {/* Flash deals */}
          {flashDeals.length > 0 && (
            <Section title="Flash Deals" icon={<Flame className="w-5 h-5 text-primary" />} href="/categories?sort=flash">
              <DesktopProductRow products={flashDeals} />
            </Section>
          )}

          {/* Trending */}
          {trending.length > 0 && (
            <Section title="Trending Now" icon={<TrendingUp className="w-5 h-5 text-primary" />} href="/categories?sort=trending">
              <DesktopProductRow products={trending} />
            </Section>
          )}

          {/* Top sellers (horizontal) */}
          {sellers.length > 0 && (
            <Section title="Meet the Top Sellers" icon={<Store className="w-5 h-5 text-primary" />} href="/sellers">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {sellers.slice(0, 4).map((seller) => {
                  const sellerProducts = allProducts.filter(p => p.seller_id === seller.id).slice(0, 4);
                  const name = seller.business_name || seller.farm_name || 'Unnamed store';
                  const initial = name.charAt(0).toUpperCase();
                  return (
                    <Card key={seller.id} className="p-3 border-slate-100 shadow-sm shrink-0 w-64">
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        {sellerProducts.length > 0 ? sellerProducts.map((p) => (
                          <Link key={p.id} href={`/product?id=${p.id}`}>
                            <div className="aspect-square rounded-md overflow-hidden bg-slate-50">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Store className="w-8 h-8 m-auto mt-4 text-slate-300" />
                              )}
                            </div>
                          </Link>
                        )) : Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="aspect-square rounded-md bg-slate-50" />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/seller-profile?id=${seller.id}`} className="shrink-0">
                          {seller.profile_image ? (
                            <img src={seller.profile_image} className="w-8 h-8 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs">
                              {initial}
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/seller-profile?id=${seller.id}`} className="font-bold text-xs text-slate-900 hover:text-primary truncate block">
                            {name}
                          </Link>
                          <div className="text-[10px] text-slate-500">
                            {seller.followers || 0} followers
                          </div>
                        </div>
                        <Link href={`/seller-profile?id=${seller.id}`}>
                          <Button size="sm" className="h-7 text-xs">Shop</Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
                <Link
                  href="/sellers"
                  className="shrink-0 w-28 flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold mb-1.5">→</div>
                  <div className="text-xs font-bold text-slate-700 text-center">See all<br/>sellers</div>
                </Link>
              </div>
            </Section>
          )}

          {/* New arrivals grid (4-col) */}
          {newArrivals.length > 0 && (
            <Section title="New Arrivals" icon={<Sparkles className="w-5 h-5 text-primary" />} href="/categories?sort=newest">
              <div className="grid grid-cols-4 gap-3">
                {newArrivals.slice(0, 8).map((p) => (
                  <Link key={p.id} href={`/product?id=${p.id}`} className="block group">
                    <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="aspect-square bg-slate-50">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Store className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-sm font-medium text-slate-700 line-clamp-2 h-10 leading-tight">{p.name}</div>
                        <div className="text-lg font-bold price mt-1">{formatPrice(p.price)}</div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-4 gap-3 pt-4">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <ShieldCheck className="w-6 h-6 mx-auto text-primary mb-1" />
              <div className="text-xs font-semibold text-slate-700">Buyer Protection</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Truck className="w-6 h-6 mx-auto text-primary mb-1" />
              <div className="text-xs font-semibold text-slate-700">Fast Delivery</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Award className="w-6 h-6 mx-auto text-primary mb-1" />
              <div className="text-xs font-semibold text-slate-700">Verified Sellers</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Headphones className="w-6 h-6 mx-auto text-primary mb-1" />
              <div className="text-xs font-semibold text-slate-700">24/7 Support</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ title, icon: Icon, href, accent, highlighted }: {
  title: string;
  icon: any;
  href: string;
  accent: string;
  highlighted?: boolean;
}) {
  return (
    <Link href={href} className={`block rounded-xl p-4 border ${highlighted ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'} hover:shadow-md transition-shadow`}>
      <div className={`w-10 h-10 rounded-full ${accent} flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className={`font-bold text-sm ${highlighted ? 'text-orange-700' : 'text-slate-900'}`}>{title}</div>
      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
        Browse <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

function Section({ title, icon, href, children }: { title: string; icon: React.ReactNode; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="text-sm font-semibold text-primary hover:underline flex items-center">
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function DesktopProductRow({ products }: { products: Product[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      {products.map((p) => (
        <Link key={p.id} href={`/product?id=${p.id}`} className="shrink-0 w-44 group">
          <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-square bg-slate-50">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Store className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="text-sm font-medium text-slate-700 line-clamp-2 h-10 leading-tight">{p.name}</div>
              <div className="text-lg font-bold price mt-1">{formatPrice(p.price)}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
