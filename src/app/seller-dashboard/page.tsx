'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Store, Package, ShoppingBag, Radio, Video,
  BookOpen, Settings, DollarSign, Eye } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { api, formatPrice } from '@/lib/api';
import { PageSkeleton } from '@/components/page-skeleton';

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
      <PageSkeleton variant="seller-dashboard" />
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
    <div className="ig-container bg-white min-h-screen pb-24 ig-topbar-offset">
      <div className="ig-topbar">
        <button onClick={() => router.push('/')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">My Store</h1>
      </div>

      {/* Profile header */}
      <div className="px-4 py-6 text-center border-b border-neutral-100">
        <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {seller?.profile_image ? (
            <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-10 h-10 text-white" />
          )}
        </div>
        <h2 className="text-xl font-bold">{seller?.business_name || 'My Store'}</h2>
        <p className="text-sm text-neutral-500 capitalize">
          {seller?.seller_type || 'business'} · {seller?.business_category || 'General'}
        </p>
        {seller?.business_location && (
          <p className="text-xs text-neutral-400 mt-1">{seller.business_location}</p>
        )}
        {seller?.business_description && (
          <p className="text-sm text-neutral-600 mt-3 max-w-md mx-auto">{seller.business_description}</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-neutral-100">
        <StatBox icon={Package} value={stats.products} label="Products" />
        <StatBox icon={ShoppingBag} value={stats.orders} label="Orders" />
        <StatBox icon={DollarSign} value={formatPrice(stats.revenue)} label="Revenue" small />
        <StatBox icon={Eye} value={stats.views} label="Views" />
      </div>

      {menuSections.map((section) => (
        <div key={section.title} className="px-4 py-3">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            {section.title}
          </h3>
          <div className="divide-y divide-neutral-100 border-y border-neutral-100">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-neutral-50 transition-colors"
                >
                  <Icon className="w-5 h-5 text-black shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-neutral-500">{item.sub}</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-neutral-300 rotate-180" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBox({ icon: Icon, value, label, small }: { icon: any; value: any; label: string; small?: boolean }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-neutral-500 mb-1" />
      <div className={`font-bold ${small ? 'text-xs' : 'text-base'}`}>{value}</div>
      <div className="text-[10px] text-neutral-500">{label}</div>
    </div>
  );
}
