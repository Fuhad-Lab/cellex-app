'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { motion } from 'framer-motion';
import { Search, Heart, MessageCircle, Send, Bookmark, Share2,
  Store, ChevronRight, Play, Zap, Users, ShieldCheck, Star, Eye,
  CheckCircle, Bell, User, Sparkles, Home as HomeIcon, Flame, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useOptimisticUI } from '@/components/optimistic-ui';
import { PageSkeleton } from '@/components/page-skeleton';
import { CommentsModal } from '@/components/comments-modal';
import { SmartImage } from '@/components/smart-image';
import { SmartVideo } from '@/components/smart-video';

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

export default function HomePage() {
  const router = useRouter();
  const { user, isSeller, unreadMessages } = useAuth();
  const { toast } = useToast();
  const { burst } = useOptimisticUI();

  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const viewedPosts = useRef<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());

  // Social tabs + category chips (Gemini-style shoppable social commerce layout)
  const [activeTab, setActiveTab] = useState<'For You' | 'Following' | 'Shops' | 'Live'>('For You');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const CATEGORIES = ['All', 'Deals', 'Electronics', 'Fashion', 'Food', 'Beauty', 'Home', 'Sports', 'Books'];

  const searchBarRef = useRef<HTMLDivElement>(null);

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
    // Prefix with type so Gorse sees videos and products as distinct items
    const itemId = videoId ? `video:${videoId}` : productId ? `product:${productId}` : postId;
    api.feedback(itemId, 'view', 0.3);
  };

  // Note: unreadMessages is fetched by AuthProvider (shared across all pages
  // via useAuth context) and polled every 30 seconds. No duplicate fetch here.

  useEffect(() => {
    (async () => {
      try {
        // Fetch feed_posts (seller-created posts with product attached) +
        // recommend API (Gorse/trending) in parallel.
        // Feed posts include video, photo, text, and story types — all with
        // a product attached that shows in the card.
        const [feedPostsResp, recommendResp, storiesResp, liveResp, sellersResp] = await Promise.all([
          api.feedPosts.list(50).catch(() => ({ success: false, posts: [] })),
          api.recommend.home(40),
          api.stories.activeBar().catch(() => ({ success: false })),
          api.live.list('live').catch(() => ({ success: false })),
          api.social.discover(60).catch(() => ({ success: false })),
        ]);

        const sellerMap = new Map<string, { name: string; image?: string; slug?: string }>();
        if (sellersResp.success) {
          const sellersList = sellersResp.sellers || [];
          setSellers(sellersList);
          sellersList.forEach((s: any) => {
            sellerMap.set(s.id, { name: s.business_name || s.farm_name || 'Seller', image: s.profile_image, slug: s.slug });
          });
        }

        const posts: FeedPost[] = [];

        // Feed posts (seller-created: video, photo, text, story — all with product attached).
        // These are the primary feed content. Every post has a product that shows in the card.
        if (feedPostsResp.success && feedPostsResp.posts) {
          feedPostsResp.posts.forEach((fp: any) => {
            const product = fp.product || {};
            const seller = fp.seller || {};
            posts.push({
              type: fp.postType === 'video' ? 'video' : 'product',
              id: `fp-${fp.id}`,
              videoId: fp.postType === 'video' ? fp.id : undefined,
              productId: product.id,
              sellerId: seller.slug ? undefined : undefined, // seller slug is on the post
              sellerSlug: seller.slug,
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
          });
        }

        // The recommend API returns `posts` — a unified, Gorse-ranked list of
        // videos and products. Each post has a `type` field ('video' | 'product').
        if (recommendResp.success && recommendResp.posts) {
          recommendResp.posts.forEach((item: any) => {
            if (item.type === 'video') {
              const seller = item.seller || {};
              const sellerInfo = seller.id ? sellerMap.get(seller.id) : null;
              posts.push({
                type: 'video',
                id: `vid-${item.id}`,
                videoId: item.id,
                productId: item.product_id || item.product?.id,
                liked: item.liked || false,
                sellerId: seller.id || item.seller_id,
                sellerSlug: seller.slug || sellerInfo?.slug,
                sellerName: seller.business_name || sellerInfo?.name || 'Seller',
                sellerImage: seller.profile_image || sellerInfo?.image,
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
            } else if (item.type === 'product') {
              const sellerInfo = item.seller_id ? sellerMap.get(item.seller_id) : null;
              posts.push({
                type: 'product',
                id: `prod-${item.id}`,
                productId: item.id,
                sellerId: item.seller_id,
                sellerSlug: sellerInfo?.slug,
                sellerName: sellerInfo?.name || 'Cellex Seller',
                sellerImage: sellerInfo?.image,
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
          });
        }

        // Feed is EXACTLY what Gorse/trending returned — no interleave, no reordering.
        setFeed(posts);

        // Initialize liked posts from API response
        const initialLiked = new Set<string>();
        posts.forEach(p => {
          if (p.liked) initialLiked.add(p.id);
        });
        setLikedPosts(initialLiked);

        if (storiesResp.success) setStories(storiesResp.stories || []);
        if (liveResp.success) setLiveSessions(liveResp.sessions || []);

        // Shorts section: extract video posts from the feed (the ones Gorse
        // ranked highest). No separate API call — the feed IS the source of truth.
        const videoPosts = posts.filter(p => p.type === 'video').slice(0, 10);
        if (videoPosts.length > 0) {
          const videoShorts = videoPosts.map(p => ({
            id: p.videoId!,
            videoUrl: p.mediaUrl,
            caption: p.caption,
            views: p.views || 0,
            likes: p.likes || 0,
            seller: { id: p.sellerId, business_name: p.sellerName, profile_image: p.sellerImage, slug: p.sellerSlug },
            product: p.product,
            createdAt: p.createdAt,
          }));
          setShorts(videoShorts);
        }
      } catch (e) {
        console.error('Feed load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleLike = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    const post = feed.find(p => p.id === postId);
    if (!post) return;
    const isLiking = !likedPosts.has(postId);
    const newLiked = new Set(likedPosts);
    if (isLiking) {
      newLiked.add(postId);
      burst(e.clientX, e.clientY, 'heart');
    } else {
      newLiked.delete(postId);
    }
    setLikedPosts(newLiked);
    // Persist video likes to the real product_video_likes table via the videos edge function
    if (post.videoId) {
      if (isLiking) api.videos.like(post.videoId);
      else api.videos.unlike(post.videoId);
    }
    // Send REAL feedback (persists to product_view_log/buyers_wishlist for products,
    // fires to Gorse for both products and videos)
    const itemId = post.videoId ? `video:${post.videoId}` : post.productId ? `product:${post.productId}` : postId;
    api.feedback(itemId, isLiking ? 'like' : 'unlike', isLiking ? 1 : 0);
  };

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
    // REAL save: persist to buyers_wishlist via the feedback API
    // (which writes a real row to Supabase + fires Gorse feedback in background)
    if (post.productId) {
      api.feedback(`product:${post.productId}`, isSaving ? 'save' : 'unsave', isSaving ? 1 : 0, { page: 'feed' });
    } else if (post.videoId) {
      // Video saves — only Gorse feedback (no dedicated table yet)
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
    burst(e.clientX, e.clientY, 'check');
    toast({ title: 'Added to cart!', description: product.name });
    // Send feedback to Gorse (strong signal — intent to buy)
    api.feedback(`product:${product.id}`, 'click', 1.5, { page: 'feed' });
  };

  if (loading) {
    return <PageSkeleton variant="home" />;
  }

  return (
    <div className="ig-container min-h-screen ig-topbar-offset">
      {/* Top bar — IG-style: logo left, search center, icons right */}
      <div
        ref={searchBarRef}
        className="fx-topbar ig-topbar"
      >
        {/* Logo — left (like Facebook logo) */}
        <Link href="/" className="shrink-0">
          <span className="text-2xl font-extrabold" style={{ color: '#D4AF37', fontFamily: 'var(--font-geist-mono)' }}>Cellex</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* RIGHT SIDE — Facebook-style action icons: Create +, Search, Messenger */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Create button */}
          <Link
            href="/create"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F5F5F5', border: '1px solid #E5E5E5' }}
            aria-label="Create"
          >
            <Plus className="w-5 h-5" style={{ color: '#000' }} />
          </Link>

          {/* Search button (opens spotlight) */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F5F5F5', border: '1px solid #E5E5E5' }}
            aria-label="Search"
          >
            <Search className="w-5 h-5" style={{ color: '#000' }} />
          </button>

          {/* Messenger */}
          <Link
            href="/messenger"
            className="w-9 h-9 rounded-full flex items-center justify-center relative transition-colors"
            style={{ background: '#F5F5F5', border: '1px solid #E5E5E5' }}
            aria-label="Messages"
          >
            <Send className="w-5 h-5" style={{ color: '#000' }} />
            {user && unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#D4AF37', border: '2px solid #fff' }}>
                <span className="text-[9px] font-bold leading-none" style={{ color: '#000' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Social switcher tabs — For You / Following / Shops / Live.
          FUNCTIONAL: filters the feed by post type / seller relationship. */}
      <div className="fx-topbar border-t border-[#E5E5E5]" style={{ paddingTop: 0, paddingBottom: '8px' }}>
        <div className="flex items-center justify-around text-xs font-semibold">
          {(['For You', 'Following', 'Shops', 'Live'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-1.5 px-3 relative transition-colors"
              style={{
                color: activeTab === tab ? 'var(--cellex-coral)' : 'var(--cellex-text-muted)',
                fontWeight: activeTab === tab ? 700 : 500,
              }}
            >
              {tab === 'Live' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--cellex-coral)] mr-1 animate-pulse" style={{ verticalAlign: 'middle' }} />
              )}
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--cellex-coral)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips — FUNCTIONAL: filters feed by product category. */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: activeCategory === cat
                  ? 'linear-gradient(135deg, var(--cellex-coral), var(--cellex-sand))'
                  : 'var(--cellex-surface-2)',
                color: activeCategory === cat ? '#0F1115' : 'var(--cellex-text-muted)',
                border: activeCategory === cat ? '1px solid var(--cellex-coral)' : '1px solid var(--cellex-border)',
                boxShadow: activeCategory === cat ? '0 2px 12px rgba(255, 107, 107, 0.3)' : 'none',
              }}
            >
              {cat === 'Deals' && <Zap className="w-3 h-3 text-[var(--cellex-sand)] inline mr-1" />}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stories section — IG-style horizontal scroll with gradient rings */}
      {stories.length > 0 && (
        <div className="ig-hero-bg border-b border-[#E5E5E5]">
          <div className="flex gap-4 px-3 py-3 overflow-x-auto no-scrollbar">
            {stories.slice(0, 12).map((s: any, i: number) => {
              const storyHref = s.slug ? `/${s.slug}` : `/seller-profile?id=${s.seller_id || ''}`;
              return (
                <Link key={i} href={storyHref} className="shrink-0 flex flex-col items-center gap-1">
                  <div className="ig-story-ring" style={{ width: 56, height: 56 }}>
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-[#F5F5F5]">
                      {s.profile_image ? (
                        <img src={s.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-[var(--cellex-text-muted)]" />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--cellex-text-muted)] max-w-[60px] truncate">{s.business_name || 'Seller'}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Auctions section — eBay-style horizontal scroll of live seller cards.
          Replaces the old small "LIVE NOW" pill. Each card shows the seller,
          their live title, viewer count, and a Watch Live CTA. */}
      {liveSessions.length > 0 && (
        <LiveAuctionsSection sessions={liveSessions} />
      )}

      {/* Shorts section — YouTube Shorts / IG Reels style horizontal scroll.
          Vertical 9:16 video thumbnails with caption + views. Appears above
          the feed so users can discover video content quickly. */}
      {shorts.length > 0 && (
        <ShortsSection shorts={shorts} />
      )}

      {/* Feed — filtered by active tab + category.
          Every 3 feed posts, insert a horizontal "Suggested Sellers" carousel. */}
      <div>
        {(() => {
          // FUNCTIONAL filtering — no static content.
          // Tab filters: For You = all, Following = only followed sellers' posts,
          // Shops = products only, Live = live sessions (handled separately above).
          // Category filter: matches post.product.category (products) or skips (videos).
          let filteredFeed = feed;
          if (activeTab === 'Following') {
            filteredFeed = feed.filter(p => p.sellerId && following.has(p.sellerId));
          } else if (activeTab === 'Shops') {
            filteredFeed = feed.filter(p => p.type === 'product');
          } else if (activeTab === 'Live') {
            filteredFeed = feed.filter(p => p.isLive);
          }
          if (activeCategory !== 'All') {
            filteredFeed = filteredFeed.filter(p => {
              if (activeCategory === 'Deals') return p.product?.group_buy_enabled || p.isLive;
              const cat = p.product?.category || '';
              return cat.toLowerCase() === activeCategory.toLowerCase();
            });
          }

          if (filteredFeed.length === 0) {
            return (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-3" style={{ borderColor: 'var(--cellex-border)' }}>
                  <Sparkles className="w-6 h-6" style={{ color: 'var(--cellex-text-muted)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--cellex-text)' }}>No posts found</p>
                <p className="text-xs mt-1" style={{ color: 'var(--cellex-text-muted)' }}>
                  Try a different tab or category.
                </p>
                <button
                  onClick={() => { setActiveTab('For You'); setActiveCategory('All'); }}
                  className="mt-4 text-xs font-bold transition"
                  style={{ color: 'var(--cellex-coral)' }}
                >
                  Reset filters
                </button>
              </div>
            );
          }

          return filteredFeed.map((post, index) => {
          // Insert a seller carousel AFTER every 3rd post (index 2, 5, 8, ...)
          const showSellers = sellers.length > 0 && (index + 1) % 3 === 0;
          // Rotate the seller batch: carousel 0 shows sellers[0..2], carousel 1 shows sellers[3..5], etc.
          const carouselIndex = Math.floor((index + 1) / 3) - 1;
          const sellerBatch = sellers.slice(carouselIndex * 3, carouselIndex * 3 + 3);

          return (
            <div key={post.id}>
              <FeedPostCard
                post={post}
                index={index}
                liked={likedPosts.has(post.id)}
                saved={savedPosts.has(post.id)}
                isFollowing={post.sellerId ? following.has(post.sellerId) : false}
                onLike={(e) => toggleLike(post.id, e)}
                onSave={(e) => toggleSave(post.id, e)}
                onFollow={(e) => post.sellerId && toggleFollow(post.sellerId, e)}
                onAddToCart={(e) => post.product && addToCart(post.product, e)}
                trackView={trackView}
              />
              {showSellers && sellerBatch.length > 0 && (
                <SuggestedSellersCarousel
                  sellers={sellerBatch}
                  carouselIndex={carouselIndex}
                  following={following}
                  onFollow={(sellerId, e) => toggleFollow(sellerId, e)}
                />
              )}
            </div>
          );
        });
        })()}
      </div>

      {/* End of feed */}
      <div className="text-center py-12 px-4">
        <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-3" style={{ borderColor: 'var(--cellex-border)' }}>
          <Sparkles className="w-6 h-6" style={{ color: 'var(--cellex-text-muted)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--cellex-text)' }}>You're all caught up</p>
        <p className="text-xs mt-1" style={{ color: 'var(--cellex-text-muted)' }}>You've seen all new posts from the last 3 days.</p>
      </div>
    </div>
  );
}

function FeedPostCard({
  post, index, liked, saved, isFollowing, onLike, onSave, onFollow, onAddToCart, trackView
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
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments || 0);
  const { toast } = useToast();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          trackView(post.id, post.videoId, post.productId);
        }
      },
      { threshold: 0.5 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (inView) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
  }, [inView]);

  const isVideo = post.type === 'video';
  const likeCount = post.likes + (liked ? 1 : 0);
  const fomoText = post.soldCount && post.soldCount > 5
    ? `${post.soldCount > 1000 ? `${(post.soldCount / 1000).toFixed(1)}k` : post.soldCount} bought this`
    : post.views && post.views > 50
    ? `${formatCount(post.views)} viewing now`
    : post.soldCount && post.soldCount > 0
    ? `${post.soldCount} bought this`
    : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="fx-card ig-card ig-card-spaced overflow-hidden"
      style={{ borderRadius: '24px', padding: 0 }}
    >
      {/* CARD HEADER: Creator & Seller Trust Badge */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b" style={{ background: 'var(--cellex-surface-2)', borderColor: 'var(--cellex-border)' }}>
        {/* Creator Info */}
        <Link
          href={post.sellerSlug ? `/${post.sellerSlug}` : (post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#')}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F5F5F5] ring-2 transition" style={{ '--tw-ring-color': 'rgba(255,107,107,0.4)' } as React.CSSProperties}>
              {post.sellerImage ? (
                <SmartImage src={post.sellerImage} alt="" width={40} height={40} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: 'var(--cellex-text)' }}>{post.sellerName.charAt(0)}</span>
                </div>
              )}
            </div>
            {post.verified && (
              <CheckCircle className="w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5" style={{ color: 'var(--cellex-coral)', fill: 'var(--cellex-coral)', stroke: 'var(--cellex-bg)' }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs truncate" style={{ color: 'var(--cellex-text)' }}>
                {post.sellerName}
              </span>
              {post.createdAt && (
                <span className="text-[11px]" style={{ color: 'var(--cellex-text-muted)' }}>• {timeAgo(post.createdAt)}</span>
              )}
            </div>
            {/* Seller trust badge */}
            <div className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5" style={{ color: 'var(--cellex-success)', background: 'rgba(40,199,111,0.1)', border: '1px solid rgba(40,199,111,0.3)' }}>
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>Verified Seller</span>
            </div>
          </div>
        </Link>

        {/* Follow Button */}
        {post.sellerId && !isFollowing && (
          <button
            onClick={onFollow}
            className="text-xs font-semibold px-3 py-1 rounded-full transition shrink-0"
            style={{ color: 'var(--cellex-coral)', border: '1px solid var(--cellex-coral)' }}
          >
            Follow
          </button>
        )}
      </div>

      {/* CARD MEDIA: 4:3 aspect ratio with overlay badges */}
      <div className="relative w-full overflow-hidden bg-[var(--cellex-surface-2)]" style={{ aspectRatio: '4 / 3' }}>
        {isVideo ? (
          <Link href="/videos" className="block w-full h-full relative">
            <SmartVideo
              src={post.mediaUrl}
              className="w-full h-full"
              autoPlay={true}
              loop={true}
              onInView={() => trackView(post.id, post.videoId, post.productId)}
            />
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 z-10">
              <Play className="w-3 h-3 text-black fill-white" />
              <span className="text-black text-[10px] font-semibold">Video</span>
            </div>
          </Link>
        ) : (
          <Link href={post.product ? `/product?id=${post.product.id}` : '#'} className="block w-full h-full group">
            <SmartImage
              src={post.mediaUrl}
              alt={post.caption}
              width={600}
              className="w-full h-full group-hover:scale-105 transition duration-500"
            />
          </Link>
        )}

        {/* Type indicator tag — top-left */}
        {post.product?.group_buy_enabled && (
          <div className="absolute top-3 left-3 text-black font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1" style={{ background: 'linear-gradient(90deg, var(--cellex-sand), #e8a347)' }}>
            <Users className="w-2.5 h-2.5" /> GROUP BUY
          </div>
        )}
        {post.isLive && (
          <div className="absolute top-3 left-3 text-black font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse" style={{ background: 'linear-gradient(90deg, var(--cellex-coral), var(--cellex-sand))' }}>
            <Zap className="w-2.5 h-2.5" /> FLASH DEAL
          </div>
        )}

        {/* Social proof overlay — bottom-left */}
        {fomoText && (
          <div className="absolute bottom-3 left-3 backdrop-blur-md text-[11px] font-medium px-3 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(15,17,21,0.8)', color: 'var(--cellex-text)', border: '1px solid var(--cellex-border)' }}>
            <Flame className="w-3 h-3" style={{ color: 'var(--cellex-sand)' }} />
            <span>{fomoText}</span>
          </div>
        )}

        {/* Quick View button — bottom-right */}
        {post.product && (
          <Link
            href={`/product?id=${post.product.id}`}
            className="absolute bottom-3 right-3 font-semibold text-xs px-3 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 transition"
            style={{ background: 'rgba(23,26,33,0.9)', color: 'var(--cellex-text)', border: '1px solid var(--cellex-border)' }}
          >
            <Eye className="w-3 h-3" /> Quick View
          </Link>
        )}
      </div>

      {/* CARD CONTENT & COMMERCE INFO */}
      <div className="p-4 flex flex-col gap-2">
        {/* Title */}
        {post.product ? (
          <Link href={`/product?id=${post.product.id}`}>
            <h3 className="font-bold text-sm line-clamp-1 cursor-pointer transition" style={{ color: 'var(--cellex-text)' }}>
              {post.caption}
            </h3>
          </Link>
        ) : (
          <h3 className="font-bold text-sm line-clamp-1" style={{ color: 'var(--cellex-text)' }}>{post.caption}</h3>
        )}

        {/* Description */}
        {post.product?.description && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--cellex-text-muted)' }}>
            {post.product.description}
          </p>
        )}

        {/* Price & rating row */}
        {post.product && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold" style={{ color: 'var(--cellex-text)' }}>
                {formatPrice(post.product.price)}
              </span>
              {post.product.units_sold && post.product.units_sold > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded" style={{ color: 'var(--cellex-sand)', background: 'rgba(244,184,96,0.15)', border: '1px solid rgba(244,184,96,0.3)' }}>
                  {post.product.units_sold} sold
                </span>
              )}
            </div>
            {post.soldCount && post.soldCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--cellex-sand)' }}>
                <Star className="w-3 h-3" style={{ fill: 'var(--cellex-sand)', color: 'var(--cellex-sand)' }} />
                <span>Trending</span>
              </div>
            )}
          </div>
        )}

        {/* ACTION BUTTONS: View Item & Buy Now */}
        {post.product && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Link
              href={`/product?id=${post.product.id}`}
              className="w-full font-semibold text-xs py-2.5 rounded-2xl transition flex items-center justify-center gap-1.5"
              style={{ background: 'var(--cellex-surface-2)', color: 'var(--cellex-text)', border: '1px solid var(--cellex-border)' }}
            >
              <Eye className="w-3.5 h-3.5" style={{ color: 'var(--cellex-text-muted)' }} /> View Item
            </Link>
            <button
              onClick={onAddToCart}
              className="w-full font-extrabold text-xs py-2.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-1.5 active:scale-95"
              style={{ background: 'linear-gradient(90deg, var(--cellex-coral), #ff5252)', color: '#0F1115', boxShadow: '0 4px 16px rgba(255,107,107,0.3)' }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: 'var(--cellex-sand)' }} /> Buy Now
            </button>
          </div>
        )}

        {/* SOCIAL ENGAGEMENT ROW: Like, Comment, Save, Share */}
        <div className="flex items-center justify-between border-t pt-3 mt-1 text-xs" style={{ borderColor: 'var(--cellex-border)', color: 'var(--cellex-text-muted)' }}>
          {/* Like */}
          <button
            onClick={onLike}
            className="flex items-center gap-1.5 transition"
            style={{ color: liked ? 'var(--cellex-coral)' : undefined, fontWeight: liked ? 700 : undefined }}
          >
            <motion.div whileTap={{ scale: 1.2 }}>
              <Heart className="w-4 h-4" style={{ fill: liked ? 'var(--cellex-coral)' : 'none', color: liked ? 'var(--cellex-coral)' : undefined }} strokeWidth={2} />
            </motion.div>
            <span>{formatCount(likeCount)}</span>
          </button>

          {/* Comment */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsOpen(true); }}
            className="flex items-center gap-1.5 transition hover:opacity-70"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={2} />
            <span>{formatCount(commentCount)}</span>
          </button>

          {/* Save */}
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 transition"
            style={{ color: saved ? 'var(--cellex-sand)' : undefined, fontWeight: saved ? 700 : undefined }}
          >
            <Bookmark className="w-4 h-4" style={{ fill: saved ? 'var(--cellex-sand)' : 'none', color: saved ? 'var(--cellex-sand)' : undefined }} strokeWidth={2} />
            <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
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
            className="flex items-center gap-1.5 transition hover:opacity-70"
          >
            <Share2 className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
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
    </motion.article>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'JUST NOW';
  if (diff < 3600) return Math.floor(diff / 60) + 'M';
  if (diff < 86400) return Math.floor(diff / 3600) + 'H';
  if (diff < 604800) return Math.floor(diff / 86400) + 'D';
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format the duration a live session has been running.
 * e.g. "5m", "1h 23m", "2h"
 */
function formatLiveDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const diff = Date.now() - start;
  if (diff < 0) return '0m';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/**
 * LiveAuctionsSection — eBay-style horizontal scroll of live seller cards.
 *
 * Each card shows:
 * - Seller avatar with pulsing red LIVE ring
 * - Seller name
 * - Live session title (e.g. "Friday tech deals")
 * - Viewer count with eye icon
 * - "Watch Live" CTA button
 *
 * The section has a dark gradient background to make the LIVE cards pop,
 * similar to eBay's live auction section.
 */
function LiveAuctionsSection({ sessions }: { sessions: any[] }) {
  return (
    <section className="fx-card ig-card ig-card-spaced mt-3 overflow-hidden">
      {/* Dark gradient backdrop inside the card so the LIVE cards pop */}
      <div className="bg-gradient-to-b from-neutral-900 to-black py-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[var(--cellex-coral)] rounded-full ig-float" />
            <span className="text-xs font-bold text-black tracking-wide">LIVE NOW</span>
          </span>
          <span className="text-xs text-black/50">·</span>
          <span className="text-xs text-black/70">{sessions.length} seller{sessions.length === 1 ? '' : 's'} streaming</span>
        </div>
        <Link href="/live" className="text-xs font-semibold text-[var(--cellex-coral)] hover:opacity-70">
          See all
        </Link>
      </div>

      {/* Horizontal scroll of live cards */}
      <div className="flex gap-3 px-3 overflow-x-auto no-scrollbar">
        {sessions.map((session, index) => {
          const seller = session.seller || {};
          const sellerName = seller.business_name || 'Seller';
          const sellerImage = seller.profile_image;
          const title = session.title || `${sellerName} is live`;
          const viewers = session.viewer_count || 0;
          const liveDuration = session.started_at
            ? formatLiveDuration(session.started_at)
            : null;

          return (
            <Link
              key={session.id}
              href={`/live-watch?id=${session.id}`}
              className="ig-bounce-in shrink-0 w-64 bg-[#F5F5F5] rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Top: avatar + LIVE badge + duration */}
              <div className="relative h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                {/* Pulsing red ring around avatar */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[var(--cellex-coral)] animate-ping opacity-40" />
                  <div className="relative w-16 h-16 rounded-full border-2 border-[var(--cellex-coral)] overflow-hidden bg-[#F5F5F5]">
                    {sellerImage ? (
                      <img src={sellerImage} alt={sellerName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-black font-bold text-2xl">
                        {sellerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                {/* LIVE badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-[var(--cellex-coral)] text-black text-[10px] font-bold px-2 py-0.5 rounded-full ig-pulse-glow">
                  <span className="w-1.5 h-1.5 bg-[#F5F5F5] rounded-full" />
                  LIVE
                </div>
                {/* Duration */}
                {liveDuration && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-black text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {liveDuration}
                  </div>
                )}
              </div>
              {/* Bottom: title + viewers + CTA */}
              <div className="p-3">
                <div className="text-xs font-semibold text-black truncate mb-1">{sellerName}</div>
                <div className="text-xs text-[var(--cellex-text-muted)] line-clamp-1 mb-2">{title}</div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-[var(--cellex-text-muted)]">
                    <span className="w-1.5 h-1.5 bg-[var(--cellex-coral)] rounded-full" />
                    {formatCount(viewers)} watching
                  </span>
                  <span className="bg-[#D4AF37] text-black text-[10px] font-bold px-3 py-1 rounded-full">
                    Watch Live
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      </div>
    </section>
  );
}

/**
 * ShortsSection — YouTube Shorts / IG Reels style horizontal scroll.
 *
 * Each card is a vertical 9:16 video thumbnail with:
 * - Caption overlay at bottom
 * - View count + play icon
 * - Seller name
 *
 * Tapping a short navigates to /videos (the full-screen video viewer).
 */
function ShortsSection({ shorts }: { shorts: any[] }) {
  return (
    <section className="fx-card ig-card ig-card-spaced overflow-hidden py-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Play className="w-4 h-4 text-black fill-indigo-600" />
          <h3 className="text-sm font-semibold text-black">Shorts</h3>
        </div>
        <Link href="/shorts" className="text-xs font-semibold text-[var(--cellex-coral)] hover:opacity-70">
          See all
        </Link>
      </div>

      {/* Horizontal scroll of vertical video cards */}
      <div className="flex gap-3 px-3 overflow-x-auto no-scrollbar">
        {shorts.map((short, index) => {
          const seller = short.seller || {};
          const sellerName = seller.business_name || 'Seller';
          const caption = short.caption || '';
          const views = short.views || 0;
          const likes = short.likes || 0;
          const productImage = short.product?.image_url;

          return (
            <Link
              key={short.id}
              href="/shorts"
              className="ig-bounce-in shrink-0 w-32 rounded-xl overflow-hidden bg-[#F5F5F5] hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Vertical 9:16 video thumbnail */}
              <div className="relative aspect-[9/16] bg-[#F5F5F5]">
                {short.videoUrl ? (
                  <video
                    src={short.videoUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : productImage ? (
                  <img src={productImage} alt={caption} className="w-full h-full object-cover" loading="lazy" />
                ) : null}
                {/* Gradient overlay for caption readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {/* Play count top-right */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-black text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                  <Play className="w-2 h-2 fill-white" />
                  {formatCount(views)}
                </div>
                {/* Caption + seller at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="text-[10px] font-semibold text-black truncate mb-0.5">{sellerName}</div>
                  {caption && (
                    <div className="text-[10px] text-black/80 line-clamp-2 leading-tight">{caption}</div>
                  )}
                  {/* Likes */}
                  <div className="flex items-center gap-1 mt-1">
                    <Heart className="w-2.5 h-2.5 fill-[var(--cellex-coral)] text-[var(--cellex-coral)]" />
                    <span className="text-[9px] text-black/70">{formatCount(likes)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * SuggestedSellersCarousel — horizontal scroll of seller cards, inserted
 * between feed posts every 3 items. Shows 3 sellers + a "See all" card
 * that links to /sellers.
 *
 * Layout matches Instagram's "Suggested for you" pattern:
 * - Section header: "Suggested Sellers" + "See All" link
 * - Horizontal scroll of square-ish seller cards (avatar + name + Follow btn)
 * - Final card: "See all sellers" with chevron
 */
function SuggestedSellersCarousel({
  sellers,
  carouselIndex,
  following,
  onFollow,
}: {
  sellers: any[];
  carouselIndex: number;
  following: Set<string>;
  onFollow: (sellerId: string, e: React.MouseEvent) => void;
}) {
  // Vary the header label slightly so repeat carousels feel fresh
  const headerLabel = carouselIndex === 0
    ? 'Suggested Sellers'
    : carouselIndex === 1
    ? 'Discover More Sellers'
    : 'More Sellers to Follow';

  return (
    <section className="fx-card ig-card ig-card-spaced overflow-hidden py-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[var(--cellex-text-muted)]" />
          <h3 className="text-sm font-semibold text-black">{headerLabel}</h3>
        </div>
        <Link href="/sellers" className="text-xs font-semibold text-[var(--cellex-coral)] hover:opacity-70">
          See All
        </Link>
      </div>

      {/* Horizontal scroll of seller cards */}
      <div className="flex gap-3 px-3 overflow-x-auto no-scrollbar">
        {sellers.map((seller, index) => {
          const sellerId = seller.id;
          const name = seller.business_name || seller.farm_name || 'Seller';
          const image = seller.profile_image;
          const category = seller.business_category;
          const isFollowing = following.has(sellerId);
          const sellerHref = seller.slug ? `/${seller.slug}` : `/seller-profile?id=${sellerId}`;

          return (
            <div
              key={sellerId}
              className="ig-bounce-in shrink-0 w-36 border border-[#E5E5E5] rounded-2xl p-3 flex flex-col items-center text-center hover:shadow-md hover:-translate-y-0.5 transition-all bg-[#F5F5F5]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link href={sellerHref} className="block">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#F5F5F5] mb-2 ig-story-ring" style={{ padding: 2 }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                    {image ? (
                      <img src={image} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F5F5F5] text-black font-bold text-xl">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
              <Link
                href={sellerHref}
                className="text-xs font-semibold text-black truncate max-w-full hover:opacity-70 mb-0.5"
              >
                {name}
              </Link>
              {category && (
                <p className="text-[10px] text-[var(--cellex-text-muted)] truncate max-w-full mb-2">{category}</p>
              )}
              <button
                onClick={(e) => onFollow(sellerId, e)}
                className={`w-full text-xs font-semibold py-1.5 rounded-md transition-colors ${
                  isFollowing
                    ? 'bg-[#F5F5F5] text-[var(--cellex-text-muted)] hover:bg-[#F5F5F5]'
                    : 'bg-[#D4AF37] text-black hover:bg-[#F5F5F5]'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          );
        })}

        {/* "See all sellers" card — links to /sellers page */}
        <Link
          href="/sellers"
          className="shrink-0 w-36 border border-[#E5E5E5] rounded-2xl p-3 flex flex-col items-center justify-center text-center hover:bg-[#F5F5F5] transition-colors bg-[#F5F5F5]"
        >
          <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-2">
            <ChevronRight className="w-6 h-6 text-[var(--cellex-text-muted)]" />
          </div>
          <span className="text-xs font-semibold text-black">See all sellers</span>
          <span className="text-[10px] text-[var(--cellex-text-muted)] mt-0.5">Discover more stores</span>
        </Link>
      </div>
    </section>
  );
}
