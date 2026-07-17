'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Package, ShoppingBag, Users, TrendingUp, Radio, Plus, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageSkeleton } from '@/components/page-skeleton';
export default function SellerDashboard() {
  const [stats, setStats] = useState<any>({});
  const [recent, setRecent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [statsResp, recentResp] = await Promise.all([
        api.sellerDashboard.stats(),
        api.sellerDashboard.recent(),
      ]);
      if (statsResp.success) setStats(statsResp);
      if (recentResp.success) setRecent(recentResp);
      setLoading(false);
    })();
  }, []);

  if (loading) { return <PageSkeleton variant="seller-dashboard" />; }

  const statCards = [
    { label: 'Products', value: stats.productsCount || 0, icon: Package },
    { label: 'Orders', value: stats.ordersCount || 0, icon: ShoppingBag },
    { label: 'Followers', value: stats.followers || 0, icon: Users },
    { label: 'Revenue', value: formatPrice(stats.revenue || 0), icon: TrendingUp, small: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-neutral-500">Welcome back to your seller center</p>
        </div>
        <Link href="/seller/products">
          <button className="bg-black text-white font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-neutral-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add product
          </button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="border border-neutral-200 rounded-md p-4 bg-white">
              <Icon className="w-5 h-5 text-black mb-2" />
              <div className={`font-bold ${s.small ? 'text-base' : 'text-2xl'}`}>{s.value}</div>
              <div className="text-xs text-neutral-500 font-medium">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent products */}
        <div className="border border-neutral-200 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Recent Products</h3>
            <Link href="/seller/products" className="text-xs text-black font-medium">See all</Link>
          </div>
          <div className="space-y-2">
            {recent?.products && recent.products.length > 0 ? (
              recent.products.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-md">
                  <div className="w-10 h-10 rounded-md bg-neutral-100 overflow-hidden shrink-0">
                    {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-neutral-500">{formatPrice(p.price)} · {p.units_sold || 0} sold</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-neutral-400">
                <Package className="w-8 h-8 mx-auto mb-1 text-neutral-300" />
                No products yet
              </div>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="border border-neutral-200 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
            <Link href="/seller/orders" className="text-xs text-black font-medium">See all</Link>
          </div>
          <div className="space-y-2">
            {recent?.orders && recent.orders.length > 0 ? (
              recent.orders.slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-md">
                  <div className="w-10 h-10 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">#{o.id?.slice(0, 8)}</div>
                    <div className="text-xs text-neutral-500">{formatPrice(o.total)} · {timeAgo(o.created_at)}</div>
                  </div>
                  <span className="text-[10px] font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">{o.status}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-neutral-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-1 text-neutral-300" />
                No orders yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/seller/go-live">
          <div className="border border-neutral-200 rounded-md p-4 hover:bg-neutral-50 transition-colors text-center">
            <Radio className="w-6 h-6 mx-auto text-black mb-1" />
            <div className="text-xs font-semibold">Go Live</div>
          </div>
        </Link>
        <Link href="/seller/videos">
          <div className="border border-neutral-200 rounded-md p-4 hover:bg-neutral-50 transition-colors text-center">
            <Package className="w-6 h-6 mx-auto text-black mb-1" />
            <div className="text-xs font-semibold">Upload Video</div>
          </div>
        </Link>
        <Link href="/seller/stories">
          <div className="border border-neutral-200 rounded-md p-4 hover:bg-neutral-50 transition-colors text-center">
            <Package className="w-6 h-6 mx-auto text-black mb-1" />
            <div className="text-xs font-semibold">Post Story</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
