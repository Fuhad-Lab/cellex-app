'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import {
  Search, Bell, MessageCircle, ShoppingCart, User as UserIcon,
  Heart, Bookmark, Store, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { SmartImage } from '@/components/smart-image';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useOptimisticUI } from '@/components/optimistic-ui';
import { motion } from 'framer-motion';

// Categories — match the actual categories in the database.
// (Previously had 'Tech' which doesn't exist — it's 'Electronics'. Added 'Farm' and 'General'.)
const CATEGORIES = ['Electronics', 'Fashion', 'Beauty', 'Home', 'Food', 'Sports', 'Books', 'Farm', 'General'] as const;
const DEFAULT_CATEGORY = 'Electronics';

function CategoriesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, cartCount, unreadMessages } = useAuth();
  const { toast } = useToast();
  const { burst } = useOptimisticUI();

  // Initialise from URL — keep existing ?category= and ?q= deep-link support
  const urlCategory = params.get('category') || '';
  const urlQuery = params.get('q') || '';
  const initialCategory =
    !urlQuery && (CATEGORIES as readonly string[]).includes(urlCategory)
      ? urlCategory
      : DEFAULT_CATEGORY;

  const [category, setCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(urlQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedProducts, setLikedProducts] = useState<Set<number>>(new Set());
  const [savedProducts, setSavedProducts] = useState<Set<number>>(new Set());
  const [savedWishlistIds, setSavedWishlistIds] = useState<Map<number, string>>(new Map());

  // Search bar ref — dispatches visibility events to GlobalSpotlight
  const searchBarRef = useRef<HTMLButtonElement>(null);

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
  }, []);

  // Pull the user's saved wishlist so bookmark icons show the right state.
  // Re-runs whenever `user` changes (login / logout). All setState calls
  // live inside the async callback so we don't trip the
  // react-hooks/set-state-in-effect rule.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.wishlist.get();
        if (cancelled) return;
        if (result.success && Array.isArray(result.items)) {
          const map = new Map<number, string>();
          const savedSet = new Set<number>();
          for (const item of result.items) {
            const pid = item?.products?.id ?? item?.product_id;
            if (pid && item?.id) {
              map.set(pid, item.id);
              savedSet.add(pid);
            }
          }
          setSavedWishlistIds(map);
          setSavedProducts(savedSet);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Refetch the wishlist from the server (used after a save/unsave toggle).
  // Kept as a useCallback so handlers can call it after the API settles.
  const refreshWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const result = await api.wishlist.get();
      if (result.success && Array.isArray(result.items)) {
        const map = new Map<number, string>();
        const savedSet = new Set<number>();
        for (const item of result.items) {
          const pid = item?.products?.id ?? item?.product_id;
          if (pid && item?.id) {
            map.set(pid, item.id);
            savedSet.add(pid);
          }
        }
        setSavedWishlistIds(map);
        setSavedProducts(savedSet);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  // Load products — keep the existing API branching:
  //   ?q=...   → api.products.search
  //   category → api.products.category
  //   else     → api.products.all (fallback, unused given default category)
  // The handler sets `loading=true` synchronously (before the effect runs)
  // so we don't need a synchronous setState inside the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let resultProducts: Product[] = [];
        if (searchQuery.trim()) {
          const result = await api.products.search(searchQuery, null);
          if (result.success) {
            resultProducts = result.results || result.products || [];
          }
        } else if (category) {
          const result = await api.products.category(category, 'newest', 1);
          if (result.success) {
            resultProducts = result.products || [];
          }
        } else {
          const result = await api.products.all(100);
          if (result.success) {
            resultProducts = result.products || [];
          }
        }
        if (!cancelled) {
          setProducts(resultProducts);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, searchQuery]);

  const updateUrl = (cat: string, q: string) => {
    const urlParams = new URLSearchParams();
    if (q) urlParams.set('q', q);
    else if (cat) urlParams.set('category', cat);
    const qs = urlParams.toString();
    router.replace(`/categories${qs ? '?' + qs : ''}`);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setSearchQuery('');
    setLoading(true); // show skeletons immediately while the new category fetches
    updateUrl(cat, '');
  };

  const toggleLike = (productId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login?next=/categories');
      return;
    }
    const isLiking = !likedProducts.has(productId);
    const newLiked = new Set(likedProducts);
    if (isLiking) {
      newLiked.add(productId);
      burst(e.clientX, e.clientY, 'heart');
    } else {
      newLiked.delete(productId);
    }
    setLikedProducts(newLiked);
    api.feedback(
      `product:${productId}`,
      isLiking ? 'like' : 'unlike',
      isLiking ? 1 : 0
    );
  };

  const toggleSave = async (productId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login?next=/categories');
      return;
    }
    const isSaving = !savedProducts.has(productId);
    const newSaved = new Set(savedProducts);
    if (isSaving) {
      newSaved.add(productId);
      burst(e.clientX, e.clientY, 'check');
      toast({ title: 'Saved to wishlist' });
      api.feedback(`product:${productId}`, 'save', 1, { page: 'categories' });
      await api.wishlist.add(productId).catch(() => {});
    } else {
      newSaved.delete(productId);
      toast({ title: 'Removed from wishlist' });
      api.feedback(`product:${productId}`, 'unsave', 0, { page: 'categories' });
      const itemId = savedWishlistIds.get(productId);
      if (itemId) {
        await api.wishlist.remove(itemId).catch(() => {});
      }
    }
    setSavedProducts(newSaved);
    // Refetch to keep savedWishlistIds in sync with backend
    refreshWishlist();
  };

  const openSpotlight = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-spotlight'));
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: '#FFFFFF', color: '#111827' }}
    >
      <MobileHeader />

      {/* ===== CATEGORY PILLS (horizontal scroll, 12px 16px padding) ===== */}
      <div
        className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = !searchQuery && category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className="font-semibold transition-all whitespace-nowrap"
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 600,
                background: isActive ? '#111827' : '#F3F4F6',
                color: isActive ? '#FFFFFF' : '#374151',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ===== DISCOVERY GRID (2 columns, gap 12px, padding 16px) ===== */}
      <main
        className="grid grid-cols-2 px-4 py-4"
        style={{ gap: '12px' }}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{ aspectRatio: '3 / 4', borderRadius: '16px' }}
            />
          ))
        ) : products.length === 0 ? (
          <div className="col-span-2 text-center py-16 px-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: '#F3F4F6' }}
            >
              <Sparkles
                className="w-6 h-6"
                style={{ color: '#9CA3AF' }}
                strokeWidth={1.5}
              />
            </div>
            <p
              className="font-semibold"
              style={{ fontSize: '15px', color: '#111827' }}
            >
              {searchQuery
                ? `No results for “${searchQuery}”`
                : `No products in ${category} yet`}
            </p>
            <p
              className="mt-1"
              style={{ fontSize: '13px', color: '#6B7280' }}
            >
              {searchQuery
                ? 'Try a different search or browse another category.'
                : 'Try another category or check back later.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleCategoryChange(DEFAULT_CATEGORY)}
                className="mt-4 font-bold transition-opacity active:opacity-70"
                style={{ fontSize: '13px', color: '#111827' }}
              >
                Browse {DEFAULT_CATEGORY}
              </button>
            )}
          </div>
        ) : (
          products.map((p, index) => (
            <DiscoveryCard
              key={p.id}
              product={p}
              index={index}
              liked={likedProducts.has(p.id)}
              saved={savedProducts.has(p.id)}
              onLike={(e) => toggleLike(p.id, e)}
              onSave={(e) => toggleSave(p.id, e)}
            />
          ))
        )}
      </main>

      {/* End-of-feed marker */}
      {!loading && products.length > 0 && (
        <div className="text-center py-8 px-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{ background: '#F3F4F6' }}
          >
            <Store
              className="w-5 h-5"
              style={{ color: '#9CA3AF' }}
              strokeWidth={1.5}
            />
          </div>
          <p
            className="font-semibold"
            style={{ fontSize: '13px', color: '#111827' }}
          >
            You&apos;ve reached the end
          </p>
          <p
            className="mt-0.5"
            style={{ fontSize: '12px', color: '#9CA3AF' }}
          >
            {products.length} item{products.length === 1 ? '' : 's'} in {searchQuery ? `“${searchQuery}”` : category}
          </p>
        </div>
      )}
    </div>
  );
}

