'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import {
  Search, Heart, MessageCircle, Bookmark, Share2,
  Store, MoreHorizontal, BadgeCheck, Bell, User as UserIcon,
  Plus, Settings as SettingsIcon, ShoppingBag, ShoppingCart,
  Home as HomeIcon, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
import { PageSkeleton } from '@/components/page-skeleton';
import { CommentsModal } from '@/components/comments-modal';
import { SmartImage } from '@/components/smart-image';
import { MobileHeader } from '@/components/mobile-header';
import { SmartVideo } from '@/components/smart-video';
import { RevealOnScroll } from '@/components/animation-provider';
import { FullPostModal } from '@/components/full-post-modal';

interface FeedPost {
  type: 'video' | 'product';
  id: string;
  videoId?: number;
  productId?: number;
  sellerId?: string;
  sellerSlug?: string;
  sellerName: string;
  sellerImage?: string;
  mediaUrl: string;
  caption: string;
  likes: number;
  views?: number;
  comments: number;
  product?: Product;
  soldCount?: number;
  createdAt?: string;
  isLive?: boolean;
  verified?: boolean;
  liked?: boolean;
}

type TabKey = 'For You' | 'Following' | 'Trending';

export default function HomePage() {
  const router = useRouter();
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  

  // Persisted state — survives ANY number of navigation hops (Home → Cart →
  // Saved → Home keeps Home's state). Backed by the Root Layout's memory
  // via GlobalStateProvider. Memory-only, XSS-safe.
  const [feed, setFeed] = usePersistedState<FeedPost[]>('home:feed', []);
  // Like feature removed — like and save are different actions.
  // Like was incorrectly mixing with the save/wishlist system.
  const [savedPosts, setSavedPosts] = usePersistedState<Set<string>>('home:savedPosts', new Set<string>());
  const [following, setFollowing] = usePersistedState<Set<string>>('home:following', new Set<string>());

  // Filter tabs — Screen 7: For You / Following / Trending
  const [activeTab, setActiveTab] = usePersistedState<TabKey>('home:activeTab', 'For You');

  // Transient state — not persisted (resets on every mount).
  // Skip the loading skeleton if we already have a cached feed.
  // Also skip if we've loaded once (even if feed was empty — prevents
  // the "No posts found" flash on return visits).
  const [hasLoadedOnce, setHasLoadedOnce] = usePersistedState<boolean>('home:hasLoadedOnce', false);
  const [loading, setLoading] = useState(!hasLoadedOnce && feed.length === 0);
  const viewedPosts = useRef<Set<string>>(new Set());

  // Restore scroll on mount, save on unmount + on user scroll.
  useScrollPreservation('home');

  // Full Post Modal state — when set, the modal opens (X/Twitter detail view style)
  const [modalPost, setModalPost] = useState<FeedPost | null>(null);

  const searchBarRef = useRef<HTMLButtonElement>(null);

  // IntersectionObserver for hiding GlobalSpotlight FAB when top search is visible
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

  // Track views — when a post enters the viewport, send a view feedback to Gorse
  const trackView = (postId: string, videoId?: number, productId?: number) => {
    if (viewedPosts.current.has(postId)) return;
    viewedPosts.current.add(postId);
    const itemId = videoId ? `video:${videoId}` : productId ? `product:${productId}` : postId;
    api.feedback(itemId, 'view', 0.3);
  };

  useEffect(() => {
    (async () => {
      try {
        // For anonymous users, only fetch feed posts (no personalized recommendations).
        // For logged-in users, fetch both feed posts AND recommendations.
        const isAnon = !user;
        const [feedPostsResp, recommendResp] = await Promise.all([
          api.feedPosts.list(50).catch(() => ({ success: false, posts: [] })),
          isAnon
            ? Promise.resolve({ success: false, posts: [] })
            : api.recommend.home(40).catch(() => ({ success: false, posts: [] })),
        ]);

        // PERSONALIZED FEED:
        // Build a map of feed posts by product ID — so we can attach the
        // seller's post (caption, media) to the recommended product at the
        // position Gorse ranked it. Gorse decides the order; feed posts
        // ride along at their product's ranked position.
        const feedPostByProductId = new Map<number, any>();
        const feedPostByVideoId = new Map<number, any>();
        if (feedPostsResp.success && feedPostsResp.posts) {
          feedPostsResp.posts.forEach((fp: any) => {
            const product = fp.product || {};
            if (product.id) feedPostByProductId.set(product.id, fp);
            if (fp.postType === 'video' && fp.id) feedPostByVideoId.set(fp.id, fp);
          });
        }

        const posts: FeedPost[] = [];
        const seenProductIds = new Set<number>();
        const seenVideoIds = new Set<number>();

        // 1. Recommended posts FIRST — Gorse/personalized order.
        //    This is the primary feed. If a recommended product has an
        //    associated feed post (seller caption + media), use the feed
        //    post's richer content; otherwise show the product directly.
        if (recommendResp.success && recommendResp.posts) {
          recommendResp.posts.forEach((item: any) => {
            if (item.type === 'video') {
              const seller = item.seller || {};
              posts.push({
                type: 'video',
                id: `vid-${item.id}`,
                videoId: item.id,
                productId: item.product_id || item.product?.id,
                liked: item.liked || false,
                sellerId: seller.id || item.seller_id,
                sellerSlug: seller.slug,
                sellerName: seller.business_name || seller.name || 'Seller',
                sellerImage: seller.profile_image,
                mediaUrl: item.video_url || '',
                caption: item.caption || '',
                likes: item.likes_count || 0,
                views: item.views_count || 0,
                comments: item.comments_count || 0,
                product: item.product,
                soldCount: item.product?.units_sold,
                createdAt: item.created_at,
                verified: true,
              });
              seenVideoIds.add(Number(item.id));
              if (item.product_id) seenProductIds.add(Number(item.product_id));
            } else if (item.type === 'product') {
              const fp = feedPostByProductId.get(Number(item.id));
              // If there's a feed post for this product, use the feed post's
              // media + caption (richer content). Otherwise show the product directly.
              if (fp) {
                const product = fp.product || {};
                const seller = fp.seller || {};
                posts.push({
                  type: fp.postType === 'video' ? 'video' : 'product',
                  id: `fp-${fp.id}`,
                  videoId: fp.postType === 'video' ? fp.id : undefined,
                  productId: product.id,
                  sellerSlug: seller.slug,
                  sellerId: seller.id,
                  sellerName: seller.name || 'Seller',
                  sellerImage: seller.image,
                  mediaUrl: fp.mediaUrl || product.image_url || '',
                  caption: fp.caption || product.name || '',
                  likes: fp.likesCount || 0,
                  views: fp.viewsCount || 0,
                  comments: fp.commentsCount || 0,
                  product: {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                    units_sold: product.units_sold,
                    category: product.category,
                    group_buy_enabled: product.group_buy_enabled,
                  },
                  soldCount: product.units_sold,
                  createdAt: fp.createdAt,
                  verified: true,
                });
              } else {
                posts.push({
                  type: 'product',
                  id: `prod-${item.id}`,
                  productId: item.id,
                  sellerId: item.seller_id,
                  sellerSlug: item.seller_slug,
                  sellerName: item.seller_name || 'Cellex Seller',
                  sellerImage: item.seller_image,
                  mediaUrl: item.image_url || '',
                  caption: item.name,
                  likes: item.likes_count || 0,
                  views: item._views_count || item.views_count || 0,
                  comments: item.comments_count || item.review_count || 0,
                  product: item,
                  soldCount: item.units_sold,
                  verified: true,
                });
              }
              seenProductIds.add(Number(item.id));
            }
          });
        }

        // 2. Feed posts whose products were NOT in the recommendations —
        //    append them at the end (so sellers' posts still get seen, but
        //    don't dominate the feed). Shuffle for variety per-user.
        if (feedPostsResp.success && feedPostsResp.posts) {
          const remaining: FeedPost[] = [];
          feedPostsResp.posts.forEach((fp: any) => {
            const product = fp.product || {};
            const pid = Number(product.id);
            const vid = fp.postType === 'video' ? Number(fp.id) : 0;
            // Skip if this product/video was already shown via recommendations
            if ((pid && seenProductIds.has(pid)) || (vid && seenVideoIds.has(vid))) return;
            const seller = fp.seller || {};
            remaining.push({
              type: fp.postType === 'video' ? 'video' : 'product',
              id: `fp-${fp.id}`,
              videoId: fp.postType === 'video' ? fp.id : undefined,
              productId: product.id,
              sellerSlug: seller.slug,
              sellerId: seller.id,
              sellerName: seller.name || 'Seller',
              sellerImage: seller.image,
              mediaUrl: fp.mediaUrl || product.image_url || '',
              caption: fp.caption || product.name || '',
              likes: fp.likesCount || 0,
              views: fp.viewsCount || 0,
              comments: fp.commentsCount || 0,
              product: {
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                units_sold: product.units_sold,
                category: product.category,
                group_buy_enabled: product.group_buy_enabled,
              },
              soldCount: product.units_sold,
              createdAt: fp.createdAt,
              verified: true,
            });
            if (pid) seenProductIds.add(pid);
            if (vid) seenVideoIds.add(vid);
          });
          // Shuffle remaining so different users see different order
          const seed = user?.id ? hashString(user.id) : Date.now();
          posts.push(...seededShuffle(remaining, seed));
        }

        // If no posts were found (anonymous users or empty feed), fall back
        // to showing products directly from the catalog — BUT fetch the
        // fallback BEFORE calling setFeed so there's no empty-state flash.
        if (posts.length === 0) {
          try {
            const productsResp = await api.products.all(30);
            if (productsResp.success && productsResp.products) {
              posts.push(...productsResp.products.map((p: any) => ({
                type: 'product' as const,
                id: `prod-${p.id}`,
                productId: p.id,
                sellerId: p.seller_id,
                sellerName: 'Seller',
                mediaUrl: p.image_url || '',
                caption: p.name || '',
                likes: 0,
                comments: 0,
                product: p,
                soldCount: p.units_sold,
                verified: true,
              })));
            }
          } catch {}
        }

        // Single setFeed call — no intermediate empty state, no flash.
        setFeed(posts);

        // Like feature removed
      } catch (e) {
        console.error('Feed load error:', e);
      } finally {
        setHasLoadedOnce(true);
        setLoading(false);
      }
    })();
  }, [user]);

  // Like feature removed — toggleLike deleted

  const toggleSave = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const post = feed.find(p => p.id === postId);
    if (!post) return;
    if (!user) { router.push('/login'); return; }
    const isSaving = !savedPosts.has(postId);
    const newSaved = new Set(savedPosts);
    if (isSaving) {
      newSaved.add(postId);
      toast({ title: 'Saved!' });
    } else {
      newSaved.delete(postId);
    }
    setSavedPosts(newSaved);
    if (post.productId) {
      api.feedback(`product:${post.productId}`, isSaving ? 'save' : 'unsave', isSaving ? 1 : 0, { page: 'feed' });
    } else if (post.videoId) {
      api.feedback(`video:${post.videoId}`, isSaving ? 'save' : 'unsave', isSaving ? 1 : 0, { page: 'feed' });
    }
  };

  const toggleFollow = (sellerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    const newFollowing = new Set(following);
    if (newFollowing.has(sellerId)) {
      newFollowing.delete(sellerId);
      api.social.unfollow(sellerId);
    } else {
      newFollowing.add(sellerId);
      api.social.follow(sellerId);
    }
    setFollowing(newFollowing);
  };

  const addToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    api.cart.add(product.id, 1);
    
    toast({ title: 'Added to cart!', description: product.name });
    api.feedback(`product:${product.id}`, 'click', 1.5, { page: 'feed' });
  };

  if (loading) {
    return <PageSkeleton variant="home" />;
  }

  // Filter feed by active tab
  let filteredFeed = feed;
  if (activeTab === 'Following') {
    filteredFeed = feed.filter(p => p.sellerId && following.has(p.sellerId));
  } else if (activeTab === 'Trending') {
    filteredFeed = [...feed].sort(
      (a, b) => (b.likes + (b.views || 0) + (b.soldCount || 0)) - (a.likes + (a.views || 0) + (a.soldCount || 0))
    );
  }

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
      {/* ===== FILTER TABS (For You / Following / Trending) ===== */}
      <div
        className="sticky top-16 z-20 flex items-center gap-2 px-4 py-3"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #F3F4F6' }}
      >
        {(['For You', 'Following', 'Trending'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="font-semibold transition-all whitespace-nowrap"
              style={{
                height: '36px',
                padding: '0 20px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 600,
                background: isActive ? '#111827' : 'transparent',
                color: isActive ? '#FFFFFF' : '#374151',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* ===== FEED ===== */}
      <main className="px-4 py-4 flex flex-col gap-4">
        {filteredFeed.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: '#F3F4F6' }}
            >
              <Sparkles className="w-6 h-6" style={{ color: '#9CA3AF' }} />
            </div>
            <p className="font-semibold" style={{ fontSize: '15px', color: '#111827' }}>
              {activeTab === 'Following' ? 'No posts from people you follow' : 'No posts found'}
            </p>
            <p className="mt-1" style={{ fontSize: '13px', color: '#6B7280' }}>
              {activeTab === 'Following'
                ? 'Follow some sellers to see their posts here.'
                : 'Try a different tab or check back later.'}
            </p>
            {activeTab !== 'For You' && (
              <button
                onClick={() => setActiveTab('For You')}
                className="mt-4 font-bold transition-opacity active:opacity-70"
                style={{ fontSize: '13px', color: '#111827' }}
              >
                Go to For You
              </button>
            )}
          </div>
        ) : (
          filteredFeed.map((post, index) => (
            <FeedPostCard
              key={post.id}
              post={post}
              index={index}
              liked={false}
              saved={savedPosts.has(post.id)}
              isFollowing={post.sellerId ? following.has(post.sellerId) : false}
              onLike={() => {}}
              onSave={(e) => toggleSave(post.id, e)}
              onFollow={(e) => post.sellerId && toggleFollow(post.sellerId, e)}
              onAddToCart={(e) => post.product && addToCart(post.product, e)}
              trackView={trackView}
              onOpenPost={() => setModalPost(post)}
            />
          ))
        )}

        {/* End of feed */}
        {filteredFeed.length > 0 && (
          <div className="text-center py-10 px-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: '#F3F4F6' }}
            >
              <HomeIcon className="w-6 h-6" style={{ color: '#9CA3AF' }} strokeWidth={1.5} />
            </div>
            <p className="font-semibold" style={{ fontSize: '14px', color: '#111827' }}>You're all caught up</p>
            <p className="mt-1" style={{ fontSize: '12px', color: '#9CA3AF' }}>You've seen all new posts.</p>
          </div>
        )}
      </main>

      {/* Full Post Modal — X/Twitter detail view style */}
      <FullPostModal post={modalPost} onClose={() => setModalPost(null)} />
    </div>
  );
}

