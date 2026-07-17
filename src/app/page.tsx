'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Search, Heart, MessageCircle, Share2, Bookmark, ShoppingBag,
  Store, Radio, Users, TrendingUp, Flame, ChevronRight, Play,
  CheckCircle, Plus, Bell, User } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useOptimisticUI } from '@/components/optimistic-ui';

interface FeedPost {
  type: 'video' | 'product';
  id: string;
  sellerId?: string;
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
  const { user, isSeller } = useAuth();
  const { toast } = useToast();
  const { burst } = useOptimisticUI();

  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [liveCount, setLiveCount] = useState(0);

  // isSeller is now read from AuthProvider (cached, no flicker)

  // Ref for the top search bar — used to detect when it's scrolled out of view
  // so the GlobalSpotlight floating search button can appear.
  const searchBarRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: when the top search bar leaves the viewport,
  // dispatch an event that GlobalSpotlight listens for to show/hide the FAB.
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

        // Build seller name lookup
        const sellerMap = new Map<string, { name: string; image?: string }>();
        if (sellersResp.success) {
          (sellersResp.sellers || []).forEach((s: any) => {
            sellerMap.set(s.id, { name: s.business_name || s.farm_name || 'Seller', image: s.profile_image });
          });
        }

        const posts: FeedPost[] = [];

