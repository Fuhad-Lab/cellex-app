'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Share2, Store, Check, Clock, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

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
    if (!groupBuyId) return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!gb) {
    return (
      <div className="text-center py-20">
        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">Group buy not found</p>
        <Link href="/" className="text-primary font-bold mt-3 inline-block">Back to home</Link>
      </div>
    );
  }

  const isComplete = gb.status === 'completed';
  const progress = ((gb.current_count || 0) / (gb.target_count || 1)) * 100;
  const discountedPrice = (gb.product?.price || 0) * (1 - (gb.discount_pct || 20) / 100);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <Link href={`/product?id=${gb.product_id}`} className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to product
      </Link>

      <div className="brand-gradient rounded-2xl p-5 text-primary-foreground mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5" />
          <h1 className="text-lg font-extrabold">Group Buy</h1>
          {isComplete && (
            <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> UNLOCKED
            </span>
          )}
        </div>
        <p className="text-sm opacity-90">Get {gb.discount_pct}% off when {gb.target_count} people join</p>
      </div>

      {/* Product preview */}
      {gb.product && (
        <Card className="p-3 border-slate-100 mb-4 flex gap-3">
          <Link href={`/product?id=${gb.product_id}`}>
            <div className="w-20 h-20 rounded-xl bg-slate-50 overflow-hidden">
              {gb.product.image_url && (
                <img src={gb.product.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/product?id=${gb.product_id}`}>
              <h3 className="font-bold text-sm hover:text-primary line-clamp-2">{gb.product.name}</h3>
            </Link>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-primary font-extrabold">{formatPrice(discountedPrice)}</span>
              <span className="text-xs text-slate-400 line-through">{formatPrice(gb.product.price)}</span>
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">-{gb.discount_pct}%</span>
            </div>
          </div>
        </Card>
      )}

      {/* Progress */}
      <Card className="p-4 border-slate-100 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">
            {gb.current_count || 0} / {gb.target_count} joined
          </span>
          <span className="text-xs text-slate-500">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full brand-gradient transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 mt-2">
          {isComplete
            ? `🎉 Target reached! Everyone gets ${gb.discount_pct}% off.`
            : `${(gb.target_count || 0) - (gb.current_count || 0)} more needed to unlock discount`}
        </div>
      </Card>

      {/* Member avatars */}
      {gb.members && gb.members.length > 0 && (
        <Card className="p-3 border-slate-100 mb-4">
          <div className="text-xs text-slate-500 mb-2">Members</div>
          <div className="flex flex-wrap gap-2">
            {gb.members.slice(0, 10).map((m: any, i: number) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold"
                title={m.user_id}
              >
                {i === 0 ? '👑' : (i + 1).toString()}
              </div>
            ))}
            {gb.members.length > 10 && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                +{gb.members.length - 10}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Actions */}
      {!isComplete ? (
        <div className="space-y-2">
          <Button
            onClick={join}
            disabled={joining}
            className="w-full brand-gradient text-primary-foreground font-bold"
          >
            {joining ? 'Joining...' : 'Join group buy'}
          </Button>
          <Button onClick={share} variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50">
            <Share2 className="w-4 h-4 mr-1" /> Share to WhatsApp
          </Button>
        </div>
      ) : (
        <Link href={`/product?id=${gb.product_id}`}>
          <Button className="w-full brand-gradient text-primary-foreground font-bold">
            Buy now at {formatPrice(discountedPrice)}
          </Button>
        </Link>
      )}

      {/* How it works */}
      <Card className="p-4 border-slate-100 mt-6">
        <h3 className="font-bold text-sm mb-3">How group buys work</h3>
        <ol className="space-y-2 text-xs text-slate-600">
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">1</span>
            <span>Join the group buy or share with friends on WhatsApp</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">2</span>
            <span>When {gb.target_count} people join, everyone unlocks the discount</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">3</span>
            <span>Each person buys individually at the discounted price</span>
          </li>
        </ol>
      </Card>
    </div>
  );
}

export default function GroupBuyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <GroupBuyContent />
    </Suspense>
  );
}

