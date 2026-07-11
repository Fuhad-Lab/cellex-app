'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductGrid } from '@/components/product-card';
import {
  Store, MapPin, Users, Calendar, Star, UserPlus, UserCheck,
  Activity, Package, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

function SellerProfileContent() {
  const params = useSearchParams();
  const sellerId = params.get('id') || '';
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [seller, setSeller] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [tab, setTab] = useState<'products' | 'about' | 'activity' | 'reviews'>('products');
  const [products, setProducts] = useState<Product[]>([]);
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

    // Load feed and reviews in background
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto no-scrollbar">
          {[
            { key: 'products', label: `Products (${products.length})`, icon: Package },
            { key: 'about', label: 'About', icon: Store },
            { key: 'activity', label: `Activity (${feed.length})`, icon: Activity },
            { key: 'reviews', label: `Reviews (${reviews.length})`, icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'products' && (
          <ProductGrid products={products} loading={false} />
        )}

        {tab === 'about' && (
          <Card className="p-4 border-slate-100 space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">Business Name</div>
              <div className="text-sm">{name}</div>
            </div>
            {seller.business_category && (
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">Category</div>
                <Badge variant="secondary">{seller.business_category}</Badge>
              </div>
            )}
            {seller.seller_type && (
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">Seller Type</div>
                <div className="text-sm capitalize">{seller.seller_type}</div>
              </div>
            )}
            {seller.business_location && (
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">Location</div>
                <div className="text-sm">{seller.business_location}</div>
              </div>
            )}
            {seller.business_description && (
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1">About</div>
                <p className="text-sm text-slate-700">{seller.business_description}</p>
              </div>
            )}
          </Card>
        )}

        {tab === 'activity' && (
          <div className="space-y-2">
            {feed.length === 0 ? (
              <Card className="p-6 text-center border-slate-100">
                <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No recent activity</p>
              </Card>
            ) : (
              feed.map((a) => (
                <Card key={a.id} className="p-3 border-slate-100 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg brand-gradient flex items-center justify-center text-white shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{a.title}</div>
                    {a.body && <p className="text-xs text-slate-500 mt-0.5">{a.body}</p>}
                    <div className="text-[10px] text-slate-400 mt-1">{timeAgo(a.created_at)}</div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="space-y-2">
            {reviews.length === 0 ? (
              <Card className="p-6 text-center border-slate-100">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No reviews yet</p>
              </Card>
            ) : (
              reviews.map((r) => (
                <Card key={r.id} className="p-3 border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">
                      {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-xs">{r.reviewer_name || 'Anonymous'}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.title && <div className="font-bold text-sm">{r.title}</div>}
                  {r.comment && <p className="text-xs text-slate-600 mt-1">{r.comment}</p>}
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellerProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <SellerProfileContent />
    </Suspense>
  );
}

