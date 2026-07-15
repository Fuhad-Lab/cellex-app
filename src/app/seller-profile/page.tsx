'use client';

import { useEffect, useState, useCallback , Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product-card';
import { Store, MapPin, Users, Calendar, Star, UserPlus, UserCheck,
  Package, Video as VideoIcon, LayoutGrid } from 'lucide-react';
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
  const [tab, setTab] = useState<'all' | 'videos' | 'products'>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
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

    // Load videos + feed + reviews in background
    api.videos.bySeller(sellerId).then((r) => r.success && setVideos(r.videos || []));
    api.social.sellerFeed(sellerId, 10).then((r) => r.success && setFeed(r.feed || []));
    api.reviews.bySeller(sellerId).then((r) => r.success && setReviews(r.reviews || []));
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
      <div className="text-center py-20">
        <Store className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">Seller not found</p>
        <Link href="/" className="text-primary font-bold mt-3 inline-block">Back to home</Link>
      </div>
    );
  }

  const name = seller.business_name || seller.farm_name || 'Unnamed store';

  return (
    <div className="max-w-5xl mx-auto pb-6">
      {/* Cover + profile header */}
      <div className="brand-gradient h-32 sm:h-40 relative">
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="px-3 sm:px-4 lg:px-6 -mt-12 sm:-mt-14 relative">
        <div className="flex items-end gap-4 mb-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden shrink-0">
            {seller.profile_image ? (
              <img src={seller.profile_image} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full brand-gradient flex items-center justify-center text-white font-extrabold text-4xl">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 pb-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              {seller.business_category && (
                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {seller.business_category}</span>
              )}
              {seller.business_location && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {seller.business_location}</span>
              )}
              {seller.created_at && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {timeAgo(seller.created_at)}</span>
              )}
            </div>
          </div>
          <div className="pb-2">
            <Button
              onClick={toggleFollow}
              className={isFollowing ? '' : 'brand-gradient text-primary-foreground'}
              variant={isFollowing ? 'outline' : 'default'}
            >
              {isFollowing ? <><UserCheck className="w-4 h-4 mr-1" /> Following</> : <><UserPlus className="w-4 h-4 mr-1" /> Follow</>}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-3 text-center border-slate-100">
            <div className="text-lg font-extrabold text-primary">{stats.followers || 0}</div>
            <div className="text-[10px] text-slate-500 font-semibold">FOLLOWERS</div>
          </Card>
          <Card className="p-3 text-center border-slate-100">
            <div className="text-lg font-extrabold text-primary">{products.length}</div>
            <div className="text-[10px] text-slate-500 font-semibold">PRODUCTS</div>
          </Card>
          <Card className="p-3 text-center border-slate-100">
            <div className="text-lg font-extrabold text-primary flex items-center justify-center gap-1">
              {(stats.rating || 0).toFixed(1)} <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">RATING</div>
          </Card>
        </div>

        {seller.business_description && (
          <Card className="p-4 border-slate-100 mb-4">
            <p className="text-sm text-slate-700 leading-relaxed">{seller.business_description}</p>
          </Card>
        )}

        {/* Tabs — only 3: All | Videos | Products */}
        <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar">
          {[
            { key: 'all', label: `All (${products.length + videos.length})`, icon: LayoutGrid },
            { key: 'videos', label: `Videos (${videos.length})`, icon: VideoIcon },
            { key: 'products', label: `Products (${products.length})`, icon: Package },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content — All: videos grid + products grid */}
        {tab === 'all' && (
          <div className="space-y-6">
            {videos.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">Videos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {videos.map((v) => (
                    <Link key={v.id} href="/videos" className="block group">
                      <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-shadow">
                        <div className="aspect-[9/16] bg-slate-900 relative">
                          {v.video_url ? (
                            <video src={v.video_url} muted className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon className="w-8 h-8 text-white/50" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            ▶ {v.views_count || 0}
                          </div>
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium line-clamp-2 h-8 leading-tight">{v.caption || 'Video'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">❤ {v.likes_count || 0}</div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              {videos.length > 0 && <h3 className="text-sm font-bold text-slate-700 mb-2">Products</h3>}
              <ProductGrid products={products} loading={false} />
            </div>
          </div>
        )}

        {/* Tab content — Videos only */}
        {tab === 'videos' && (
          videos.length === 0 ? (
            <Card className="p-8 text-center border-slate-100">
              <VideoIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No videos yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {videos.map((v) => (
                <Link key={v.id} href="/videos" className="block group">
                  <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-shadow">
                    <div className="aspect-[9/16] bg-slate-900 relative">
                      {v.video_url ? (
                        <video src={v.video_url} muted className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoIcon className="w-8 h-8 text-white/50" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        ▶ {v.views_count || 0}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium line-clamp-2 h-8 leading-tight">{v.caption || 'Video'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">❤ {v.likes_count || 0}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Tab content — Products only */}
        {tab === 'products' && (
          <ProductGrid products={products} loading={false} />
        )}
      </div>
    </div>
  );
}

export default function SellerProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="seller-profile" />}>
      <SellerProfileContent />
    </Suspense>
  );
}

