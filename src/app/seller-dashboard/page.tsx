'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Store, Package, ShoppingBag, Radio, Video,
  BookOpen, Settings, DollarSign, Eye, TrendingUp, ArrowRight,
  PackageOpen, ShoppingBag as BagIcon, PlusCircle, Film, Mic,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { api, formatPrice, timeAgo, type Product } from '@/lib/api';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';
import { SellerAvatarModal } from '@/components/seller-avatar-modal';
import { MagneticButton } from '@/components/animation-provider';

import { useScrollPreservation } from '@/components/global-state-provider';
/**
 * SellerDashboardPage — dynamic seller dashboard.
 *
 * Fetches REAL data:
 *   - Seller profile (via /api/seller-profile)
 *   - Products (via api.sellerProducts.list())
 *   - Orders (via api.sellerOrders.list())
 *   - Videos (via /api/videos with op='mine')
 *
 * Then computes:
 *   - Total revenue (sum of order totals)
 *   - Total orders, products, videos counts
 *   - Recent orders (last 5)
 *   - Top products (by units_sold)
 *
 * Shows IG-style UI: top bar, profile header, 4-stat grid, recent orders list,
 * top products carousel, and quick action buttons.
 */
export default function SellerDashboardPage() {
  useScrollPreservation('seller-dashboard');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/seller-dashboard');
      return;
    }
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        // Fetch seller profile + products + orders in parallel.
        // Videos fetch separately (uses op='mine' which may not exist on older
        // edge functions — we swallow errors gracefully).
        const [profileResp, productsResp, ordersResp, videosResp] = await Promise.all([
          fetch(`${API_BASE}/api/seller-profile`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          }).then((r) => r.json()).catch(() => ({ success: false })),
          api.sellerProducts.list().catch(() => ({ success: false })),
          fetch(`${API_BASE}/api/seller-orders`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'list' }),
          }).then((r) => r.json()).catch(() => ({ success: false })),
          fetch(`${API_BASE}/api/videos`, {
      credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'mine' }),
          }).then((r) => r.json()).catch(() => ({ success: false })),
        ]);

        if (cancelled) return;

        if (profileResp.success && profileResp.seller) {
          setSeller(profileResp.seller);
        }
        if (productsResp.success && Array.isArray(productsResp.products)) {
          setProducts(productsResp.products);
        }
        if (ordersResp.success && Array.isArray(ordersResp.orders)) {
          setOrders(ordersResp.orders);
        }
        if (videosResp.success && Array.isArray(videosResp.videos)) {
          setVideos(videosResp.videos);
        }
      } catch {
        // Swallow — we show empty states below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return <PageSkeleton variant="seller-dashboard" />;
  }

  // ---- Compute real stats ----
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalOrders = orders.length;
  const totalProducts = products.length;
  const totalVideos = videos.length;
  const totalViews = videos.reduce((sum, v) => sum + (Number(v.views_count) || 0), 0);

  // Recent orders (last 5, newest first — API returns newest first already,
  // but we sort defensively by created_at).
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5);

  // Top products by units_sold
  const topProducts = [...products]
    .sort((a, b) => (b.units_sold || 0) - (a.units_sold || 0))
    .slice(0, 4);

  const menuSections = [
    {
      title: 'Manage',
      items: [
        { href: '/seller/products', icon: Package, label: 'My Products', sub: `${totalProducts} product${totalProducts === 1 ? '' : 's'}` },
        { href: '/seller/orders', icon: ShoppingBag, label: 'Orders', sub: `${totalOrders} order${totalOrders === 1 ? '' : 's'}` },
        { href: '/seller/videos', icon: Video, label: 'Videos', sub: `${totalVideos} video${totalVideos === 1 ? '' : 's'}` },
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

  const sellerName = seller?.business_name || seller?.farm_name || 'My Store';
  const sellerSlug = seller?.slug;

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.push('/')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">My Store</h1>
        {sellerSlug && (
          <Link
            href={`/${sellerSlug}`}
            className="text-xs font-semibold text-sky-500 hover:text-sky-700 px-2 py-1"
            aria-label="View public storefront"
          >
            View store
          </Link>
        )}
      </div>

      {/* Profile header */}
      <div className="px-4 py-6 text-center border-b border-[#E5E5E5]">
        <div className="w-20 h-20 rounded-full bg-[#D4AF37] flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {seller?.profile_image ? (
            <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store className="w-10 h-10 text-black" />
          )}
        </div>
        <h2 className="text-xl font-bold">{sellerName}</h2>
        <p className="text-sm text-[#666666] capitalize">
          {seller?.seller_type || 'business'} · {seller?.business_category || 'General'}
        </p>
        {seller?.business_location && (
          <p className="text-xs text-[#666666] mt-1">{seller.business_location}</p>
        )}
        {seller?.business_description && (
          <p className="text-sm text-[#666666] mt-3 max-w-md mx-auto">{seller.business_description}</p>
        )}
        {sellerSlug && (
          <Link
            href={`/${sellerSlug}`}
            className="inline-block mt-3 text-xs font-medium text-sky-500 hover:underline"
          >
            cellex.app/{sellerSlug}
          </Link>
        )}
      </div>

      {/* Stats grid — all numbers are real */}
      <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-[#E5E5E5]">
        <StatBox icon={Package} value={totalProducts} label="Products" />
        <StatBox icon={ShoppingBag} value={totalOrders} label="Orders" />
        <StatBox icon={DollarSign} value={formatPrice(totalRevenue)} label="Revenue" small />
        <StatBox icon={Eye} value={totalViews} label="Views" />
      </div>

      {/* Recent orders section — real orders from seller-orders API */}
      <div className="px-4 py-4 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wide flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            Recent Orders
          </h3>
          {totalOrders > 0 && (
            <Link href="/seller/orders" className="text-xs font-semibold text-sky-500 hover:text-sky-700 flex items-center gap-0.5">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <EmptyStateCard
            icon={<BagIcon className="w-6 h-6 text-[#666666]" />}
            title="No orders yet"
            message="Orders from buyers will appear here once you start selling."
            actionHref="/seller/products"
            actionLabel="Add products"
          />
        ) : (
          <div className="divide-y divide-white/5 border-y border-[#E5E5E5]">
            {recentOrders.map((o) => {
              const itemCount = (o.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
              const firstItemName = o.items?.[0]?.product_name;
              const extraItems = (o.items?.length || 0) - 1;
              return (
                <Link
                  key={o.id}
                  href="/seller/orders"
                  className="flex items-center gap-3 py-3 hover:bg-[#F5F5F5] -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-[#666666]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{String(o.id || '').slice(0, 8)}</span>
                      <span className="text-[10px] font-medium bg-[#F5F5F5] text-[#666666] px-1.5 py-0.5 rounded-full capitalize">
                        {o.status || 'pending'}
                      </span>
                    </div>
                    <div className="text-xs text-[#666666] truncate">
                      {firstItemName ? (
                        <>
                          {firstItemName}
                          {extraItems > 0 && <span className="text-[#666666]"> · +{extraItems} more</span>}
                          <span className="text-[#666666]"> · {itemCount} item{itemCount === 1 ? '' : 's'}</span>
                        </>
                      ) : (
                        <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
                      )}
                    </div>
                    {o.created_at && (
                      <div className="text-[10px] text-[#666666] mt-0.5">{timeAgo(o.created_at)}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">{formatPrice(o.total)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Top products section — sorted by units_sold */}
      <div className="px-4 py-4 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Top Products
          </h3>
          {totalProducts > 0 && (
            <Link href="/seller/products" className="text-xs font-semibold text-sky-500 hover:text-sky-700 flex items-center gap-0.5">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {topProducts.length === 0 ? (
          <EmptyStateCard
            icon={<PackageOpen className="w-6 h-6 text-[#666666]" />}
            title="No products yet"
            message="Add your first product to start selling on Cellex."
            actionHref="/seller/products"
            actionLabel="Add product"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {topProducts.map((p) => (
              <Link
                key={p.id}
                href={`/product?id=${p.id}`}
                className="block border border-[#E5E5E5] rounded-lg overflow-hidden hover:shadow-md transition-all"
              >
                <div className="aspect-square bg-[#F5F5F5] relative">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#666666]">
                      <Store className="w-8 h-8" />
                    </div>
                  )}
                  {(p.units_sold || 0) > 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-black/80 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {p.units_sold} sold
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="font-semibold text-xs line-clamp-1">{p.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-sm">{formatPrice(p.price)}</span>
                    {p.category && (
                      <span className="text-[9px] bg-[#F5F5F5] px-1.5 py-0.5 rounded text-[#666666]">{p.category}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 py-4 border-b border-[#E5E5E5]">
        <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <PlusCircle className="w-3.5 h-3.5" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction href="/seller/products" icon={Package} label="Add Product" />
          <QuickAction href="/seller/videos" icon={Film} label="Add Video" />
          <QuickAction href="/seller/go-live" icon={Radio} label="Go Live" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <MagneticButton strength={0.15}>
          <button
            onClick={() => setAvatarModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-[#111827] btn-ripple  text-white hover:bg-[#374151] transition"
          >
            <Mic className="w-5 h-5" />
            <span className="text-[10px] font-semibold">AI Avatar</span>
          </button>
        </MagneticButton>
        </div>
      </div>

      {/* Menu sections */}
      {menuSections.map((section) => (
        <div key={section.title} className="px-4 py-3">
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-2">
            {section.title}
          </h3>
          <div className="divide-y divide-white/5 border-y border-[#E5E5E5]">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-[#F5F5F5] transition-colors"
                >
                  <Icon className="w-5 h-5 text-black shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-[#666666]">{item.sub}</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#666666] rotate-180" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* AI Seller Avatar Modal */}
      <SellerAvatarModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        sellerName={seller?.business_name}
      />
    </div>
  );
}

function StatBox({ icon: Icon, value, label, small }: { icon: any; value: any; label: string; small?: boolean }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-[#666666] mb-1" />
      <div className={`font-bold ${small ? 'text-xs' : 'text-base'}`}>{value}</div>
      <div className="text-[10px] text-[#666666]">{label}</div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 py-3 border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5] hover:border-white/15 transition-colors"
    >
      <Icon className="w-5 h-5 text-black" />
      <span className="text-[11px] font-semibold text-black">{label}</span>
    </Link>
  );
}

function EmptyStateCard({
  icon,
  title,
  message,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="text-center py-8 px-4 border border-dashed border-[#E5E5E5] rounded-lg">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm font-semibold text-[#666666]">{title}</p>
      <p className="text-xs text-[#666666] mt-1 max-w-xs mx-auto">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-block mt-3 bg-[#D4AF37] text-black text-xs font-semibold px-4 py-2 rounded-md hover:bg-[#F5F5F5]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
