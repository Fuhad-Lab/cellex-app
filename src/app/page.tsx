'use client';

import { useEffect, useState } from 'react';
import { api, Product, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Flame, TrendingUp, Store, Radio, Video, Users, Sparkles, ChevronRight,
  Search, Camera, Zap, Tag, Gift, Crown, Heart, ShoppingBag,
  Layers, Headphones, Truck, ShieldCheck, Award, Star, Bot
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

  const allProducts = [...flashDeals, ...trending, ...newArrivals];

  return (
    <>
      {/* MOBILE LAYOUT (Temu/Pinduoduo style) */}
      <div className="md:hidden home-mobile-layout">
        <MobileHome
          flashDeals={flashDeals}
          trending={trending}
          newArrivals={newArrivals}
          sellers={sellers}
          allProducts={allProducts}
        />
      </div>

      {/* DESKTOP LAYOUT (Alibaba.com minimal style, rebranded) */}
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
   MOBILE HOME — Temu/Pinduoduo exact UI + AI banner + sellers
   ============================================================ */
function MobileHome({ flashDeals, trending, newArrivals, sellers, allProducts }: {
  flashDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
  sellers: any[];
  allProducts: Product[];
}) {
  const categoryTabs = ['All', 'Phones', 'Food & Grocery', 'General Merchandise', 'Electronics', 'Fashion'];

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

      {/* AI Assistant banner — prominent */}
      <Link href="/ai-chat" className="block mx-3 mb-2">
        <div className="bg-gradient-to-r from-violet-500 to-primary rounded-xl p-3 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">AI Shopping Assistant</div>
            <div className="text-xs text-white/85">Chat with Qwen2.5-72B to find products</div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </div>
      </Link>

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
      <Link href="/sellers" className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100">
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

      {/* 2x5 category icon grid */}
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

      {/* Promo strip */}
      <Link href="/categories?sort=flash" className="block mx-3 mb-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-orange-700">🔥 Fast-selling products</div>
            <div className="text-xs text-orange-600">Limited time deals — up to 50% off</div>
          </div>
          <ChevronRight className="w-4 h-4 text-orange-600" />
        </div>
      </Link>

      {/* Top Sellers — horizontal scroll (RESTORED) */}
      {sellers.length > 0 && (
        <div className="px-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900">Top Sellers</h2>
            <Link href="/sellers" className="text-xs font-semibold text-primary flex items-center">
              See all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {sellers.slice(0, 6).map((seller) => {
              const name = seller.business_name || seller.farm_name || 'Unnamed store';
              const initial = name.charAt(0).toUpperCase();
              const sellerProducts = allProducts.filter(p => p.seller_id === seller.id).slice(0, 1);
              return (
                <Link
                  key={seller.id}
                  href={`/seller-profile?id=${seller.id}`}
                  className="shrink-0 w-32 bg-white rounded-lg border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-slate-50">
                    {sellerProducts[0]?.image_url ? (
                      <img src={sellerProducts[0].image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Store className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <div className="flex items-center gap-1">
                      {seller.profile_image ? (
                        <img src={seller.profile_image} className="w-5 h-5 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-5 h-5 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-[9px]">
                          {initial}
                        </div>
                      )}
                      <span className="font-bold text-[11px] text-slate-900 truncate">{name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{seller.followers || 0} followers</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

function MobileProductCard({ product }: { product: Product }) {
  const isHot = typeof product.units_sold === 'number' && product.units_sold > 50;
  const isBestseller = typeof product.units_sold === 'number' && product.units_sold > 200;

  return (
    <Link href={`/product?id=${product.id}`} className="bg-white rounded-lg overflow-hidden border border-slate-100">
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
      <div className="p-2">
        <div className="text-xs font-medium text-slate-800 line-clamp-2 h-8 leading-tight">
          {product.name}
        </div>
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
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-extrabold price leading-none">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-[10px] text-slate-400">
              {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
            </span>
          )}
        </div>
        {product.category && (
          <div className="text-[10px] text-slate-500 mt-0.5">With Coupon · {product.category}</div>
        )}
      </div>
    </Link>
  );
}

/* ============================================================
   DESKTOP HOME — Alibaba.com MINIMAL style (matches reference)
   Only: top row → logo+search → tabs → welcome+CTAs → 4-col category grid
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
      {/* 1. Top thin row — small links */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <Link href="/categories" className="hover:text-primary flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> All categories
            </Link>
            <Link href="/sellers" className="hover:text-primary">Featured selections</Link>
            <Link href="/orders" className="hover:text-primary">Order protections</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="hover:text-primary">Buyer Central</Link>
            <Link href="/telegram" className="hover:text-primary">Help Center</Link>
            <Link href="/link-account" className="hover:text-primary">App & WhatsApp</Link>
            <Link href="/seller" className="hover:text-primary flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Sell on Cellex
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Logo + big centered search bar */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center glow">
            <span className="text-white font-extrabold text-xl" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
          </div>
          <span className="text-2xl font-extrabold brand-text" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Cellex
          </span>
        </Link>

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

      {/* 3. Tabs row */}
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
            <Video className="w-4 h-4" /> Worldwide
          </Link>
        </div>
      </div>

      {/* 4. Welcome row + 3 circular CTAs (matches reference exactly) */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-slate-900">Welcome to Cellex</h2>
        <div className="flex items-center gap-8">
          <Link href="/cart" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <ShoppingBag className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Quick order</span>
          </Link>
          <Link href="/sellers" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <Crown className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Top Ranking</span>
          </Link>
          <Link href="/seller" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <Truck className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Fast delivery</span>
          </Link>
        </div>
      </div>

      {/* 5. 4-column category grid (matches reference exactly) */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-4 gap-3">
          <CategoryCard
            title="Categories for you"
            subtitle="Browse all categories"
            icon={Layers}
            href="/categories"
          />
          <CategoryCard
            title="Smart Watches"
            subtitle="Frequently viewed"
            icon={Zap}
            href="/categories?category=Electronics"
          />
          <CategoryCard
            title="Fashion picks"
            subtitle="Frequently viewed"
            icon={Crown}
            href="/categories?category=Fashion"
          />
          <CategoryCard
            title="Fast-selling products"
            subtitle="Trending now"
            icon={Flame}
            href="/categories?sort=flash"
            highlighted
          />
        </div>
      </div>
    </div>
  );
}

/* 4-column category card (matches reference) */
function CategoryCard({ title, subtitle, icon: Icon, href, highlighted }: {
  title: string;
  subtitle?: string;
  icon: any;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl p-5 border ${
        highlighted ? 'bg-orange-50 border-orange-200 hover:border-orange-400' : 'bg-white border-slate-100 hover:border-primary hover:shadow-md'
      } transition-all`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
        highlighted ? 'bg-orange-100' : 'bg-primary/10'
      }`}>
        <Icon className={`w-5 h-5 ${highlighted ? 'text-orange-600' : 'text-primary'}`} />
      </div>
      <div className={`font-bold text-base ${highlighted ? 'text-orange-700' : 'text-slate-900'}`}>
        {title}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      )}
      <div className="flex items-center gap-1 text-xs font-semibold mt-2 text-slate-600">
        Browse <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
}
