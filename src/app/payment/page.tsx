'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Copy, Check, Clock, Banknote, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

const PALMPAY_ACCOUNT = '8088561764';
const PALMPAY_NAME = 'Abdlrazaq Bidemi Awofolaji';
const PALMPAY_BANK = 'PalmPay';

function PaymentContent() {
  const params = useSearchParams();
  const orderId = params.get('order') || '';
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'details' | 'sent' | 'verifying' | 'paid' | 'failed'>('details');
  const [copied, setCopied] = useState<string>('');
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    const result = await api.payment.checkStatus(orderId);
    setLoading(false);
    if (result.success && result.order) {
      setOrder(result.order);
      if (result.order.status === 'paid' || result.order.status === 'confirmed') {
        setStep('paid');
      } else if (result.order.status === 'sent' || result.order.status === 'pending_payment_sent') {
        setStep('sent');
      } else if (result.order.status === 'failed' || result.order.status === 'expired') {
        setStep('failed');
      }
    } else {
      toast({ title: 'Order not found', variant: 'destructive' });
    }
  }, [orderId, toast]);

  useEffect(() => { load(); }, [load]);

  // Auto-poll when in 'sent' or 'verifying' state
  useEffect(() => {
    if (step !== 'sent' && step !== 'verifying') {
      if (pollTimer) clearInterval(pollTimer);
      return;
    }
    const interval = setInterval(async () => {
      const result = await api.payment.checkStatus(orderId);
      if (result.success && result.order) {
        if (result.order.status === 'paid' || result.order.status === 'confirmed') {
          setOrder(result.order);
          setStep('paid');
          clearInterval(interval);
        }
      }
    }, 8000);
    setPollTimer(interval);
    return () => clearInterval(interval);
  }, [step, orderId]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const confirmSent = async () => {
    setStep('verifying');
    const result = await api.payment.confirmSent(orderId);
    if (result.success) {
      setStep('sent');
      toast({ title: 'Payment confirmation started', description: 'We will verify your transfer automatically.' });
    } else {
      setStep('details');
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  if (loading) { return <PageSkeleton variant="payment" />; }

  if (!order) {
    return (
      <div className="ig-container min-h-screen ig-topbar-offset">
        <div className="ig-topbar">
          <button onClick={() => router.push('/cart')} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Payment</h1>
        </div>
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-600 mb-4">Order not found</p>
          <Link href="/cart" className="text-black font-semibold">Back to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ig-container min-h-screen pb-24">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.push('/cart')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Complete Payment</h1>
      </div>

      <div className="px-4 py-4">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          {[
            { key: 'details', label: 'Transfer', icon: Banknote },
            { key: 'sent', label: 'Confirm', icon: Clock },
            { key: 'paid', label: 'Done', icon: CheckCircle2 },
          ].map((s, i) => {
            const isActive = step === s.key || (step === 'verifying' && s.key === 'sent') || (step === 'paid' && s.key === 'paid');
            const isDone = (step === 'sent' && s.key === 'details') || (step === 'verifying' && s.key === 'details') || (step === 'paid' && i < 2);
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    isActive || isDone ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className={`text-[10px] font-semibold ${isActive || isDone ? 'text-black' : 'text-neutral-400'}`}>
                    {s.label}
                  </div>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-black' : 'bg-neutral-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step: Details - show bank info */}
        {(step === 'details' || step === 'sent' || step === 'verifying') && (
          <div className="border border-neutral-200 rounded-md p-4">
            <h3 className="font-semibold text-sm mb-4">Bank Transfer Details</h3>

            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-4 space-y-3">
              <div>
                <div className="text-xs text-neutral-500">Account number</div>
                <button
                  onClick={() => copyText(PALMPAY_ACCOUNT, 'acct')}
                  className="flex items-center gap-2 mt-0.5 group"
                >
                  <span className="text-xl font-bold tracking-wider text-black">{PALMPAY_ACCOUNT}</span>
                  {copied === 'acct' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-neutral-400 group-hover:text-black" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-500">Account name</div>
                  <div className="text-sm font-semibold">{PALMPAY_NAME}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Bank</div>
                  <div className="text-sm font-semibold">{PALMPAY_BANK}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Amount to transfer</span>
                <button
                  onClick={() => copyText(String(order.total), 'amt')}
                  className="flex items-center gap-1 font-bold text-black"
                >
                  {formatPrice(order.total)}
                  {copied === 'amt' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Order reference</span>
                <span className="font-mono text-xs text-neutral-500">#{order.id?.slice(0, 8)}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-4 text-xs text-amber-800">
              Transfer exactly <strong>{formatPrice(order.total)}</strong> to the account above.
              Your payment will be auto-verified within 30 seconds of transfer.
            </div>

            {step === 'details' && (
              <button onClick={confirmSent} className="w-full mt-4 bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800">
                I&apos;ve made the transfer
              </button>
            )}

            {step === 'sent' && (
              <div className="mt-4 space-y-2">
                <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-neutral-700">
                    Verifying your payment — this usually takes 30 seconds
                  </span>
                </div>
                <button onClick={load} className="w-full bg-white border border-neutral-300 text-black text-xs font-semibold rounded-md py-2 hover:bg-neutral-50">
                  Check status manually
                </button>
              </div>
            )}

            {step === 'verifying' && (
              <div className="mt-4 flex items-center justify-center py-2">
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-neutral-500 ml-2">Confirming...</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Paid - success */}
        {step === 'paid' && (
          <div className="border border-neutral-200 rounded-md p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-black">Payment confirmed!</h2>
            <p className="text-sm text-neutral-500 mt-1 mb-4">
              Thank you for your purchase. Your order has been placed successfully.
            </p>

            <div className="bg-neutral-50 rounded-md p-4 text-left text-sm space-y-1.5 mb-4">
              <div className="flex justify-between"><span className="text-neutral-500">Order ID</span><span className="font-mono">#{order.id?.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Amount paid</span><span className="font-bold text-black">{formatPrice(order.total)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Items</span><span>{order.item_count} item(s)</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Status</span><span className="text-green-600 font-semibold">Confirmed</span></div>
            </div>

            <div className="flex gap-2">
              <Link href="/orders" className="flex-1">
                <button className="w-full bg-black text-white font-semibold rounded-md py-2.5">View orders</button>
              </Link>
              <Link href="/" className="flex-1">
                <button className="w-full bg-white border border-neutral-300 text-black font-semibold rounded-md py-2.5">Continue shopping</button>
              </Link>
            </div>
          </div>
        )}

        {/* Step: Failed */}
        {step === 'failed' && (
          <div className="border border-neutral-200 rounded-md p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-black">Payment failed</h2>
            <p className="text-sm text-neutral-500 mt-1 mb-4">
              We couldn&apos;t verify your payment. Please try again or contact support.
            </p>
            <button onClick={() => setStep('details')} className="bg-black text-white font-semibold rounded-md px-6 py-2.5 hover:bg-neutral-800">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="payment" />}>
      <PaymentContent />
    </Suspense>
  );
}

