'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Store, MapPin, Star, Grid3x3, Film, Package, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

function SellerProfileContent() {
  const params = useSearchParams();
  const sellerId = params.get('id') || '';
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [seller, setSeller] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [tab, setTab] = useState<'products' | 'videos'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    const [profileResp, prodResp] = await Promise.all([
      api.social.publicProfile(sellerId),
      api.products.all(200),
    ]);
    if (profileResp.success && profileResp.seller) {
      setSeller(profileResp.seller);
      setIsFollowing(profileResp.isFollowing || false);
      setStats({
        followers: profileResp.followers || 0,
        posts: profileResp.posts || 0,
        rating: profileResp.rating || 0,
      });
    }
    if (prodResp.success && prodResp.products) {
      setProducts(prodResp.products.filter((p: Product) => p.seller_id === sellerId));
    }
    setLoading(false);

    api.videos.bySeller(sellerId).then((r) => r.success && setVideos(r.videos || []));
  }, [sellerId]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/seller-profile?id=${sellerId}`)); return; }
    const result = isFollowing
      ? await api.social.unfollow(sellerId)
      : await api.social.follow(sellerId);
    if (result.success) {
      setIsFollowing(!isFollowing);
      setStats((s) => ({ ...s, followers: s.followers + (isFollowing ? -1 : 1) }));
      toast({ title: isFollowing ? 'Unfollowed' : 'Following', description: seller?.business_name });
    }
  };

  if (loading) { return <PageSkeleton variant="seller-profile" />; }

  if (!seller) {
    return (
      <div className="ig-container text-center py-20 px-4 ig-topbar-offset">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Seller not found</h2>
        <p className="text-sm text-neutral-500 mb-6 max-w-xs mx-auto">
          This seller may no longer be active on Cellex. Try browsing other stores.
        </p>
        <Link href="/categories" className="inline-block bg-black text-white text-sm font-semibold px-6 py-3 rounded-lg">
          Browse Products
        </Link>
      </div>
    );
  }

  const name = seller.business_name || seller.farm_name || 'Unnamed store';
  const totalPosts = products.length + videos.length;

  return (
    <div className="ig-container bg-white min-h-screen">
      {/* Top bar — IG-style with back button */}
      <div className="ig-topbar">
        <button
          onClick={() => router.back()}
          className="ig-icon-btn"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{name}</h1>
          {seller.business_category && (
            <p className="text-[11px] text-neutral-500 -mt-0.5 truncate">{seller.business_category}</p>
          )}
        </div>
      </div>

      {/* Profile header — IG-style: avatar + stats row */}
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
            <span className="num">{formatCount(stats.followers || 0)}</span>
            <span className="label">followers</span>
          </div>
          <div className="ig-profile-stat">
            <span className="num">{products.length}</span>
            <span className="label">products</span>
          </div>
        </div>
      </div>

      {/* Bio — IG-style */}
      <div className="px-4 pb-3">
        <div className="text-sm font-semibold text-black">{name}</div>
        {seller.business_description && (
          <p className="text-sm text-neutral-700 leading-snug mt-1 whitespace-pre-line">{seller.business_description}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500">
          {seller.business_location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {seller.business_location}</span>
          )}
          {seller.created_at && (
            <span>Joined {timeAgo(seller.created_at)}</span>
          )}
          {(stats.rating || 0) > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {(stats.rating || 0).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — IG-style: Follow + Message */}
      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={toggleFollow}
          className={`flex-1 ${isFollowing ? 'ig-btn-outline' : 'ig-btn-primary'} ${isFollowing ? 'following' : ''}`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        <Link
          href={`/messenger?seller=${sellerId}`}
          className="flex-1 ig-btn-outline text-center inline-flex items-center justify-center"
        >
          Message
        </Link>
      </div>

      {/* Tab bar — IG-style: 2 tabs (Products / Videos) */}
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
            <p className="text-xs text-neutral-400 mt-1">When this seller adds products, they'll appear here.</p>
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
                {/* Hover overlay with price (desktop only) */}
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
            <p className="text-xs text-neutral-400 mt-1">When this seller posts videos, they'll appear here.</p>
          </div>
        ) : (
          <div className="ig-post-grid">
            {videos.map((v) => (
              <Link key={v.id} href="/videos" className="block relative group bg-black">
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

export default function SellerProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="seller-profile" />}>
      <SellerProfileContent />
    </Suspense>
  );
}
