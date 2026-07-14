'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Camera, ChevronLeft, Store, Filter, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const ALL_CATEGORIES = [
  { label: 'All', value: '', emoji: '🛍️' },
  { label: 'Electronics', value: 'Electronics', emoji: '📱' },
  { label: 'Fashion', value: 'Fashion', emoji: '👗' },
  { label: 'Home', value: 'Home', emoji: '🏠' },
  { label: 'Beauty', value: 'Beauty', emoji: '💄' },
  { label: 'Farm', value: 'Farm', emoji: '🌱' },
  { label: 'Sports', value: 'Sports', emoji: '⚽' },
  { label: 'Food', value: 'Food', emoji: '🍲' },
  { label: 'Toys', value: 'Toys', emoji: '🧸' },
  { label: 'Books', value: 'Books', emoji: '📚' },
];

const SUBCATEGORIES: Record<string, string[]> = {
  'Electronics': ['Smart Watches', 'Headphones', 'Speakers', 'Chargers', 'Cameras', 'Gaming', 'Drones', 'Accessories'],
  'Fashion': ['Ankara', 'Shirts', 'Shoes', 'Bags', 'Watches', 'Jewelry', 'Heels', 'Sneakers'],
  'Home': ['Kitchen', 'Bedding', 'Appliances', 'Decor', 'Lighting', 'Storage', 'Cookware', 'Cleaning'],
  'Beauty': ['Skincare', 'Makeup', 'Hair', 'Perfume', 'Nails', 'Wigs', 'Lotion', 'Brushes'],
  'Farm': ['Vegetables', 'Grains', 'Tubers', 'Palm Oil', 'Honey', 'Fruits', 'Pepper', 'Spices'],
  'Sports': ['Football', 'Fitness', 'Cycling', 'Camping', 'Boxing', 'Tennis', 'Swimming', 'Running'],
  'Food': ['Snacks', 'Beverages', 'Coffee', 'Tea', 'Spices', 'Biscuits', 'Nuts', 'Chocolate'],
  'Toys': ['Building', 'RC Cars', 'Dolls', 'Puzzles', 'Board Games', 'Plush', 'STEM', 'Music'],
  'Books': ['African Lit', 'Textbooks', 'Children', 'Religious', 'Stationery', 'JAMB', 'WAEC', 'Dictionary'],
};

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Popular' },
  { key: 'price_low', label: 'Price: Low → High' },
  { key: 'price_high', label: 'Price: High → Low' },
];

function CategoriesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialCategory = params.get('category') || '';
  const initialSort = params.get('sort') || 'newest';
  const initialQuery = params.get('q') || '';

  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    if (searchQuery.trim()) {
      const result = await api.products.search(searchQuery, null);
      if (result.success) {
        setProducts(result.results || result.products || []);
      }
    } else if (category) {
      // Specific category selected — use the category op
      const result = await api.products.category(category, sort, 1);
      if (result.success) {
        setProducts(result.products || []);
      }
    } else {
      // "All" categories — use the all op (category op rejects empty string)
      const result = await api.products.all(100);
      if (result.success) {
        let allProducts = result.products || [];
        // Apply client-side sort since the 'all' op doesn't sort
        if (sort === 'price_low') {
          allProducts = [...allProducts].sort((a, b) => a.price - b.price);
        } else if (sort === 'price_high') {
          allProducts = [...allProducts].sort((a, b) => b.price - a.price);
        } else if (sort === 'popular') {
          allProducts = [...allProducts].sort((a, b) => (b.units_sold || 0) - (a.units_sold || 0));
        } else {
          // newest — sort by created_at descending
          allProducts = [...allProducts].sort((a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
        }
        setProducts(allProducts);
      }
    }
    setLoading(false);
  }, [category, sort, searchQuery]);

  useEffect(() => { load(); }, [load]);

  // Update URL when filter changes
  const updateUrl = (cat: string, s: string) => {
    const urlParams = new URLSearchParams();
    if (cat) urlParams.set('category', cat);
    if (s !== 'newest') urlParams.set('sort', s);
    const qs = urlParams.toString();
    router.replace(`/categories${qs ? '?' + qs : ''}`);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setSearchQuery('');
    updateUrl(cat, sort);
  };

  const handleSortChange = (s: string) => {
    setSort(s);
    setShowSortMenu(false);
    updateUrl(category, s);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      load();
    }
  };

  // Search by subcategory label — sets the query and triggers a search.
  // We can't rely on the load() callback because it captures the old searchQuery;
  // instead we call the search API directly with the new value.
  const searchBySubcategory = async (sub: string) => {
    setLoading(true);
    setSearchQuery(sub);
    const result = await api.products.search(sub, null);
    if (result.success) {
      setProducts(result.results || result.products || []);
    }
    setLoading(false);
  };

  const activeCategoryLabel = ALL_CATEGORIES.find(c => c.value === category)?.label || 'All';
  const subcats = category ? SUBCATEGORIES[category] || [] : [];

  return (
    <div className="bg-white min-h-screen">
      {/* === MOBILE LAYOUT === */}
      <div className="md:hidden">
        {/* Search bar — full width with back arrow */}
        <div ref={searchBarRef} className="sticky top-0 z-30 bg-white px-3 pt-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0">
              <ChevronLeft className="w-5 h-5 text-black" />
            </Link>
            <form onSubmit={handleSearch} className="flex-1 flex items-center bg-slate-100 rounded-full px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for items you want"
                className="flex-1 bg-transparent outline-none text-sm text-black placeholder:text-slate-400"
              />
              <Camera className="w-4 h-4 text-slate-500 ml-2" />
            </form>
          </div>
        </div>

        {/* Category tabs with underline */}
        <div className="flex items-center gap-5 px-3 py-2 overflow-x-auto no-scrollbar bg-white border-b border-slate-100">
          {ALL_CATEGORIES.map((cat) => {
            // "All" clears the category filter (stays on categories page)
            if (cat.value === '') {
              return (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange('')}
                  className={`text-sm whitespace-nowrap pb-1.5 transition-colors ${
                    category === ''
                      ? 'text-primary font-bold border-b-2 border-primary'
                      : 'text-black'
                  }`}
                >
                  {cat.label}
                </button>
              );
            }
            return (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`text-sm whitespace-nowrap pb-1.5 transition-colors ${
                  category === cat.value
                    ? 'text-primary font-bold border-b-2 border-primary'
                    : 'text-black'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Subcategory grid (5-column) */}
        {subcats.length > 0 && (
          <div className="grid grid-cols-5 gap-2 px-3 py-3 bg-white border-b border-slate-100">
            {subcats.map((sub, i) => (
              <button
                key={sub}
                onClick={() => searchBySubcategory(sub)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg">
                  {ALL_CATEGORIES.find(c => c.value === category)?.emoji || '🛍️'}
                </div>
                <span className="text-[10px] text-black text-center leading-tight truncate w-full">{sub}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sort bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100">
          <div className="text-xs text-slate-500">
            {loading ? 'Loading...' : `${products.length} products`}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 text-xs font-bold text-black px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <Filter className="w-3 h-3" />
              {SORTS.find(s => s.key === sort)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-9 z-10 bg-white border border-slate-100 rounded-xl shadow-xl py-1 min-w-[180px]">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleSortChange(s.key)}
                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${
                      sort === s.key ? 'text-primary font-bold' : 'text-black'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product grid — 2-column Temu-style */}
        <div className="grid grid-cols-2 gap-2 px-3 py-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-lg animate-pulse aspect-[3/4]" />
            ))
          ) : products.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No products found</p>
            </div>
          ) : (
            products.map((p) => (
              <MobileCategoryProductCard key={p.id} product={p} />
            ))
          )}
        </div>
      </div>

      {/* === DESKTOP LAYOUT === */}
      <div className="hidden md:block">
        {/* Top thin row */}
        <div className="border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center gap-5">
              <Link href="/" className="hover:text-primary flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Back to home
              </Link>
              <span className="text-slate-200">|</span>
              <Link href="/categories" className="hover:text-primary">All categories</Link>
              <Link href="/sellers" className="hover:text-primary">Featured sellers</Link>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/profile" className="hover:text-primary">Buyer Central</Link>
              <Link href="/telegram" className="hover:text-primary">Help Center</Link>
              <Link href="/seller" className="hover:text-primary flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> Sell on Cellex
              </Link>
            </div>
          </div>
        </div>

        {/* Logo + big search */}
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
            onSubmit={handleSearch}
            className="flex-1 max-w-3xl flex items-center border-2 border-primary rounded-full overflow-hidden"
          >
            <div className="px-3 py-2.5 text-slate-500 border-r border-slate-200 flex items-center gap-1">
              <Camera className="w-4 h-4" />
              <span className="text-xs">Image</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What are you looking for?"
              className="flex-1 px-4 py-2.5 outline-none text-base"
            />
            <button type="submit" className="brand-gradient text-white font-bold px-8 py-2.5 flex items-center gap-1.5">
              <Search className="w-4 h-4" />
              Search
            </button>
          </form>

          <Link href="/cart" className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary">
            <Store className="w-5 h-5" />
            <span>Cart</span>
          </Link>
        </div>

        {/* Tabs row */}
        <div className="border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
            <Link href="/ai-chat" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
              AI Mode
            </Link>
            <Link href="/categories" className="flex items-center gap-1.5 py-3 text-sm font-bold text-primary border-b-2 border-primary">
              Products
            </Link>
            <Link href="/sellers" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
              Sellers
            </Link>
            <Link href="/live" className="flex items-center gap-1.5 py-3 text-sm font-bold text-slate-900 border-b-2 border-transparent hover:border-primary">
              Live
            </Link>
          </div>
        </div>

        {/* Category pills + sort */}
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {ALL_CATEGORIES.map((cat) => {
                // "All" clears the category filter (stays on categories page)
                if (cat.value === '') {
                  return (
                    <button
                      key={cat.value}
                      onClick={() => handleCategoryChange('')}
                      className={`text-sm font-medium px-4 py-1.5 rounded-full whitespace-nowrap transition-all ${
                        category === ''
                          ? 'brand-gradient text-white font-bold'
                          : 'bg-slate-100 text-black hover:bg-slate-200'
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  );
                }
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryChange(cat.value)}
                    className={`text-sm font-medium px-4 py-1.5 rounded-full whitespace-nowrap transition-all ${
                      category === cat.value
                        ? 'brand-gradient text-white font-bold'
                        : 'bg-slate-100 text-black hover:bg-slate-200'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-4">
              <div className="text-sm text-slate-500">
                {loading ? 'Loading...' : `${products.length} products`}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1 text-sm font-bold text-black px-3 py-1.5 rounded-lg border border-slate-200"
                >
                  <Filter className="w-3.5 h-3.5" />
                  {SORTS.find(s => s.key === sort)?.label}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-9 z-10 bg-white border border-slate-100 rounded-xl shadow-xl py-1 min-w-[180px]">
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => handleSortChange(s.key)}
                        className={`block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                          sort === s.key ? 'text-primary font-bold' : 'text-black'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subcategory chips */}
          {subcats.length > 0 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
              {subcats.map((sub) => (
                <button
                  key={sub}
                  onClick={() => searchBySubcategory(sub)}
                  className="shrink-0 text-xs font-medium text-black bg-slate-50 hover:bg-primary/10 hover:text-primary px-3 py-1.5 rounded-full border border-slate-100"
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Product grid — 4-column on desktop */}
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-slate-100 rounded-lg animate-pulse aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Store className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-base text-slate-500">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {products.map((p) => (
                <DesktopCategoryProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Mobile product card — Temu-style: image, title, badges, cyan price */
function MobileCategoryProductCard({ product }: { product: Product }) {
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
          <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            ⚡ Hot
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium text-black line-clamp-2 h-8 leading-tight">
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

/* Desktop product card */
function DesktopCategoryProductCard({ product }: { product: Product }) {
  const isHot = typeof product.units_sold === 'number' && product.units_sold > 50;
  const isBestseller = typeof product.units_sold === 'number' && product.units_sold > 200;

  return (
    <Link href={`/product?id=${product.id}`} className="block group">
      <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
        <div className="aspect-square bg-slate-50 relative">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Store className="w-10 h-10" />
            </div>
          )}
          {isHot && (
            <span className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded">
              ⚡ Hot
            </span>
          )}
        </div>
        <div className="p-3">
          <div className="text-sm font-medium text-black line-clamp-2 h-10 leading-tight">
            {product.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-green-200">
              Pay on delivery
            </span>
            {isBestseller && (
              <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                Bestseller
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-extrabold price">{formatPrice(product.price)}</span>
            {typeof product.units_sold === 'number' && product.units_sold > 0 && (
              <span className="text-xs text-slate-400">
                {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
              </span>
            )}
          </div>
          {product.category && (
            <div className="text-xs text-slate-500 mt-1">With Coupon · {product.category}</div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <CategoriesContent />
    </Suspense>
  );
}
