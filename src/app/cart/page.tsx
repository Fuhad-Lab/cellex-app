'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InternalLink from '@/components/internal-link';
import { api, formatPrice, type CartItem, type Product } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { MagneticButton, RevealOnScroll } from '@/components/animation-provider';
import { SmartImage } from '@/components/smart-image';
import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
import {
  Search, User as UserIcon, Trash2, Minus, Plus, X,
  ShoppingCart, ArrowRight, Store, Sparkles, Tag, Heart,
} from 'lucide-react';

// ---- Local types ----
interface SellerInfo {
  id: string;
  name: string;
  image?: string;
  slug?: string;
}

const TAX_RATE = 0.075; // 7.5% VAT (Nigerian standard)
const FREE_SHIPPING_THRESHOLD = 50000;
const FLAT_SHIPPING = 1500;

export default function CartPage() {
  const { user, loading: authLoading, refreshCartCount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Persisted state — survives navigation away and back, no matter how many
  // pages are visited in between.
  const [items, setItems] = usePersistedState<CartItem[]>('cart:items', []);
  const [sellers, setSellers] = usePersistedState<Record<string, SellerInfo>>('cart:sellers', {});
  const [likedProductIds, setLikedProductIds] = usePersistedState<Set<number>>('cart:likedProductIds', new Set<number>());
  const [recommendations, setRecommendations] = usePersistedState<Product[]>('cart:recommendations', []);
  const [appliedPromo, setAppliedPromo] = usePersistedState<string | null>('cart:appliedPromo', null);
  const [promoDiscount, setPromoDiscount] = usePersistedState<number>('cart:promoDiscount', 0);
  // Track whether we've already loaded data at least once — prevents the
  // loading skeleton from flashing on return visits even when the cart is empty.
  const [hasLoadedOnce, setHasLoadedOnce] = usePersistedState<boolean>('cart:hasLoadedOnce', false);

  // Transient state — not persisted. Skip loading skeleton if we've already
  // loaded once (even if cart was empty).
  const [loading, setLoading] = useState(!hasLoadedOnce);
  const [updating, setUpdating] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  // Restore scroll on mount, save on unmount.
  useScrollPreservation('cart');

  const searchBarRef = useRef<HTMLButtonElement>(null);

  // ===== Load cart + wishlist + recommendations =====
  const load = useCallback(async () => {
    // Don't show loading skeleton if we've already loaded once — just
    // refresh in the background so the user sees their cart instantly.
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    const [cartResult, wishlistResult, recommendResult] = await Promise.all([
      api.cart.get(),
      api.wishlist.get().catch(() => ({ success: false })),
      api.recommend.home(10).catch(() => ({ success: false })),
    ]);

    if (cartResult.success) {
      const cartItems = cartResult.items || [];
      setItems(cartItems);

      // Fetch seller profiles for each unique seller in the cart
      const sellerIds: string[] = Array.from(
        new Set(
          cartItems
            .map((i: CartItem) => i.products?.seller_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (sellerIds.length > 0) {
        const profiles = await Promise.all(
          sellerIds.map((id: string) =>
            api.social
              .publicProfile(id)
              .then((r: any) => {
                if (r && r.success && r.profile) {
                  const p = r.profile;
                  return {
                    id,
                    name:
                      p.business_name ||
                      p.farm_name ||
                      p.name ||
                      'Seller',
                    image: p.profile_image || p.image,
                    slug: p.slug,
                  } as SellerInfo;
                }
                return null;
              })
              .catch(() => null)
          )
        );
        const sellerMap: Record<string, SellerInfo> = {};
        profiles.forEach((p) => {
          if (p) sellerMap[p.id] = p;
        });
        setSellers(sellerMap);
      }
    }

    if (wishlistResult.success && Array.isArray(wishlistResult.items)) {
      setLikedProductIds(
        new Set(
          wishlistResult.items
            .map((w: any) => w.product_id || w.products?.id)
            .filter(Boolean)
        )
      );
    }

    if (recommendResult.success && Array.isArray(recommendResult.products)) {
      setRecommendations(recommendResult.products.slice(0, 8));
    } else if (recommendResult.success && Array.isArray(recommendResult.items)) {
      setRecommendations(recommendResult.items.slice(0, 8));
    }

    setHasLoadedOnce(true);
    setLoading(false);
  }, [hasLoadedOnce]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/cart');
      return;
    }
    if (user) {
      (async () => {
        await load();
      })();
    }
  }, [user, authLoading, router, load]);

  // ===== Dispatch searchbar visibility (hide GlobalSpotlight FAB while visible) =====
  useEffect(() => {
    const el = searchBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.dispatchEvent(
          new CustomEvent('searchbar-visibility', {
            detail: { visible: entry.isIntersecting },
          })
        );
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // ===== Cart actions =====
  const updateQty = async (itemId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setUpdating(itemId);
    const result = await api.cart.update(itemId, newQty);
    setUpdating(null);
    if (result.success) {
      // Optimistic update for snappy UX, then refetch
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i))
      );
      refreshCartCount();
    } else {
      toast({ title: 'Could not update quantity', variant: 'destructive' });
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    const result = await api.cart.remove(itemId);
    setUpdating(null);
    if (result.success) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      refreshCartCount();
      toast({ title: 'Removed from cart' });
    } else {
      toast({ title: 'Could not remove item', variant: 'destructive' });
    }
  };

  const clearCart = async () => {
    if (!confirm('Clear all items from cart?')) return;
    const result = await api.cart.clear();
    if (result.success) {
      setItems([]);
      refreshCartCount();
      toast({ title: 'Cart cleared' });
    } else {
      toast({ title: 'Could not clear cart', variant: 'destructive' });
    }
  };

  const applyPromo = () => {
    const code = promoCode.trim();
    if (!code) return;
    // Simple demo promo — CELLEX10 = 10% off, FREESHIP = free shipping
    if (code.toUpperCase() === 'CELLEX10') {
      setAppliedPromo(code.toUpperCase());
      setPromoDiscount(0.1);
      toast({ title: 'Promo applied', description: '10% off your order' });
    } else if (code.toUpperCase() === 'FREESHIP') {
      setAppliedPromo(code.toUpperCase());
      setPromoDiscount(0);
      toast({ title: 'Promo applied', description: 'Free shipping' });
    } else {
      toast({ title: 'Invalid promo code', variant: 'destructive' });
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoCode('');
  };

  // ===== Compute totals =====
  const subtotal = items.reduce(
    (sum, i) => sum + (i.products?.price || 0) * i.quantity,
    0
  );
  const discountAmount = Math.round(subtotal * promoDiscount);
  const afterDiscount = subtotal - discountAmount;
  const baseShipping =
    subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const shipping =
    appliedPromo === 'FREESHIP' ? 0 : baseShipping;
  const tax = Math.round(afterDiscount * TAX_RATE);
  const total = afterDiscount + shipping + tax;

  // ===== Checkout =====
  const proceedToCheckout = async () => {
    if (items.length === 0) return;
    setCheckingOut(true);
    try {
      // Prepare checkout session on the backend, then navigate
      await api.checkout.prepare();
      router.push('/checkout');
    } catch {
      // Even if prepare fails, let the user proceed — checkout page handles its own state
      router.push('/checkout');
    } finally {
      setCheckingOut(false);
    }
  };

  const openSpotlight = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-spotlight'));
    }
  };

  // ===== Loading state =====
  if (authLoading || loading) return <PageSkeleton variant="cart" />;

  // ===== Empty state =====
  if (items.length === 0) {
    return (
      <div
        className="min-h-screen"
        style={{ background: '#FFFFFF', color: '#111827' }}
      >
        {/* Header (same as populated state for consistency) */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4"
          style={{
            height: '64px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <div className="flex flex-col">
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Your Cart
            </span>
            <span style={{ fontSize: '13px', color: '#6B7280' }}>
              0 items
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              ref={searchBarRef}
              type="button"
              onClick={openSpotlight}
              className="flex items-center justify-center transition-opacity active:opacity-70"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                background: '#F3F4F6',
                border: 'none',
              }}
              aria-label="Search"
            >
              <Search className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
            </button>
            <InternalLink
              href={user ? '/profile' : '/login'}
              className="flex items-center justify-center overflow-hidden transition-opacity active:opacity-70"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                border: '2px solid #E5E7EB',
                background: '#F3F4F6',
              }}
              aria-label="Profile"
            >
              {user?.email ? (
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {user.email.charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserIcon className="w-5 h-5" style={{ color: '#6B7280' }} strokeWidth={1.75} />
              )}
            </InternalLink>
          </div>
        </header>

        {/* Empty state */}
        <div
          className="flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: 'calc(100vh - 64px - 96px)', paddingTop: '48px' }}
        >
          <div
            className="flex items-center justify-center mb-5"
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '999px',
              background: '#F3F4F6',
            }}
          >
            <ShoppingCart className="w-10 h-10" style={{ color: '#9CA3AF' }} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
            Your cart is empty
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '320px', marginBottom: '24px' }}>
            Discover products from sellers you follow, or explore the marketplace for fresh picks.
          </p>
          <InternalLink
            href="/"
            className="inline-flex items-center justify-center gap-2 transition-opacity active:opacity-70"
            style={{
              height: '48px',
              padding: '0 28px',
              borderRadius: '999px',
              background: '#111827',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
            }}
          >
            Browse products
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </InternalLink>
        </div>
      </div>
    );
  }

  // ===== Populated cart =====
  return (
    <div
      className="min-h-screen"
      style={{ background: '#FFFFFF', color: '#111827', paddingBottom: '112px' }}
    >
      {/* ===== HEADER (64px, white, border-bottom #E5E7EB) ===== */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4"
        style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        {/* Left: title + subtitle */}
        <div className="flex flex-col min-w-0">
          <span
            className="truncate"
            style={{ fontSize: '18px', fontWeight: 700, color: '#111827', lineHeight: '1.2' }}
          >
            Your Cart
          </span>
          <span
            className="truncate"
            style={{ fontSize: '13px', color: '#6B7280', lineHeight: '1.2', marginTop: '2px' }}
          >
            {items.length} {items.length === 1 ? 'item' : 'items'} from followed sellers
          </span>
        </div>

        {/* Right: search icon + profile avatar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            ref={searchBarRef}
            type="button"
            onClick={openSpotlight}
            className="flex items-center justify-center transition-opacity active:opacity-70"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              background: '#F3F4F6',
              border: 'none',
            }}
            aria-label="Search"
          >
            <Search className="w-5 h-5" style={{ color: '#111827' }} strokeWidth={1.75} />
          </button>
          <InternalLink
            href={user ? '/profile' : '/login'}
            className="flex items-center justify-center overflow-hidden transition-opacity active:opacity-70"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              border: '2px solid #E5E7EB',
              background: '#F3F4F6',
            }}
            aria-label="Profile"
          >
            {user?.email ? (
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                {user.email.charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserIcon className="w-5 h-5" style={{ color: '#6B7280' }} strokeWidth={1.75} />
            )}
          </InternalLink>
        </div>
      </header>

      {/* ===== Sub-row: Clear cart + items count ===== */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          height: '44px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <button
          type="button"
          onClick={clearCart}
          className="inline-flex items-center gap-1.5 transition-opacity active:opacity-70"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            color: '#EF4444',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Clear cart"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          Clear cart
        </button>
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* ===== CART ITEMS ===== */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        {items.map((item) => {
          const product = item.products;
          const seller = product?.seller_id ? sellers[product.seller_id] : undefined;
          const sellerHref = seller?.slug
            ? `/${seller.slug}`
            : product?.seller_id
            ? `/seller-profile?id=${product.seller_id}`
            : '#';
          const isLiked = product ? likedProductIds.has(product.id) : false;
          const itemTotal = (product?.price || 0) * item.quantity;
          return (
            <div
              key={item.id}
              className="relative"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '16px',
                padding: '16px',
              }}
            >
              {/* Remove X — top right */}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={updating === item.id}
                className="absolute flex items-center justify-center transition-colors disabled:opacity-50"
                style={{
                  top: '12px',
                  right: '12px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="Remove item"
              >
                <X className="w-4 h-4" style={{ color: '#9CA3AF' }} strokeWidth={2} />
              </button>

              {/* Top row: thumbnail + product info */}
              <div className="flex gap-3">
                {/* Product thumbnail (80x80) */}
                <InternalLink
                  href={`/product?id=${item.product_id}`}
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    background: '#F3F4F6',
                  }}
                  aria-label={product?.name || 'Product'}
                >
                  <SmartImage
                    src={product?.image_url}
                    alt={product?.name || 'Product'}
                    width={80}
                    height={80}
                    loading="lazy"
                    className="w-full h-full"
                  />
                </InternalLink>

                {/* Product details */}
                <div className="flex-1 min-w-0 pr-7">
                  <InternalLink href={`/product?id=${item.product_id}`} className="block">
                    <h3
                      className="line-clamp-2"
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#111827',
                        lineHeight: '1.3',
                      }}
                    >
                      {product?.name || 'Product'}
                    </h3>
                  </InternalLink>

                  {/* Seller row */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <InternalLink
                      href={sellerHref}
                      className="flex items-center gap-1.5 shrink-0"
                      aria-label={seller?.name || 'View seller'}
                    >
                      <span
                        className="flex items-center justify-center overflow-hidden shrink-0"
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '999px',
                          background: '#F3F4F6',
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        {seller?.image ? (
                          <SmartImage
                            src={seller.image}
                            alt={seller.name}
                            width={24}
                            height={24}
                            blur={false}
                            className="w-full h-full"
                          />
                        ) : (
                          <Store
                            className="w-3 h-3"
                            style={{ color: '#6B7280' }}
                            strokeWidth={2}
                          />
                        )}
                      </span>
                      <span
                        className="truncate"
                        style={{ fontSize: '13px', color: '#6B7280', maxWidth: '120px' }}
                      >
                        {seller?.name || 'Seller'}
                      </span>
                    </InternalLink>
                    <InternalLink
                      href={sellerHref}
                      className="transition-opacity active:opacity-70"
                      style={{
                        fontSize: '13px',
                        color: '#3B82F6',
                        fontWeight: 500,
                      }}
                    >
                      View seller
                    </InternalLink>
                  </div>

                  {/* Tags row — "Liked item" badge shown when item is in wishlist */}
                  {isLiked && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1"
                        style={{
                          background: '#F3F4F6',
                          color: '#6B7280',
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        <Heart className="w-2.5 h-2.5" style={{ color: '#EF4444' }} strokeWidth={2} />
                        Liked item
                      </span>
                    </div>
                  )}

                  {/* Variant info */}
                  <p
                    className="mt-1.5"
                    style={{ fontSize: '13px', color: '#6B7280' }}
                  >
                    Color: Default
                    <span style={{ margin: '0 6px', color: '#D1D5DB' }}>·</span>
                    Size: Standard
                  </p>
                </div>
              </div>

              {/* Bottom row: quantity stepper (left) + price (right) */}
              <div className="flex items-end justify-between mt-3">
                {/* Quantity stepper */}
                <div
                  className="flex items-center"
                  style={{
                    background: '#F3F4F6',
                    borderRadius: '999px',
                    padding: '4px',
                    height: '40px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, -1)}
                    disabled={updating === item.id || item.quantity <= 1}
                    className="flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '999px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" style={{ color: '#111827' }} strokeWidth={2.5} />
                  </button>
                  <span
                    className="text-center"
                    style={{
                      minWidth: '28px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, 1)}
                    disabled={updating === item.id}
                    className="flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '999px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" style={{ color: '#111827' }} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Price */}
                <div className="flex flex-col items-end">
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {formatPrice(product?.price || 0)} each
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#111827',
                      lineHeight: '1.2',
                    }}
                  >
                    {formatPrice(itemTotal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== YOU MIGHT ALSO LIKE (horizontal scroll) ===== */}
      {recommendations.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              You might also like
            </h2>
            <InternalLink
              href="/"
              className="inline-flex items-center transition-opacity active:opacity-70"
              style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}
            >
              See all
            </InternalLink>
          </div>
          <div
            className="flex gap-3 overflow-x-auto px-4 pb-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {recommendations.map((p) => (
              <InternalLink
                key={p.id}
                href={`/product?id=${p.id}`}
                className="shrink-0 block transition-transform active:scale-95"
                style={{ width: '120px' }}
              >
                <div
                  className="overflow-hidden"
                  style={{
                    width: '120px',
                    aspectRatio: '1 / 1',
                    borderRadius: '12px',
                    background: '#F3F4F6',
                  }}
                >
                  <SmartImage
                    src={p.image_url}
                    alt={p.name}
                    width={120}
                    height={120}
                    loading="lazy"
                    className="w-full h-full"
                  />
                </div>
                <h3
                  className="line-clamp-2 mt-2"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#111827',
                    lineHeight: '1.3',
                  }}
                >
                  {p.name}
                </h3>
                <p
                  className="mt-0.5"
                  style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}
                >
                  {formatPrice(p.price)}
                </p>
              </InternalLink>
            ))}
          </div>
        </section>
      )}

      {/* ===== ORDER SUMMARY ===== */}
      <section className="px-4 mt-6">
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            padding: '16px',
          }}
        >
          {/* Lines: Subtotal / Shipping / Tax / (Discount) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '15px', color: '#6B7280' }}>Subtotal</span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ fontSize: '15px', color: '#6B7280' }}>Shipping</span>
              {shipping === 0 ? (
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#10B981',
                  }}
                >
                  Free
                </span>
              ) : (
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                  {formatPrice(shipping)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span style={{ fontSize: '15px', color: '#6B7280' }}>Tax (VAT 7.5%)</span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                {formatPrice(tax)}
              </span>
            </div>

            {appliedPromo && discountAmount > 0 && (
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex items-center gap-1"
                  style={{ fontSize: '15px', color: '#10B981' }}
                >
                  <Tag className="w-3.5 h-3.5" strokeWidth={2} />
                  Discount ({appliedPromo})
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#10B981' }}>
                  −{formatPrice(discountAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Free shipping progress hint */}
          {baseShipping > 0 && (
            <div
              className="mt-3"
              style={{
                background: '#F3F4F6',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#6B7280',
              }}
            >
              Add{' '}
              <span style={{ fontWeight: 700, color: '#111827' }}>
                {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)}
              </span>{' '}
              more to unlock free shipping.
            </div>
          )}

          {/* Promo code input */}
          <div className="mt-3">
            {appliedPromo ? (
              <div
                className="flex items-center justify-between"
                style={{
                  background: '#F3F4F6',
                  borderRadius: '999px',
                  padding: '8px 8px 8px 16px',
                  height: '44px',
                }}
              >
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}
                >
                  <Tag className="w-3.5 h-3.5" style={{ color: '#10B981' }} strokeWidth={2} />
                  {appliedPromo}
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  className="inline-flex items-center justify-center transition-colors"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer',
                  }}
                  aria-label="Remove promo"
                >
                  <X className="w-3.5 h-3.5" style={{ color: '#6B7280' }} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center"
                style={{
                  background: '#F3F4F6',
                  borderRadius: '999px',
                  padding: '4px 4px 4px 16px',
                  height: '44px',
                }}
              >
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPromo();
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 bg-transparent outline-none min-w-0"
                  style={{
                    fontSize: '13px',
                    color: '#111827',
                    border: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={!promoCode.trim()}
                  className="transition-opacity active:opacity-70 disabled:opacity-40"
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    background: '#111827',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            className="my-3"
            style={{ height: '1px', background: '#E5E7EB' }}
          />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Total</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              {formatPrice(total)}
            </span>
          </div>

          {/* Checkout button */}
          <button
            type="button"
            onClick={proceedToCheckout}
            disabled={checkingOut}
            className="w-full inline-flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-60 mt-4"
            style={{
              height: '52px',
              borderRadius: '999px',
              background: '#111827',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {checkingOut ? (
              <>
                <span
                  className="inline-block rounded-full animate-spin"
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#FFFFFF',
                  }}
                />
                Preparing…
              </>
            ) : (
              <>
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
              </>
            )}
          </button>

          {/* Trust note */}
          <p
            className="text-center mt-3"
            style={{ fontSize: '11px', color: '#9CA3AF' }}
          >
            Secure checkout · Free returns within 7 days
          </p>
        </div>
      </section>
    </div>
  );
}