/* ===================== Feed Post Card ===================== */

function FeedPostCard({
  post, index, liked, saved, isFollowing, onLike, onSave, onFollow, onAddToCart, trackView, onOpenPost,
}: {
  post: FeedPost;
  index: number;
  liked: boolean;
  saved: boolean;
  isFollowing: boolean;
  onLike: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  onFollow: (e: React.MouseEvent) => void;
  onAddToCart: (e: React.MouseEvent) => void;
  trackView: (postId: string, videoId?: number, productId?: number) => void;
  onOpenPost: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments || 0);
  const { toast } = useToast();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackView(post.id, post.videoId, post.productId);
        }
      },
      { threshold: 0.5 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const isVideo = post.type === 'video';
  const likeCount = post.likes + (liked ? 1 : 0);

  const handle = post.sellerSlug
    || (post.sellerName || 'seller').toLowerCase().replace(/[^a-z0-9]/g, '');

  const sellerHref = post.sellerSlug
    ? `/${post.sellerSlug}`
    : '#';

  const productHref = post.product ? `/product?id=${post.product.id}` : '#';

  const subtext = post.soldCount && post.soldCount > 0
    ? `${post.soldCount > 1000 ? `${(post.soldCount / 1000).toFixed(1)}k` : post.soldCount} sold`
    : 'Free shipping';

  return (
    <article
      ref={cardRef}
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
      }}
    >
      {/* ===== SELLER HEADER (click → opens Full Post Modal) ===== */}
      <div
        className="flex items-center justify-between gap-3 cursor-pointer"
        style={{ padding: '16px 20px 12px' }}
        onClick={(e) => {
          // Only open modal if clicking the header area (not the Follow button or more dots)
          const target = e.target as HTMLElement;
          if (target.closest('button')) return; // let buttons handle their own clicks
          e.preventDefault();
          e.stopPropagation();
          onOpenPost();
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar 40px circle */}
          <div
            className="shrink-0 overflow-hidden flex items-center justify-center"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: '#F3F4F6',
            }}
          >
            {post.sellerImage ? (
              <SmartImage src={post.sellerImage} alt={post.sellerName} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold" style={{ fontSize: '15px', color: '#6B7280' }}>
                {post.sellerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span
                className="font-semibold truncate"
                style={{ fontSize: '15px', color: '#111827', fontWeight: 600 }}
              >
                {post.sellerName}
              </span>
              {post.verified && (
                <BadgeCheck
                  className="w-4 h-4 shrink-0"
                  style={{ color: '#3B82F6' }}
                  strokeWidth={2}
                />
              )}
            </div>
            <div
              className="truncate"
              style={{ fontSize: '13px', color: '#6B7280' }}
            >
              @{handle}
              {post.createdAt && (
                <>
                  {' · '}
                  {timeAgoShort(post.createdAt)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Follow button (if not following) OR more dots */}
        <div className="shrink-0 flex items-center gap-2">
          {post.sellerId && !isFollowing && (
            <button
              onClick={onFollow}
              className="font-semibold transition-opacity active:opacity-70"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#111827',
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid #E5E7EB',
                background: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              Follow
            </button>
          )}
          <button
            className="flex items-center justify-center transition-opacity active:opacity-70"
            style={{ width: '28px', height: '28px' }}
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" style={{ color: '#9CA3AF' }} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ===== CAPTION (padding 0 20px 12px) ===== */}
      {post.caption && (
        <p
          style={{
            padding: '0 20px 12px',
            fontSize: '15px',
            color: '#111827',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {post.caption}
        </p>
      )}

      {/* ===== MEDIA (margin 0 20px 16px, radius 12px, aspect 4/5) ===== */}
      <div
        className="relative overflow-hidden"
        style={{
          margin: '0 20px 16px',
          borderRadius: '12px',
          aspectRatio: '4 / 5',
          background: '#F3F4F6',
        }}
      >
        {isVideo ? (
          <Link href="/videos" className="block w-full h-full relative">
            <SmartVideo
              src={post.mediaUrl}
              className="w-full h-full"
              autoPlay={true}
              loop={true}
              onInView={() => trackView(post.id, post.videoId, post.productId)}
            />
          </Link>
        ) : (
          <Link href={productHref} className="block w-full h-full">
            <SmartImage
              src={post.mediaUrl}
              alt={post.caption || post.product?.name || ''}
              width={600}
              className="w-full h-full object-cover"
            />
          </Link>
        )}

        {/* ===== PRODUCT OVERLAY (dark glass, bottom-left) ===== */}
        {post.product && (
          <Link
            href={productHref}
            className="absolute"
            style={{
              bottom: '12px',
              left: '12px',
              background: 'rgba(17, 24, 39, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '10px 16px',
              maxWidth: 'calc(100% - 24px)',
            }}
          >
            <div
              className="font-semibold truncate"
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#FFFFFF',
                maxWidth: '220px',
              }}
            >
              {post.product.name}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: '2px',
              }}
            >
              {subtext}
            </div>
            <div
              className="font-bold"
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#FFFFFF',
                marginTop: '4px',
              }}
            >
              {formatPrice(post.product.price)}
            </div>
          </Link>
        )}
      </div>

      {/* ===== ACTION BAR (border-top, padding 16px 20px 20px) ===== */}
      <div
        className="flex items-center justify-between gap-3"
        style={{
          borderTop: '1px solid #F3F4F6',
          padding: '16px 20px 20px',
        }}
      >
        {/* Left: Comment | Share | Bookmark (gap 24px) — Like removed */}
        <div className="flex items-center" style={{ gap: '20px' }}>
          {/* Comment */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsOpen(true); }}
            className="flex items-center gap-1.5 "
            aria-label="Comments"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={2} style={{ color: '#374151' }} />
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
              {formatCount(commentCount)}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = post.product ? `${window.location.origin}/product?id=${post.product.id}` : window.location.href;
              if (typeof navigator !== 'undefined' && navigator.share) {
                navigator.share({ title: post.caption || 'Check this out on Cellex', url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
                toast({ title: 'Link copied!' });
              }
              if (post.videoId) api.feedback(`video:${post.videoId}`, 'share', 0.5, { page: 'feed' });
              else if (post.productId) api.feedback(`product:${post.productId}`, 'share', 0.5, { page: 'feed' });
            }}
            className="flex items-center gap-1.5 "
            aria-label="Share"
          >
            <Share2 className="w-5 h-5" strokeWidth={2} style={{ color: '#374151' }} />
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
              {formatCount(post.views || 0)}
            </span>
          </button>

          {/* Bookmark */}
          <button
            onClick={onSave}
            className="flex items-center justify-center "
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            <Bookmark
              className="w-5 h-5"
              strokeWidth={2}
              style={{
                color: saved ? '#111827' : '#374151',
                fill: saved ? '#111827' : 'none',
              }}
            />
          </button>
        </div>

        {/* Right: Add to Cart pill button */}
        {post.product && (
          <button
            onClick={onAddToCart}
            className="flex items-center gap-1.5 font-semibold transition-transform active:scale-95 shrink-0"
            style={{
              background: '#111827',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              padding: '10px 20px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
            }}
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} style={{ color: '#FFFFFF' }} />
            <span>Add to Cart</span>
          </button>
        )}
      </div>

      {/* Comments modal */}
      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postType={post.videoId ? 'video' : 'product'}
        postId={post.videoId || post.productId || 0}
        postCaption={post.caption}
        onCommentAdded={(count) => setCommentCount(count)}
      />
    </article>
  );
}

/* ===================== Helpers ===================== */

function timeAgoShort(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd';
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// Simple string hash for deterministic per-user shuffling (same user = same
// order on refresh, but different users see different orders).
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seeded shuffle — deterministic per seed so the same user sees the same
// order on refresh, but different users see different orders.
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let rng = seed;
  for (let i = result.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
