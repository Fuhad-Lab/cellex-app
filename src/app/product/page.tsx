'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Heart, Share2, Store, Star, ChevronLeft, ChevronRight, Sparkles,
  MessageSquare, ThumbsUp, Truck, Shield, RotateCcw, Users,
  MessageCircle, Clock, ChevronRight as Arrow, MapPin, Flag, MoreHorizontal,
  CheckCircle, Award, Video as VideoIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { TryItOnModal } from '@/components/try-it-on';

function ProductContent() {
  const params = useSearchParams();
  const id = Number(params.get('id'));
  const router = useRouter();
  const { user, refreshCartCount } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>({ avg: 0, count: 0 });
  const [groupBuys, setGroupBuys] = useState<any[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  // Fake countdown timer (like the reference's "Ending soon 00:06:45.7")
  const [countdown, setCountdown] = useState({ m: 6, s: 45, ms: 7 });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [prodResp, reviewsResp, gbResp] = await Promise.all([
      api.products.byId(id),
      api.reviews.byProduct(id),
      api.groupBuy.active(id),
    ]);
    if (prodResp.success && prodResp.product) {
      setProduct(prodResp.product);
      if (prodResp.seller) setSeller(prodResp.seller);
    }
    if (reviewsResp.success) {
      setReviews(reviewsResp.reviews || []);
      const r = reviewsResp.reviews || [];
      const avg = r.length ? r.reduce((s: number, x: Review) => s + (x.rating || 0), 0) / r.length : 0;
      setReviewSummary({ avg, count: r.length });
    }
    if (gbResp.success) setGroupBuys(gbResp.groupBuys || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        let { m, s, ms } = prev;
        ms -= 1;
        if (ms < 0) { ms = 9; s -= 1; }
        if (s < 0) { s = 59; m -= 1; }
        if (m < 0) { m = 59; }
        return { m, s, ms };
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const images = product?.additional_images?.length
    ? [product.image_url, ...product.additional_images!].filter(Boolean)
    : product?.image_url ? [product.image_url] : [];

  const addToCart = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`)); return; }
    setAdding(true);
    const result = await api.cart.add(id, qty);
    setAdding(false);
    if (result.success) {
      await refreshCartCount();
      toast({ title: 'Added to cart', description: `${qty} × ${product?.name}` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const buyNow = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`)); return; }
    setAdding(true);
    const result = await api.cart.add(id, qty);
    setAdding(false);
    if (result.success) {
      router.push('/cart');
    }
  };

  const addToWishlist = async () => {
    if (!user) { router.push('/login'); return; }
    const result = await api.wishlist.add(id);
    toast({
      title: result.success ? 'Added to wishlist' : 'Error',
      description: result.success ? product?.name : result.error,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const startGroupBuy = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`)); return; }
    // Use the new group-buy API to start a group buy with invite link
    const resp = await fetch('/api/group-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'start', productId: id }),
    });
    const result = await resp.json();
    if (result.success && result.groupBuy) {
      toast({
        title: 'Group Buy Started! 🎉',
        description: 'Share the invite link with friends to get the discount.',
      });
      // Navigate to the group buy join page so the user can copy/share the link
      router.push(result.groupBuy.inviteLink || `/group-buy-join?code=${result.groupBuy.invite_code}`);
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to start group buy', variant: 'destructive' });
    }
  };

  const submitReview = async () => {
    if (!user) { router.push('/login'); return; }
    const result = await api.reviews.create({
      productId: id,
      rating: reviewRating,
      title: reviewTitle,
      comment: reviewComment,
    });
    if (result.success) {
      toast({ title: 'Review submitted', description: 'Thank you for your feedback!' });
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewComment('');
      load();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const shareProduct = (channel: 'whatsapp' | 'telegram' | 'copy') => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Check out ${product?.name} on Cellex — ${formatPrice(product?.price || 0)}`;
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    else if (channel === 'telegram') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    else { navigator.clipboard.writeText(url); toast({ title: 'Link copied' }); }
  };

  const formatCountdown = () => {
    const { m, s, ms } = countdown;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  if (loading) {
    return <PageSkeleton variant="product" />;
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-base">Product not found</p>
        <Link href="/" className="text-primary font-bold mt-3 inline-block">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="bg-white pb-20">
      {/* Back arrow (top-left, overlays the image) */}
      <button
        onClick={() => router.back()}
        className="fixed top-3 left-3 z-50 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center"
      >
        <ChevronLeft className="w-5 h-5 text-black" />
      </button>

      {/* === 1. IMAGE GALLERY (full-width, page indicator bottom-right) === */}
      <div className="relative aspect-square bg-slate-50">
        {images[activeImage] ? (
          <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Store className="w-16 h-16" />
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveImage((activeImage + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              {activeImage + 1} / {images.length}
            </div>
          </>
        )}
        {/* Share + wishlist top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button onClick={shareProduct.bind(null, 'whatsapp')} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow">
            <Share2 className="w-4 h-4 text-green-600" />
          </button>
          <button onClick={addToWishlist} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow">
            <Heart className="w-4 h-4 text-primary" />
          </button>
        </div>
      </div>

      {/* === 2. PRICE SECTION (large cyan price + sold count right) === */}
      <div className="px-3 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold price">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-sm text-slate-400">{product.units_sold} sold</span>
          )}
        </div>

        {/* Green "Buy Now, Pay Later" banner */}
        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 font-semibold">Pay on delivery | ₦0 upfront, pay when you receive</span>
        </div>
      </div>

      {/* === 3. TITLE === */}
      <h1 className="text-base font-semibold text-black leading-snug px-3 pt-3">{product.name}</h1>
      {product.category && (
        <div className="px-3 pt-1">
          <Badge variant="secondary" className="text-xs">{product.category}</Badge>
        </div>
      )}

      {/* === 4. SOCIAL PROOF BADGES (brown/gold) === */}
      <div className="px-3 pt-3 flex items-center gap-2 flex-wrap">
        <span className="bg-amber-50 text-amber-800 text-xs font-bold px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {100 + (product.units_sold || 0)}+ People Joined Group Buys in 24h
        </span>
        {typeof product.units_sold === 'number' && product.units_sold > 50 && (
          <span className="bg-gradient-to-r from-amber-600 to-amber-800 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Award className="w-3 h-3" />
            Bestseller
          </span>
        )}
      </div>

      {/* === 4b. TRY IT ON BUTTON (prominent, right after badges — for fashion/beauty/home) === */}
      {['Fashion', 'Beauty', 'Home'].includes(product.category || '') && (
        <button
          onClick={() => setShowTryOn(true)}
          className="mx-3 mt-3 w-[calc(100%-1.5rem)] bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl px-4 py-3 flex items-center justify-between hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm">Try It On with AI</div>
              <div className="text-[10px] opacity-90">See yourself wearing this</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* === 5. GROUP BUY SECTION (only if seller enabled it) === */}
      {product.group_buy_enabled ? (
        <div className="px-3 pt-3">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <div className="font-bold text-sm text-purple-900">Group Buy Available</div>
                <div className="text-xs text-purple-600">
                  Get {product.group_buy_discount_pct || 20}% off when {product.group_buy_target_count || 3} people join
                </div>
              </div>
            </div>
            <button
              onClick={startGroupBuy}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm py-2.5 rounded-lg hover:shadow-md transition-shadow"
            >
              Start a Group Buy & Get {product.group_buy_discount_pct || 20}% Off
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pt-3">
          <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center">
            <span className="text-xs text-slate-400">Group buy not available — the seller did not enable group buy for this product.</span>
          </div>
        </div>
      )}

      {/* === 6. SELLER CARDS WITH COUNTDOWN (always show at least 1 card) === */}
      <div className="px-3 pt-3 space-y-2">
        {(groupBuys.length > 0 ? groupBuys.slice(0, 2) : [null, null]).map((gb, i) => (
          <Card key={gb?.id || i} className="p-3 border-slate-100">
            <div className="flex items-center gap-2">
              {/* Seller avatar */}
              <Link href={`/seller-profile?id=${gb?.seller_id || seller?.id || ''}`}>
                <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(seller?.business_name || 'S').charAt(0)}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-black truncate">{seller?.business_name || 'Seller'}</span>
                  <span className="border border-primary text-primary text-[10px] font-bold px-1 py-0.5 rounded">Repeat customer</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-primary text-xs font-bold">Ending soon</span>
                  <span className="text-black text-xs font-mono">{formatCountdown()}</span>
                </div>
              </div>
              <button
                onClick={buyNow}
                disabled={adding}
                className="relative brand-gradient text-white font-bold text-sm px-4 py-2 rounded-lg"
              >
                Buy Now
                <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-primary text-[9px] font-bold px-1 py-0.5 rounded">Ready</span>
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* === 6b. PRODUCT VIDEO (authenticity proof from seller) === */}
      {product.video_url && (
        <section className="px-3 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <VideoIcon className="w-4 h-4 text-black" />
            <h3 className="font-bold text-sm">Seller Video — See it in action</h3>
          </div>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            {product.video_url.includes('youtube.com') || product.video_url.includes('youtu.be') ? (
              <iframe
                src={product.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                className="w-full h-full"
                allowFullScreen
                title={product.name}
              />
            ) : (
              <video
                src={product.video_url}
                controls
                className="w-full h-full object-cover"
                poster={product.image_url}
              />
            )}
          </div>
        </section>
      )}

      {/* === 7. SHIPPING / RETURNS ROW === */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <RotateCcw className="w-3.5 h-3.5" />
            7-day free returns
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">Shipping within 48 hours</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">Free shipping</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
        </div>
      </div>

      {/* Rating row */}
      <div className="px-3 pt-3 flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-4 h-4 ${s <= Math.round(reviewSummary.avg) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
            />
          ))}
        </div>
        <span className="text-sm text-slate-600">
          {reviewSummary.count > 0
            ? `${reviewSummary.avg.toFixed(1)} (${reviewSummary.count} reviews)`
            : 'No reviews yet'}
        </span>
      </div>

      {/* === 8. REVIEWS SECTION === */}
      <section className="mt-4 px-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-black">Item Reviews ({reviewSummary.count})</h2>
          {reviewSummary.count > 0 && (
            <button className="text-sm text-slate-400 flex items-center">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showReviewForm && (
          <Card className="p-3 mb-3 border-slate-100 space-y-2">
            <div>
              <div className="text-sm font-semibold mb-1">Rating</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star className={`w-6 h-6 ${s <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base"
            />
            <Textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share details about the product..."
              rows={3}
            />
            <Button onClick={submitReview} className="brand-gradient text-white">Submit</Button>
          </Card>
        )}

        {reviews.length === 0 ? (
          <Card className="p-5 text-center border-slate-100">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No reviews yet</p>
            {user && (
              <Button size="sm" variant="outline" onClick={() => setShowReviewForm(!showReviewForm)} className="mt-2">
                Write a review
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 2).map((r) => (
              <Card key={r.id} className="p-3 border-slate-100">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-black">{r.reviewer_name || 'Anonymous'}</span>
                      {r.verified_purchase && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Verified</Badge>
                      )}
                    </div>
                    <div className="flex my-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    {r.title && <div className="font-bold text-sm text-black">{r.title}</div>}
                    {r.comment && <p className="text-sm text-slate-600 mt-0.5">{r.comment}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                      <button className="flex items-center gap-1 text-xs text-slate-500">
                        <ThumbsUp className="w-3 h-3" /> Helpful
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* === 9. STORE INFO CARD === */}
      {seller && (
        <section className="mt-4 px-3">
          <Card className="p-3 border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold">
                  {(seller.business_name || 'S').charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-black">{seller.business_name || 'Unnamed store'}</div>
                  <div className="text-xs text-amber-700">{product.units_sold || 0} items sold in our store recently</div>
                </div>
              </div>
              <Link href={`/seller-profile?id=${seller.id}`}>
                <Button size="sm" variant="outline" className="text-xs">Browse <ChevronRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs">
              <span className="flex items-center gap-1 text-green-600 font-semibold">
                <Shield className="w-3.5 h-3.5" /> Guarantees
              </span>
              <span className="text-slate-500">7-Day Hassle-Free Returns</span>
            </div>
          </Card>
        </section>
      )}

      {/* === 10. PRODUCT DETAILS TABLE === */}
      <section className="mt-4 px-3">
        <Card className="p-3 border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-black">Product details</h3>
            <div className="flex items-center gap-3">
              <button className="text-xs text-slate-400 flex items-center gap-1">
                <Flag className="w-3 h-3" /> Report
              </button>
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            {product.category && (
              <div className="flex">
                <span className="text-slate-500 w-32 shrink-0">Category</span>
                <span className="text-black">{product.category}</span>
              </div>
            )}
            <div className="flex">
              <span className="text-slate-500 w-32 shrink-0">Seller</span>
              <span className="text-black">{seller?.business_name || 'Cellex verified'}</span>
            </div>
            <div className="flex">
              <span className="text-slate-500 w-32 shrink-0">Location</span>
              <span className="text-black flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {seller?.business_location || 'Nigeria'}
              </span>
            </div>
            <div className="flex">
              <span className="text-slate-500 w-32 shrink-0">Stock</span>
              <span className="text-black">{(product.units_sold || 0) + 50}+ available</span>
            </div>
          </div>
          {product.description && (
            <>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-sm text-black mb-1">Description</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
              </div>
            </>
          )}
        </Card>

      {/* === 10b. TRY IT ON BUTTON (for fashion/beauty/accessory products) === */}
      {['Fashion', 'Beauty', 'Home'].includes(product.category || '') && (
        <button
          onClick={() => setShowTryOn(true)}
          className="w-full mt-3 mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-4 flex items-center justify-between hover:shadow-lg transition-shadow"
        >
          <div className="text-left flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm">Try It On with AI</div>
              <div className="text-[10px] opacity-90">Upload your photo & see yourself with this product</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Try It On Modal */}
      <TryItOnModal
        isOpen={showTryOn}
        onClose={() => setShowTryOn(false)}
        productName={product.name}
        productCategory={product.category || ''}
        productImage={product.image_url || ''}
      />
      </section>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2">
        {/* Left: 3 icons */}
        <Link href={seller ? `/seller-profile?id=${seller.id}` : '/'} className="flex flex-col items-center justify-center px-2 py-1">
          <Store className="w-5 h-5 text-black" />
          <span className="text-[10px] text-black">Store</span>
        </Link>
        <button onClick={addToWishlist} className="flex flex-col items-center justify-center px-2 py-1">
          <Heart className="w-5 h-5 text-black" />
          <span className="text-[10px] text-black">Save</span>
        </button>
        <Link href="/ai-chat" className="flex flex-col items-center justify-center px-2 py-1">
          <MessageCircle className="w-5 h-5 text-black" />
          <span className="text-[10px] text-black">Chat</span>
        </Link>

        {/* Right: cyan "Limited Offer" banner */}
        <button
          onClick={buyNow}
          disabled={adding}
          className="flex-1 brand-gradient text-white rounded-lg px-3 py-2 flex items-center justify-between"
        >
          <div className="text-left">
            <div className="text-sm font-bold leading-tight">Limited Offer {formatPrice(product.price * qty)}</div>
            <div className="text-[10px] opacity-90 leading-tight">Sale Ending Soon, Buy Now</div>
          </div>
          <ShoppingCart className="w-5 h-5 ml-2 shrink-0" />
        </button>
      </div>

      {/* Secondary add-to-cart button (above bottom bar) */}
      <div className="fixed bottom-14 left-0 right-0 z-30 px-3 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <Button
            onClick={addToCart}
            disabled={adding}
            variant="outline"
            className="flex-1 border-primary text-primary font-bold h-10 bg-white"
          >
            <ShoppingCart className="w-4 h-4 mr-1" /> Add to cart
          </Button>
          {product.group_buy_enabled && (
            <Button
              onClick={startGroupBuy}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold h-10"
            >
              <Users className="w-4 h-4 mr-1" /> Group buy · {product.group_buy_discount_pct || 20}% off
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="product" />}>
      <ProductContent />
    </Suspense>
  );
}
