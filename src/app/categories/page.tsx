'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { Search, Camera, ChevronLeft, Store, Filter, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { PageSkeleton } from '@/components/page-skeleton';
import { SmartImage } from '@/components/smart-image';
const ALL_CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Fashion', value: 'Fashion' },
  { label: 'Home', value: 'Home' },
  { label: 'Beauty', value: 'Beauty' },
  { label: 'Farm', value: 'Farm' },
  { label: 'Sports', value: 'Sports' },
  { label: 'Food', value: 'Food' },
  { label: 'Toys', value: 'Toys' },
  { label: 'Books', value: 'Books' },
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

  // NOTE: The top search bar now triggers Smart Search (spotlight overlay)
  // instead of a form-based product search. The searchQuery state is still
  // used for the initial URL query param (?q=...) and for subcategory search.

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

  const subcats = category ? SUBCATEGORIES[category] || [] : [];

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar with search — clicking the search bar opens Smart Search spotlight */}
      <div ref={searchBarRef} className="fx-topbar ig-topbar gap-2">
        <button onClick={() => router.push('/')} className="ig-icon-btn shrink-0" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
          className="flex-1 flex items-center bg-[#F5F5F5] rounded-md px-3 py-2 hover:bg-[#F5F5F5] transition-colors text-left"
          aria-label="Open Smart Search"
        >
          <Search className="w-4 h-4 text-[#666666] mr-2 shrink-0" />
          <span className="flex-1 text-sm text-[#666666] truncate">Search for items you want</span>
          <Camera className="w-4 h-4 text-[#666666] ml-2 shrink-0" />
        </button>
      </div>

      {/* Category pills — horizontal scroll */}
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-[#E5E5E5]">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full whitespace-nowrap transition-all ${
              category === cat.value
                ? 'bg-[#D4AF37] text-black'
                : 'bg-[#F5F5F5] text-black hover:bg-[#F5F5F5]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Subcategory chips (only when a category is selected) */}
      {subcats.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-[#E5E5E5]">
          {subcats.map((sub) => (
            <button
              key={sub}
              onClick={() => searchBySubcategory(sub)}
              className="shrink-0 text-xs font-medium text-black bg-[#F5F5F5] hover:bg-[#F5F5F5] px-3 py-1.5 rounded-full border border-[#E5E5E5]"
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Sort bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <div className="text-xs" style={{ color: 'var(--cellex-text-muted)' }}>
          {loading ? '' : `${products.length} products`}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 text-xs font-semibold text-black px-3 py-1.5 rounded-md border border-[#E5E5E5]"
            aria-label="Sort"
          >
            <Filter className="w-3 h-3" />
            {SORTS.find(s => s.key === sort)?.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-9 z-10 bg-[#F5F5F5] border border-[#E5E5E5] rounded-md shadow-lg py-1 min-w-[180px]">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleSortChange(s.key)}
                  className={`block w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] ${
                    sort === s.key ? 'text-black font-bold' : 'text-black'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product grid — 2-column IG-style */}
      <div className="grid grid-cols-2 gap-2 px-3 py-3">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer rounded-md aspect-[3/4]" />
          ))
        ) : products.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <Store className="w-10 h-10 mx-auto text-[#666666] mb-2" />
            <p className="text-sm text-[#666666]">No products found</p>
          </div>
        ) : (
          products.map((p) => (
            <CategoryProductCard key={p.id} product={p} />
          ))
        )}
      </div>
    </div>
  );
}

/* IG-style product card — minimal, white bg, square image, price bold */
function CategoryProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product?id=${product.id}`} className="fx-card ig-card block">
      <div className="aspect-square bg-[#F5F5F5] relative">
        {product.image_url ? (
          <SmartImage src={product.image_url} alt={product.name} width={300} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#666666]">
            <Store className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium text-black line-clamp-2 h-8 leading-tight">
          {product.name}
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-black leading-none">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-[10px] text-[#666666]">
              {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
            </span>
          )}
        </div>
        {product.category && (
          <div className="text-[10px] text-[#666666] mt-0.5">{product.category}</div>
        )}
      </div>
    </Link>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="categories" />}>
      <CategoriesContent />
    </Suspense>
  );
}
