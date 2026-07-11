'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, type Product } from '@/lib/api';
import { ProductGrid } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Filter, ChevronDown } from 'lucide-react';

const CATEGORIES = [
  { key: '', label: 'All', emoji: '🛍️' },
  { key: 'Electronics', label: 'Electronics', emoji: '📱' },
  { key: 'Fashion', label: 'Fashion', emoji: '👗' },
  { key: 'Home', label: 'Home', emoji: '🏠' },
  { key: 'Beauty', label: 'Beauty', emoji: '💄' },
  { key: 'Farm', label: 'Farm Fresh', emoji: '🌱' },
  { key: 'Sports', label: 'Sports', emoji: '⚽' },
  { key: 'Books', label: 'Books', emoji: '📚' },
  { key: 'Food', label: 'Food', emoji: '🍲' },
  { key: 'Toys', label: 'Toys', emoji: '🧸' },
];

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Popular' },
  { key: 'price_low', label: 'Price: Low → High' },
  { key: 'price_high', label: 'Price: High → Low' },
  { key: 'flash', label: '⚡ Flash Deals' },
  { key: 'trending', label: '🔥 Trending' },
];

function CategoriesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialCategory = params.get('category') || '';
  const initialSort = params.get('sort') || 'newest';

  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api.products.category(category, sort, page);
    if (result.success) {
      setProducts(result.products || []);
    }
    setLoading(false);
  }, [category, sort, page]);

  useEffect(() => { load(); }, [load]);

  // Update URL when filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (sort !== 'newest') params.set('sort', sort);
    router.replace(`/categories${params.toString() ? '?' + params.toString() : ''}`);
    setPage(1);
  }, [category, sort, router]);

  const activeSort = SORTS.find((s) => s.key === sort);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <h1 className="text-xl font-bold mb-3">Browse Products</h1>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              category === c.key
                ? 'brand-gradient text-primary-foreground shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="mr-1">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="text-xs text-slate-500">
          {loading ? 'Loading...' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
        </div>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="flex items-center gap-1 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <Filter className="w-3 h-3" />
          {activeSort?.label}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showSortMenu && (
          <div className="absolute right-0 top-9 z-10 bg-white border border-slate-100 rounded-xl shadow-xl py-1 min-w-[180px]">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSort(s.key); setShowSortMenu(false); }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${
                  sort === s.key ? 'text-primary font-bold' : 'text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ProductGrid products={products} loading={loading} />

      {!loading && products.length >= 20 && (
        <div className="text-center mt-6">
          <Button onClick={() => setPage(page + 1)} variant="outline">
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <CategoriesContent />
    </Suspense>
  );
}

