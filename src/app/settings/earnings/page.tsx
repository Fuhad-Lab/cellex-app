'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Wallet, Clock, CheckCircle, TrendingUp, ArrowDownToLine, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { API_BASE } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MagneticButton, RevealOnScroll } from '@/components/animation-provider';

import { useScrollPreservation } from '@/components/global-state-provider';
function formatNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

export default function EarningsPage() {
  useScrollPreservation('settings-earnings');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/settings/earnings');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadEarnings();
  }, [user]);

  const loadEarnings = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get_earnings' }),
      });
      const result = await resp.json();
      if (result.success) setData(result);
    } catch {}
    setLoading(false);
  };

  const handlePayout = async () => {
    setRequesting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'request_payout' }),
      });
      const result = await resp.json();
      if (result.success) {
        toast({ title: 'Payout initiated!', description: result.message });
        loadEarnings();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setRequesting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#111827]" />
      </div>
    );
  }

  const earnings = data?.earnings || {};
  const bankDetails = data?.bankDetails;
  const escrowRecords = data?.escrowRecords || [];
  const payouts = data?.payouts || [];

  return (
    <div className="min-h-screen bg-white  pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center gap-2">
        <button onClick={() => router.push('/settings')} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6]" aria-label="Back">
          <ChevronLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-base font-semibold text-[#111827]">Earnings & Payouts</h1>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Available balance */}
          <div className="p-4 rounded-2xl bg-[#111827] btn-ripple  text-white">
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet className="w-4 h-4 text-[#171717]" />
              <span className="text-[10px] font-semibold uppercase opacity-80">Available</span>
            </div>
            <p className="text-xl font-bold">{formatNaira(earnings.availableBalance || 0)}</p>
            <p className="text-[10px] opacity-60 mt-1">Ready for payout</p>
          </div>

          {/* In escrow */}
          <div className="p-4 rounded-2xl bg-[#F3F4F6]">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[10px] font-semibold uppercase text-[#6B7280]">In Escrow</span>
            </div>
            <p className="text-xl font-bold text-[#111827]">{formatNaira(earnings.heldBalance || 0)}</p>
            <p className="text-[10px] text-[#6B7280] mt-1">3-day hold</p>
          </div>
        </div>

        {/* Total earnings + paid out */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#16A34A]" />
              <span className="text-[10px] font-semibold text-[#15803D]">Total Earned</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{formatNaira(earnings.totalEarnings || 0)}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-[#6B7280]" />
              <span className="text-[10px] font-semibold text-[#6B7280]">Paid Out</span>
            </div>
            <p className="text-lg font-bold text-[#111827]">{formatNaira(earnings.paidOut || 0)}</p>
          </div>
        </div>

        {/* Bank details status */}
        {!bankDetails ? (
          <div className="p-4 rounded-xl bg-[#FEF3C7] border border-[#FCD34D] flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#92400E]" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#92400E]">No bank account added</p>
              <p className="text-[10px] text-[#92400E] opacity-80">Add your bank details to receive payouts</p>
            </div>
            <button onClick={() => router.push('/settings/bank-details')} className="text-xs font-bold text-[#92400E] underline">
              Add
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#6B7280]" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#111827]">{bankDetails.bank_name}</p>
              <p className="text-[10px] text-[#6B7280]">{bankDetails.account_number} · {bankDetails.account_name}</p>
            </div>
            {bankDetails.is_verified && <CheckCircle className="w-4 h-4 text-[#16A34A]" />}
          </div>
        )}

        {/* Request payout button */}
        <MagneticButton strength={0.15}>
        <button
          onClick={handlePayout}
          disabled={requesting || !bankDetails || (earnings.availableBalance || 0) < 100}
          className="w-full h-12 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {requesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing payout...
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-4 h-4" />
              Withdraw {formatNaira(earnings.availableBalance || 0)}
            </>
          )}
        </button>
        </MagneticButton>
        {(earnings.availableBalance || 0) < 100 && bankDetails && (
          <p className="text-[10px] text-[#9CA3AF] text-center">Minimum withdrawal is ₦100</p>
        )}

        {/* Recent escrow transactions */}
        {escrowRecords.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2 mt-4">Recent Transactions</h3>
            <div className="space-y-2">
              {escrowRecords.slice(0, 10).map((esc: any) => (
                <div key={esc.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{formatNaira(esc.seller_payout)}</p>
                    <p className="text-[10px] text-[#6B7280]">
                      {esc.status === 'held' && `In escrow — releases ${new Date(esc.release_at).toLocaleDateString()}`}
                      {esc.status === 'released' && 'Released — ready for payout'}
                      {esc.status === 'paid_out' && `Paid out ${timeAgo(esc.paid_out_at)}`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    esc.status === 'held' ? 'bg-[#FEF3C7] text-[#92400E]' :
                    esc.status === 'released' ? 'bg-[#DBEAFE] text-[#1E40AF]' :
                    'bg-[#D1FAE5] text-[#065F46]'
                  }`}>
                    {esc.status === 'held' ? 'Held' : esc.status === 'released' ? 'Available' : 'Paid'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payout history */}
        {payouts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2 mt-4">Payout History</h3>
            <div className="space-y-2">
              {payouts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{formatNaira(p.amount)}</p>
                    <p className="text-[10px] text-[#6B7280]">{timeAgo(p.created_at)} · {p.reference?.slice(0, 20)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    p.status === 'success' ? 'bg-[#D1FAE5] text-[#065F46]' :
                    p.status === 'pending' ? 'bg-[#FEF3C7] text-[#92400E]' :
                    'bg-[#FEE2E2] text-[#991B1B]'
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {escrowRecords.length === 0 && payouts.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
            <p className="text-sm font-medium text-[#6B7280]">No earnings yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1">When buyers pay for your products, earnings will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
