'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { motion } from 'framer-motion';
import { Search, Heart, MessageCircle, Send, Bookmark, Share2,
  Store, ChevronRight, Play, Zap, Users, ShieldCheck, Star, Eye,
  CheckCircle, Bell, User, Sparkles, Home as HomeIcon, Flame } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useOptimisticUI } from '@/components/optimistic-ui';
import { PageSkeleton } from '@/components/page-skeleton';
import { CommentsModal } from '@/components/comments-modal';

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
        // PURELY AI-DRIVEN FEED — Gorse decides the order of every post.
        // No hardcoded interleave logic, no fixed video/product ratio.
        // The recommend API returns a unified `posts` array (videos + products
        // mixed together, ranked by Gorse). The frontend just renders them
        // in the exact order Gorse returned.
        const [recommendResp, storiesResp, liveResp, sellersResp] = await Promise.all([
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
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <span className="ig-logo">Cellex</span>
        </Link>

        {/* Search — desktop only (pill button).
            Mobile users access Smart Search via the Explore/Categories page
            search bar, or via Cmd+K on physical keyboards. */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
          className="hidden sm:flex flex-1 max-w-[260px] mx-auto items-center ig-search-input hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '8px 16px' }}
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <span className="text-sm text-slate-400 text-left flex-1">Search</span>
        </button>

        {/* Spacer on mobile (search hidden) */}
        <div className="flex-1 sm:hidden" />

        {/* RIGHT SIDE — role-dependent.
            Badges are FUNCTIONAL: only show when there's actual unread data. */}
        {isSeller ? (
          <div className="shrink-0 flex items-center gap-1">
            <Link href="/messenger" className="ig-icon-btn relative" aria-label="Messages">
              <Send className="w-6 h-6" />
              {user && unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold leading-none">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                </span>
              )}
            </Link>
            <Link href="/notifications" className="ig-icon-btn" aria-label="Notifications">
              <Bell className="w-6 h-6" />
            </Link>
            <Link href="/seller-dashboard" className="ig-icon-btn" aria-label="My Store">
              <User className="w-6 h-6" />
            </Link>
          </div>
        ) : (
          /* Buyer: Notifications + Account icons in header.
             Account links to /profile (personal profile).
             Mobile nav no longer has Account — it has Shorts instead. */
          <div className="shrink-0 flex items-center gap-1">
            <Link href="/notifications" className="ig-icon-btn" aria-label="Notifications">
              <Bell className="w-6 h-6" />
            </Link>
            <Link href="/profile" className="ig-icon-btn relative" aria-label="Account">
              <User className="w-6 h-6" />
              {user && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              )}
            </Link>
          </div>
        )}
      </div>

      {/* Social switcher tabs — Gemini-style: For You / Following / Shops / Live */}
      <div className="fx-topbar border-t border-white/5" style={{ paddingTop: 0, paddingBottom: '8px' }}>
        <div className="flex items-center justify-around text-xs font-semibold">
          {(['For You', 'Following', 'Shops', 'Live'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-1.5 px-3 relative transition-colors"
              style={{
                color: activeTab === tab ? '#f43f5e' : '#94a3b8',
                fontWeight: activeTab === tab ? 700 : 500,
              }}
            >
              {tab === 'Live' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" style={{ verticalAlign: 'middle' }} />
              )}
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips + flash deal banner — Gemini-style discovery module */}
      <div className="flex flex-col gap-2.5 px-3 py-3">
        {/* Category chips horizontal scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: activeCategory === cat
                  ? 'linear-gradient(135deg, #be123c, #8b5cf6)'
                  : 'rgba(255,255,255,0.06)',
                color: activeCategory === cat ? '#fff' : '#cbd5e1',
                border: activeCategory === cat ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: activeCategory === cat ? '0 2px 12px rgba(244,63,94,0.3)' : 'none',
              }}
            >
              {cat === 'Deals' && <Zap className="w-3 h-3 text-amber-400 inline mr-1" />}
              {cat}
            </button>
          ))}
        </div>

        {/* Flash deal banner */}
        <div
          className="rounded-2xl p-3 flex items-center justify-between gap-3"
          style={{
            background: 'linear-gradient(90deg, rgba(190,18,60,0.25), rgba(124,58,237,0.25), rgba(15,23,42,0.4))',
            border: '1px solid rgba(244,63,94,0.3)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)' }}>
              <Flame className="w-5 h-5 text-rose-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-rose-500 text-white">
                  LIVE FLASH DEAL
                </span>
                <span className="text-xs text-rose-300 font-mono">Ends soon</span>
              </div>
              <p className="text-xs font-semibold text-slate-100 mt-0.5 truncate">
                Group Buys active: Unlock up to 40% OFF with 1 invite!
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveCategory('Deals')}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-2 rounded-xl shrink-0 transition flex items-center gap-1"
          >
            Explore <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Stories section — IG-style horizontal scroll with gradient rings */}
      {stories.length > 0 && (
        <div className="ig-hero-bg border-b border-white/5">
          <div className="flex gap-4 px-3 py-3 overflow-x-auto no-scrollbar">
            {stories.slice(0, 12).map((s: any, i: number) => {
              const storyHref = s.slug ? `/${s.slug}` : `/seller-profile?id=${s.seller_id || ''}`;
              return (
                <Link key={i} href={storyHref} className="shrink-0 flex flex-col items-center gap-1">
                  <div className="ig-story-ring" style={{ width: 56, height: 56 }}>
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white/5">
                      {s.profile_image ? (
                        <img src={s.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-300 max-w-[60px] truncate">{s.business_name || 'Seller'}</span>
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

      {/* Feed — IG-style.
          Every 3 feed posts, insert a horizontal "Suggested Sellers" carousel.
          The carousel shows 3 seller cards followed by a "See all" card that
          links to /sellers. Sellers are rotated so each carousel shows a
          different batch. */}
      <div>
        {feed.map((post, index) => {
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
        })}
      </div>

      {/* End of feed — IG-style */}
      <div className="text-center py-12 px-4">
        <div className="w-14 h-14 rounded-full border-2 border-white/15 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-300">You're all caught up</p>
        <p className="text-xs text-slate-500 mt-1">You've seen all new posts from the last 3 days.</p>
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
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Creator Info */}
        <Link
          href={post.sellerSlug ? `/${post.sellerSlug}` : (post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#')}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 ring-2 ring-rose-500/40 group-hover:ring-rose-500 transition">
              {post.sellerImage ? (
                <img src={post.sellerImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{post.sellerName.charAt(0)}</span>
                </div>
              )}
            </div>
            {post.verified && (
              <CheckCircle className="w-3.5 h-3.5 text-rose-500 fill-rose-500 stroke-slate-950 absolute -bottom-0.5 -right-0.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-100 group-hover:text-rose-400 transition truncate">
                {post.sellerName}
              </span>
              {post.createdAt && (
                <span className="text-[11px] text-slate-500">• {timeAgo(post.createdAt)}</span>
              )}
            </div>
            {/* Seller trust badge */}
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-full mt-0.5">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>Verified Seller</span>
            </div>
          </div>
        </Link>

        {/* Follow Button */}
        {post.sellerId && !isFollowing && (
          <button
            onClick={onFollow}
            className="text-xs font-semibold text-rose-400 border border-rose-500/40 hover:bg-rose-600 hover:text-white px-3 py-1 rounded-full transition shrink-0"
          >
            Follow
          </button>
        )}
      </div>

      {/* CARD MEDIA: 4:3 aspect ratio with overlay badges */}
      <div className="relative w-full overflow-hidden bg-slate-950" style={{ aspectRatio: '4 / 3' }}>
        {isVideo ? (
          <Link href="/videos" className="block w-full h-full relative">
            <video
              ref={videoRef}
              src={post.mediaUrl}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
              <Play className="w-3 h-3 text-white fill-white" />
              <span className="text-white text-[10px] font-semibold">Video</span>
            </div>
          </Link>
        ) : (
          <Link href={post.product ? `/product?id=${post.product.id}` : '#'} className="block w-full h-full group">
            <img
              src={post.mediaUrl}
              alt={post.caption}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
              loading="lazy"
            />
          </Link>
        )}

        {/* Type indicator tag — top-left */}
        {post.product?.group_buy_enabled && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> GROUP BUY
          </div>
        )}
        {post.isLive && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-rose-600 to-amber-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
            <Zap className="w-2.5 h-2.5" /> FLASH DEAL
          </div>
        )}

        {/* Social proof overlay — bottom-left */}
        {fomoText && (
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-slate-200 text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>{fomoText}</span>
          </div>
        )}

        {/* Quick View button — bottom-right */}
        {post.product && (
          <Link
            href={`/product?id=${post.product.id}`}
            className="absolute bottom-3 right-3 bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-xs px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 transition"
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
            <h3 className="font-bold text-sm text-slate-100 hover:text-rose-400 transition cursor-pointer line-clamp-1">
              {post.caption}
            </h3>
          </Link>
        ) : (
          <h3 className="font-bold text-sm text-slate-100 line-clamp-1">{post.caption}</h3>
        )}

        {/* Description */}
        {post.product?.description && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {post.product.description}
          </p>
        )}

        {/* Price & rating row */}
        {post.product && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-white">
                {formatPrice(post.product.price)}
              </span>
              {post.product.units_sold && post.product.units_sold > 0 && (
                <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded">
                  {post.product.units_sold} sold
                </span>
              )}
            </div>
            {post.soldCount && post.soldCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                <Star className="w-3 h-3 fill-amber-400" />
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
              className="w-full bg-white/8 hover:bg-white/12 text-slate-200 font-semibold text-xs py-2.5 rounded-2xl border border-white/10 transition flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" /> View Item
            </Link>
            <button
              onClick={onAddToCart}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-extrabold text-xs py-2.5 rounded-2xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" /> Buy Now
            </button>
          </div>
        )}

        {/* SOCIAL ENGAGEMENT ROW: Like, Comment, Save, Share */}
        <div className="flex items-center justify-between border-t border-white/8 pt-3 mt-1 text-slate-400 text-xs">
          {/* Like */}
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 hover:text-rose-400 transition ${liked ? 'text-rose-500 font-bold' : ''}`}
          >
            <motion.div whileTap={{ scale: 1.2 }}>
              <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} strokeWidth={2} />
            </motion.div>
            <span>{formatCount(likeCount)}</span>
          </button>

          {/* Comment */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsOpen(true); }}
            className="flex items-center gap-1.5 hover:text-slate-200 transition"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={2} />
            <span>{formatCount(commentCount)}</span>
          </button>

          {/* Save */}
          <button
            onClick={onSave}
            className={`flex items-center gap-1.5 hover:text-amber-400 transition ${saved ? 'text-amber-400 font-bold' : ''}`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? 'fill-amber-400' : ''}`} strokeWidth={2} />
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
            className="flex items-center gap-1.5 hover:text-rose-400 transition"
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
            <span className="w-2 h-2 bg-red-500 rounded-full ig-float" />
            <span className="text-xs font-bold text-white tracking-wide">LIVE NOW</span>
          </span>
          <span className="text-xs text-white/50">·</span>
          <span className="text-xs text-white/70">{sessions.length} seller{sessions.length === 1 ? '' : 's'} streaming</span>
        </div>
        <Link href="/live" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
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
              className="ig-bounce-in shrink-0 w-64 bg-white/10 rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Top: avatar + LIVE badge + duration */}
              <div className="relative h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                {/* Pulsing red ring around avatar */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
                  <div className="relative w-16 h-16 rounded-full border-2 border-red-500 overflow-hidden bg-white/10">
                    {sellerImage ? (
                      <img src={sellerImage} alt={sellerName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                        {sellerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                {/* LIVE badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ig-pulse-glow">
                  <span className="w-1.5 h-1.5 bg-white/10 rounded-full" />
                  LIVE
                </div>
                {/* Duration */}
                {liveDuration && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {liveDuration}
                  </div>
                )}
              </div>
              {/* Bottom: title + viewers + CTA */}
              <div className="p-3">
                <div className="text-xs font-semibold text-white truncate mb-1">{sellerName}</div>
                <div className="text-xs text-slate-400 line-clamp-1 mb-2">{title}</div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    {formatCount(viewers)} watching
                  </span>
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
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
          <Play className="w-4 h-4 text-white fill-indigo-600" />
          <h3 className="text-sm font-semibold text-white">Shorts</h3>
        </div>
        <Link href="/shorts" className="text-xs font-semibold text-sky-500 hover:text-sky-700">
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
              className="ig-bounce-in shrink-0 w-32 rounded-xl overflow-hidden bg-white/5 hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Vertical 9:16 video thumbnail */}
              <div className="relative aspect-[9/16] bg-white/10">
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
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                  <Play className="w-2 h-2 fill-white" />
                  {formatCount(views)}
                </div>
                {/* Caption + seller at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="text-[10px] font-semibold text-white truncate mb-0.5">{sellerName}</div>
                  {caption && (
                    <div className="text-[10px] text-white/80 line-clamp-2 leading-tight">{caption}</div>
                  )}
                  {/* Likes */}
                  <div className="flex items-center gap-1 mt-1">
                    <Heart className="w-2.5 h-2.5 fill-red-500 text-red-500" />
                    <span className="text-[9px] text-white/70">{formatCount(likes)}</span>
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
          <Users className="w-4 h-4 text-slate-300" />
          <h3 className="text-sm font-semibold text-white">{headerLabel}</h3>
        </div>
        <Link href="/sellers" className="text-xs font-semibold text-sky-500 hover:text-sky-700">
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
              className="ig-bounce-in shrink-0 w-36 border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center hover:shadow-md hover:-translate-y-0.5 transition-all bg-white/10"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link href={sellerHref} className="block">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 mb-2 ig-story-ring" style={{ padding: 2 }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                    {image ? (
                      <img src={image} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10 text-white font-bold text-xl">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
              <Link
                href={sellerHref}
                className="text-xs font-semibold text-white truncate max-w-full hover:opacity-70 mb-0.5"
              >
                {name}
              </Link>
              {category && (
                <p className="text-[10px] text-slate-400 truncate max-w-full mb-2">{category}</p>
              )}
              <button
                onClick={(e) => onFollow(sellerId, e)}
                className={`w-full text-xs font-semibold py-1.5 rounded-md transition-colors ${
                  isFollowing
                    ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'bg-indigo-600 text-white hover:bg-white/10'
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
          className="shrink-0 w-36 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors bg-white/10"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
            <ChevronRight className="w-6 h-6 text-slate-300" />
          </div>
          <span className="text-xs font-semibold text-white">See all sellers</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Discover more stores</span>
        </Link>
      </div>
    </section>
  );
}
