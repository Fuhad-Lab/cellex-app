'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { ChevronLeft, Users, Share2, Check, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

function GroupBuyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const groupBuyId = params.get('id') || '';
  const [gb, setGb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!groupBuyId) { setLoading(false); return; }
    (async () => {
      const result = await api.groupBuy.status(groupBuyId);
      if (result.success) setGb(result.groupBuy || result);
      setLoading(false);
    })();
  }, [groupBuyId]);

  const join = async () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent(`/group-buy?id=${groupBuyId}`));
      return;
    }
    setJoining(true);
    const result = await api.groupBuy.join(groupBuyId);
    setJoining(false);
    if (result.success) {
      toast({ title: 'Joined!', description: 'You\'re now part of this group buy.' });
      setGb((prev: any) => ({ ...prev, current_count: (prev?.current_count || 0) + 1, members: [...(prev?.members || []), { user_id: user.id }] }));
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const share = () => {
    const url = `${window.location.origin}/group-buy?id=${groupBuyId}`;
    const text = `Join my group buy on Cellex and get ${gb?.discount_pct || 20}% off ${gb?.product?.name || ''}!`;
    if (navigator.share) {
      navigator.share({ title: 'Group Buy on Cellex', text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text} ${url}`);
      toast({ title: 'Link copied!', description: 'Share it with your friends.' });
    }
  };

  if (loading) return <PageSkeleton variant="group-buy" />;

  if (!gb) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#FFFFFF' }}>
        <Users className="w-12 h-12 mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Group buy not found</p>
        <p className="text-xs mt-1" style={{ color: '#6B7280' }}>This group buy may have ended or been cancelled.</p>
        <Link href="/" className="mt-4 text-sm font-semibold" style={{ color: '#111827' }}>Browse products</Link>
      </div>
    );
  }

  const isComplete = gb.status === 'completed';
  const progress = ((gb.current_count || 0) / (gb.target_count || 1)) * 100;
  const discountedPrice = (gb.product?.price || 0) * (1 - (gb.discount_pct || 20) / 100);
  const inviterName = gb.creator_name || gb.creator?.name || 'Someone';

  return (
    <div className="min-h-screen pb-24" style={{ background: '#FFFFFF' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center px-4" style={{ height: '56px', background: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
        <button onClick={() => router.push(`/product?id=${gb.product_id}`)} className="p-2" aria-label="Back">
          <ChevronLeft className="w-6 h-6" style={{ color: '#111827' }} />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2" style={{ color: '#111827' }}>Group Buy</h1>
        {isComplete && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ background: '#D1FAE5', color: '#059669' }}>
            <Check className="w-3 h-3" /> UNLOCKED
          </span>
        )}
      </div>

      {/* Product image (large, at top) */}
      {gb.product?.image_url && (
        <div className="w-full" style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
          <img src={gb.product.image_url} alt={gb.product.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Inviter message */}
        <div className="text-center py-4">
          <p className="text-base" style={{ color: '#111827' }}>
            <span className="font-bold">{inviterName}</span> is inviting you to buy{' '}
            <span className="font-bold">{gb.product?.name || 'this product'}</span> together to enable a discount of{' '}
            <span className="font-bold" style={{ color: '#059669' }}>{gb.discount_pct}%</span>.
          </p>
        </div>

        {/* Price display */}
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-2xl font-bold" style={{ color: '#111827' }}>{formatPrice(discountedPrice)}</span>
          <span className="text-base line-through" style={{ color: '#9CA3AF' }}>{formatPrice(gb.product?.price || 0)}</span>
          <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#D1FAE5', color: '#059669' }}>-{gb.discount_pct}%</span>
        </div>

        {/* Progress */}
        <div className="rounded-2xl p-4" style={{ background: '#F3F4F6' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1" style={{ color: '#111827' }}>
              <Users className="w-4 h-4" /> {gb.current_count || 0} / {gb.target_count} joined
            </span>
            <span className="text-xs" style={{ color: '#6B7280' }}>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
            <div className="h-full transition-all" style={{ width: `${Math.min(100, progress)}%`, background: '#111827' }} />
          </div>
          <div className="text-xs mt-2" style={{ color: '#6B7280' }}>
            {isComplete
              ? `Target reached! Everyone gets ${gb.discount_pct}% off.`
              : `${(gb.target_count || 0) - (gb.current_count || 0)} more needed to unlock discount`}
          </div>
        </div>

        {/* Actions */}
        {!isComplete ? (
          <div className="space-y-2">
            {user ? (
              <button
                onClick={join}
                disabled={joining}
                className="w-full font-semibold transition active:scale-95 disabled:opacity-50"
                style={{ height: '52px', borderRadius: '999px', background: '#111827', color: '#FFFFFF', fontSize: '15px' }}
              >
                {joining ? 'Joining...' : 'Join Group Buy'}
              </button>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/group-buy?id=${groupBuyId}`)}`}
                className="w-full font-semibold transition active:scale-95 flex items-center justify-center"
                style={{ height: '52px', borderRadius: '999px', background: '#111827', color: '#FFFFFF', fontSize: '15px' }}
              >
                Sign up to Join
              </Link>
            )}
            <button
              onClick={share}
              className="w-full font-semibold transition active:scale-95 flex items-center justify-center gap-2"
              style={{ height: '48px', borderRadius: '999px', background: '#F3F4F6', color: '#111827', fontSize: '14px', border: '1px solid #E5E7EB' }}
            >
              <Share2 className="w-4 h-4" /> Share Link
            </button>
          </div>
        ) : (
          <Link href={`/product?id=${gb.product_id}`}>
            <button
              className="w-full font-semibold transition active:scale-95 flex items-center justify-center gap-2"
              style={{ height: '52px', borderRadius: '999px', background: '#111827', color: '#FFFFFF', fontSize: '15px' }}
            >
              <ShoppingBag className="w-5 h-5" /> Buy at {formatPrice(discountedPrice)}
            </button>
          </Link>
        )}

        {/* How it works */}
        <div className="rounded-2xl p-4" style={{ border: '1px solid #E5E7EB' }}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>How group buys work</h3>
          <ol className="space-y-2 text-xs" style={{ color: '#6B7280' }}>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full font-bold flex items-center justify-center shrink-0" style={{ background: '#F3F4F6', color: '#111827' }}>1</span>
              <span>Join the group buy or share the link with friends</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full font-bold flex items-center justify-center shrink-0" style={{ background: '#F3F4F6', color: '#111827' }}>2</span>
              <span>When {gb.target_count} people join, everyone unlocks {gb.discount_pct}% off</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full font-bold flex items-center justify-center shrink-0" style={{ background: '#F3F4F6', color: '#111827' }}>3</span>
              <span>Buy the product at the discounted price</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function GroupBuyPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="group-buy" />}>
      <GroupBuyContent />
    </Suspense>
  );
}
