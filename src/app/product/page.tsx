'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ShoppingCart, Heart, Share2, Store, Star, ChevronLeft, ChevronRight,
  MessageSquare, ThumbsUp, Truck, Shield, RotateCcw, Users, Flame, ChevronRight as Arrow,
  MessageCircle, Bookmark, Clock
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
        <div className="w-7 h-7 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-sm">Product not found</p>
        <Link href="/" className="text-primary font-bold mt-2 inline-block text-sm">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-3 pb-24">
      {/* Breadcrumb */}
      <div className="text-[10px] text-slate-400 py-2 px-1">
        <Link href="/" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href={`/categories?category=${product.category || ''}`} className="hover:text-primary">{product.category || 'All'}</Link>
        {' / '}
        <span className="text-slate-600 truncate">{product.name}</span>
      </div>

      {/* Image gallery */}
      <div className="relative aspect-square bg-slate-50 rounded-lg overflow-hidden">
        {images[activeImage] ? (
          <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Store className="w-14 h-14" />
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur text-white rounded-full p-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveImage((activeImage + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur text-white rounded-full p-1.5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
              {activeImage + 1} / {images.length}
            </div>
          </>
        )}
        {/* Top-right action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button onClick={shareProduct.bind(null, 'whatsapp')} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow">
            <Share2 className="w-3.5 h-3.5 text-green-600" />
          </button>
          <button onClick={addToWishlist} className="w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow">
            <Heart className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-1.5 p-2 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 ${activeImage === i ? 'border-primary' : 'border-transparent'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Price section — RED price, sold count */}
      <div className="px-2 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold price">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-[11px] text-slate-500">{product.units_sold} sold</span>
          )}
        </div>

        {/* Buy Now Pay Later banner — green */}
        <div className="mt-1.5 bg-green-50 border border-green-200 rounded-md px-2 py-1 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor"><path d="M10 3L4.5 8.5 2 6"/></svg>
          </div>
          <span className="text-[10px] text-green-800 font-semibold">Pay on delivery available</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-sm font-semibold text-slate-900 leading-snug px-2 pt-2">{product.name}</h1>
      {product.category && (
        <div className="px-2 pt-1">
          <Badge variant="secondary" className="text-[10px] h-4">{product.category}</Badge>
        </div>
      )}

      {/* Rating */}
      <div className="flex items-center gap-1.5 px-2 pt-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-3 h-3 ${s <= Math.round(reviewSummary.avg) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
            />
          ))}
        </div>
        <span className="text-[11px] text-slate-600">
          {reviewSummary.count > 0
            ? `${reviewSummary.avg.toFixed(1)} (${reviewSummary.count} reviews)`
            : 'No reviews yet'}
        </span>
      </div>

      {/* Social proof — group buy activity */}
      {groupBuys.length > 0 && (
        <div className="mx-2 mt-2.5 commerce-gradient rounded-lg p-2.5 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold text-[11px]">{groupBuys.length} active group buy{groupBuys.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-[10px] text-white/85 mb-2">
            Join with {groupBuys.length} shopper(s) and unlock up to 20% off
          </p>
          <div className="space-y-1.5">
            {groupBuys.slice(0, 2).map((gb) => (
              <Link key={gb.id} href={`/group-buy?id=${gb.id}`}>
                <div className="bg-white/15 backdrop-blur rounded p-1.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold">{gb.current_count || 1} / {gb.target_count} joined</div>
                    <div className="text-[9px] opacity-80">{gb.discount_pct}% off when target reached</div>
                  </div>
                  <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2">Join</Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Seller card */}
      {seller && (
        <Link href={`/seller-profile?id=${seller.id}`} className="block mx-2 mt-2.5">
          <Card className="p-2 flex items-center gap-2 hover:shadow-md transition-shadow border-slate-100">
            <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0">
              {(seller.business_name || 'S').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-900 truncate">{seller.business_name || 'Unnamed store'}</div>
              <div className="text-[10px] text-slate-500">{seller.business_category || 'Seller'}</div>
            </div>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Visit</Button>
          </Card>
        </Link>
      )}

      {/* Trust badges row */}
      <div className="grid grid-cols-3 gap-1.5 px-2 mt-2.5">
        <div className="text-center p-1.5 bg-slate-50 rounded-md">
          <RotateCcw className="w-3.5 h-3.5 mx-auto text-green-600 mb-0.5" />
          <div className="text-[9px] font-semibold text-slate-700">7-Day Return</div>
        </div>
        <div className="text-center p-1.5 bg-slate-50 rounded-md">
          <Shield className="w-3.5 h-3.5 mx-auto text-primary mb-0.5" />
          <div className="text-[9px] font-semibold text-slate-700">Buyer Protection</div>
        </div>
        <div className="text-center p-1.5 bg-slate-50 rounded-md">
          <Truck className="w-3.5 h-3.5 mx-auto text-slate-600 mb-0.5" />
          <div className="text-[9px] font-semibold text-slate-700">Fast Shipping</div>
        </div>
      </div>

      {/* Quantity selector */}
      <div className="px-2 pt-3 flex items-center gap-3">
        <span className="text-xs text-slate-600">Qty:</span>
        <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm"
          >−</button>
          <span className="px-3 py-1 font-bold text-xs">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm"
          >+</button>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <Card className="mx-2 mt-3 p-3 border-slate-100">
          <h3 className="font-bold text-xs mb-1.5">Description</h3>
          <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">{product.description}</p>
        </Card>
      )}

      {/* Reviews section */}
      <section className="mt-4 px-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-primary" />
            Reviews ({reviewSummary.count})
          </h2>
          {user && (
            <Button size="sm" variant="outline" onClick={() => setShowReviewForm(!showReviewForm)} className="h-7 text-[11px]">
              Write a review
            </Button>
          )}
        </div>

        {showReviewForm && (
          <Card className="p-3 mb-2 border-slate-100 space-y-2">
            <div>
              <div className="text-[11px] font-semibold mb-1">Rating</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star className={`w-5 h-5 ${s <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold mb-1">Title</div>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Summarize your experience"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold mb-1">Comment</div>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details about the product quality, delivery, etc."
                rows={3}
              />
            </div>
            <Button onClick={submitReview} className="commerce-gradient text-white h-8 text-xs">
              Submit review
            </Button>
          </Card>
        )}

        {reviews.length === 0 ? (
          <Card className="p-5 text-center border-slate-100">
            <MessageSquare className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
            <p className="text-[11px] text-slate-500">No reviews yet. Be the first!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <Card key={r.id} className="p-2.5 border-slate-100">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                    {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[11px]">{r.reviewer_name || 'Anonymous'}</span>
                      {r.verified_purchase && (
                        <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700 h-4">
                          Verified
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-400">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="flex my-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    {r.title && <div className="font-bold text-[11px]">{r.title}</div>}
                    {r.comment && <p className="text-[11px] text-slate-600 mt-0.5">{r.comment}</p>}
                    <button
                      onClick={async () => {
                        const res = await api.reviews.helpful(r.id);
                        if (res.success) load();
                      }}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary mt-1.5"
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

      {/* Bottom CTA bar — fixed, Temu-style */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center gap-1.5 md:max-w-4xl md:mx-auto md:rounded-t-2xl md:bottom-2 md:border md:shadow-lg">
        {/* Left: store/save/chat icons */}
        <Link href={seller ? `/seller-profile?id=${seller.id}` : '/'} className="flex flex-col items-center justify-center px-2 py-0.5">
          <Store className="w-4 h-4 text-slate-700" />
          <span className="text-[9px] text-slate-600">Store</span>
        </Link>
        <button onClick={addToWishlist} className="flex flex-col items-center justify-center px-2 py-0.5">
          <Heart className="w-4 h-4 text-slate-700" />
          <span className="text-[9px] text-slate-600">Save</span>
        </button>
        <Link href="/cart" className="flex flex-col items-center justify-center px-2 py-0.5">
          <MessageCircle className="w-4 h-4 text-slate-700" />
          <span className="text-[9px] text-slate-600">Chat</span>
        </Link>

        {/* Right: Add to cart + Buy Now */}
        <Button
          onClick={addToCart}
          disabled={adding}
          variant="outline"
          className="flex-1 h-9 border-primary text-primary font-bold text-xs hover:bg-primary/5"
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
          Cart
        </Button>
        <Button
          onClick={buyNow}
          disabled={adding}
          className="flex-1 h-9 commerce-gradient text-white font-bold text-xs glow"
        >
          Buy Now · {formatPrice(product.price * qty)}
        </Button>
      </div>

      {/* Group buy CTA — separate button above bottom bar */}
      <div className="fixed bottom-14 left-0 right-0 z-30 px-2 md:max-w-4xl md:mx-auto md:bottom-16 pointer-events-none">
        <Button
          onClick={startGroupBuy}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-8 text-xs pointer-events-auto shadow-lg"
        >
          <Users className="w-3.5 h-3.5 mr-1" />
          Start group buy · 20% off
        </Button>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-7 h-7 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <ProductContent />
    </Suspense>
  );
}
