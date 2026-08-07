'use client';

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import InternalLink from '@/components/internal-link';
import { api, formatPrice, timeAgo, type Product } from '@/lib/api';
import { API_BASE } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { SmartImage } from '@/components/smart-image';
import { StorefrontAvatarPlayer } from '@/components/storefront-avatar-player';
import { useScrollPreservation } from '@/components/global-state-provider';
import {
  ChevronLeft,
  Share2,
  MapPin,
  Globe,
  Heart,
  MessageCircle,
  Star,
  Store,
  Package,
  Clock,
  TrendingUp,
  BadgeCheck,
  Sparkles,
  ShoppingBag,
  MessageSquare,
  Check,
  Plus,
} from 'lucide-react';

/**
 * SellerStorefront — Screen 9 mobile seller/store page.
 *
 * Route: /<slug>  →  dynamic storefront page (public, no auth required).
 *
 * Layout (top → bottom, matching Screen 9 exactly):
 *  1. Cover image (200px tall, full-bleed) — back button (top-left, 40px white circle)
 *     + share button (top-right, 40px white circle)
 *  2. Profile section (overlapping cover, padding 16px) — 80px avatar (border 4px white,
 *     -40px margin-top), name + verified checkmark (blue #3B82F6), bio (14px #374151,
 *     line-clamp-2), location (13px #6B7280 with map pin), website link (13px #3B82F6),
 *     buttons row: Follow (black pill #111827) + Message (white pill, #E5E7EB border) +
 *     share icon button
 *  3. Stats bar (bg #F3F4F6, radius 16px, margin 16px) — Posts | Followers | Following,
 *     each flex-1, text-center, number (18px 700 #111827) + label (13px #6B7280)
 *  4. Tab bar (segmented control, sticky) — Posts | Shop | Reviews | About
 *     Active: #111827 bold + 2px #111827 border-bottom; Inactive: #6B7280
 *  5. Tab content:
 *     - Posts: vertical list of seller's activity-feed items (api.social.sellerFeed)
 *     - Shop: 2-column grid of product cards (square image + price tag + heart + title
 *       + engagement stats + status badge)
 *     - Reviews: list of seller reviews (api.reviews.bySeller)
 *     - About: business_description + category + location + joined date + response time
 *  6. Seller stats section (3 white cards with border) — Rating (with stars) | Sales |
 *     Response Time
 *  7. Similar sellers (horizontal scroll) — avatar + name + follow button
 *
 * API logic kept (per task spec):
 *   - api.social.publicProfile(sellerId)  → followers count, posts count, isFollowing
 *   - api.social.sellerFeed(sellerId)     → activity-feed posts for the Posts tab
 *   - api.social.follow / unfollow         → toggle follow state
 *   - api.social.discover()                → similar sellers
 *   - api.reviews.bySeller(sellerId)       → reviews tab + rating calculation
 *   - api.products (via /api/seller-by-slug) → shop tab
 *   - api.wishlist.add                     → heart on product cards
 *   - api.feedback                         → engagement signals
 *
 * The bottom nav is rendered globally by NavShell — this page just adds paddingBottom
 * so content clears the fixed bottom bar + safe-area inset.
 */

// ---- Color tokens (Screen 7/9 palette) ----
const COLORS = {
  bg: '#FFFFFF',
  text: '#111827',
  secondary: '#6B7280',
  body: '#374151',
  muted: '#9CA3AF',
  lightBg: '#F3F4F6',
  border: '#E5E7EB',
  blue: '#3B82F6', // verified checkmark + website link (spec-mandated)
  red: '#EF4444', // liked heart
  amber: '#F59E0B', // review stars
  green: '#10B981', // response time / sales positive
} as const;

type TabKey = 'posts' | 'shop' | 'reviews' | 'about';

