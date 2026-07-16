'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, Check, ShoppingBag, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

function GroupBuyJoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const inviteCode = params.get('code') || '';

  const [groupBuy, setGroupBuy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteCode) {
      setError('No invite code provided');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const resp = await fetch('/api/group-buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'invite', inviteCode }),
        });
        const data = await resp.json();
        if (data.success) {
          setGroupBuy(data.groupBuy);
        } else {
          setError(data.error || 'Invalid invite link');
        }
      } catch {
        setError('Failed to load group buy');
      }
      setLoading(false);
    })();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!user) {
      router.push(`/login?next=/group-buy-join?code=${inviteCode}`);
      return;
    }
    setJoining(true);
    try {
      const resp = await fetch('/api/group-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'join', inviteCode }),
      });
      const data = await resp.json();
      if (data.success) {
        setJoined(true);
        setGroupBuy(data.groupBuy);
      } else {
        setError(data.error || 'Failed to join');
      }
    } catch {
      setError('Network error');
    }
    setJoining(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !groupBuy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h2 className="text-lg font-bold mb-2">Group Buy Not Found</h2>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <Link href="/categories" className="inline-block bg-black text-white text-sm font-bold px-6 py-3 rounded-full">
            Browse Products
          </Link>
        </Card>
      </div>
    );
  }

  const discountPrice = groupBuy ? (groupBuy.price * (1 - groupBuy.discount_pct / 100)) : 0;
  const initiatorName = groupBuy?.initiator_email?.split('@')[0] || 'Someone';

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto p-4">
      {/* Header */}
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Group Buy Invitation</h1>
        <p className="text-sm text-slate-500">Join together, save together</p>
      </div>

      {/* Product card */}
      {groupBuy && (
        <Card className="overflow-hidden border-slate-200 mb-4">
          {groupBuy.image_url && (
            <img src={groupBuy.image_url} alt={groupBuy.product_name} className="w-full h-48 object-cover" />
          )}
          <div className="p-4">
            <h2 className="font-bold text-sm">{groupBuy.product_name}</h2>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-green-600">₦{discountPrice.toLocaleString()}</span>
              <span className="text-sm text-slate-400 line-through">₦{Number(groupBuy.price).toLocaleString()}</span>
              <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                {groupBuy.discount_pct}% OFF
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Invitation message */}
      <Card className="p-5 mb-4 border-slate-200">
        <p className="text-sm text-center leading-relaxed">
          <span className="font-bold">{initiatorName}</span> invites you to buy{' '}
          <span className="font-bold">{groupBuy?.product_name}</span> together at a{' '}
          <span className="font-bold text-green-600">{groupBuy?.discount_pct}% discount</span>.
        </p>

        {/* Progress */}
        {groupBuy && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{groupBuy.current_count} joined</span>
              <span>{groupBuy.target_count} needed</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min((groupBuy.current_count / groupBuy.target_count) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Action */}
      {joined ? (
        <Card className="p-6 text-center border-green-200 bg-green-50">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-bold text-lg mb-1">You're in! 🎉</h2>
          <p className="text-sm text-slate-600 mb-4">
            You've joined this group buy. A conversation has been created in your messenger for this group.
          </p>
          <div className="flex gap-2">
            <Link href="/messenger" className="flex-1">
              <Button className="w-full bg-black text-white">Open Messenger</Button>
            </Link>
            <Link href={`/product?id=${groupBuy?.product_id}`} className="flex-1">
              <Button variant="outline" className="w-full">View Product</Button>
            </Link>
          </div>
        </Card>
      ) : !user && !authLoading ? (
        <Card className="p-6 text-center border-amber-200 bg-amber-50">
          <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h2 className="font-bold mb-1">Login Required</h2>
          <p className="text-sm text-slate-600 mb-4">
            You need to be logged in to join a group buy. Please sign up or login to continue.
          </p>
          <div className="flex gap-2">
            <Link href={`/login?next=/group-buy-join?code=${inviteCode}`} className="flex-1">
              <Button className="w-full bg-black text-white">Login</Button>
            </Link>
            <Link href={`/login?next=/group-buy-join?code=${inviteCode}&mode=signup`} className="flex-1">
              <Button variant="outline" className="w-full">Sign Up</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Button
          onClick={handleJoin}
          disabled={joining || groupBuy?.status === 'completed'}
          className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold"
        >
          {joining ? 'Joining...' : groupBuy?.status === 'completed' ? 'Group Buy Complete' : 'Join Group Buy'}
        </Button>
      )}

      {/* How it works */}
      <div className="mt-6 space-y-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase">How it works</h3>
        {[
          { icon: Users, text: 'Join the group buy with the link' },
          { icon: ShoppingBag, text: 'Once enough people join, the discount unlocks' },
          { icon: Sparkles, text: 'A group chat is created for all members' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
              {item.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GroupBuyJoinPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-black rounded-full animate-spin" /></div>}>
      <GroupBuyJoinContent />
    </Suspense>
  );
}
