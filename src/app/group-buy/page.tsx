'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Users, Share2, Check, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
function GroupBuyContent() {
  const params = useSearchParams();
  const groupBuyId = params.get('id') || '';
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [gb, setGb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!groupBuyId) { setLoading(false); return; }
    const result = await api.groupBuy.status(groupBuyId);
    if (result.success) setGb(result.groupBuy);
    setLoading(false);
  }, [groupBuyId]);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    if (!user) { router.push('/login?next=' + encodeURIComponent(`/group-buy?id=${groupBuyId}`)); return; }
    setJoining(true);
    const result = await api.groupBuy.join(groupBuyId);
    setJoining(false);
    if (result.success) {
      toast({ title: 'Joined!', description: 'Group buy unlocked' });
      load();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const share = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Join my group buy on Cellex and get ${(gb?.discount_pct || 20)}% off ${gb?.product?.name || ''}!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  };

  if (loading) { return <PageSkeleton variant="group-buy" />; }

  if (!gb) {
    return (
      <div className="ig-container bg-white min-h-screen">
        <div className="ig-topbar">
          <button onClick={() => router.push('/categories')} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Group Buy</h1>
        </div>
        <div className="text-center py-20 px-4">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-base font-semibold mb-1">
            {groupBuyId ? 'Group buy not found' : 'No group buy selected'}
          </h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-xs mx-auto">
            {groupBuyId
              ? 'This group buy may have ended or been cancelled.'
              : 'Browse products and look for group buy badges to join bulk discounts.'}
          </p>
          <Link href="/categories" className="inline-block bg-black text-white text-sm font-semibold px-6 py-3 rounded-md">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const isComplete = gb.status === 'completed';
  const progress = ((gb.current_count || 0) / (gb.target_count || 1)) * 100;
  const discountedPrice = (gb.product?.price || 0) * (1 - (gb.discount_pct || 20) / 100);

  return (
    <div className="ig-container bg-white min-h-screen pb-24">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.push(`/product?id=${gb.product_id}`)} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Group Buy</h1>
        {isComplete && (
          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" /> UNLOCKED
          </span>
        )}
      </div>

      {/* Hero */}
      <div className="bg-black text-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5" />
          <h2 className="font-semibold">Group Buy</h2>
        </div>
        <p className="text-sm opacity-90">Get {gb.discount_pct}% off when {gb.target_count} people join</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Product preview */}
        {gb.product && (
          <div className="border border-neutral-200 rounded-md p-3 flex gap-3">
            <Link href={`/product?id=${gb.product_id}`}>
              <div className="w-20 h-20 rounded-md bg-neutral-50 overflow-hidden">
                {gb.product.image_url && (
                  <img src={gb.product.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/product?id=${gb.product_id}`}>
                <h3 className="font-semibold text-sm hover:opacity-70 line-clamp-2">{gb.product.name}</h3>
              </Link>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-black font-bold">{formatPrice(discountedPrice)}</span>
                <span className="text-xs text-neutral-400 line-through">{formatPrice(gb.product.price)}</span>
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">-{gb.discount_pct}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="border border-neutral-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              {gb.current_count || 0} / {gb.target_count} joined
            </span>
            <span className="text-xs text-neutral-500">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="text-xs text-neutral-500 mt-2">
            {isComplete
              ? `Target reached. Everyone gets ${gb.discount_pct}% off.`
              : `${(gb.target_count || 0) - (gb.current_count || 0)} more needed to unlock discount`}
          </div>
        </div>

        {/* Member avatars */}
        {gb.members && gb.members.length > 0 && (
          <div className="border border-neutral-200 rounded-md p-3">
            <div className="text-xs text-neutral-500 mb-2">Members</div>
            <div className="flex flex-wrap gap-2">
              {gb.members.slice(0, 10).map((m: any, i: number) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold"
                  title={m.user_id}
                >
                  {i === 0 ? <Users className="w-3 h-3" /> : (i + 1).toString()}
                </div>
              ))}
              {gb.members.length > 10 && (
                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                  +{gb.members.length - 10}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isComplete ? (
          <div className="space-y-2">
            <button
              onClick={join}
              disabled={joining}
              className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join group buy'}
            </button>
            <button onClick={share} className="w-full bg-white border border-neutral-300 text-black font-semibold rounded-md py-3 hover:bg-neutral-50">
              <Share2 className="w-4 h-4 inline mr-1" /> Share to WhatsApp
            </button>
          </div>
        ) : (
          <Link href={`/product?id=${gb.product_id}`}>
            <button className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800">
              Buy now at {formatPrice(discountedPrice)}
            </button>
          </Link>
        )}

        {/* How it works */}
        <div className="border border-neutral-200 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3">How group buys work</h3>
          <ol className="space-y-2 text-xs text-neutral-600">
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-black font-bold flex items-center justify-center shrink-0">1</span>
              <span>Join the group buy or share with friends on WhatsApp</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-black font-bold flex items-center justify-center shrink-0">2</span>
              <span>When {gb.target_count} people join, everyone unlocks the discount</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-black font-bold flex items-center justify-center shrink-0">3</span>
              <span>Each person buys individually at the discounted price</span>
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