export default function SellerStorefront({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  // Preserve scroll position when navigating away and back.
  useScrollPreservation('storefront');

  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [publicProfile, setPublicProfile] = useState<any>(null);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similarSellers, setSimilarSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [savedProducts, setSavedProducts] = useState<Set<number>>(new Set());
  // Lazy initial state — read URL hash (#shop, #reviews, #about) so users can
  // deep-link a specific tab. Avoids setState-in-effect.
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'shop';
    const hash = window.location.hash.replace('#', '') as TabKey;
    return hash === 'posts' || hash === 'shop' || hash === 'reviews' || hash === 'about'
      ? hash
      : 'shop';
  });

  // Sync the hash back to the URL whenever the active tab changes (no setState —
  // just URL replacement, so the react-hooks/set-state-in-effect rule is satisfied).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  // ===== Load seller + products + social profile + feed + reviews + similar =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. Public seller lookup by slug (no auth required)
        const resp = await fetch(`${API_BASE}/api/seller-by-slug`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        const data = await resp.json();
        if (!data.success || !data.seller) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (cancelled) return;
        setSeller(data.seller);
        setProducts(data.products || []);

        const sellerId = data.seller.id;
        const viewerId = user?.id || null;

        // 2. Parallel fetch — every endpoint is best-effort so a single failure
        // doesn't break the whole page.
        const [profileResp, feedResp, reviewsResp, discoverResp] = await Promise.all([
          api.social.publicProfile(sellerId, viewerId).catch(() => null),
          api.social.sellerFeed(sellerId, 20).catch(() => null),
          api.reviews.bySeller(sellerId).catch(() => null),
          api.social.discover(12).catch(() => null),
        ]);

        if (cancelled) return;

        if (profileResp?.success) {
          setIsFollowing(!!profileResp.isFollowing);
          // The edge function returns stats: { followers, posts }, but older
          // deployments may flatten to top-level — read both safely.
          const f =
            profileResp.stats?.followers ??
            profileResp.followers ??
            0;
          const p =
            profileResp.stats?.posts ?? profileResp.posts ?? 0;
          setFollowers(f);
          setPostsCount(p);
        }

        if (feedResp?.success) {
          setFeedItems(feedResp.items || []);
        }
        if (reviewsResp?.success) {
          setReviews(reviewsResp.reviews || []);
        }
        if (discoverResp?.success) {
          // Filter out the current seller + dedupe
          const others = (discoverResp.sellers || []).filter(
            (s: any) => s.id !== sellerId
          );
          setSimilarSellers(others.slice(0, 10));
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, user?.id]);

  // ===== Follow / unfollow the main seller =====
  const toggleFollow = async () => {
    if (!user) {
      router.push(`/login?next=/${slug}`);
      return;
    }
    if (!seller) return;
    const result = isFollowing
      ? await api.social.unfollow(seller.id)
      : await api.social.follow(seller.id);
    if (result.success) {
      setIsFollowing(!isFollowing);
      setFollowers((f) => Math.max(0, f + (isFollowing ? -1 : 1)));
      toast({
        title: isFollowing ? 'Unfollowed' : 'Following',
        description: seller.business_name,
      });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  // ===== Follow / unfollow a similar seller (card button) =====
  const toggleSimilarFollow = async (sellerId: string) => {
    if (!user) {
      router.push(`/login?next=/${slug}`);
      return;
    }
    const isCurrentlyFollowing = followedSet.has(sellerId);
    const result = isCurrentlyFollowing
      ? await api.social.unfollow(sellerId)
      : await api.social.follow(sellerId);
    if (result.success) {
      setFollowedSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) next.delete(sellerId);
        else next.add(sellerId);
        return next;
      });
    }
  };

  // ===== Share store URL =====
  const shareStore = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator
        .share({ title: seller?.business_name, url })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast({ title: 'Store link copied!' });
    }
  };

  // ===== Toggle wishlist on a product (heart icon in Shop tab) =====
  const toggleProductLike = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=/${slug}`);
      return;
    }
    const isLiked = savedProducts.has(product.id);
    setSavedProducts((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
    if (!isLiked) {
      api.wishlist.add(product.id).catch(() => {});
      api
        .feedback(`product:${product.id}`, 'like', 1.0, { page: 'storefront' })
        .catch(() => {});
      toast({ title: 'Added to wishlist', description: product.name });
    } else {
      api
        .feedback(`product:${product.id}`, 'unlike', 0.0, { page: 'storefront' })
        .catch(() => {});
    }
  };

  // ===== Reviews-derived metrics for the Seller Stats section =====
  // (Hoisted before the early-return loading guard so the react-hooks/rules-of-hooks
  // rule is satisfied — useMemo must run in the same order on every render.)
  const ratingSummary = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce(
      (s, r) => s + (Number(r.rating) || 0),
      0
    );
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const totalSales = useMemo(
    () =>
      products.reduce(
        (s, p) => s + (Number(p.units_sold) || 0),
        0
      ),
    [products]
  );

  // ===== Loading & not-found states =====
  if (loading) {
    return <PageSkeleton variant="seller-profile" />;
  }

  if (notFound || !seller) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center px-6"
        style={{ background: COLORS.bg, paddingBottom: '120px' }}
      >
        <div
          className="flex items-center justify-center mx-auto mb-4"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '999px',
            background: COLORS.lightBg,
          }}
        >
          <Store className="w-10 h-10" style={{ color: COLORS.muted }} strokeWidth={1.5} />
        </div>
        <h1
          className="font-bold mb-2"
          style={{ fontSize: '20px', color: COLORS.text }}
        >
          Storefront Not Found
        </h1>
        <p
          className="mb-6 max-w-xs"
          style={{ fontSize: '14px', color: COLORS.secondary, lineHeight: 1.5 }}
        >
          The store{' '}
          <span className="font-mono font-semibold">/{slug}</span> doesn&apos;t exist, or
          the seller may have changed their name.
        </p>
        <InternalLink
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
          Go to homepage
        </InternalLink>
      </div>
    );
  }

  const name = seller.business_name || seller.farm_name || 'Store';
  const bio =
    seller.business_description ||
    seller.farm_name ||
    `Welcome to ${name}'s store on Cellex — Nigeria's #1 social marketplace.`;
  const location = seller.business_location || '';
  const website = seller.website || seller.website_url || `cellex.app/${slug}`;
  const category = seller.business_category || '';
  const joinedDate = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';
  const isVerified = seller.verified || seller.seller_type === 'verified';

  // Stats bar numbers
  const totalPosts = postsCount || feedItems.length || products.length;
  const totalFollowing = seller.following_count || 0; // sellers don't follow others typically

  // Shop tab — product cards
  const productCards = products;

  // ===== Tabs =====
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'shop', label: 'Shop' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'about', label: 'About' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        paddingBottom: '120px', // clear the global bottom nav + safe area
      }}
    >
      {/* ============================================================
          1. COVER IMAGE (200px, full-bleed, with back + share overlays)
          ============================================================ */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '200px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #111827 0%, #374151 50%, #6B7280 100%)',
        }}
      >
        {seller.profile_image && (
          <>
            <img
              src={seller.profile_image}
              alt=""
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(28px)',
                transform: 'scale(1.3)',
                opacity: 0.55,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(17,24,39,0.45) 0%, rgba(17,24,39,0.35) 100%)',
              }}
            />
          </>
        )}

        {/* Back button — top-left, 40px white circle */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex items-center justify-center "
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            background: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: COLORS.text }} strokeWidth={2.25} />
        </button>

        {/* Share button — top-right, 40px white circle */}
        <button
          type="button"
          onClick={shareStore}
          aria-label="Share store"
          className="flex items-center justify-center "
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            background: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Share2 className="w-5 h-5" style={{ color: COLORS.text }} strokeWidth={2} />
        </button>
      </div>

      {/* ============================================================
          2. PROFILE SECTION (avatar overlapping cover + name + bio +
          location + website + follow / message / share buttons)
          ============================================================ */}
      <section style={{ padding: '0 16px 16px' }}>
        {/* Avatar — 80px circle, 4px white border, pulled up -40px to overlap cover */}
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '999px',
            border: '4px solid #FFFFFF',
            marginTop: '-40px',
            background: COLORS.lightBg,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {seller.profile_image ? (
            <SmartImage
              src={seller.profile_image}
              alt={name}
              width={80}
              height={80}
              blur={false}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <span
              className="font-bold"
              style={{ fontSize: '32px', color: COLORS.text }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + verified checkmark */}
        <div
          className="flex items-center gap-1.5"
          style={{ marginTop: '12px' }}
        >
          <h1
            className="font-bold truncate"
            style={{ fontSize: '20px', color: COLORS.text }}
          >
            {name}
          </h1>
          {isVerified && (
            <BadgeCheck
              className="w-5 h-5 shrink-0"
              style={{ color: COLORS.blue }}
              fill={COLORS.blue}
              strokeWidth={2}
            />
          )}
        </div>

        {/* Bio — 14px #374151, max 2 lines */}
        {bio && (
          <p
            className="line-clamp-2"
            style={{
              fontSize: '14px',
              color: COLORS.body,
              lineHeight: 1.5,
              marginTop: '6px',
            }}
          >
            {bio}
          </p>
        )}

        {/* Location + website row */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: '14px', marginTop: '10px' }}
        >
          {location && (
            <span
              className="inline-flex items-center gap-1"
              style={{ fontSize: '13px', color: COLORS.secondary }}
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: COLORS.secondary }} strokeWidth={2} />
              {location}
            </span>
          )}
          <a
            href={
              website.startsWith('http')
                ? website
                : `https://${website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-opacity active:opacity-70"
            style={{ fontSize: '13px', color: COLORS.blue, fontWeight: 500 }}
          >
            <Globe className="w-3.5 h-3.5" style={{ color: COLORS.blue }} strokeWidth={2} />
            {website.replace(/^https?:\/\//, '')}
          </a>
        </div>

        {/* Buttons row — Follow (black pill) + Message (white pill) + share icon */}
        <div
          className="flex items-center"
          style={{ gap: '10px', marginTop: '16px' }}
        >
          <button
            type="button"
            onClick={toggleFollow}
            className="flex-1 flex items-center justify-center transition-opacity active:opacity-80"
            style={{
              height: '44px',
              borderRadius: '999px',
              background: isFollowing ? '#FFFFFF' : COLORS.text,
              color: isFollowing ? COLORS.text : '#FFFFFF',
              border: isFollowing ? `1px solid ${COLORS.border}` : 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            aria-pressed={isFollowing}
          >
            {isFollowing ? (
              <>
                <Check className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                Following
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                Follow
              </>
            )}
          </button>
          <InternalLink
            href={`/messenger?seller=${seller.id}`}
            className="flex-1 flex items-center justify-center transition-opacity active:opacity-80"
            style={{
              height: '44px',
              borderRadius: '999px',
              background: '#FFFFFF',
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              fontSize: '14px',
              fontWeight: 600,
            }}
            aria-label="Message seller"
          >
            <MessageCircle className="w-4 h-4 mr-1.5" strokeWidth={2} />
            Message
          </InternalLink>
          <button
            type="button"
            onClick={shareStore}
            aria-label="Share store"
            className="flex items-center justify-center transition-opacity active:opacity-70"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '999px',
              background: '#FFFFFF',
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Share2 className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* ============================================================
          2.5. AI SELLER AVATAR (trust builder)
          Shows the seller's AI talking avatar with their introduction script.
          Only appears if the seller has created an avatar.
          ============================================================ */}
      {seller.avatar_script && (
        <StorefrontAvatarPlayer
          sellerName={name}
          sellerImage={seller.profile_image}
          script={seller.avatar_script}
          audioUrl={seller.avatar_audio_url}
          language={seller.avatar_language || 'en'}
        />
      )}

      {/* ============================================================
          3. STATS BAR (bg #F3F4F6, radius 16px, margin 16px)
          Posts | Followers | Following — number 18px 700 + label 13px #6B7280
          ============================================================ */}
      <section style={{ padding: '0 16px' }}>
        <div
          className="flex items-center"
          style={{
            background: COLORS.lightBg,
            borderRadius: '16px',
            padding: '16px',
          }}
        >
          <StatCell value={totalPosts} label="Posts" />
          <Divider />
          <StatCell value={followers} label="Followers" />
          <Divider />
          <StatCell value={totalFollowing} label="Following" />
        </div>
      </section>

      {/* ============================================================
          4. TAB BAR (segmented control, sticky below the cover)
          Posts | Shop | Reviews | About
          ============================================================ */}
      <div
        className="sticky z-20 flex"
        style={{
          top: 0,
          marginTop: '16px',
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: '0 16px',
        }}
      >
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex-1 text-center transition-colors"
              style={{
                paddingBottom: '12px',
                paddingTop: '12px',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
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
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================
          5. TAB CONTENT
          ============================================================ */}
      <main>
        {/* ----- POSTS TAB ----- */}
        {tab === 'posts' && (
          <div
            className="flex flex-col"
            style={{ padding: '16px', gap: '12px' }}
          >
            {feedItems.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="w-6 h-6" style={{ color: COLORS.muted }} />}
                title="No posts yet"
                message={`When ${name} posts updates, new products, or stories, they'll show up here.`}
              />
            ) : (
              feedItems.map((item) => (
                <PostCard key={item.id} item={item} />
              ))
            )}
          </div>
        )}

        {/* ----- SHOP TAB ----- */}
        {tab === 'shop' && (
          <div style={{ padding: '16px' }}>
            {productCards.length === 0 ? (
              <EmptyState
                icon={<Package className="w-6 h-6" style={{ color: COLORS.muted }} />}
                title="No products yet"
                message={`When ${name} adds products to their store, they'll appear here.`}
              />
            ) : (
              <div
                className="grid grid-cols-2"
                style={{ gap: '12px' }}
              >
                {productCards.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isLiked={savedProducts.has(p.id)}
                    onLike={(e) => toggleProductLike(e, p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----- REVIEWS TAB ----- */}
        {tab === 'reviews' && (
          <div
            className="flex flex-col"
            style={{ padding: '16px', gap: '12px' }}
          >
            {/* Rating summary card */}
            <div
              style={{
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '16px',
                padding: '16px',
              }}
            >
              <div className="flex items-center" style={{ gap: '14px' }}>
                <span
                  className="font-bold"
                  style={{ fontSize: '36px', color: COLORS.text, lineHeight: 1 }}
                >
                  {ratingSummary.avg.toFixed(1)}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center" style={{ gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="w-4 h-4"
                        style={{
                          color: COLORS.amber,
                        }}
                        fill={
                          s <= Math.round(ratingSummary.avg)
                            ? COLORS.amber
                            : 'none'
                        }
                        strokeWidth={2}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      color: COLORS.secondary,
                      marginTop: '4px',
                    }}
                  >
                    Based on {ratingSummary.count} review
                    {ratingSummary.count === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual reviews */}
            {reviews.length === 0 ? (
              <EmptyState
                icon={<Star className="w-6 h-6" style={{ color: COLORS.muted }} />}
                title="No reviews yet"
                message={`Be the first to review products from ${name}.`}
              />
            ) : (
              reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </div>
        )}

        {/* ----- ABOUT TAB ----- */}
        {tab === 'about' && (
          <div style={{ padding: '16px' }}>
            <div
              style={{
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '16px',
                padding: '16px',
              }}
            >
              {/* About title */}
              <h2
                className="font-bold"
                style={{ fontSize: '16px', color: COLORS.text }}
              >
                About {name}
              </h2>

              {/* Description */}
              {bio && (
                <p
                  style={{
                    fontSize: '14px',
                    color: COLORS.body,
                    lineHeight: 1.55,
                    marginTop: '10px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {bio}
                </p>
              )}

              {/* Meta rows */}
              <div
                className="flex flex-col"
                style={{ gap: '12px', marginTop: '16px' }}
              >
                {category && (
                  <MetaRow
                    icon={<Store className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                    label="Category"
                    value={category}
                  />
                )}
                {location && (
                  <MetaRow
                    icon={<MapPin className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                    label="Location"
                    value={location}
                  />
                )}
                <MetaRow
                  icon={<Package className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                  label="Products"
                  value={`${products.length} listed`}
                />
                <MetaRow
                  icon={<TrendingUp className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                  label="Total sales"
                  value={`${totalSales} sold`}
                />
                <MetaRow
                  icon={<Star className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                  label="Rating"
                  value={
                    ratingSummary.count > 0
                      ? `${ratingSummary.avg.toFixed(1)} (${ratingSummary.count} review${
                          ratingSummary.count === 1 ? '' : 's'
                        })`
                      : 'No reviews yet'
                  }
                />
                {joinedDate && (
                  <MetaRow
                    icon={<Clock className="w-4 h-4" style={{ color: COLORS.secondary }} strokeWidth={2} />}
                    label="Joined"
                    value={joinedDate}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================
          6. SELLER STATS SECTION (3 white cards with border)
          Rating | Sales | Response Time
          ============================================================ */}
      <section style={{ padding: '8px 16px 16px' }}>
        <h2
          className="font-bold"
          style={{ fontSize: '16px', color: COLORS.text, marginBottom: '12px' }}
        >
          Seller Stats
        </h2>
        <div className="grid grid-cols-3" style={{ gap: '8px' }}>
          {/* Rating card */}
          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '14px',
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div className="flex items-center justify-center" style={{ gap: '2px', marginBottom: '6px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-3 h-3"
                  style={{ color: COLORS.amber }}
                  fill={s <= Math.round(ratingSummary.avg) ? COLORS.amber : 'none'}
                  strokeWidth={2}
                />
              ))}
            </div>
            <div
              className="font-bold"
              style={{ fontSize: '16px', color: COLORS.text }}
            >
              {ratingSummary.count > 0 ? ratingSummary.avg.toFixed(1) : 'New'}
            </div>
            <div
              style={{ fontSize: '11px', color: COLORS.secondary, marginTop: '2px' }}
            >
              {ratingSummary.count > 0
                ? `${ratingSummary.count} review${ratingSummary.count === 1 ? '' : 's'}`
                : 'No reviews'}
            </div>
          </div>

          {/* Sales card */}
          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '14px',
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: '#D1FAE5',
                marginBottom: '6px',
              }}
            >
              <ShoppingBag
                className="w-4 h-4"
                style={{ color: COLORS.green }}
                strokeWidth={2}
              />
            </div>
            <div
              className="font-bold"
              style={{ fontSize: '16px', color: COLORS.text }}
            >
              {formatCount(totalSales)}
            </div>
            <div
              style={{ fontSize: '11px', color: COLORS.secondary, marginTop: '2px' }}
            >
              Sales
            </div>
          </div>

          {/* Response Time card */}
          <div
            style={{
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '14px',
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: '#DBEAFE',
                marginBottom: '6px',
              }}
            >
              <Clock
                className="w-4 h-4"
                style={{ color: COLORS.blue }}
                strokeWidth={2}
              />
            </div>
            <div
              className="font-bold"
              style={{ fontSize: '14px', color: COLORS.text }}
            >
              ~1 hour
            </div>
            <div
              style={{ fontSize: '11px', color: COLORS.secondary, marginTop: '2px' }}
            >
              Response
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          7. SIMILAR SELLERS (horizontal scroll)
          avatar + name + follow button
          ============================================================ */}
      {similarSellers.length > 0 && (
        <section style={{ padding: '8px 16px 16px' }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: '12px' }}
          >
            <h2
              className="font-bold"
              style={{ fontSize: '16px', color: COLORS.text }}
            >
              Similar Sellers
            </h2>
            <InternalLink
              href="/sellers"
              style={{
                fontSize: '13px',
                color: COLORS.secondary,
                fontWeight: 500,
              }}
            >
              See all
            </InternalLink>
          </div>

          <div
            className="flex overflow-x-auto"
            style={{
              gap: '12px',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {similarSellers.map((s) => {
              const sName =
                s.business_name || s.farm_name || 'Seller';
              const sId = s.id;
              const isFollowingThis = followedSet.has(sId);
              return (
                <div
                  key={sId}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '16px',
                    padding: '14px 12px',
                    width: '140px',
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  <InternalLink
                    href={
                      s.slug
                        ? `/${s.slug}`
                        : `/seller-profile?id=${sId}`
                    }
                    className="flex items-center justify-center mx-auto"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      background: COLORS.lightBg,
                      border: `1px solid ${COLORS.border}`,
                      marginBottom: '8px',
                    }}
                  >
                    {s.profile_image ? (
                      <SmartImage
                        src={s.profile_image}
                        alt={sName}
                        width={56}
                        height={56}
                        blur={false}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <span
                        className="font-bold"
                        style={{ fontSize: '22px', color: COLORS.text }}
                      >
                        {sName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </InternalLink>
                  <div
                    className="font-semibold truncate"
                    style={{
                      fontSize: '13px',
                      color: COLORS.text,
                      marginBottom: '6px',
                    }}
                  >
                    {sName}
                  </div>
                  {s.business_category && (
                    <div
                      className="truncate"
                      style={{
                        fontSize: '11px',
                        color: COLORS.secondary,
                        marginBottom: '8px',
                      }}
                    >
                      {s.business_category}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSimilarFollow(sId)}
                    className="w-full transition-opacity active:opacity-80"
                    style={{
                      height: '32px',
                      borderRadius: '999px',
                      background: isFollowingThis ? '#FFFFFF' : COLORS.text,
                      color: isFollowingThis ? COLORS.text : '#FFFFFF',
                      border: isFollowingThis
                        ? `1px solid ${COLORS.border}`
                        : 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    aria-pressed={isFollowingThis}
                  >
                    {isFollowingThis ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer trust note */}
      <div
        style={{
          padding: '8px 16px 0',
          textAlign: 'center',
          fontSize: '11px',
          color: COLORS.muted,
        }}
      >
        Cellex · Nigeria&apos;s #1 social marketplace
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center text-center"
      style={{ padding: '4px 8px' }}
    >
      <span
        className="font-bold"
        style={{ fontSize: '18px', color: COLORS.text, lineHeight: 1.2 }}
      >
        {formatCount(value)}
      </span>
      <span
        style={{ fontSize: '13px', color: COLORS.secondary, marginTop: '2px' }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: '1px',
        height: '28px',
        background: COLORS.border,
        flexShrink: 0,
      }}
    />
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start" style={{ gap: '10px' }}>
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          background: COLORS.lightBg,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: '12px', color: COLORS.secondary }}>{label}</div>
        <div
          className="font-medium"
          style={{ fontSize: '14px', color: COLORS.text, marginTop: '1px' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ padding: '48px 16px' }}
    >
      <div
        className="flex items-center justify-center mx-auto mb-4"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          background: COLORS.lightBg,
        }}
      >
        {icon}
      </div>
      <h3
        className="font-bold"
        style={{ fontSize: '15px', color: COLORS.text, marginBottom: '6px' }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '13px',
          color: COLORS.secondary,
          maxWidth: '320px',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
    </div>
  );
}

function PostCard({ item }: { item: any }) {
  const title = item.title || item.body?.slice(0, 80) || 'Update';
  const body = item.body || '';
  const img = item.image_url;
  const activityType = item.activity_type || 'post';
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {img && (
        <InternalLink
          href={
            item.entity_id && activityType === 'product_added'
              ? `/product?id=${item.entity_id}`
              : `/${item.seller_id ? '' : ''}`
          }
          className="block"
          style={{
            width: '100%',
            aspectRatio: '4 / 3',
            background: COLORS.lightBg,
            overflow: 'hidden',
          }}
        >
          <SmartImage
            src={img}
            alt={title}
            width={400}
            blur
            style={{ width: '100%', height: '100%' }}
          />
        </InternalLink>
      )}
      <div style={{ padding: '14px' }}>
        <div
          className="flex items-center"
          style={{ gap: '6px', marginBottom: '6px' }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: COLORS.secondary,
              background: COLORS.lightBg,
              padding: '2px 8px',
              borderRadius: '999px',
            }}
          >
            {activityType.replace(/_/g, ' ')}
          </span>
          {item.created_at && (
            <span style={{ fontSize: '12px', color: COLORS.muted }}>
              {timeAgo(item.created_at)}
            </span>
          )}
        </div>
        <h3
          className="font-semibold"
          style={{ fontSize: '15px', color: COLORS.text, lineHeight: 1.3 }}
        >
          {title}
        </h3>
        {body && body !== title && (
          <p
            style={{
              fontSize: '13px',
              color: COLORS.body,
              marginTop: '6px',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </p>
        )}
        {item.entity_id && activityType === 'product_added' && (
          <InternalLink
            href={`/product?id=${item.entity_id}`}
            className="inline-flex items-center mt-3"
            style={{
              fontSize: '13px',
              color: COLORS.blue,
              fontWeight: 600,
            }}
          >
            View product →
          </InternalLink>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  isLiked,
  onLike,
}: {
  product: Product;
  isLiked: boolean;
  onLike: (e: React.MouseEvent) => void;
}) {
  // Status badge: "New" if created within 7 days, "Best Seller" if units_sold > 10
  const isNew =
    product.created_at &&
    Date.now() - new Date(product.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  const isBestSeller = (product.units_sold || 0) >= 10;
  const badge = isBestSeller
    ? { label: 'Best Seller', bg: '#FEF3C7', fg: '#92400E' }
    : isNew
    ? { label: 'New', bg: '#D1FAE5', fg: '#065F46' }
    : null;

  // Engagement stats — use units_sold for "likes" placeholder, comments = 0 (no API)
  const likeCount = product.units_sold || 0;
  const commentCount = 0;

  return (
    <InternalLink
      href={`/product?id=${product.id}`}
      className="block transition-transform active:scale-[0.98]"
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Square image with price tag (top-left) + heart (top-right) + status badge */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: COLORS.lightBg,
          overflow: 'hidden',
        }}
      >
        <SmartImage
          src={product.image_url}
          alt={product.name}
          width={300}
          widths={[200, 300, 400]}
          blur
          style={{ width: '100%', height: '100%' }}
        />

        {/* Price tag — top-left, white bg pill */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: '#FFFFFF',
            color: COLORS.text,
            fontSize: '12px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '999px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}
        >
          {formatPrice(product.price)}
        </div>

        {/* Heart icon — top-right */}
        <button
          type="button"
          onClick={onLike}
          aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          className="flex items-center justify-center "
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Heart
            className="w-4 h-4"
            style={{ color: isLiked ? COLORS.red : COLORS.text }}
            fill={isLiked ? COLORS.red : 'none'}
            strokeWidth={2}
          />
        </button>

        {/* Status badge — bottom-left */}
        {badge && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              background: badge.bg,
              color: badge.fg,
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: '999px',
            }}
          >
            {badge.label}
          </div>
        )}
      </div>

      {/* Title + engagement stats */}
      <div style={{ padding: '10px 12px 12px' }}>
        <h3
          className="font-semibold line-clamp-2"
          style={{
            fontSize: '14px',
            color: COLORS.text,
            lineHeight: 1.35,
            minHeight: '38px',
          }}
        >
          {product.name}
        </h3>
        <div
          className="flex items-center"
          style={{ gap: '12px', marginTop: '8px' }}
        >
          <span
            className="inline-flex items-center gap-1"
            style={{ fontSize: '12px', color: COLORS.secondary }}
          >
            <Heart
              className="w-3.5 h-3.5"
              style={{ color: COLORS.secondary }}
              fill={isLiked ? COLORS.red : 'none'}
              strokeWidth={2}
            />
            {formatCount(likeCount)}
          </span>
          <span
            className="inline-flex items-center gap-1"
            style={{ fontSize: '12px', color: COLORS.secondary }}
          >
            <MessageSquare
              className="w-3.5 h-3.5"
              style={{ color: COLORS.secondary }}
              strokeWidth={2}
            />
            {formatCount(commentCount)}
          </span>
        </div>
      </div>
    </InternalLink>
  );
}

function ReviewCard({ review }: { review: any }) {
  const stars = Math.round(Number(review.rating) || 0);
  const reviewerName =
    review.reviewer_name ||
    review.user_name ||
    (review.user_email ? review.user_email.split('@')[0] : 'Buyer');
  const initials = reviewerName.charAt(0).toUpperCase();
  const verified = review.verified_purchase !== false;
  const date = review.created_at
    ? timeAgo(review.created_at)
    : '';

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '16px',
        padding: '14px',
      }}
    >
      <div className="flex items-start" style={{ gap: '10px' }}>
        <div
          className="flex items-center justify-center shrink-0 font-bold"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            background: COLORS.lightBg,
            color: COLORS.text,
            fontSize: '14px',
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: '6px' }}>
            <span
              className="font-semibold truncate"
              style={{ fontSize: '14px', color: COLORS.text }}
            >
              {reviewerName}
            </span>
            {verified && (
              <BadgeCheck
                className="w-4 h-4 shrink-0"
                style={{ color: COLORS.blue }}
                fill={COLORS.blue}
                strokeWidth={2}
              />
            )}
            {date && (
              <span
                style={{
                  fontSize: '12px',
                  color: COLORS.muted,
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}
              >
                {date}
              </span>
            )}
          </div>
          <div className="flex items-center" style={{ gap: '2px', marginTop: '4px' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className="w-3.5 h-3.5"
                style={{ color: COLORS.amber }}
                fill={s <= stars ? COLORS.amber : 'none'}
                strokeWidth={2}
              />
            ))}
          </div>
          {review.title && (
            <h4
              className="font-semibold"
              style={{
                fontSize: '14px',
                color: COLORS.text,
                marginTop: '8px',
              }}
            >
              {review.title}
            </h4>
          )}
          {review.comment && (
            <p
              style={{
                fontSize: '13px',
                color: COLORS.body,
                marginTop: review.title ? '4px' : '8px',
                lineHeight: 1.5,
              }}
            >
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
