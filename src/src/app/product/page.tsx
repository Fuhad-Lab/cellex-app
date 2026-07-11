'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ShoppingCart, Heart, Share2, Store, Star, ChevronLeft, ChevronRight,
  MessageSquare, ThumbsUp, Truck, Shield, RotateCcw, Users
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');

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
    const result = await api.groupBuy.create(id);
    if (result.success && result.groupBuy?.id) {
      router.push(`/group-buy?id=${result.groupBuy.id}`);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Product not found</p>
        <Link href="/" className="text-primary font-bold mt-3 inline-block">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <div className="text-xs text-slate-400 mb-4">
        <Link href="/" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href={`/categories?category=${product.category || ''}`} className="hover:text-primary">{product.category || 'All'}</Link>
        {' / '}
        <span className="text-slate-600">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Image gallery */}
        <div className="lg:col-span-5">
          <Card className="overflow-hidden border-slate-100">
            <div className="aspect-square bg-slate-50 relative">
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveImage((activeImage + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      activeImage === i ? 'border-primary' : 'border-slate-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <Button onClick={addToWishlist} variant="outline" size="sm" className="border-slate-200">
              <Heart className="w-4 h-4" />
            </Button>
            <Button onClick={() => shareProduct('whatsapp')} variant="outline" size="sm" className="border-slate-200">
              <Share2 className="w-4 h-4 text-green-500" />
            </Button>
            <Button onClick={() => shareProduct('telegram')} variant="outline" size="sm" className="border-slate-200">
              <Share2 className="w-4 h-4 text-blue-500" />
            </Button>
            <Button onClick={() => shareProduct('copy')} variant="outline" size="sm" className="border-slate-200">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Product info */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{product.name}</h1>
            {product.category && (
              <Badge variant="secondary" className="mt-2">{product.category}</Badge>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-primary">{formatPrice(product.price)}</span>
            {typeof product.units_sold === 'number' && product.units_sold > 0 && (
              <span className="text-xs text-slate-500">{product.units_sold} sold</span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
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

          {/* Seller card */}
          {seller && (
            <Link href={`/seller-profile?id=${seller.id}`}>
              <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow border-slate-100">
                <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(seller.business_name || 'S').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 truncate">{seller.business_name || 'Unnamed store'}</div>
                  <div className="text-xs text-slate-500">{seller.business_category || 'Seller'}</div>
                </div>
                <Button size="sm" variant="outline">Visit</Button>
              </Card>
            </Link>
          )}

          {/* Group buy banner */}
          {groupBuys.length > 0 && (
            <Card className="p-4 brand-gradient border-0">
              <div className="flex items-center gap-2 text-primary-foreground mb-1">
                <Users className="w-4 h-4" />
                <span className="font-bold text-sm">Active Group Buy</span>
              </div>
              <p className="text-xs text-primary-foreground/80 mb-3">
                Join with {groupBuys.length} other shopper(s) and unlock up to 20% off
              </p>
              <div className="space-y-2">
                {groupBuys.slice(0, 2).map((gb) => (
                  <Link key={gb.id} href={`/group-buy?id=${gb.id}`}>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-2 flex items-center justify-between text-primary-foreground">
                      <div>
                        <div className="text-xs font-bold">{gb.current_count || 1} / {gb.target_count} joined</div>
                        <div className="text-[10px] opacity-80">{gb.discount_pct}% off when target reached</div>
                      </div>
                      <Button size="sm" variant="secondary">Join</Button>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 text-slate-500 hover:bg-slate-50"
              >
                −
              </button>
              <span className="px-4 py-2 font-bold text-sm">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="px-3 py-2 text-slate-500 hover:bg-slate-50"
              >
                +
              </button>
            </div>
            <Button onClick={addToCart} disabled={adding} className="flex-1 brand-gradient text-primary-foreground font-bold">
              <ShoppingCart className="w-4 h-4 mr-2" />
              {adding ? 'Adding...' : 'Add to cart'}
            </Button>
            <Button onClick={buyNow} disabled={adding} variant="default" className="font-bold">
              Buy now
            </Button>
          </div>

          <Button onClick={startGroupBuy} variant="outline" className="w-full border-primary text-primary font-bold hover:bg-primary/5">
            <Users className="w-4 h-4 mr-2" /> Start group buy · 20% off
          </Button>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 py-2">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <Truck className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">Fast Delivery</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <Shield className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">Buyer Protection</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <RotateCcw className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">7-Day Return</div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <Card className="p-4 border-slate-100">
              <h3 className="font-bold text-sm mb-2">Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Reviews section */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Reviews ({reviewSummary.count})
          </h2>
          {user && (
            <Button size="sm" variant="outline" onClick={() => setShowReviewForm(!showReviewForm)}>
              Write a review
            </Button>
          )}
        </div>

        {showReviewForm && (
          <Card className="p-4 mb-4 border-slate-100 space-y-3">
            <div>
              <div className="text-xs font-semibold mb-1">Rating</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star className={`w-6 h-6 ${s <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1">Title</div>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Summarize your experience"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <div className="text-xs font-semibold mb-1">Comment</div>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details about the product quality, delivery, etc."
                rows={3}
              />
            </div>
            <Button onClick={submitReview} className="brand-gradient text-primary-foreground">
              Submit review
            </Button>
          </Card>
        )}

        {reviews.length === 0 ? (
          <Card className="p-8 text-center border-slate-100">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No reviews yet. Be the first!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className="p-4 border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{r.reviewer_name || 'Anonymous'}</span>
                      {r.verified_purchase && (
                        <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                          Verified purchase
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="flex my-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    {r.title && <div className="font-bold text-sm">{r.title}</div>}
                    {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
                    <button
                      onClick={async () => {
                        const res = await api.reviews.helpful(r.id);
                        if (res.success) load();
                      }}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary mt-2"
                    >
                      <ThumbsUp className="w-3 h-3" /> Helpful ({r.helpful_count || 0})
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <ProductContent />
    </Suspense>
  );
}

