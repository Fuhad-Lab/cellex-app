'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { motion } from 'framer-motion';
import { Search, Heart, MessageCircle, Send, Bookmark,
  Store, ChevronRight, Play,
  CheckCircle, Bell, User, Sparkles, Home as HomeIcon, Users } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useOptimisticUI } from '@/components/optimistic-ui';
import { PageSkeleton } from '@/components/page-skeleton';

interface FeedPost {
  type: 'video' | 'product';
  id: string;
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
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());

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

  // Note: unreadMessages is fetched by AuthProvider (shared across all pages
  // via useAuth context) and polled every 30 seconds. No duplicate fetch here.

  useEffect(() => {
    (async () => {
      try {
        const [vidResp, homeResp, storiesResp, liveResp, sellersResp] = await Promise.all([
          api.videos.feed(20),
          api.products.home(),
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

        if (vidResp.success) {
          (vidResp.videos || []).forEach((v: any) => {
            const seller = v.seller || {};
            // If the video seller doesn't have a slug, look it up via sellerMap
            const sellerInfo = seller.id ? sellerMap.get(seller.id) : null;
            posts.push({
              type: 'video',
              id: `vid-${v.id}`,
              sellerId: seller.id,
              sellerSlug: seller.slug || sellerInfo?.slug,
              sellerName: seller.business_name || 'Seller',
              sellerImage: seller.profile_image,
              mediaUrl: v.video_url || '',
              caption: v.caption || '',
              likes: v.likes_count || 0,
              views: v.views_count || 0,
              comments: Math.floor((v.views_count || 0) / 20),
              product: v.product,
              soldCount: v.product?.units_sold,
              createdAt: v.created_at,
              verified: true,
            });
          });
        }

        if (homeResp.success) {
          const allProducts = [
            ...(homeResp.flashDeals || []),
            ...(homeResp.trending || []),
            ...(homeResp.newArrivals || []),
          ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

          allProducts.forEach((p: Product) => {
            const sellerInfo = p.seller_id ? sellerMap.get(p.seller_id) : null;
            posts.push({
              type: 'product',
              id: `prod-${p.id}`,
              sellerId: p.seller_id,
              sellerSlug: sellerInfo?.slug,
              sellerName: sellerInfo?.name || 'Cellex Seller',
              sellerImage: sellerInfo?.image,
              mediaUrl: p.image_url || '',
              caption: p.name,
              likes: Math.floor((p.units_sold || 0) * 0.3),
              comments: Math.floor((p.units_sold || 0) * 0.1),
              product: p,
              soldCount: p.units_sold,
              verified: true,
            });
          });
        }

        // Interleave videos and products
        const videoPosts = posts.filter(p => p.type === 'video');
        const productPosts = posts.filter(p => p.type === 'product');
        const interleaved: FeedPost[] = [];
        const maxLen = Math.max(videoPosts.length, productPosts.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < videoPosts.length) interleaved.push(videoPosts[i]);
          if (i < productPosts.length) interleaved.push(productPosts[i]);
        }
        setFeed(interleaved);

        if (storiesResp.success) setStories(storiesResp.stories || []);
        if (liveResp.success) setLiveSessions(liveResp.sessions || []);

        // Store video posts as Shorts (for the Shorts section).
        // These are the same videos that appear in the feed, but presented
        // as vertical 9:16 cards in a horizontal scroll (YouTube Shorts style).
        if (vidResp.success) {
          const videoShorts = (vidResp.videos || []).slice(0, 10).map((v: any) => ({
            id: v.id,
            videoUrl: v.video_url || '',
            caption: v.caption || '',
            views: v.views_count || 0,
            likes: v.likes_count || 0,
            seller: v.seller || {},
            product: v.product,
            createdAt: v.created_at,
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
    const newLiked = new Set(likedPosts);
    if (newLiked.has(postId)) {
      newLiked.delete(postId);
    } else {
      newLiked.add(postId);
      burst(e.clientX, e.clientY, 'heart');
    }
    setLikedPosts(newLiked);
  };

  const toggleSave = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSaved = new Set(savedPosts);
    if (newSaved.has(postId)) {
      newSaved.delete(postId);
    } else {
      newSaved.add(postId);
      toast({ title: 'Saved!' });
    }
    setSavedPosts(newSaved);
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
  };

  if (loading) {
    return <PageSkeleton variant="home" />;
  }

  return (
    <div className="ig-container bg-white min-h-screen ig-topbar-offset">
      {/* Top bar — IG-style: logo left, search center, icons right */}
      <div
        ref={searchBarRef}
        className="ig-topbar"
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
          className="hidden sm:flex flex-1 max-w-[260px] mx-auto items-center ig-search-input hover:bg-neutral-200 transition-colors"
          style={{ background: '#efefef', border: 'none', borderRadius: '8px', padding: '8px 16px' }}
          aria-label="Search"
        >
          <Search className="w-4 h-4 text-neutral-500 mr-2" />
          <span className="text-sm text-neutral-500 text-left flex-1">Search</span>
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

      {/* Stories section — IG-style horizontal scroll with gradient rings */}
      {stories.length > 0 && (
        <div className="ig-hero-bg border-b border-neutral-100">
          <div className="flex gap-4 px-3 py-3 overflow-x-auto no-scrollbar">
            {stories.slice(0, 12).map((s: any, i: number) => {
              const storyHref = s.slug ? `/${s.slug}` : `/seller-profile?id=${s.seller_id || ''}`;
              return (
                <Link key={i} href={storyHref} className="shrink-0 flex flex-col items-center gap-1">
                  <div className="ig-story-ring" style={{ width: 56, height: 56 }}>
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-neutral-100">
                      {s.profile_image ? (
                        <img src={s.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-neutral-300" />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-700 max-w-[60px] truncate">{s.business_name || 'Seller'}</span>
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
        <div className="w-14 h-14 rounded-full border-2 border-neutral-300 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-sm font-semibold text-neutral-700">You're all caught up</p>
        <p className="text-xs text-neutral-400 mt-1">You've seen all new posts from the last 3 days.</p>
      </div>
    </div>
  );
}

function FeedPostCard({
  post, index, liked, saved, isFollowing, onLike, onSave, onFollow, onAddToCart
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
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="ig-feed-card"
    >
      {/* Seller header — IG-style: avatar + username + verified + Follow */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Link href={post.sellerSlug ? `/${post.sellerSlug}` : (post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#')}>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-200 shrink-0">
            {post.sellerImage ? (
              <img src={post.sellerImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                <span className="text-white text-xs font-bold">{post.sellerName.charAt(0)}</span>
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <Link href={post.sellerSlug ? `/${post.sellerSlug}` : (post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#')} className="text-sm font-semibold text-black hover:opacity-70 transition-opacity truncate">
            {post.sellerName}
          </Link>
          {post.verified && (
            <CheckCircle className="w-3 h-3 text-sky-500 fill-sky-500 stroke-white shrink-0" />
          )}
          {post.createdAt && (
            <>
              <span className="text-neutral-400 text-xs">•</span>
              <span className="text-xs text-neutral-500">{timeAgo(post.createdAt)}</span>
            </>
          )}
        </div>
        {post.sellerId && !isFollowing && (
          <button
            onClick={onFollow}
            className="text-xs font-semibold text-sky-500 hover:text-sky-700 transition-colors"
          >
            Follow
          </button>
        )}
      </div>

      {/* Media — IG-style: square, full-bleed, with hover zoom on images */}
      <div className="ig-media ig-img-zoom">
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
          <Link href={post.product ? `/product?id=${post.product.id}` : '#'} className="block w-full h-full">
            <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" loading="lazy" />
          </Link>
        )}

        {/* FOMO badge — top-left, subtle */}
        {fomoText && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {fomoText}
          </div>
        )}
      </div>

      {/* Action bar — IG-style: 24px icons, no labels, gap 16px */}
      <div className="ig-action-bar">
        <button onClick={onLike} aria-label="Like">
          <motion.div whileTap={{ scale: 1.2 }}>
            <Heart className={`w-7 h-7 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-black'}`} strokeWidth={1.5} />
          </motion.div>
        </button>
        <button aria-label="Comment">
          <MessageCircle className="w-7 h-7 text-black" strokeWidth={1.5} />
        </button>
        <button aria-label="Share">
          <Send className="w-7 h-7 text-black" strokeWidth={1.5} />
        </button>
        <button onClick={onSave} className="ml-auto" aria-label="Save">
          <Bookmark className={`w-7 h-7 transition-colors ${saved ? 'fill-black text-black' : 'text-black'}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Likes count — IG-style bold */}
      <div className="ig-likes">
        {formatCount(likeCount)} likes
      </div>

      {/* Caption — IG-style: bold username + text */}
      <div className="ig-caption">
        <span className="username">{post.sellerName}</span>
        {post.caption}
        {post.product?.category && (
          <span className="text-sky-500"> #{post.product.category.toLowerCase().replace(/\s+/g, '')}</span>
        )}
      </div>

      {/* Comments link */}
      {post.comments > 0 && (
        <div className="ig-comments-link">
          View all {formatCount(post.comments)} comments
        </div>
      )}

      {/* Timestamp */}
      {post.createdAt && (
        <div className="ig-timestamp">
          {timeAgo(post.createdAt)} AGO
        </div>
      )}

      {/* Product CTA — IG-style shoppable tag at bottom */}
      {post.product && (
        <Link
          href={`/product?id=${post.product.id}`}
          className="block mx-3 mb-3 bg-white border border-neutral-200 rounded-lg p-2.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
        >
          <div className="w-11 h-11 rounded-md overflow-hidden bg-neutral-100 shrink-0">
            {post.product.image_url && (
              <img src={post.product.image_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-black truncate">{post.product.name}</div>
            <div className="text-sm font-bold text-black">{formatPrice(post.product.price)}</div>
          </div>
          <button
            onClick={onAddToCart}
            className="bg-black text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-neutral-800 transition-colors shrink-0 active:scale-95"
          >
            Add to cart
          </button>
        </Link>
      )}
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
    <section className="border-b border-neutral-100 bg-gradient-to-b from-neutral-900 to-black py-4">
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
              className="ig-bounce-in shrink-0 w-64 bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Top: avatar + LIVE badge + duration */}
              <div className="relative h-32 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                {/* Pulsing red ring around avatar */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
                  <div className="relative w-16 h-16 rounded-full border-2 border-red-500 overflow-hidden bg-neutral-700">
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
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
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
                <div className="text-xs font-semibold text-black truncate mb-1">{sellerName}</div>
                <div className="text-xs text-neutral-600 line-clamp-1 mb-2">{title}</div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    {formatCount(viewers)} watching
                  </span>
                  <span className="bg-black text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    Watch Live
                  </span>
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
    <section className="border-b border-neutral-100 py-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Play className="w-4 h-4 text-black fill-black" />
          <h3 className="text-sm font-semibold text-black">Shorts</h3>
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
              className="ig-bounce-in shrink-0 w-32 rounded-xl overflow-hidden bg-neutral-900 hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Vertical 9:16 video thumbnail */}
              <div className="relative aspect-[9/16] bg-neutral-800">
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
    <section className="border-y border-neutral-100 bg-white py-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-neutral-700" />
          <h3 className="text-sm font-semibold text-black">{headerLabel}</h3>
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
              className="ig-bounce-in shrink-0 w-36 border border-neutral-200 rounded-lg p-3 flex flex-col items-center text-center hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link href={sellerHref} className="block">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-200 mb-2 ig-story-ring" style={{ padding: 2 }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                    {image ? (
                      <img src={image} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-white font-bold text-xl">
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
                <p className="text-[10px] text-neutral-500 truncate max-w-full mb-2">{category}</p>
              )}
              <button
                onClick={(e) => onFollow(sellerId, e)}
                className={`w-full text-xs font-semibold py-1.5 rounded-md transition-colors ${
                  isFollowing
                    ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
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
          className="shrink-0 w-36 border border-neutral-200 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-2">
            <ChevronRight className="w-6 h-6 text-neutral-700" />
          </div>
          <span className="text-xs font-semibold text-black">See all sellers</span>
          <span className="text-[10px] text-neutral-500 mt-0.5">Discover more stores</span>
        </Link>
      </div>
    </section>
  );
}
