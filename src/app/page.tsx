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
  Layers, Headphones, Truck, ShieldCheck, Award, Star, Bot, ChevronDown,
  MessageCircle, HelpCircle, Image as ImageIcon, Check
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
      {/* MOBILE LAYOUT */}
      <div className="md:hidden home-mobile-layout">
        <MobileHome
          flashDeals={flashDeals}
          trending={trending}
          newArrivals={newArrivals}
          sellers={sellers}
          allProducts={allProducts}
        />
      </div>

      {/* DESKTOP LAYOUT — Alibaba.com exact structure, rebranded to Cellex */}
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
   MOBILE HOME — Temu/Pinduoduo UI + AI banner + sellers
   ============================================================ */
function MobileHome({ flashDeals, trending, newArrivals, sellers, allProducts }: {
  flashDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
  sellers: any[];
  allProducts: Product[];
}) {
  const categoryTabs = [
    { label: 'All', href: '/' },
    { label: 'Electronics', href: '/categories?category=Electronics' },
    { label: 'Fashion', href: '/categories?category=Fashion' },
    { label: 'Home', href: '/categories?category=Home' },
    { label: 'Beauty', href: '/categories?category=Beauty' },
    { label: 'Farm', href: '/categories?category=Farm' },
    { label: 'Sports', href: '/categories?category=Sports' },
    { label: 'Food', href: '/categories?category=Food' },
    { label: 'Toys', href: '/categories?category=Toys' },
    { label: 'Books', href: '/categories?category=Books' },
  ];

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
      {/* Spotlight search trigger — taps open the glassmorphic spotlight */}
      <div className="px-3 pt-3 pb-2 bg-white sticky top-0 z-30">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
          className="w-full flex items-center bg-neutral-100 rounded-full px-4 py-2.5 hover:bg-neutral-200 transition-colors group"
        >
          <Search className="w-4 h-4 text-neutral-400 mr-2 group-hover:text-black transition-colors" />
          <span className="flex-1 text-left text-sm text-neutral-400 group-hover:text-black transition-colors">
            Search products, categories...
          </span>
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white rounded text-[9px] font-bold text-neutral-400 border border-neutral-200">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* AI Assistant banner */}
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
            key={tab.label}
            href={tab.href}
            className={`text-sm whitespace-nowrap pb-1 ${
              i === 0
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-black'
            }`}
          >
            {tab.label}
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

      {/* Top Sellers — horizontal scroll */}
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

      {/* Product grid — 2-column */}
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
   DESKTOP HOME — Alibaba.com EXACT structure, rebranded to Cellex
   Reference HTML: Pasted Content_1783816379023.txt
   ============================================================ */
function DesktopHome({ flashDeals, trending, newArrivals, sellers, allProducts }: {
  flashDeals: Product[];
  trending: Product[];
  newArrivals: Product[];
  sellers: any[];
  allProducts: Product[];
}) {
  return (
    <div className="bg-white min-h-screen pb-12">
      {/* ===== 1. Top nav row: logo + small links ===== */}
      <div className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
          {/* Logo left */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center glow">
              <span className="text-white font-extrabold text-lg" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
            </div>
            <span className="text-xl font-extrabold brand-text" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Cellex.com
            </span>
          </Link>

          {/* Small links */}
          <div className="flex items-center gap-5 text-sm text-slate-600">
            <Link href="/categories" className="hover:text-primary flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> All categories
            </Link>
            <Link href="/sellers" className="hover:text-primary">Featured selections</Link>
            <Link href="/orders" className="hover:text-primary">Order protections</Link>
            <span className="text-slate-200">|</span>
            <Link href="/profile" className="hover:text-primary">Buyer Central</Link>
            <Link href="/telegram" className="hover:text-primary">Help Center</Link>
            <Link href="/link-account" className="hover:text-primary">App & extension</Link>
            <Link href="/seller" className="hover:text-primary flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Sell on Cellex
            </Link>
          </div>
        </div>
      </div>

      {/* ===== 2. Tabs row (AI Mode | Products | Manufacturers | Worldwide) — ABOVE search ===== */}
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-2">
        <nav className="flex items-center gap-5" aria-label="Search tabs">
          <Link href="/ai-chat" className="flex items-center gap-1.5 text-base font-semibold text-slate-800 hover:text-primary group">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI Mode</span>
          </Link>
          <span className="w-px h-5 bg-slate-200" />
          <Link href="/categories" className="text-base font-bold text-primary border-b-2 border-primary pb-1">
            Products
          </Link>
          <Link href="/sellers" className="text-base font-semibold text-slate-800 hover:text-primary">
            Manufacturers
          </Link>
          <Link href="/live" className="text-base font-semibold text-slate-800 hover:text-primary">
            Worldwide
          </Link>
        </nav>
      </div>

      {/* ===== 3. Big centered search bar (cyan border, Image Search left, cyan Search button right) ===== */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).querySelector('input');
            if (input?.value.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(input.value.trim())}`;
            }
          }}
          className="max-w-4xl mx-auto flex items-center border-2 border-primary rounded-full overflow-hidden bg-white"
        >
          <Link href="/categories" className="px-4 py-3 text-slate-600 hover:text-primary border-r border-slate-200 flex items-center gap-1.5 shrink-0">
            <Camera className="w-4 h-4" />
            <span className="text-sm">Image Search</span>
          </Link>
          <input
            type="text"
            placeholder="What are you looking for?"
            className="flex-1 px-4 py-3 outline-none text-base"
          />
          <button
            type="submit"
            className="brand-gradient text-white font-bold px-8 py-3 flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {/* ===== 4. "Connect with verified manufacturers" strip with 3 checkmark features ===== */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            Connect with verified
            <span className="brand-text text-lg">manufacturers</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-3 h-3 text-primary" />
              </div>
              5K+ industries covered
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-3 h-3 text-primary" />
              </div>
              Factory-direct pricing
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-3 h-3 text-primary" />
              </div>
              Sample & customization
            </span>
          </div>
        </div>
      </div>

      {/* ===== 5. Welcome row (heading left, 3 CTAs right with circular icons) ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-slate-900">Welcome to Cellex</h2>
        <div className="flex items-center gap-8">
          <Link href="/cart" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <ShoppingBag className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Request for Quotation</span>
          </Link>
          <Link href="/sellers" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <Crown className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Top Ranking</span>
          </Link>
          <Link href="/seller" className="flex flex-col items-center gap-1.5 group">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10">
              <Zap className="w-5 h-5 text-slate-700 group-hover:text-primary" />
            </div>
            <span className="text-xs text-slate-600">Fast customize</span>
          </Link>
        </div>
      </div>

      {/* ===== 6. 4-column category cards with LIST items + right arrows ===== */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-4 gap-3">
          {/* Card 1: Categories for you */}
          <CategoryListCard
            title="Categories for you"
            icon={Layers}
            items={[
              { label: 'Apparel & Accessories', href: '/categories?category=Fashion' },
              { label: 'Electronics & Phones', href: '/categories?category=Electronics' },
              { label: 'Home & Kitchen', href: '/categories?category=Home' },
            ]}
          />

          {/* Card 2: Frequently searched — Smart Watches */}
          <CategoryListCard
            title="Frequently searched"
            icon={Zap}
            items={[
              { label: 'Smart Watches', href: '/categories?category=Electronics' },
              { label: 'Wireless Earbuds', href: '/categories?category=Electronics' },
              { label: 'Phone Accessories', href: '/categories?category=Electronics' },
            ]}
          />

          {/* Card 3: Frequently searched — Cars (we'll use Motors / Sports) */}
          <CategoryListCard
            title="Frequently searched"
            icon={TrendingUp}
            items={[
              { label: 'Auto Parts', href: '/categories?category=Sports' },
              { label: 'Motorcycle Gear', href: '/categories?category=Sports' },
              { label: 'Bikes & Cycling', href: '/categories?category=Sports' },
            ]}
          />

          {/* Card 4: Fast-selling products (orange highlighted) */}
          <CategoryListCard
            title="Fast-selling products"
            icon={Flame}
            highlighted
            items={[
              { label: 'Flash Deals', href: '/categories?sort=flash' },
              { label: 'Trending Now', href: '/categories?sort=trending' },
              { label: 'New Arrivals', href: '/categories?sort=newest' },
            ]}
          />
        </div>
      </div>

      {/* ===== Floating right-side chat widget (3 vertical icons) ===== */}
      <div className="fixed right-4 bottom-8 z-40 flex flex-col gap-2">
        <button className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:border-primary hover:shadow-lg transition-all">
          <MessageCircle className="w-5 h-5 text-slate-600" />
        </button>
        <button className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:border-primary hover:shadow-lg transition-all">
          <ImageIcon className="w-5 h-5 text-slate-600" />
        </button>
        <button className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:border-primary hover:shadow-lg transition-all">
          <HelpCircle className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}

/* Category card with title + LIST items + right arrows (matches reference exactly) */
function CategoryListCard({ title, icon: Icon, items, highlighted }: {
  title: string;
  icon: any;
  items: { label: string; href: string }[];
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlighted ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'
    }`}>
      {/* Card title with icon */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${highlighted ? 'text-orange-600' : 'text-slate-400'}`} />
        <h3 className={`text-sm font-bold ${highlighted ? 'text-orange-700' : 'text-slate-900'}`}>
          {title}
        </h3>
      </div>

      {/* List items with right arrows */}
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-white ${
              highlighted ? 'text-slate-700 hover:bg-orange-100' : 'text-slate-600 hover:bg-slate-50'
            } transition-colors`}
          >
            <span>{item.label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
