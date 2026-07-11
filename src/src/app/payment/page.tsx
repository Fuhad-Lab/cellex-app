'use client';

import { useEffect, useState, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Copy, Check, Clock, Banknote, CheckCircle2, AlertCircle, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
        <p className="text-slate-600 mb-4">Order not found</p>
        <Link href="/cart" className="text-primary font-bold">Back to cart</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      <Link href="/cart" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to cart
      </Link>

      <h1 className="text-xl font-bold mb-4">Complete Payment</h1>

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
                  isActive || isDone ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`text-[10px] font-bold ${isActive || isDone ? 'text-primary' : 'text-slate-400'}`}>
                  {s.label}
                </div>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-primary' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step: Details - show bank info */}
      {(step === 'details' || step === 'sent' || step === 'verifying') && (
        <Card className="p-5 border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Bank Transfer Details</h3>
          </div>

          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-3">
            <div>
              <div className="text-xs text-slate-500">Account number</div>
              <button
                onClick={() => copyText(PALMPAY_ACCOUNT, 'acct')}
                className="flex items-center gap-2 mt-0.5 group"
              >
                <span className="text-xl font-extrabold tracking-wider text-slate-900">{PALMPAY_ACCOUNT}</span>
                {copied === 'acct' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400 group-hover:text-primary" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Account name</div>
                <div className="text-sm font-semibold">{PALMPAY_NAME}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Bank</div>
                <div className="text-sm font-semibold">{PALMPAY_BANK}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Amount to transfer</span>
              <button
                onClick={() => copyText(String(order.total), 'amt')}
                className="flex items-center gap-1 font-bold text-primary"
              >
                {formatPrice(order.total)}
                {copied === 'amt' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Order reference</span>
              <span className="font-mono text-xs text-slate-500">#{order.id?.slice(0, 8)}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-xs text-amber-800">
            <strong>Important:</strong> Transfer exactly <strong>{formatPrice(order.total)}</strong> to the account above.
            Your payment will be auto-verified within 30 seconds of transfer.
          </div>

          {step === 'details' && (
            <Button onClick={confirmSent} className="w-full mt-4 brand-gradient text-primary-foreground font-bold">
              I've made the transfer
            </Button>
          )}

          {step === 'sent' && (
            <div className="mt-4 space-y-2">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-blue-700">
                  Verifying your payment... this usually takes 30 seconds
                </span>
              </div>
              <Button onClick={load} variant="outline" className="w-full text-xs">
                Check status manually
              </Button>
            </div>
          )}

          {step === 'verifying' && (
            <div className="mt-4 flex items-center justify-center py-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500 ml-2">Confirming...</span>
            </div>
          )}
        </Card>
      )}

      {/* Step: Paid - success */}
      {step === 'paid' && (
        <Card className="p-6 border-green-200 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Payment confirmed!</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Thank you for your purchase. Your order has been placed successfully.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1.5 mb-4">
            <div className="flex justify-between"><span className="text-slate-500">Order ID</span><span className="font-mono">#{order.id?.slice(0, 8)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount paid</span><span className="font-bold text-primary">{formatPrice(order.total)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Items</span><span>{order.item_count} item(s)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-green-600 font-semibold">Confirmed</span></div>
          </div>

          <div className="flex gap-2">
            <Link href="/orders" className="flex-1">
              <Button className="w-full brand-gradient text-primary-foreground font-bold">View orders</Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">Continue shopping</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Step: Failed */}
      {step === 'failed' && (
        <Card className="p-6 border-red-200 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Payment failed</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            We couldn't verify your payment. Please try again or contact support.
          </p>
          <Button onClick={() => setStep('details')} className="brand-gradient text-primary-foreground font-bold">
            Try again
          </Button>
        </Card>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <PaymentContent />
    </Suspense>
  );
}

