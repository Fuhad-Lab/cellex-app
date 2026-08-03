'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import {
  ShoppingCart, Heart, Share2, Store, Star, ChevronLeft, Sparkles,
  MessageSquare, MessageCircle, CheckCircle, Video as VideoIcon,
  Bookmark, Minus, Plus, Zap, BadgeCheck, Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { TryItOnModal } from '@/components/try-it-on';
import { CommentsModal } from '@/components/comments-modal';
import { SmartImage } from '@/components/smart-image';
import { MobileNav } from '@/components/mobile-nav';
import { GroupBuySuccessModal, generateGroupBuyName } from '@/components/group-buy-success-modal';
import { MagneticButton, RevealOnScroll } from '@/components/animation-provider';

// Screen 8 — static variant options (the product API does not carry variants,
// so we render the same colorways + EU sizes shown in the reference).
const COLORWAYS = ['Onyx Black', 'Cloud White', 'Desert Sand'];
const SIZES = [40, 41, 42, 43, 44];

function ProductContent() {
  const params = useSearchParams();
  const id = Number(params.get('id'));
  const router = useRouter();
  const { user, refreshCartCount } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [colorway, setColorway] = useState(COLORWAYS[0]);
  const [size, setSize] = useState<number>(SIZES[2]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [helpfulReviews, setHelpfulReviews] = useState<Set<string>>(new Set());
  const [groupBuyModalOpen, setGroupBuyModalOpen] = useState(false);
  const [createdGroupBuy, setCreatedGroupBuy] = useState<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [prodResp, reviewsResp] = await Promise.all([
      api.products.byId(id),
      api.reviews.byProduct(id),
    ]);
    if (prodResp.success && prodResp.product) {
      setProduct(prodResp.product);
      if (prodResp.seller) {
        setSeller(prodResp.seller);
        // Pull follower count + follow state from the public profile endpoint.
        api.social
          .publicProfile(prodResp.seller.id)
          .then((r: any) => {
            if (r && r.success) {
              setIsFollowing(!!r.isFollowing);
              setFollowers(r.followers || 0);
            }
          })
          .catch(() => {});
      }
    }
    if (reviewsResp.success) {
      setReviews(reviewsResp.reviews || []);
      const r = reviewsResp.reviews || [];
      const avg = r.length ? r.reduce((s: number, x: Review) => s + (x.rating || 0), 0) / r.length : 0;
      setReviewSummary({ avg, count: r.length });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const images = product?.additional_images?.length
    ? [product.image_url, ...product.additional_images!].filter(Boolean)
    : product?.image_url
    ? [product.image_url]
    : [];

  const addToCart = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    setAdding(true);
    const result = await api.cart.add(id, qty);
    setAdding(false);
    if (result.success) {
      await refreshCartCount();
      toast({ title: 'Added to cart', description: `${qty} × ${product?.name}` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const buyNow = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    setAdding(true);
    const result = await api.cart.add(id, qty);
    setAdding(false);
    if (result.success) {
      router.push('/cart');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleCreateGroupBuy = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    // Create group buy via the group-buy API.
    // Instead of redirecting, show a success modal with the shareable link.
    // The creator stays on the product page; only people who click the shared
    // link get redirected to /group-buy-join?code=...
    const result: any = await api.groupBuy.create(id, product?.group_buy_target_count || 3, product?.group_buy_discount_pct || 20);
    if (result.success && result.groupBuy) {
      const gb = result.groupBuy;
      // Attach the auto-generated name so the modal displays it
      gb.groupBuyName = generateGroupBuyName(
        product?.name || 'Product',
        gb.discount_pct || product?.group_buy_discount_pct || 20,
        gb.target_count || product?.group_buy_target_count || 3,
      );
      setCreatedGroupBuy(gb);
      setGroupBuyModalOpen(true);
      toast({ title: 'Group buy created!', description: 'Share the link with friends to unlock the discount.' });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to create group buy', variant: 'destructive' });
    }
  };

  const toggleWishlist = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    if (saved) {
      setSaved(false);
      toast({ title: 'Removed from wishlist' });
      return;
    }
    const result = await api.wishlist.add(id);
    setSaved(true);
    toast({
      title: result.success ? 'Added to wishlist' : 'Error',
      description: result.success ? product?.name : result.error,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const toggleFollow = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
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

  const submitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || posting) return;
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    setPosting(true);
    try {
      const result = await api.comments.create('product', id, trimmed);
      if (result.success) {
        setCommentText('');
        toast({ title: 'Comment posted' });
        setCommentsOpen(true);
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setPosting(false);
  };

  const helpfulReview = async (reviewId: string) => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`));
      return;
    }
    if (helpfulReviews.has(reviewId)) return;
    const result = await api.reviews.helpful(reviewId);
    if (result.success) {
      setHelpfulReviews((prev) => new Set(prev).add(reviewId));
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpful_count: (r.helpful_count || 0) + 1 } : r
        )
      );
    }
  };

  const shareProduct = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Check out ${product?.name} on Cellex — ${formatPrice(product?.price || 0)}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: product?.name || 'Check this out on Cellex', text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast({ title: 'Link copied' });
    }
    api.feedback(`product:${id}`, 'share', 0.5, { page: 'product' });
  };

  if (loading) {
    return <PageSkeleton variant="product" />;
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center px-4"
        style={{ background: '#FFFFFF' }}
      >
        <Store className="w-12 h-12 mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="font-semibold" style={{ fontSize: '15px', color: '#6B7280' }}>
          Product not found
        </p>
        <Link
          href="/"
          className="inline-block mt-4 font-semibold"
          style={{
            background: '#111827',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            padding: '10px 24px',
            borderRadius: '999px',
          }}
        >
          Back to home
        </Link>
      </div>
    );
  }

  const tryOnCategories = ['Fashion', 'Beauty', 'Home'];
  const canTryOn = tryOnCategories.includes(product.category || '');

  // Derive original price + discount % (product API has no compare_at field,
  // so fall back to the group-buy discount when one is configured).
  const compareAt = (product as any).compare_at_price as number | undefined;
  const groupPct = product.group_buy_enabled ? product.group_buy_discount_pct || 0 : 0;
  let originalPrice: number | null = null;
  let discountPct = 0;
  if (compareAt && compareAt > product.price) {
    originalPrice = compareAt;
    discountPct = Math.round(((compareAt - product.price) / compareAt) * 100);
  } else if (groupPct > 0) {
    originalPrice = Math.round(product.price / (1 - groupPct / 100));
    discountPct = groupPct;
  }

  // Engagement stats — we only have units_sold + review count from the API.
  const heartCount = product.units_sold || 0;
  const commentCount = reviewSummary.count;
  const shareCount = 0;
  const saveCount = 0;

  const handle = seller?.business_name
    ? seller.business_name.toLowerCase().replace(/[^a-z0-9]/g, '')
    : 'seller';
  const sellerHref = seller?.slug
    ? `/${seller.slug}`
    : seller?.id
    ? `/seller-profile?id=${seller.id}`
    : '#';

  // Thumbnails: up to 4 circles + "+N" indicator when there are more.
  const visibleThumbs = images.slice(0, 4);
  const extraCount = images.length > 4 ? images.length - 4 : 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: '#FFFFFF', color: '#111827', paddingBottom: '96px' }}
    >
      {/* ============ 1. IMAGE GALLERY ============ */}
      <div
        className="relative"
        style={{ aspectRatio: '1 / 1', background: '#F3F4F6' }}
      >
        {images[activeImage] ? (
          <SmartImage
            src={images[activeImage]}
            alt={product.name}
            width={600}
            className="w-full h-full"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="w-16 h-16" style={{ color: '#9CA3AF' }} />
          </div>
        )}

        {/* Video badge */}
        {product.video_url && (
          <div
            className="absolute flex items-center gap-1 text-white font-semibold"
            style={{
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(17, 24, 39, 0.75)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '999px',
            }}
          >
            <VideoIcon className="w-3 h-3" /> Video
          </div>
        )}

        {/* Back button overlay (top-left, 40px white circle, shadow) */}
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center bg-white"
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={2} />
        </button>

        {/* Bookmark/save overlay (top-right, 40px white circle, shadow) */}
        <button
          onClick={toggleWishlist}
          className="flex items-center justify-center bg-white"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          <Bookmark
            className="w-5 h-5"
            strokeWidth={2}
            style={{
              color: '#111827',
              fill: saved ? '#111827' : 'none',
            }}
          />
        </button>

        {/* Image counter pill */}
        {images.length > 1 && (
          <div
            className="text-white font-medium"
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              background: 'rgba(17, 24, 39, 0.75)',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '999px',
            }}
          >
            {activeImage + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Circular thumbnails row (60px, active = 2px black border) */}
      {images.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto"
          style={{ padding: '12px 16px' }}
        >
          {visibleThumbs.map((img, i) => {
            const active = i === activeImage;
            return (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className="shrink-0"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '999px',
                  border: active ? '2px solid #111827' : '2px solid transparent',
                  padding: 0,
                  background: '#F3F4F6',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                aria-label={`View image ${i + 1}`}
                aria-current={active ? 'true' : undefined}
              >
                <SmartImage
                  src={img}
                  alt={`${product.name} ${i + 1}`}
                  width={60}
                  height={60}
                  className="w-full h-full"
                  blur={false}
                />
              </button>
            );
          })}
          {extraCount > 0 && (
            <div
              className="shrink-0 flex items-center justify-center font-semibold"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '999px',
                background: '#F3F4F6',
                color: '#111827',
                fontSize: '14px',
                fontWeight: 600,
              }}
              aria-label={`${extraCount} more images`}
            >
              +{extraCount}
            </div>
          )}
        </div>
      )}

      {/* ============ 2. SELLER CARD ============ */}
      {seller && (
        <div
          className="flex items-center gap-3"
          style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}
        >
          <Link href={sellerHref} className="shrink-0">
            <div
              className="overflow-hidden flex items-center justify-center"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '999px',
                background: '#F3F4F6',
              }}
            >
              {seller.profile_image ? (
                <img
                  src={seller.profile_image}
                  alt={seller.business_name || 'Seller'}
                  className="w-full h-full object-cover img-zoom"
                />
              ) : (
                <span className="font-bold" style={{ fontSize: '18px', color: '#6B7280' }}>
                  {(seller.business_name || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </Link>

          <Link href={sellerHref} className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span
                className="font-semibold truncate"
                style={{ fontSize: '15px', color: '#111827', fontWeight: 600 }}
              >
                {seller.business_name || 'Unnamed store'}
              </span>
              <BadgeCheck
                className="w-4 h-4 shrink-0"
                style={{ color: '#3B82F6' }}
                strokeWidth={2}
              />
            </div>
            <div
              className="truncate"
              style={{ fontSize: '13px', color: '#6B7280' }}
            >
              @{handle} · {formatCount(followers)} followers
            </div>
          </Link>

          <button
            onClick={toggleFollow}
            className="font-semibold transition-opacity active:opacity-70"
            style={{
              padding: '8px 20px',
              borderRadius: '999px',
              background: isFollowing ? '#FFFFFF' : '#111827',
              color: isFollowing ? '#111827' : '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              border: isFollowing ? '1px solid #E5E7EB' : 'none',
              cursor: 'pointer',
            }}
            aria-label={isFollowing ? 'Unfollow' : 'Follow'}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      )}

      {/* ============ 3. PRODUCT TITLE + PRICE ============ */}
      <div style={{ padding: '16px' }}>
        <h1
          className="font-bold leading-snug"
          style={{ fontSize: '18px', color: '#111827', fontWeight: 700 }}
        >
          {product.name}
        </h1>
        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <span
            className="font-bold"
            style={{ fontSize: '24px', color: '#111827', fontWeight: 700 }}
          >
            {formatPrice(product.price)}
          </span>
          {originalPrice !== null && (
            <span
              className="line-through"
              style={{ fontSize: '16px', color: '#9CA3AF', fontWeight: 400 }}
            >
              {formatPrice(originalPrice)}
            </span>
          )}
          {discountPct > 0 && (
            <span
              style={{
                background: '#F3F4F6',
                color: '#111827',
                fontSize: '12px',
                borderRadius: '999px',
                padding: '4px 8px',
                fontWeight: 600,
              }}
            >
              {discountPct}% OFF
            </span>
          )}
        </div>
      </div>

      {/* ============ 4. VARIANTS ============ */}
      <div style={{ padding: '16px' }} className="space-y-4">
        <div>
          <div
            className="font-semibold"
            style={{
              fontSize: '13px',
              color: '#6B7280',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            Colorway
          </div>
          <div className="flex gap-2 flex-wrap">
            {COLORWAYS.map((c) => {
              const active = colorway === c;
              return (
                <button
                  key={c}
                  onClick={() => setColorway(c)}
                  className="font-medium transition-all"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    border: active ? '1px solid #111827' : '1px solid #E5E7EB',
                    background: active ? '#111827' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#111827',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  aria-pressed={active}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div
            className="font-semibold"
            style={{
              fontSize: '13px',
              color: '#6B7280',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            Size (EU)
          </div>
          <div className="flex gap-2">
            {SIZES.map((s) => {
              const active = size === s;
              return (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="flex items-center justify-center font-medium transition-all"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '999px',
                    border: active ? '1px solid #111827' : '1px solid #E5E7EB',
                    background: active ? '#111827' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#111827',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  aria-pressed={active}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ 5. QUANTITY SELECTOR ============ */}
      <div style={{ padding: '16px' }}>
        <div
          className="flex items-center justify-between"
          style={{
            background: '#F3F4F6',
            borderRadius: '999px',
            height: '40px',
            padding: '0 6px 0 16px',
          }}
        >
          <span
            className="font-semibold"
            style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}
          >
            Qty
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="flex items-center justify-center transition-opacity active:opacity-70 disabled:opacity-40"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: '#FFFFFF',
                border: 'none',
                cursor: qty <= 1 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" style={{ color: '#111827' }} strokeWidth={2} />
            </button>
            <span
              className="font-semibold text-center"
              style={{
                fontSize: '14px',
                color: '#111827',
                fontWeight: 600,
                minWidth: '24px',
              }}
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              disabled={qty >= 99}
              className="flex items-center justify-center transition-opacity active:opacity-70 disabled:opacity-40"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: '#FFFFFF',
                border: 'none',
                cursor: qty >= 99 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" style={{ color: '#111827' }} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ============ 6. ACTION BUTTONS ============ */}
      <div className="flex" style={{ padding: '16px', gap: '12px' }}>
        <button
          onClick={addToCart}
          disabled={adding}
          className="flex-1 flex items-center justify-center gap-2 font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
          style={{
            height: '48px',
            borderRadius: '999px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            color: '#111827',
            fontSize: '14px',
            fontWeight: 600,
            cursor: adding ? 'not-allowed' : 'pointer',
          }}
          aria-label="Add to cart" className="btn-ripple"
        >
          <ShoppingCart className="w-4 h-4" strokeWidth={2} />
          <span>Add to Cart</span>
        </button>
        <button
          onClick={buyNow}
          disabled={adding}
          className="flex-1 flex items-center justify-center gap-2 font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
          style={{
            height: '48px',
            borderRadius: '999px',
            background: '#111827',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            cursor: adding ? 'not-allowed' : 'pointer',
          }}
          aria-label="Buy now" className="btn-ripple"
        >
          <Zap className="w-4 h-4" strokeWidth={2} />
          <span>Buy Now</span>
        </button>
      </div>

      {/* ============ GROUP BUY SECTION ============ */}
      <div style={{ padding: '16px', borderTop: '1px solid #F3F4F6' }}>
        {product.group_buy_enabled ? (
          <div style={{ background: '#F3F4F6', borderRadius: '16px', padding: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5" style={{ color: '#111827' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Group Buy Available</span>
            </div>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
              Get <span style={{ fontWeight: 700, color: '#111827' }}>{product.group_buy_discount_pct || 20}% off</span> when{' '}
              <span style={{ fontWeight: 700, color: '#111827' }}>{product.group_buy_target_count || 3} people</span> join.
              Create a group buy, share the link with friends, and unlock the discount together!
            </p>
            <button
              onClick={handleCreateGroupBuy}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '999px',
                background: '#111827',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start Group Buy
            </button>
          </div>
        ) : (
          <div style={{ background: '#F9FAFB', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
            <p style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
              Group buy is not enabled for this product.
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
              The seller hasn't set up group buy discounts for this item.
            </p>
          </div>
        )}
      </div>

      {/* Try It On — only for Fashion / Beauty / Home (keeps TryItOnModal wired up) */}
      {canTryOn && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => setShowTryOn(true)}
            className="w-full flex items-center justify-center gap-2 font-semibold transition-opacity active:opacity-70"
            style={{
              height: '40px',
              borderRadius: '999px',
              background: '#F3F4F6',
              color: '#111827',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span>Try It On with AI</span>
          </button>
        </div>
      )}

      {/* ============ 7. ENGAGEMENT STATS ============ */}
      <div
        className="flex items-center"
        style={{ padding: '16px', gap: '20px', borderTop: '1px solid #F3F4F6' }}
      >
        <button
          onClick={toggleWishlist}
          className="flex items-center gap-1.5 transition-transform active:scale-90"
          aria-label="Like"
        >
          <Heart
            className="w-5 h-5"
            strokeWidth={2}
            style={{
              color: saved ? '#EF4444' : '#6B7280',
              fill: saved ? '#EF4444' : 'none',
            }}
          />
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            {formatCount(heartCount)}
          </span>
        </button>

        <button
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-1.5 transition-transform active:scale-90"
          aria-label="Comments"
        >
          <MessageCircle className="w-5 h-5" strokeWidth={2} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            {formatCount(commentCount)}
          </span>
        </button>

        <button
          onClick={shareProduct}
          className="flex items-center gap-1.5 transition-transform active:scale-90"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5" strokeWidth={2} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            {formatCount(shareCount)}
          </span>
        </button>

        <button
          onClick={toggleWishlist}
          className="flex items-center gap-1.5 transition-transform active:scale-90"
          aria-label="Save"
        >
          <Bookmark
            className="w-5 h-5"
            strokeWidth={2}
            style={{
              color: saved ? '#111827' : '#6B7280',
              fill: saved ? '#111827' : 'none',
            }}
          />
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
            {formatCount(saveCount)}
          </span>
        </button>
      </div>

      {/* ============ 8. COMMENTS & REVIEWS ============ */}
      <div style={{ padding: '16px' }}>
        <h2
          className="font-bold"
          style={{ fontSize: '16px', color: '#111827', fontWeight: 700, marginBottom: '12px' }}
        >
          Comments &amp; Reviews
        </h2>

        {/* Inline comment input bar */}
        <div
          className="flex items-center gap-2"
          style={{ marginBottom: '16px' }}
        >
          <div
            className="shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: '#F3F4F6',
            }}
          >
            {user?.email ? (
              <span className="font-bold" style={{ fontSize: '13px', color: '#6B7280' }}>
                {user.email.charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="font-bold" style={{ fontSize: '13px', color: '#9CA3AF' }}>
                U
              </span>
            )}
          </div>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComment();
              }
            }}
            placeholder="Add a comment..."
            maxLength={1000}
            className="flex-1 outline-none"
            style={{
              fontSize: '14px',
              color: '#111827',
              background: 'transparent',
              border: 'none',
              padding: '8px 0',
            }}
            aria-label="Add a comment"
          />
          <button
            onClick={submitComment}
            disabled={!commentText.trim() || posting}
            className="font-semibold transition-opacity active:opacity-70 disabled:opacity-40"
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              background: '#111827',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: commentText.trim() && !posting ? 'pointer' : 'not-allowed',
            }}
          >
            Post
          </button>
        </div>

        {/* Review items */}
        {reviews.length === 0 ? (
          <div className="text-center" style={{ padding: '24px 0' }}>
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
            <p style={{ fontSize: '14px', color: '#6B7280' }}>No reviews yet</p>
            <button
              onClick={() => setCommentsOpen(true)}
              className="font-semibold"
              style={{ fontSize: '13px', color: '#111827', marginTop: '8px' }}
            >
              Be the first to comment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.slice(0, 5).map((r) => {
              const liked = helpfulReviews.has(r.id);
              return (
                <div key={r.id} className="flex gap-3">
                  <div
                    className="shrink-0 overflow-hidden flex items-center justify-center"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '999px',
                      background: '#F3F4F6',
                    }}
                  >
                    <span className="font-bold" style={{ fontSize: '13px', color: '#6B7280' }}>
                      {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="font-semibold"
                        style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}
                      >
                        {r.reviewer_name || 'Anonymous'}
                      </span>
                      {r.verified_purchase && (
                        <span
                          className="flex items-center gap-0.5"
                          style={{ fontSize: '11px', color: '#3B82F6' }}
                        >
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      )}
                      <span style={{ fontSize: '13px', color: '#6B7280' }}>
                        · {timeAgo(r.created_at)}
                      </span>
                    </div>

                    {r.rating > 0 && (
                      <div className="flex" style={{ margin: '2px 0' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className="w-3 h-3"
                            style={{
                              color: s <= r.rating ? '#F59E0B' : '#E5E7EB',
                              fill: s <= r.rating ? '#F59E0B' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {r.title && (
                      <div
                        className="font-semibold"
                        style={{ fontSize: '14px', color: '#111827' }}
                      >
                        {r.title}
                      </div>
                    )}
                    {r.comment && (
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#374151',
                          lineHeight: 1.5,
                          marginTop: '2px',
                        }}
                      >
                        {r.comment}
                      </p>
                    )}

                    <div className="flex items-center gap-4" style={{ marginTop: '6px' }}>
                      <button
                        onClick={() => helpfulReview(r.id)}
                        className="flex items-center gap-1 transition-opacity active:opacity-70"
                        style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}
                      >
                        <Heart
                          className="w-3.5 h-3.5"
                          style={{
                            color: liked ? '#EF4444' : '#6B7280',
                            fill: liked ? '#EF4444' : 'none',
                          }}
                        />
                        Like ({r.helpful_count || 0})
                      </button>
                      <button
                        onClick={() => setCommentsOpen(true)}
                        className="transition-opacity active:opacity-70"
                        style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {reviews.length > 5 && (
              <button
                onClick={() => setCommentsOpen(true)}
                className="font-semibold"
                style={{ fontSize: '14px', color: '#111827' }}
              >
                View all {reviews.length} reviews
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============ 9. BOTTOM NAV ============ */}
      {/* NavShell hides MobileNav on /product, so we render it directly here
          to match Screen 8 (which shows the same 6-item white bar as the homepage). */}
      <MobileNav />

      {/* Try It On Modal */}
      {canTryOn && (
        <TryItOnModal
          isOpen={showTryOn}
          onClose={() => setShowTryOn(false)}
          productName={product.name}
          productCategory={product.category || ''}
          productImage={product.image_url || ''}
        />
      )}

      {/* Comments modal (full comments thread) */}
      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postType="product"
        postId={id}
        postCaption={product?.name}
      />

      {/* Group Buy Success Modal — shown after a buyer creates a group buy.
          Glassmorphism iOS-style. Creator stays on this page; only people who
          click the shared link get redirected to /group-buy-join. */}
      <GroupBuySuccessModal
        open={groupBuyModalOpen}
        onClose={() => setGroupBuyModalOpen(false)}
        groupBuy={createdGroupBuy}
        product={product ? { name: product.name, image_url: product.image_url, price: product.price } : null}
      />
    </div>
  );
}

function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="product" />}>
      <ProductContent />
    </Suspense>
  );
}
