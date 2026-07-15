'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Store, Package, BarChart3, ShoppingBag, Radio, Video,
  BookOpen, Settings, TrendingUp, DollarSign, Eye
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { api, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';

export default function SellerProfileDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [seller, setSeller] = useState<any>(null);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, views: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/seller-dashboard');
      return;
    }
    if (user) {
      (async () => {
        try {
          const resp = await fetch('/api/seller-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) {
              setSeller(data.seller);
            }
          }
          const statsResp = await api.sellerDashboard.stats();
          if (statsResp.success) {
            setStats({
              products: statsResp.stats?.product_count || 0,
              orders: statsResp.stats?.order_count || 0,
              revenue: statsResp.stats?.revenue || 0,
              views: statsResp.stats?.total_views || 0,
            });
          }
        } catch {}
        setLoading(false);
      })();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const menuSections = [
    {
      title: 'Manage',
      items: [
        { href: '/seller/products', icon: Package, label: 'My Products', sub: `${stats.products} products` },
        { href: '/seller/orders', icon: ShoppingBag, label: 'Orders', sub: `${stats.orders} orders` },
        { href: '/seller/videos', icon: Video, label: 'Videos', sub: 'Manage product videos' },
        { href: '/seller/stories', icon: BookOpen, label: 'Stories', sub: '24h story posts' },
      ],
    },
    {
      title: 'Grow',
      items: [
        { href: '/seller/go-live', icon: Radio, label: 'Go Live', sub: 'Start a live session' },
        { href: '/seller/academy', icon: BookOpen, label: 'Academy', sub: 'Learn to grow' },
      ],
    },
    {
      title: 'Account',
      items: [
        { href: '/seller/settings', icon: Settings, label: 'Settings', sub: 'Store preferences' },
        { href: '/seller/profile', icon: Store, label: 'Edit Store Profile', sub: 'Store name, logo, description' },
      ],
    },
  ];

  return (
    <div className="bg-white min-h-screen max-w-2xl mx-auto pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold flex-1">My Store</h1>
      </div>

      <div className="px-4 py-6 text-center border-b border-slate-100">
        <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {seller?.profile_image ? (
            <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-10 h-10 text-white" />
          )}
        </div>
        <h2 className="text-xl font-bold">{seller?.business_name || 'My Store'}</h2>
        <p className="text-sm text-slate-500 capitalize">
          {seller?.seller_type || 'business'} · {seller?.business_category || 'General'}
        </p>
        {seller?.business_location && (
          <p className="text-xs text-slate-400 mt-1">{seller.business_location}</p>
        )}
        {seller?.business_description && (
          <p className="text-sm text-slate-600 mt-3 max-w-md mx-auto">{seller.business_description}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-slate-100">
        <StatBox icon={Package} value={stats.products} label="Products" />
        <StatBox icon={ShoppingBag} value={stats.orders} label="Orders" />
        <StatBox icon={DollarSign} value={formatPrice(stats.revenue)} label="Revenue" small />
        <StatBox icon={Eye} value={stats.views} label="Views" />
      </div>

      {menuSections.map((section) => (
        <div key={section.title} className="px-4 py-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
            {section.title}
          </h3>
          <Card className="border-slate-100 divide-y divide-slate-100">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.sub}</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180" />
                </Link>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

function StatBox({ icon: Icon, value, label, small }: { icon: any; value: any; label: string; small?: boolean }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-slate-400 mb-1" />
      <div className={`font-bold ${small ? 'text-xs' : 'text-base'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