/* ===================== Discovery Card =====================
 * Screen 10 — large rectangular image (3:4), border-radius 16px,
 * overflow hidden, dark overlay gradient at the bottom with
 * category label + title + price; heart + bookmark icons at top-right.
 */
function DiscoveryCard({
  product,
  index,
  liked,
  saved,
  onLike,
  onSave,
}: {
  product: Product;
  index: number;
  liked: boolean;
  saved: boolean;
  onLike: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#F3F4F6',
      }}
    >
      <Link
        href={`/product?id=${product.id}`}
        className="block w-full h-full"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Product image fills the entire card */}
        {product.image_url ? (
          <SmartImage
            src={product.image_url}
            alt={product.name}
            width={400}
            className="w-full h-full"
            style={{ height: '100%' }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: '#F3F4F6' }}
          >
            <Store
              className="w-10 h-10"
              style={{ color: '#9CA3AF' }}
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Top-right action icons (heart + bookmark, 20px) */}
        <div
          className="absolute flex items-center"
          style={{ top: '12px', right: '12px', gap: '6px', zIndex: 2 }}
        >
          <button
            type="button"
            onClick={onLike}
            className="flex items-center justify-center transition-transform active:scale-90"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: 'rgba(0, 0, 0, 0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            aria-label={liked ? 'Unlike product' : 'Like product'}
            aria-pressed={liked}
          >
            <Heart
              className="w-5 h-5"
              style={{ color: liked ? '#EF4444' : '#FFFFFF' }}
              fill={liked ? '#EF4444' : 'none'}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex items-center justify-center transition-transform active:scale-90"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: 'rgba(0, 0, 0, 0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={saved}
          >
            <Bookmark
              className="w-5 h-5"
              style={{ color: '#FFFFFF' }}
              fill={saved ? '#FFFFFF' : 'none'}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* Bottom dark gradient overlay with category label + title + price */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            padding: '12px',
            paddingTop: '40px',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0) 100%)',
            zIndex: 1,
          }}
        >
          {product.category && (
            <div
              className="uppercase tracking-wide"
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 600,
                marginBottom: '2px',
                letterSpacing: '0.04em',
              }}
            >
              {product.category}
            </div>
          )}
          <div
            className="line-clamp-2"
            style={{
              fontSize: '16px',
              color: '#FFFFFF',
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: '14px',
              color: '#FFFFFF',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            {formatPrice(product.price)}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="categories" />}>
      <CategoriesContent />
    </Suspense>
  );
}
