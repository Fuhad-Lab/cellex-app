'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatPrice, type Product } from '@/lib/api';
import { Store, MapPin, Star, Grid3x3, Film, Package, ChevronLeft, Heart, Share2, ShoppingBag, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

/**
 * SellerStorefront — dynamic storefront page at /<slug>
 *
 * Examples:
 *   /fuhad-shirts  →  Fuhad Shirts storefront
 *   /lagos-fashion  →  Lagos Fashion House storefront
 *
 * This is a SINGLE page that handles ALL seller storefronts dynamically.
 * The slug is read from the URL, then we fetch the seller + products via
 * /api/seller-by-slug. No page is created per seller — it's all dynamic.
 *
 * Works on both:
 *   - Web (standalone): native dynamic route
 *   - APK (static export): client-side fetch with generateStaticParams fallback
 */
export default function SellerStorefront({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tab, setTab] = useState<'products' | 'videos'>('products');
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/seller-by-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        const data = await resp.json();
        if (data.success && data.seller) {
          setSeller(data.seller);
          setProducts(data.products || []);
          // Load videos in background
          if (data.seller.id) {
            api.videos.bySeller(data.seller.id).then((r) => {
              if (r.success) setVideos(r.videos || []);
            }).catch(() => {});
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

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
      toast({ title: isFollowing ? 'Unfollowed' : 'Following', description: seller.business_name });
    }
  };

  const shareStore = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({ title: seller?.business_name, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast({ title: 'Store link copied!' });
    }
  };

  if (loading) {
    return <PageSkeleton variant="seller-profile" />;
  }

  if (notFound || !seller) {
    return (
      <div className="ig-container bg-white min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
          <Store className="w-10 h-10 text-neutral-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Storefront Not Found</h1>
        <p className="text-sm text-neutral-500 max-w-xs mb-6">
          The store <span className="font-mono font-semibold">/{slug}</span> doesn&apos;t exist, or the seller may have changed their name.
        </p>
        <Link href="/" className="bg-black text-white text-sm font-semibold px-6 py-3 rounded-md">
          Go to homepage
        </Link>
      </div>
    );
  }

  const name = seller.business_name || seller.farm_name || 'Store';
  const totalPosts = products.length + videos.length;

  return (
    <div className="ig-container bg-white min-h-screen ig-topbar-offset">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0 ml-2">
          <h1 className="text-base font-semibold truncate">{name}</h1>
          {seller.business_category && (
            <p className="text-[11px] text-neutral-500 -mt-0.5 truncate">{seller.business_category}</p>
          )}
        </div>
        <button onClick={shareStore} className="ig-icon-btn" aria-label="Share store">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Profile header — IG-style */}
      <div className="ig-profile-header">
        <div className="shrink-0">
          {seller.profile_image ? (
            <img src={seller.profile_image} alt={name} className="ig-avatar-lg" />
          ) : (
            <div className="ig-avatar-lg bg-neutral-800 flex items-center justify-center text-white font-bold text-2xl">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="ig-profile-stats">
          <div className="ig-profile-stat">
            <span className="num">{totalPosts}</span>
            <span className="label">posts</span>
          </div>
          <div className="ig-profile-stat">
            <span className="num">{formatCount(seller.followers_count || 0)}</span>
            <span className="label">followers</span>
          </div>
          <div className="ig-profile-stat">
            <span className="num">{products.length}</span>
            <span className="label">products</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="px-4 pb-3">
        <div className="text-sm font-semibold text-black flex items-center gap-1">
          {name}
          <CheckCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500 stroke-white" />
        </div>
        {seller.business_description && (
          <p className="text-sm text-neutral-700 leading-snug mt-1 whitespace-pre-line">{seller.business_description}</p>
        )}
        {/* Store URL display */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-500 font-medium">
          <Link href={`/${slug}`} className="hover:underline">
            cellex.app/{slug}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500">
          {seller.business_location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {seller.business_location}</span>
          )}
          {seller.created_at && (
            <span>Joined {new Date(seller.created_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={toggleFollow}
          className={`flex-1 ${isFollowing ? 'ig-btn-outline' : 'ig-btn-primary'} ${isFollowing ? 'following' : ''}`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        <Link
          href={`/messenger?seller=${seller.id}`}
          className="flex-1 ig-btn-outline text-center inline-flex items-center justify-center"
        >
          Message
        </Link>
      </div>

      {/* Tab bar */}
      <div className="ig-tab-bar">
        <button
          onClick={() => setTab('products')}
          className={`ig-tab ${tab === 'products' ? 'active' : ''}`}
          aria-label="Products tab"
        >
          <Grid3x3 className="w-5 h-5" strokeWidth={tab === 'products' ? 2.5 : 1.5} />
        </button>
        <button
          onClick={() => setTab('videos')}
          className={`ig-tab ${tab === 'videos' ? 'active' : ''}`}
          aria-label="Videos tab"
        >
          <Film className="w-5 h-5" strokeWidth={tab === 'videos' ? 2.5 : 1.5} />
        </button>
      </div>

      {/* Tab content */}
      {tab === 'products' && (
        products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm font-medium text-neutral-700">No products yet</p>
            <p className="text-xs text-neutral-400 mt-1">When this store adds products, they&apos;ll appear here.</p>
          </div>
        ) : (
          <div className="ig-post-grid">
            {products.map((p) => (
              <Link key={p.id} href={`/product?id=${p.id}`} className="block relative group">
                <img
                  src={p.image_url || ''}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="text-white text-sm font-bold">{formatPrice(p.price)}</div>
                  <div className="text-white/80 text-[10px] mt-0.5">{p.units_sold || 0} sold</div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'videos' && (
        videos.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Film className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm font-medium text-neutral-700">No videos yet</p>
            <p className="text-xs text-neutral-400 mt-1">When this store posts videos, they&apos;ll appear here.</p>
          </div>
        ) : (
          <div className="ig-post-grid">
            {videos.map((v) => (
              <Link key={v.id} href="/shorts" className="block relative group bg-black">
                {v.video_url ? (
                  <video src={v.video_url} muted className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-6 h-6 text-white/30" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="text-white text-[10px] font-semibold">{formatCount(v.views_count || 0)}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
