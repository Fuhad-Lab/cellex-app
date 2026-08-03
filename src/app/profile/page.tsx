'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { SmartImage } from '@/components/smart-image';
import {
  Bell,
  Settings as SettingsIcon,
  ChevronRight,
  Heart,
  ShoppingBag,
  UserPlus,
  Star,
  Package,
  X,
  Sparkles,
  Store,
  Bookmark,
} from 'lucide-react';

import { useScrollPreservation } from '@/components/global-state-provider';
/**
 * ProfilePage — Screen 12 mobile buyer profile.
 *
 * Layout (top → bottom):
 *  1. Sticky white header (64px) — "Profile" title + Bell + Settings icons
 *  2. Profile card (white, padding 20px, border-bottom #E5E7EB)
 *     - 72px avatar
 *     - Name 18/700 #111827, @handle 14 #6B7280, bio 14 #374151 line-clamp-2
 *     - Stats row: Following | Followers | Posts & Reviews (gap 24px)
 *     - Full-width "Edit Profile" pill (#F3F4F6 bg, #111827 text, 44px, radius 999px)
 *  3. Tab bar (sticky below header) — Activity Feed | Orders | Saved
 *     Active: #111827 text, bold, border-bottom 2px #111827
 *     Inactive: #6B7280 text
 *  4. Tab content:
 *     - Activity Feed: vertical list of activity cards (16px radius, 1px #E5E7EB)
 *       Each card: 40px colored icon circle (pink heart / yellow star / blue bag / purple user)
 *       + action text + product thumbnail + price (or seller avatar for follows)
 *     - Orders: list of order cards with order#, date, status, total, item count
 *     - Saved: 2-column grid of saved products (aspect-square image + name + price + remove btn)
 *
 * API logic kept (per task spec):
 *   - api.profile.get() / api.profile.update() — buyer profile fields
 *   - api.orders.list() — orders tab + "purchased" activities
 *   - api.wishlist.get() / api.wishlist.remove() — saved tab + "liked" activities
 *   - api.social.following() — "followed" activities + Following count
 *   - api.social.publicProfile(user.id) — Followers + Posts count (when user is a seller)
 *   - api.reviews.byProduct(productId) — "reviewed" activities (filtered by user.id)
 *
 * The bottom nav is rendered globally by NavShell — this page just adds
 * paddingBottom so content clears the fixed bottom bar + safe-area inset.
 */

type TabKey = 'activity' | 'orders' | 'saved';

interface Activity {
  id: string;
  type: 'liked' | 'purchased' | 'followed' | 'reviewed';
  productName?: string;
  productImage?: string;
  productPrice?: number;
  productId?: number;
  sellerName?: string;
  sellerImage?: string;
  sellerSlug?: string;
  sellerId?: string;
  rating?: number;
  reviewTitle?: string;
  reviewComment?: string;
  createdAt?: string;
}

// ---- Color tokens (Screen 7 palette) ----
const COLORS = {
  bg: '#FFFFFF',
  text: '#111827',
  secondary: '#6B7280',
  body: '#374151',
  muted: '#9CA3AF',
  lightBg: '#F3F4F6',
  border: '#E5E7EB',
  // Activity icon circle backgrounds (light) + icon colors (saturated)
  likedBg: '#FCE7F3',
  likedFg: '#EC4899',
  reviewedBg: '#FEF3C7',
  reviewedFg: '#D97706',
  purchasedBg: '#DBEAFE',
  purchasedFg: '#2563EB',
  followedBg: '#EDE9FE',
  followedFg: '#7C3AED',
} as const;

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E' },
  confirmed: { bg: '#F3F4F6', fg: '#6B7280' },
  paid: { bg: '#D1FAE5', fg: '#065F46' },
  shipped: { bg: '#DBEAFE', fg: '#1E40AF' },
  delivered: { bg: '#D1FAE5', fg: '#065F46' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
  pending_payment_sent: { bg: '#F3F4F6', fg: '#6B7280' },
};

