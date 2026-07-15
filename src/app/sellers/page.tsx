'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Store, Search, Users, Star, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports', 'Books', 'Food', 'Toys', 'General'];

export default function SellersPage() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'followers' | 'name' | 'products'>('followers');

  useEffect(() => {
    (async () => {
      const [sellersResp, productsResp] = await Promise.all([
        api.social.discover(50),
        api.products.all(200),
      ]);
      if (sellersResp.success) setSellers(sellersResp.sellers || []);
      if (productsResp.success) setAllProducts(productsResp.products || []);
      setLoading(false);
    })();
  }, []);

  // Filter + sort sellers
  const filteredSellers = sellers
    .filter((s) => {
      const name = (s.business_name || s.farm_name || '').toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesCategory = category === 'All' || s.business_category === category || s.seller_type === category.toLowerCase();
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sort === 'followers') return (b.followers || 0) - (a.followers || 0);
      if (sort === 'name') {
        const an = a.business_name || a.farm_name || '';
        const bn = b.business_name || b.farm_name || '';
        return an.localeCompare(bn);
      }
      if (sort === 'products') {
        const ap = allProducts.filter(p => p.seller_id === a.id).length;
        const bp = allProducts.filter(p => p.seller_id === b.id).length;
        return bp - ap;
      }
      return 0;
    });

  if (loading) { return <PageSkeleton variant="minimal" />; }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to home
      </Link>

      <div className="flex items-center gap-2 mb-4">
        <Store className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">All Sellers</h1>
        <Badge variant="secondary" className="ml-1">{filteredSellers.length}</Badge>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sellers..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                category === c
                  ? 'brand-gradient text-primary-foreground'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Sort by:</span>
          {[
            { key: 'followers' as const, label: 'Followers' },
            { key: 'products' as const, label: 'Most products' },
            { key: 'name' as const, label: 'Name (A-Z)' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 py-1 rounded-full font-bold transition-colors ${
                sort === s.key ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sellers grid */}
      {filteredSellers.length === 0 ? (
        <EmptyState
          icon={<Store className="w-8 h-8" />}
          title="No sellers found"
          message="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSellers.map((seller) => {
            const sellerProducts = allProducts
              .filter(p => p.seller_id === seller.id)
              .slice(0, 4);
            const productCount = allProducts.filter(p => p.seller_id === seller.id).length;
            const name = seller.business_name || seller.farm_name || 'Unnamed store';
            const initial = name.charAt(0).toUpperCase();

            return (
              <Card key={seller.id} className="p-3 border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                {/* 2x2 product grid */}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {sellerProducts.length > 0 ? (
                    sellerProducts.map((p) => (
                      <Link key={p.id} href={`/product?id=${p.id}`}>
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Store className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                      </Link>
                    ))
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-lg bg-slate-50" />
                    ))
                  )}
                </div>

                {/* Seller info + Shop button */}
                <div className="flex items-center gap-3">
                  <Link href={`/seller-profile?id=${seller.id}`} className="shrink-0">
                    {seller.profile_image ? (
                      <img src={seller.profile_image} className="w-10 h-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm">
                        {initial}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/seller-profile?id=${seller.id}`} className="font-bold text-sm text-slate-900 hover:text-primary truncate block">
                      {name}
                    </Link>
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {seller.followers || 0}
                      </span>
                      <span>·</span>
                      <span>{productCount} product{productCount !== 1 ? 's' : ''}</span>
                      {seller.business_category && (
                        <>
                          <span>·</span>
                          <span className="truncate">{seller.business_category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link href={`/seller-profile?id=${seller.id}`}>
                    <Button size="sm" variant="default">Shop</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
