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
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [liveCount, setLiveCount] = useState(0);

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

        const sellerMap = new Map<string, { name: string; image?: string }>();
        if (sellersResp.success) {
          const sellersList = sellersResp.sellers || [];
          setSellers(sellersList);
          sellersList.forEach((s: any) => {
            sellerMap.set(s.id, { name: s.business_name || s.farm_name || 'Seller', image: s.profile_image });
          });
        }

        const posts: FeedPost[] = [];

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
        if (liveResp.success) setLiveCount((liveResp.sessions || []).length);
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="loading-dots"><span></span><span></span><span></span></div>
      </div>
    );
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

        {/* Search (hidden on small screens — uses Cmd+K / FAB instead) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-spotlight'))}
          className="hidden sm:flex flex-1 max-w-[260px] mx-auto items-center ig-search-input hover:bg-neutral-200 transition-colors"
          style={{ background: '#efefef', border: 'none', borderRadius: '8px', padding: '8px 16px' }}
        >
          <Search className="w-4 h-4 text-neutral-500 mr-2" />
          <span className="text-sm text-neutral-500 text-left flex-1">Search</span>
        </button>

        {/* Spacer on mobile (search hidden) */}
        <div className="flex-1 sm:hidden" />

        {/* RIGHT SIDE — role-dependent */}
        {isSeller ? (
          <div className="shrink-0 flex items-center gap-1">
            <Link href="/messenger" className="ig-icon-btn relative" aria-label="Messages">
              <Send className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
            <Link href="/notifications" className="ig-icon-btn relative" aria-label="Notifications">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
            <Link href="/seller-dashboard" className="ig-icon-btn" aria-label="My Store">
              <User className="w-6 h-6" />
            </Link>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-1">
            <Link href="/notifications" className="ig-icon-btn relative" aria-label="Notifications">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
          </div>
        )}
      </div>

      {/* Stories bar — IG-style horizontal scroll with gradient rings */}
      {stories.length > 0 && (
        <div className="flex gap-4 px-3 py-3 overflow-x-auto no-scrollbar border-b border-neutral-100">
          {stories.slice(0, 12).map((s: any, i: number) => (
            <Link
              key={i}
              href={`/seller-profile?id=${s.seller_id || ''}`}
              className="shrink-0 flex flex-col items-center gap-1"
            >
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
          ))}
        </div>
      )}

      {/* Live Now indicator — compact black pill */}
      {liveCount > 0 && (
        <Link href="/live" className="block px-3 pt-3">
          <div className="flex items-center gap-2 bg-black text-white rounded-full px-3 py-2 hover:bg-neutral-800 transition-colors">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold">{liveCount} LIVE NOW</span>
            <ChevronRight className="w-3 h-3 ml-auto" />
          </div>
        </Link>
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
        <Link href={post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#'}>
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
          <Link href={post.sellerId ? `/seller-profile?id=${post.sellerId}` : '#'} className="text-sm font-semibold text-black hover:opacity-70 transition-opacity truncate">
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

      {/* Media — IG-style: square, full-bleed */}
      <div className="ig-media">
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
          <Link href={post.product ? `/product?id=${post.product.id}` : '#'}>
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
        {sellers.map((seller) => {
          const sellerId = seller.id;
          const name = seller.business_name || seller.farm_name || 'Seller';
          const image = seller.profile_image;
          const category = seller.business_category;
          const isFollowing = following.has(sellerId);

          return (
            <div
              key={sellerId}
              className="shrink-0 w-36 border border-neutral-200 rounded-lg p-3 flex flex-col items-center text-center"
            >
              <Link href={`/seller-profile?id=${sellerId}`} className="block">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-200 mb-2">
                  {image ? (
                    <img src={image} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-white font-bold text-xl">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              <Link
                href={`/seller-profile?id=${sellerId}`}
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