export default function ProfilePage() {
  useScrollPreservation('profile');

  const { user, loading: authLoading, isSeller, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [publicProfile, setPublicProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<Activity[]>([]);
  // Lazy initial state — read the URL hash (#orders, #saved) on mount so users
  // can bookmark/share a specific tab. Avoids setState-in-effect.
  const [view, setView] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'activity';
    const hash = window.location.hash.replace('#', '') as TabKey;
    return hash === 'orders' || hash === 'saved' || hash === 'activity'
      ? hash
      : 'activity';
  });
  const [loading, setLoading] = useState(true);

  // Sync hash when view changes (no setState here — just URL replacement)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `#${view}`);
  }, [view]);

  // ===== Load everything in parallel after auth resolves =====
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?next=/profile');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Parallel fetch — every endpoint is best-effort so a single failure
      // doesn't break the whole page.
      const [profileResp, ordersResp, wishResp, followingResp, publicResp] =
        await Promise.all([
          api.profile.get().catch(() => null),
          api.orders.list().catch(() => null),
          api.wishlist.get().catch(() => null),
          api.social.following().catch(() => null),
          user.id
            ? api.social.publicProfile(user.id).catch(() => null)
            : Promise.resolve(null),
        ]);

      if (cancelled) return;

      if (profileResp?.success && profileResp.profile) {
        setProfile(profileResp.profile);
      }
      if (ordersResp?.success) {
        setOrders(ordersResp.orders || []);
      }
      if (wishResp?.success) {
        setWishlist(wishResp.items || []);
      }
      if (followingResp?.success) {
        setFollowing(followingResp.sellers || followingResp.following || []);
      }
      if (publicResp?.success) {
        setPublicProfile(publicResp);
      }

      // Try to fetch reviews written by the current user.
      // We look up reviews on each unique product_id from orders (capped at 5
      // product lookups to stay reasonable) and filter to those by user.id.
      const orderedProductIds: number[] = Array.from(
        new Set(
          (ordersResp?.orders || [])
            .flatMap((o: any) => (o.items || []).map((it: any) => it.product_id))
            .filter((id: any) => typeof id === 'number')
        )
      ).slice(0, 5) as number[];

      if (orderedProductIds.length > 0 && user.id) {
        try {
          const reviewResults = await Promise.all(
            orderedProductIds.map((pid) =>
              api.reviews.byProduct(pid).catch(() => null)
            )
          );
          if (cancelled) return;
          const reviewedActivities: Activity[] = [];
          reviewResults.forEach((r, idx) => {
            if (r?.success && Array.isArray(r.reviews)) {
              r.reviews
                .filter((rv: any) => rv.user_id === user.id)
                .forEach((rv: any) => {
                  reviewedActivities.push({
                    id: `review-${rv.id}`,
                    type: 'reviewed',
                    productName: rv.product_name,
                    productImage: rv.product_image,
                    productPrice: rv.product_price,
                    productId: orderedProductIds[idx],
                    rating: rv.rating,
                    reviewTitle: rv.title,
                    reviewComment: rv.comment,
                    createdAt: rv.created_at,
                  });
                });
            }
          });
          setReviews(reviewedActivities);
        } catch {
          setReviews([]);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const removeWishlist = async (itemId: string) => {
    const result = await api.wishlist.remove(itemId);
    if (result.success) {
      setWishlist((prev) => prev.filter((i) => i.id !== itemId));
      toast({ title: 'Removed from wishlist' });
    } else {
      toast({ title: 'Could not remove', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // ===== Build the unified activity feed (must run before any early return) =====
  const activities = useMemo<Activity[]>(() => {
    const list: Activity[] = [];

    // Liked (from wishlist)
    wishlist.forEach((item: any) => {
      const product = item.products || item.product;
      if (!product) return;
      list.push({
        id: `liked-${item.id}`,
        type: 'liked',
        productName: product.name,
        productImage: product.image_url,
        productPrice: product.price,
        productId: product.id,
        createdAt: item.created_at,
      });
    });

    // Purchased (one activity per order — show first item as the thumbnail)
    orders.forEach((order: any) => {
      const firstItem = (order.items || [])[0];
      const product = firstItem?.products || firstItem?.product;
      list.push({
        id: `purchased-${order.id}`,
        type: 'purchased',
        productName:
          firstItem?.product_name ||
          product?.name ||
          `${(order.items || []).length} item(s)`,
        productImage: product?.image_url || firstItem?.image_url,
        productPrice: product?.price || firstItem?.price,
        productId: product?.id || firstItem?.product_id,
        createdAt: order.created_at,
      });
    });

    // Followed (from following list)
    following.forEach((seller: any) => {
      list.push({
        id: `followed-${seller.id}`,
        type: 'followed',
        sellerName:
          seller.business_name || seller.farm_name || seller.name || 'Seller',
        sellerImage: seller.profile_image || seller.image,
        sellerSlug: seller.slug,
        sellerId: seller.id,
        createdAt: seller.followed_at || seller.created_at,
      });
    });

    // Reviewed (already filtered to the current user)
    list.push(...reviews);

    // Sort by createdAt desc (unknown dates go last)
    list.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

    return list;
  }, [wishlist, orders, following, reviews]);

  // ===== Loading state =====
  if (authLoading || loading) {
    return <PageSkeleton variant="profile" />;
  }

  // ===== Derived values =====
  const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Cellex User';
  const handle =
    profile?.username ||
    profile?.handle ||
    (user?.email ? user.email.split('@')[0].toLowerCase() : 'cellex_user');
  const avatarUrl = profile?.profile_image;
  const bio =
    profile?.bio ||
    profile?.business_description ||
    (profile?.address
      ? `📍 ${profile.address}`
      : 'Shopping on Cellex — Nigeria\'s #1 social marketplace.');

  const followingCount = following.length;
  const followersCount = publicProfile?.followers || 0;
  // Posts & Reviews = seller posts (if seller) + reviews by user + liked items
  const postsCount =
    (publicProfile?.posts || 0) + reviews.length + wishlist.length;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'activity', label: 'Activity Feed' },
    { key: 'orders', label: 'Orders' },
    { key: 'saved', label: 'Saved' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        paddingBottom: '112px', // clear the global bottom nav + safe area
      }}
    >
      {/* ===== Header (sticky, 64px) ===== */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4"
        style={{
          height: '64px',
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: '18px', color: COLORS.text }}
        >
          Profile
        </h1>
        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="flex items-center justify-center transition-opacity active:opacity-70"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: COLORS.lightBg,
            }}
            aria-label="Notifications"
          >
            <Bell
              className="w-5 h-5"
              style={{ color: COLORS.text }}
              strokeWidth={1.75}
            />
          </Link>
          <Link
            href="/settings"
            className="flex items-center justify-center transition-opacity active:opacity-70"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: COLORS.lightBg,
            }}
            aria-label="Settings"
          >
            <SettingsIcon
              className="w-5 h-5"
              style={{ color: COLORS.text }}
              strokeWidth={1.75}
            />
          </Link>
        </div>
      </header>

      {/* ===== Profile Card ===== */}
      <section
        style={{
          padding: '20px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
        }}
      >
        {/* Avatar + name + handle + bio */}
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '999px',
              background: COLORS.lightBg,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {avatarUrl ? (
              <SmartImage
                src={avatarUrl}
                alt={fullName}
                width={72}
                height={72}
                blur={false}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <span
                className="font-bold"
                style={{ fontSize: '28px', color: COLORS.text }}
              >
                {fullName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2
              className="font-bold truncate"
              style={{ fontSize: '18px', color: COLORS.text }}
            >
              {fullName}
              {isSeller && (
                <span
                  className="ml-2 inline-flex items-center gap-1 align-middle"
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: COLORS.text,
                    background: COLORS.lightBg,
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  <Store className="w-3 h-3" strokeWidth={2} /> SELLER
                </span>
              )}
            </h2>
            <p
              className="truncate"
              style={{ fontSize: '14px', color: COLORS.secondary, marginTop: '2px' }}
            >
              @{handle}
            </p>
            <p
              className="line-clamp-2"
              style={{
                fontSize: '14px',
                color: COLORS.body,
                marginTop: '6px',
                lineHeight: 1.4,
              }}
            >
              {bio}
            </p>
          </div>
        </div>

        {/* Stats row: Following | Followers | Posts & Reviews */}
        <div
          className="flex items-center"
          style={{ gap: '24px', marginTop: '20px' }}
        >
          <Stat value={followingCount} label="Following" />
          <Stat value={followersCount} label="Followers" />
          <Stat value={postsCount} label="Posts & Reviews" />
        </div>

        {/* Edit Profile button — full-width pill, #F3F4F6 bg, chevron */}
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="w-full flex items-center justify-center gap-2 transition-opacity active:opacity-70"
          style={{
            height: '44px',
            marginTop: '20px',
            background: COLORS.lightBg,
            color: COLORS.text,
            borderRadius: '999px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Edit Profile
          <ChevronRight
            className="w-4 h-4"
            style={{ color: COLORS.text }}
            strokeWidth={2}
          />
        </button>
      </section>

      {/* ===== Tab Bar (segmented control, sticky below header) ===== */}
      <div
        className="sticky z-20 flex"
        style={{
          top: '64px',
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: '12px 16px 0',
        }}
      >
        {tabs.map((tab) => {
          const isActive = view === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className="flex-1 text-center transition-colors"
              style={{
                paddingBottom: '12px',
                fontSize: '14px',
                fontWeight: 600,
                color: isActive ? COLORS.text : COLORS.secondary,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${COLORS.text}`
                  : '2px solid transparent',
                cursor: 'pointer',
              }}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== Tab content ===== */}
      <main>
        {/* ----- ACTIVITY FEED ----- */}
        {view === 'activity' && (
          <div
            className="flex flex-col"
            style={{ padding: '16px', gap: '12px' }}
          >
            {activities.length === 0 ? (
              <EmptyState
                icon={
                  <Sparkles
                    className="w-6 h-6"
                    style={{ color: COLORS.muted }}
                  />
                }
                title="No activity yet"
                message="Like products, follow sellers, and place orders — your activity will show up here."
                cta={
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center"
                    style={{
                      height: '44px',
                      padding: '0 24px',
                      background: COLORS.text,
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Browse products
                  </Link>
                }
              />
            ) : (
              activities.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))
            )}
          </div>
        )}

        {/* ----- ORDERS ----- */}
        {view === 'orders' && (
          <div
            className="flex flex-col"
            style={{ padding: '16px', gap: '12px' }}
          >
            {orders.length === 0 ? (
              <EmptyState
                icon={
                  <Package
                    className="w-6 h-6"
                    style={{ color: COLORS.muted }}
                  />
                }
                title="No orders yet"
                message="When you place your first order, it will appear here."
                cta={
                  <Link
                    href="/categories"
                    className="inline-flex items-center justify-center"
                    style={{
                      height: '44px',
                      padding: '0 24px',
                      background: COLORS.text,
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Start shopping
                  </Link>
                }
              />
            ) : (
              orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </div>
        )}

        {/* ----- SAVED / WISHLIST ----- */}
        {view === 'saved' && (
          <div style={{ padding: '16px' }}>
            {wishlist.length === 0 ? (
              <EmptyState
                icon={
                  <Bookmark
                    className="w-6 h-6"
                    style={{ color: COLORS.muted }}
                  />
                }
                title="No saved items"
                message="Tap the bookmark on any product to save it for later."
                cta={
                  <Link
                    href="/categories"
                    className="inline-flex items-center justify-center"
                    style={{
                      height: '44px',
                      padding: '0 24px',
                      background: COLORS.text,
                      color: '#FFFFFF',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Discover products
                  </Link>
                }
              />
            ) : (
              <div
                className="grid grid-cols-2"
                style={{ gap: '12px' }}
              >
                {wishlist.map((item) => (
                  <SavedCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeWishlist(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== Footer actions (logout) ===== */}
      <div style={{ padding: '24px 16px 8px' }}>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full"
          style={{
            height: '44px',
            borderRadius: '999px',
            background: 'transparent',
            color: '#EF4444',
            border: `1px solid ${COLORS.border}`,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
        <p
          className="text-center"
          style={{
            fontSize: '11px',
            color: COLORS.muted,
            marginTop: '12px',
          }}
        >
          Cellex · Nigeria&apos;s #1 social marketplace
        </p>
      </div>
    </div>
  );
}

/* ===================== Stat ===================== */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <span
        className="font-bold"
        style={{ fontSize: '18px', color: COLORS.text, lineHeight: 1.1 }}
      >
        {value.toLocaleString()}
      </span>
      <span
        style={{ fontSize: '13px', color: COLORS.secondary, marginTop: '2px' }}
      >
        {label}
      </span>
    </div>
  );
}

/* ===================== Activity Card ===================== */
function ActivityCard({ activity }: { activity: Activity }) {
  const {
    type,
    productName,
    productImage,
    productPrice,
    productId,
    sellerName,
    sellerImage,
    sellerSlug,
    sellerId,
    rating,
    reviewComment,
    reviewTitle,
    createdAt,
  } = activity;

  // Pick the icon + colors for this activity type
  let Icon = Heart;
  let bg: string = COLORS.likedBg;
  let fg: string = COLORS.likedFg;
  let actionText = 'Liked';
  if (type === 'purchased') {
    Icon = ShoppingBag;
    bg = COLORS.purchasedBg;
    fg = COLORS.purchasedFg;
    actionText = 'Purchased';
  } else if (type === 'followed') {
    Icon = UserPlus;
    bg = COLORS.followedBg;
    fg = COLORS.followedFg;
    actionText = 'Followed';
  } else if (type === 'reviewed') {
    Icon = Star;
    bg = COLORS.reviewedBg;
    fg = COLORS.reviewedFg;
    actionText = 'Wrote a review';
  }

  // Build the right-side tile (thumbnail+price for product activities,
  // seller avatar for follows)
  let rightTile: React.ReactNode = null;
  if (type === 'liked' || type === 'purchased' || type === 'reviewed') {
    const productHref = productId ? `/product?id=${productId}` : '#';
    rightTile = (
      <Link
        href={productHref}
        className="flex items-center gap-2 shrink-0 transition-opacity active:opacity-70"
      >
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            background: COLORS.lightBg,
          }}
        >
          {productImage ? (
            <SmartImage
              src={productImage}
              alt={productName || 'Product'}
              width={44}
              height={44}
              blur={false}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Package
              className="w-5 h-5"
              style={{ color: COLORS.muted }}
              strokeWidth={1.5}
            />
          )}
        </div>
        {typeof productPrice === 'number' && (
          <span
            className="font-bold"
            style={{ fontSize: '14px', color: COLORS.text }}
          >
            {formatPrice(productPrice)}
          </span>
        )}
      </Link>
    );
  } else if (type === 'followed') {
    const sellerHref = sellerSlug
      ? `/${sellerSlug}`
      : sellerId
      ? `/seller-profile?id=${sellerId}`
      : '#';
    rightTile = (
      <Link
        href={sellerHref}
        className="shrink-0 transition-opacity active:opacity-70"
      >
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            background: COLORS.lightBg,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {sellerImage ? (
            <SmartImage
              src={sellerImage}
              alt={sellerName || 'Seller'}
              width={40}
              height={40}
              blur={false}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <span
              className="font-bold"
              style={{ fontSize: '16px', color: COLORS.text }}
            >
              {(sellerName || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <article
      className="flex items-center gap-3"
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '16px',
        padding: '16px',
      }}
    >
      {/* Left: colored icon circle */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          background: bg,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: fg }}
          strokeWidth={2}
          fill={type === 'liked' ? fg : 'none'}
        />
      </div>

      {/* Middle: action text + (rating / snippet) + time */}
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{ fontSize: '14px', color: COLORS.text, fontWeight: 500 }}
        >
          {actionText}
          {productName ? (
            <>
              {' '}
              <span style={{ fontWeight: 700 }}>{productName}</span>
            </>
          ) : null}
          {sellerName ? (
            <>
              {' '}
              <span style={{ fontWeight: 700 }}>{sellerName}</span>
            </>
          ) : null}
        </p>

        {type === 'reviewed' && (
          <div
            className="flex items-center gap-1"
            style={{ marginTop: '4px' }}
          >
            <div className="flex items-center" style={{ gap: '1px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-3 h-3"
                  style={{
                    color: COLORS.reviewedFg,
                  }}
                  strokeWidth={2}
                  fill={s <= (rating || 0) ? COLORS.reviewedFg : 'none'}
                />
              ))}
            </div>
            {(reviewComment || reviewTitle) && (
              <span
                className="truncate"
                style={{ fontSize: '12px', color: COLORS.secondary }}
              >
                {reviewTitle || reviewComment}
              </span>
            )}
          </div>
        )}

        {createdAt && (
          <p
            style={{
              fontSize: '12px',
              color: COLORS.secondary,
              marginTop: '4px',
            }}
          >
            {timeAgo(createdAt)}
          </p>
        )}
      </div>

      {/* Right: thumbnail + price, or seller avatar */}
      {rightTile}
    </article>
  );
}

/* ===================== Order Card ===================== */
function OrderCard({ order }: { order: any }) {
  const status = (order.status || 'pending').toLowerCase();
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const items = order.items || [];
  const itemCount = order.item_count || items.length || 0;
  const orderNumber = String(order.id || '').slice(0, 8);

  return (
    <article
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '16px',
        padding: '16px',
      }}
    >
      {/* Top row: order# + date / status */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            Order #{orderNumber}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: COLORS.secondary,
              marginTop: '2px',
            }}
          >
            {order.created_at ? timeAgo(order.created_at) : ''}
          </p>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: statusStyle.fg,
            background: statusStyle.bg,
            padding: '4px 10px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Item thumbnails */}
      {items.length > 0 && (
        <div
          className="flex items-center"
          style={{ gap: '8px', marginTop: '12px' }}
        >
          {items.slice(0, 4).map((item: any, i: number) => {
            const product = item.products || item.product;
            const img = product?.image_url || item.image_url;
            return (
              <Link
                key={i}
                href={`/product?id=${item.product_id || product?.id}`}
                className="shrink-0 transition-opacity active:opacity-70"
              >
                <div
                  className="overflow-hidden flex items-center justify-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: COLORS.lightBg,
                  }}
                >
                  {img ? (
                    <SmartImage
                      src={img}
                      alt={item.product_name || product?.name || 'Product'}
                      width={48}
                      height={48}
                      blur={false}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Package
                      className="w-5 h-5"
                      style={{ color: COLORS.muted }}
                      strokeWidth={1.5}
                    />
                  )}
                </div>
              </Link>
            );
          })}
          {items.length > 4 && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: COLORS.lightBg,
                fontSize: '12px',
                fontWeight: 700,
                color: COLORS.secondary,
              }}
            >
              +{items.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Bottom row: item count + total + view link */}
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <span style={{ fontSize: '13px', color: COLORS.secondary }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-bold"
            style={{ fontSize: '15px', color: COLORS.text }}
          >
            {formatPrice(order.total || 0)}
          </span>
          <Link
            href="/orders"
            className="flex items-center transition-opacity active:opacity-70"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: COLORS.text,
            }}
            aria-label="View order details"
          >
            <ChevronRight
              className="w-4 h-4"
              style={{ color: COLORS.text }}
              strokeWidth={2}
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ===================== Saved Card ===================== */
function SavedCard({
  item,
  onRemove,
}: {
  item: any;
  onRemove: () => void;
}) {
  const product = item.products || item.product;
  if (!product) return null;
  const href = `/product?id=${product.id}`;

  return (
    <article
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Square image with remove button overlay */}
      <Link href={href} className="block relative">
        <div
          style={{
            aspectRatio: '1 / 1',
            background: COLORS.lightBg,
            position: 'relative',
          }}
        >
          <SmartImage
            src={product.image_url}
            alt={product.name}
            width={300}
            height={300}
            blur={false}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="flex items-center justify-center"
          aria-label="Remove from wishlist"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <X
            className="w-4 h-4"
            style={{ color: COLORS.secondary }}
            strokeWidth={2}
          />
        </button>
      </Link>

      {/* Name + price */}
      <div style={{ padding: '12px' }}>
        <Link href={href}>
          <h3
            className="line-clamp-2"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: COLORS.text,
              lineHeight: 1.3,
              minHeight: '36px',
            }}
          >
            {product.name}
          </h3>
        </Link>
        <p
          className="font-bold"
          style={{
            fontSize: '15px',
            color: COLORS.text,
            marginTop: '6px',
          }}
        >
          {formatPrice(product.price)}
        </p>
      </div>
    </article>
  );
}

/* ===================== Empty State ===================== */
function EmptyState({
  icon,
  title,
  message,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ padding: '48px 16px' }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          background: COLORS.lightBg,
          marginBottom: '12px',
        }}
      >
        {icon}
      </div>
      <p
        className="font-bold"
        style={{ fontSize: '15px', color: COLORS.text }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: '13px',
          color: COLORS.secondary,
          marginTop: '4px',
          maxWidth: '320px',
        }}
      >
        {message}
      </p>
      {cta && <div style={{ marginTop: '16px' }}>{cta}</div>}
    </div>
  );
}
