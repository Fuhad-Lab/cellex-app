'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type Product } from '@/lib/api';
import { ProductGrid } from '@/components/product-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQuery = params.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const doSearch = useCallback(async (q: string, mp: number | null) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const result = await api.products.search(q, mp);
    if (result.success) {
      setResults(result.results || result.products || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    doSearch(initialQuery, null);
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    router.replace(`/search?${params.toString()}`);
    doSearch(query, maxPrice);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <h1 className="text-xl font-bold mb-3">Search</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, sellers..."
            className="pl-9"
            autoFocus
          />
        </div>
        <Button type="submit" className="brand-gradient text-primary-foreground">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </form>

      {showFilters && (
        <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Max price:</label>
          <input
            type="number"
            value={maxPrice || ''}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
            placeholder="Any"
            className="flex-1 max-w-[140px] px-2 py-1 border border-slate-200 rounded text-xs"
          />
          {maxPrice && (
            <button
              onClick={() => setMaxPrice(null)}
              className="text-xs text-red-500"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {query && (
        <div className="text-xs text-slate-500 mb-3">
          {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
        </div>
      )}

      {!query && !loading && (
        <div className="text-center py-12">
          <SearchIcon className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-500">Start typing to search across thousands of products</p>
        </div>
      )}

      <ProductGrid products={results} loading={loading} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

