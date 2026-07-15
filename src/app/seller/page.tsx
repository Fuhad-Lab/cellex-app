'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    { label: 'Products', value: stats.productsCount || 0, icon: Package, color: 'bg-blue-100 text-blue-600' },
    { label: 'Orders', value: stats.ordersCount || 0, icon: ShoppingBag, color: 'bg-green-100 text-green-600' },
    { label: 'Followers', value: stats.followers || 0, icon: Users, color: 'bg-purple-100 text-purple-600' },
    { label: 'Revenue', value: formatPrice(stats.revenue || 0), icon: TrendingUp, color: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back to your seller center</p>
        </div>
        <Link href="/seller/products">
          <Button className="brand-gradient text-primary-foreground font-bold">
            <Plus className="w-4 h-4 mr-1" /> Add product
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 border-slate-100">
              <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold">{s.value}</div>
              <div className="text-xs text-slate-500 font-semibold">{s.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent products */}
        <Card className="p-4 border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Recent Products</h3>
            <Link href="/seller/products" className="text-xs text-primary font-semibold">See all →</Link>
          </div>
          <div className="space-y-2">
            {recent?.products && recent.products.length > 0 ? (
              recent.products.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{formatPrice(p.price)} · {p.units_sold || 0} sold</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-1 text-slate-200" />
                No products yet
              </div>
            )}
          </div>
        </Card>

        {/* Recent orders */}
        <Card className="p-4 border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Recent Orders</h3>
            <Link href="/seller/orders" className="text-xs text-primary font-semibold">See all →</Link>
          </div>
          <div className="space-y-2">
            {recent?.orders && recent.orders.length > 0 ? (
              recent.orders.slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">#{o.id?.slice(0, 8)}</div>
                    <div className="text-xs text-slate-500">{formatPrice(o.total)} · {timeAgo(o.created_at)}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-1 text-slate-200" />
                No orders yet
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link href="/seller/go-live">
          <Card className="p-4 border-slate-100 hover:shadow-md transition-shadow text-center cursor-pointer">
            <Radio className="w-6 h-6 mx-auto text-red-500 mb-1" />
            <div className="text-xs font-bold">Go Live</div>
          </Card>
        </Link>
        <Link href="/seller/videos">
          <Card className="p-4 border-slate-100 hover:shadow-md transition-shadow text-center cursor-pointer">
            <Package className="w-6 h-6 mx-auto text-primary mb-1" />
            <div className="text-xs font-bold">Upload Video</div>
          </Card>
        </Link>
        <Link href="/seller/stories">
          <Card className="p-4 border-slate-100 hover:shadow-md transition-shadow text-center cursor-pointer">
            <Package className="w-6 h-6 mx-auto text-violet-500 mb-1" />
            <div className="text-xs font-bold">Post Story</div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
