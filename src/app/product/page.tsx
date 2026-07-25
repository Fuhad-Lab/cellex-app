'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, type Product, type Review } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Heart, Share2, Store, Star, ChevronLeft, ChevronRight, Sparkles,
  MessageSquare, ThumbsUp, Truck, Shield, RotateCcw, Users,
  MessageCircle, CheckCircle, Award, Video as VideoIcon, Send, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { TryItOnModal } from '@/components/try-it-on';
import { CommentsModal } from '@/components/comments-modal';
import { SmartImage } from '@/components/smart-image';
import { API_BASE } from '@/lib/api';

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
  const [saved, setSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

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
    setSaved(true);
    toast({
      title: result.success ? 'Added to wishlist' : 'Error',
      description: result.success ? product?.name : result.error,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const startGroupBuy = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/product?id=${id}`)); return; }
    const resp = await fetch(`${API_BASE}/api/group-buy`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'start', productId: id }),
    });
    const result = await resp.json();
    if (result.success && result.groupBuy) {
      toast({ title: 'Group Buy started!', description: 'Share the invite link with friends.' });
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

  if (loading) {
    return <PageSkeleton variant="product" />;
  }

  if (!product) {
    return (
      <div className="ig-container text-center py-20 px-4 ig-topbar-offset">
        <Store className="w-12 h-12 mx-auto text-[#666666] mb-3" />
        <p className="text-[#666666] font-semibold">Product not found</p>
        <Link href="/" className="inline-block mt-4 bg-[#D4AF37] text-black text-sm font-semibold px-6 py-2.5 rounded-lg">Back to home</Link>
      </div>
    );
  }

  const tryOnCategories = ['Fashion', 'Beauty', 'Home'];
  const canTryOn = tryOnCategories.includes(product.category || '');

  return (
    <div className="ig-container min-h-screen pb-32">
      {/* Top bar — IG-style: back + share + save */}
      <div className="fx-topbar ig-topbar">
        <button
          onClick={() => router.back()}
          className="ig-icon-btn"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1" />
        <button onClick={() => shareProduct('whatsapp')} className="ig-icon-btn" aria-label="Share">
          <Share2 className="w-6 h-6" />
        </button>
        <button onClick={addToWishlist} className="ig-icon-btn" aria-label="Save">
          <Bookmark className={`w-6 h-6 ${saved ? 'fill-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Image gallery — IG-style square with dot pagination */}
      <div className="relative aspect-square bg-[#F5F5F5]">
        {images[activeImage] ? (
          <SmartImage src={images[activeImage]} alt={product.name} width={600} className="w-full h-full" loading="eager" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#666666]">
            <Store className="w-16 h-16" />
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveImage((activeImage - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white backdrop-blur flex items-center justify-center shadow"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveImage((activeImage + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white backdrop-blur flex items-center justify-center shadow"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* IG-style dot pagination */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeImage ? 'bg-[#D4AF37]' : 'bg-white/70'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action bar — IG-style: 24px icons */}
      <div className="ig-action-bar">
        <button onClick={addToWishlist} aria-label="Like">
          <Heart className={`w-7 h-7 ${saved ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-black'}`} strokeWidth={1.5} />
        </button>
        <button aria-label="Comment" onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="w-7 h-7 text-black" strokeWidth={1.5} />
        </button>
        <button onClick={() => shareProduct('whatsapp')} aria-label="Share">
          <Share2 className="w-7 h-7 text-black" strokeWidth={1.5} />
        </button>
      </div>

      {/* Price — IG-style bold */}
      <div className="px-3 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-black">{formatPrice(product.price)}</span>
          {typeof product.units_sold === 'number' && product.units_sold > 0 && (
            <span className="text-xs text-[#666666]">{product.units_sold} sold</span>
          )}
        </div>
      </div>

      {/* Title + category */}
      <h1 className="text-base font-semibold text-black leading-snug px-3 pb-1">{product.name}</h1>
      {product.category && (
        <div className="px-3 pb-2">
          <span className="text-xs text-sky-500">#{product.category.toLowerCase().replace(/\s+/g, '')}</span>
        </div>
      )}

      {/* Rating row — IG-style minimal */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-3.5 h-3.5 ${s <= Math.round(reviewSummary.avg) ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-black'}`}
            />
          ))}
        </div>
        <span className="text-xs text-[#666666]">
          {reviewSummary.count > 0
            ? `${reviewSummary.avg.toFixed(1)} · ${reviewSummary.count} review${reviewSummary.count === 1 ? '' : 's'}`
            : 'No reviews yet'}
        </span>
      </div>

      {/* Try It On — for fashion/beauty/home, IG-style subtle banner */}
      {canTryOn && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowTryOn(true)}
            className="w-full bg-[#F5F5F5] text-black rounded-lg px-4 py-3 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Try It On with AI</div>
                <div className="text-[11px] text-black/70">See yourself with this product</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Group Buy — only if seller enabled it. Clean, IG-style. */}
      {product.group_buy_enabled && (
        <div className="px-3 pb-3">
          <div className="border border-[#E5E5E5] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                <Users className="w-4 h-4 text-[#666666]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-black">Group Buy</div>
                <div className="text-xs text-[#666666]">
                  {product.group_buy_discount_pct || 20}% off when {product.group_buy_target_count || 3} buyers join
                </div>
              </div>
            </div>
            <button
              onClick={startGroupBuy}
              className="w-full bg-[#D4AF37] text-black text-sm font-semibold py-2.5 rounded-md hover:bg-[#F5F5F5] transition-colors"
            >
              Start a Group Buy · Save {product.group_buy_discount_pct || 20}%
            </button>
          </div>
        </div>
      )}

      {/* Seller header — IG-style: avatar + name + follow button */}
      {seller && (
        <div className="px-3 py-3 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-3">
            <Link href={seller.slug ? `/${seller.slug}` : `/seller-profile?id=${seller.id}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F5F5F5] shrink-0">
                {seller.profile_image ? (
                  <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F5F5F5] text-black font-bold text-sm">
                    {(seller.business_name || 'S').charAt(0)}
                  </div>
                )}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={seller.slug ? `/${seller.slug}` : `/seller-profile?id=${seller.id}`} className="text-sm font-semibold text-black hover:opacity-70 truncate block">
                {seller.business_name || 'Unnamed store'}
              </Link>
              <div className="text-xs text-[#666666]">{product.units_sold || 0} sold · {seller.business_location || 'Nigeria'}</div>
            </div>
            <Link
              href={seller.slug ? `/${seller.slug}` : `/seller-profile?id=${seller.id}`}
              className="text-xs font-semibold text-sky-500 hover:text-sky-700 px-3 py-1.5"
            >
              Visit
            </Link>
          </div>
        </div>
      )}

      {/* Description — IG-style caption block */}
      {product.description && (
        <div className="px-3 py-3 border-t border-[#E5E5E5]">
          <div className="text-sm font-semibold text-black mb-1">Description</div>
          <p className="text-sm text-[#666666] whitespace-pre-wrap leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Product video — IG-style */}
      {product.video_url && (
        <section className="px-3 py-3 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-2 mb-2">
            <VideoIcon className="w-4 h-4 text-black" />
            <h3 className="font-semibold text-sm">Video</h3>
          </div>
          <div className="rounded-lg overflow-hidden bg-[#D4AF37] aspect-video">
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

      {/* Shipping info — IG-style minimal row */}
      <div className="px-3 py-3 border-t border-[#E5E5E5]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#666666]">
            <RotateCcw className="w-4 h-4 text-[#666666]" />
            <span>7-day free returns</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#666666]">
            <Truck className="w-4 h-4 text-[#666666]" />
            <span>Ships within 48 hours</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#666666]">
            <Shield className="w-4 h-4 text-[#666666]" />
            <span>Secure checkout · Pay on delivery available</span>
          </div>
        </div>
      </div>

      {/* Reviews — IG-style comments section */}
      <section className="px-3 py-3 border-t border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-black">Reviews · {reviewSummary.count}</h2>
          {reviewSummary.count > 0 && (
            <button className="text-xs text-[#666666]">See all</button>
          )}
        </div>

        {showReviewForm && (
          <div className="border border-[#E5E5E5] rounded-lg p-3 mb-3 space-y-2">
            <div>
              <div className="text-xs font-semibold mb-1">Rating</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setReviewRating(s)} aria-label={`${s} stars`}>
                    <Star className={`w-6 h-6 ${s <= reviewRating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-black'}`} />
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md text-sm bg-[#F5F5F5]"
            />
            <Textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share details about the product..."
              rows={3}
              className="text-sm"
            />
            <Button onClick={submitReview} className="bg-[#D4AF37] text-black hover:bg-[#F5F5F5]">Submit review</Button>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 mx-auto text-[#666666] mb-2" />
            <p className="text-sm text-[#666666]">No reviews yet</p>
            {user && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="mt-2 text-xs font-semibold text-sky-500"
              >
                Write the first review
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!showReviewForm && user && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="text-xs font-semibold text-sky-500 mb-2"
              >
                Write a review
              </button>
            )}
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center text-black font-bold text-xs shrink-0">
                  {(r.reviewer_name || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-black">{r.reviewer_name || 'Anonymous'}</span>
                    {r.verified_purchase && (
                      <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                    <span className="text-[10px] text-[#666666]">· {timeAgo(r.created_at)}</span>
                  </div>
                  <div className="flex my-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-black'}`} />
                    ))}
                  </div>
                  {r.title && <div className="font-semibold text-sm text-black">{r.title}</div>}
                  {r.comment && <p className="text-sm text-[#666666] mt-0.5">{r.comment}</p>}
                  <button className="flex items-center gap-1 text-xs text-[#666666] mt-1.5 hover:text-black">
                    <ThumbsUp className="w-3 h-3" /> Helpful
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Try It On Modal */}
      {canTryOn && (
        <TryItOnModal
          isOpen={showTryOn}
          onClose={() => setShowTryOn(false)}
          productName={product.name}
          productCategory={product.category || ''}
          productImage={product.image_url || ''}
        />
      )}

      {/* Fixed bottom bar — Add to cart + Buy now (IG-style minimal) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#F5F5F5] border-t border-[#E5E5E5] px-3 py-2.5 flex items-center gap-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <button
          onClick={addToCart}
          disabled={adding}
          className="flex-1 bg-[#F5F5F5] border border-white/15 text-black font-semibold text-sm py-2.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-50"
        >
          Add to cart
        </button>
        <button
          onClick={buyNow}
          disabled={adding}
          className="flex-1 bg-[#D4AF37] text-black font-semibold text-sm py-2.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-50"
        >
          Buy now
        </button>
      </div>

      {/* Comments modal */}
      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postType="product"
        postId={id}
        postCaption={product?.name}
      />
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