        // Add video posts
        if (vidResp.success) {
          (vidResp.videos || []).forEach((v: any) => {
            const seller = v.seller || {};
            posts.push({
              type: 'video',
              id: `vid-${v.id}`,
              sellerId: seller.id,
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

        // Add product spotlight posts (interleaved)
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

        // Interleave videos and products for variable reward (slot machine effect)
        const videoPosts = posts.filter(p => p.type === 'video');
        const productPosts = posts.filter(p => p.type === 'product');
        const interleaved: FeedPost[] = [];
        const maxLen = Math.max(videoPosts.length, productPosts.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < videoPosts.length) interleaved.push(videoPosts[i]);
          if (i < productPosts.length) interleaved.push(productPosts[i]);
        }
        setFeed(interleaved);

        if (storiesResp.success) {
          setStories(storiesResp.stories || []);
        }
        if (liveResp.success) {
          setLiveCount((liveResp.sessions || []).length);
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
      toast({ title: 'Following!' });
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="loading-dots"><span></span><span></span><span></span></div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen max-w-xl mx-auto">
      {/* Top bar: ROLE-AWARE
          - Buyer:        logo + search + messenger icon
          - Buyer-Seller: logo + search + chat + notification + profile icons */}
      <div
        ref={searchBarRef}
        className="px-3 pt-3 pb-2 bg-white sticky top-0 z-30 flex items-center gap-2"
      >
        {/* Logo (left side) — same for both roles */}
        <Link href="/" className="shrink-0 flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-extrabold text-base" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
          </div>
        </Link>

        {/* Search bar (center, flex-1) — same for both roles */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
          className="flex-1 flex items-center bg-neutral-100 rounded-full px-4 py-2.5 hover:bg-neutral-200 transition-colors group"
        >
          <Search className="w-4 h-4 text-neutral-400 mr-2 group-hover:text-black transition-colors" />
          <span className="flex-1 text-left text-sm text-neutral-400">Search products, categories...</span>
          <kbd className="hidden sm:flex px-1.5 py-0.5 bg-white rounded text-[9px] font-bold text-neutral-400 border border-neutral-200">⌘K</kbd>
        </button>

        {/* RIGHT SIDE — role-dependent */}
        {isSeller ? (
          <>
            {/* Chat icon → /messenger (seller-to-buyer messaging) */}
            <Link
              href="/messenger"
              className="shrink-0 w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors relative"
              aria-label="Messages"
            >
              <MessageCircle className="w-5 h-5 text-black" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </Link>

            {/* Notification icon → /notifications */}
            <Link
              href="/notifications"
              className="shrink-0 w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-black" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </Link>

            {/* Profile icon → /seller-dashboard (Facebook 'Me' style) */}
            <Link
              href="/seller-dashboard"
              className="shrink-0 w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors"
              aria-label="My Store"
            >
              <User className="w-5 h-5 text-black" />
            </Link>
          </>
        ) : (
          /* Buyer: single messenger icon → /ai-chat */
          <Link
            href="/ai-chat"
            className="shrink-0 w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors relative"
            aria-label="Messages"
          >
            <MessageCircle className="w-5 h-5 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </Link>
        )}
      </div>

      {/* Stories bar */}
      {stories.length > 0 && (
        <div className="flex gap-3 px-3 py-2 overflow-x-auto no-scrollbar border-b border-neutral-100">
          {stories.slice(0, 10).map((s: any, i: number) => (
            <Link
              key={i}
              href={`/seller-profile?id=${s.seller_id || ''}`}
              className="shrink-0 flex flex-col items-center gap-1"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-neutral-800 via-neutral-600 to-neutral-800">
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
              <span className="text-[10px] text-neutral-600 max-w-[60px] truncate">{s.business_name || 'Seller'}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Live Now indicator */}
      {liveCount > 0 && (
        <Link href="/live" className="block mx-3 mt-2">
          <div className="flex items-center gap-2 bg-black text-white rounded-xl px-4 py-2.5 hover:bg-neutral-800 transition-colors">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold">LIVE NOW</span>
            </span>
            <span className="text-xs text-white/70">{liveCount} seller{liveCount > 1 ? 's' : ''} streaming</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </div>
        </Link>
      )}

      {/* Feed */}
      <div className="space-y-0">
        {feed.map((post, index) => (
          <FeedPostCard
            key={post.id}
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
        ))}
      </div>

      {/* End of feed */}
      <div className="text-center py-8">
        <p className="text-xs text-neutral-400">You're all caught up ✨</p>
        <p className="text-[10px] text-neutral-300 mt-1">Check back for more drops</p>
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
    ? `🔥 ${post.soldCount > 1000 ? `${(post.soldCount / 1000).toFixed(1)}k` : post.soldCount} bought this`
    : post.views && post.views > 50
    ? `👀 ${formatCount(post.views)} viewing now`
    : post.soldCount && post.soldCount > 0
    ? `✨ ${post.soldCount} bought this`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="border-b border-neutral-100"
    >
      {/* Seller header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Link href={post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#'}>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-100 shrink-0">
            {post.sellerImage ? (
              <img src={post.sellerImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <span className="text-white text-sm font-bold">{post.sellerName.charAt(0)}</span>
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Link href={post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#'} className="text-sm font-bold text-black truncate hover:underline">
              {post.sellerName}
            </Link>
            {post.verified && (
              <CheckCircle className="w-3.5 h-3.5 text-black fill-black stroke-white shrink-0" />
            )}
          </div>
          {post.createdAt && (
            <div className="text-xs text-neutral-400">{timeAgo(post.createdAt)}</div>
          )}
        </div>
        {post.sellerId && (
          <button
            onClick={onFollow}
            className={`text-sm font-bold px-4 py-2 rounded-full transition-all ${
              isFollowing ? 'bg-neutral-100 text-neutral-600' : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Media */}
      <div className="relative bg-neutral-50 aspect-square overflow-hidden">
        {isVideo ? (
          <Link href="/videos" className="block w-full h-full">
            <video
              ref={videoRef}
              src={post.mediaUrl}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Tap to open indicator */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
              <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
                <Play className="w-6 h-6 text-white" />
              </div>
            </div>
          </Link>
        ) : (
          <Link href={post.product ? `/product?id=${post.product.id}` : '#'}>
            <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover" loading="lazy" />
          </Link>
        )}

        {/* FOMO overlay */}
        {fomoText && (
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-sm font-bold px-3 py-1.5 rounded-full">
            {fomoText}
          </div>
        )}

        {/* Product badge */}
        {post.product && (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
              {post.product.image_url && (
                <img src={post.product.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-black truncate">{post.product.name}</div>
              <div className="text-base font-extrabold text-black">{formatPrice(post.product.price)}</div>
            </div>
            <button
              onClick={onAddToCart}
              className="bg-black text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors shrink-0 active:scale-95 min-w-[80px]"
            >
              Buy Now
            </button>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-5 px-4 py-3">
        <button onClick={onLike} className="flex items-center gap-2 group">
          <motion.div whileTap={{ scale: 1.3 }}>
            <Heart className={`w-7 h-7 transition-colors ${liked ? 'fill-black text-black' : 'text-black'}`} />
          </motion.div>
          <span className="text-sm font-semibold text-black">{formatCount(likeCount)}</span>
        </button>
        <button className="flex items-center gap-2">
          <MessageCircle className="w-7 h-7 text-black" />
          <span className="text-sm font-semibold text-black">{formatCount(post.comments)}</span>
        </button>
        <button className="flex items-center gap-2">
          <Share2 className="w-7 h-7 text-black" />
        </button>
        <button onClick={onSave} className="ml-auto">
          <Bookmark className={`w-7 h-7 transition-colors ${saved ? 'fill-black text-black' : 'text-black'}`} />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-4">
        <p className="text-sm text-black">
          <span className="font-bold mr-1.5">{post.sellerName}</span>
          {post.caption}
        </p>
        {post.product?.category && (
          <p className="text-xs text-neutral-400 mt-1.5">#{post.product.category.toLowerCase().replace(/\s+/g, '')}</p>
        )}
        {post.comments > 0 && (
          <button className="text-xs text-neutral-400 mt-1.5 hover:text-black transition-colors">
            View all {post.comments} comments
          </button>
        )}
      </div>
    </motion.div>
  );
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
