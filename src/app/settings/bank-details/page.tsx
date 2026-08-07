'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Building2, Check, Loader2, AlertCircle, Banknote } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { API_BASE } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MagneticButton } from '@/components/animation-provider';

import { useScrollPreservation } from '@/components/global-state-provider';
export default function BankDetailsPage() {
  useScrollPreservation('settings-bank-details');

  const { user, loading: authLoading, isSeller } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [existingDetails, setExistingDetails] = useState<any>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/settings/bank-details');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadBanks();
      loadExistingDetails();
    }
  }, [user]);

  const loadBanks = async () => {
    try {
      // Frontend talks to Edge Function → NestJS → Paystack (server-side only)
      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get_banks' }),
      });
      const data = await resp.json();
      if (data.success) setBanks(data.banks || []);
    } catch {}
    setLoadingBanks(false);
  };

  const loadExistingDetails = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'get_bank_details' }),
      });
      const data = await resp.json();
      if (data.success && data.bankDetails) {
        setExistingDetails(data.bankDetails);
        setAccountName(data.bankDetails.account_name || '');
        setAccountNumber(data.bankDetails.account_number || '');
        setSelectedBank(data.bankDetails.bank_code || '');
        setVerified(data.bankDetails.is_verified || false);
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!accountName || !accountNumber || !selectedBank) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const bank = banks.find(b => b.code === selectedBank);
      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'save_bank_details',
          accountName, accountNumber, bankCode: selectedBank,
          bankName: bank?.name || '',
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setExistingDetails(data.bankDetails);
        setVerified(data.verified);
        if (data.verified) {
          toast({
            title: 'Bank details verified!',
            description: 'Your account is ready for payouts.',
          });
        } else if (data.verifyError) {
          toast({
            title: 'Bank details saved (verification failed)',
            description: `Saved, but Paystack could not verify: ${data.verifyError}. Payouts may be delayed.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Bank details saved',
            description: 'We could not verify your account automatically. Payouts may be delayed.',
          });
        }
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-white  pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center gap-2">
        <button onClick={() => router.push('/settings', { scroll: false })} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6]" aria-label="Back">
          <ChevronLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-base font-semibold text-[#111827]">Bank Details</h1>
      </div>

      <div className="p-4 space-y-5 max-w-md mx-auto">
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD]">
          <Banknote className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
          <p className="text-xs text-[#0C4A6E]">
            Add your bank account to receive payouts. After a buyer pays, funds are held in escrow for 3 days, then sent to your account automatically.
          </p>
        </div>

        {/* Existing details badge */}
        {existingDetails && verified && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
            <Check className="w-4 h-4 text-[#16A34A]" />
            <span className="text-xs font-semibold text-[#15803D]">Bank account verified and ready for payouts</span>
          </div>
        )}

        {/* Bank selector */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-[#6B7280]">BANK</label>
          {loadingBanks ? (
            <div className="flex items-center gap-2 p-3 bg-[#F9FAFB] rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
              <span className="text-xs text-[#6B7280]">Loading banks...</span>
            </div>
          ) : (
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] card-premium  rounded-xl p-3 text-sm text-[#111827] outline-none focus:border-[#111827]"
            >
              <option value="">Select your bank...</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Account number */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-[#6B7280]">ACCOUNT NUMBER</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit account number"
            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] card-premium  rounded-xl p-3 text-sm text-[#111827] outline-none focus:border-[#111827]"
            maxLength={10}
          />
        </div>

        {/* Account name */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block text-[#6B7280]">ACCOUNT NAME</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Name on the bank account"
            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] card-premium  rounded-xl p-3 text-sm text-[#111827] outline-none focus:border-[#111827]"
          />
        </div>

        {/* Save button */}
        <MagneticButton strength={0.15}>
        <button
          onClick={handleSave}
          disabled={saving || !accountName || !accountNumber || !selectedBank}
          className="w-full h-12 rounded-xl bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying with Paystack...
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4" />
              {existingDetails ? 'Update Bank Details' : 'Save & Verify'}
            </>
          )}
        </button>
        </MagneticButton>

        {existingDetails && (
          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase mb-1">Current Details</p>
            <p className="text-sm text-[#111827]">{existingDetails.bank_name}</p>
            <p className="text-xs text-[#6B7280]">{existingDetails.account_number} · {existingDetails.account_name}</p>
            {existingDetails.is_verified && (
              <p className="text-[10px] text-[#16A34A] mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Verified
              </p>
            )}
          </div>
        )}

        {/* Security note */}
        <p className="text-[10px] text-[#9CA3AF] text-center">
          Your bank details are verified securely via Paystack and stored encrypted. We never expose your account information to other users.
        </p>
      </div>
    </div>
  );
}
