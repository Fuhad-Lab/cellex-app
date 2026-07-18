'use client';

import { useEffect, useState } from 'react';
import { api, type Product } from '@/lib/api';
import { Store, Search, Users, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Beauty', 'Farm', 'Sports', 'Books', 'Food', 'Toys', 'General'];

export default function SellersPage() {
  const router = useRouter();
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
    <div className="ig-container bg-white min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Sellers</h1>
        <span className="text-xs text-neutral-500">{filteredSellers.length}</span>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 space-y-3 border-b border-neutral-100">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sellers..."
            className="w-full bg-neutral-100 rounded-md pl-9 pr-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-neutral-300"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                category === c
                  ? 'bg-black text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">Sort by:</span>
          {[
            { key: 'followers' as const, label: 'Followers' },
            { key: 'products' as const, label: 'Most products' },
            { key: 'name' as const, label: 'Name (A-Z)' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                sort === s.key ? 'bg-neutral-100 text-black' : 'bg-neutral-50 text-neutral-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sellers list */}
      {filteredSellers.length === 0 ? (
        <div className="px-4 py-10">
          <EmptyState
            icon={<Store className="w-8 h-8" />}
            title="No sellers found"
            message="Try adjusting your search or filters."
          />
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {filteredSellers.map((seller) => {
            const sellerProducts = allProducts
              .filter(p => p.seller_id === seller.id)
              .slice(0, 3);
            const productCount = allProducts.filter(p => p.seller_id === seller.id).length;
            const name = seller.business_name || seller.farm_name || 'Unnamed store';
            const initial = name.charAt(0).toUpperCase();
            const sellerHref = seller.slug ? `/${seller.slug}` : `/seller-profile?id=${seller.id}`;

            return (
              <Link
                key={seller.id}
                href={sellerHref}
                className="block p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {seller.profile_image ? (
                    <img src={seller.profile_image} className="w-12 h-12 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-black truncate">{name}</div>
                    <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
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
                  <span className="text-xs font-semibold text-black bg-neutral-100 px-3 py-1.5 rounded-md">
                    Shop
                  </span>
                </div>
                {sellerProducts.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 mt-3">
                    {sellerProducts.map((p) => (
                      <div key={p.id} className="aspect-square rounded-sm overflow-hidden bg-neutral-50">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
