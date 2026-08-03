'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Store, MapPin, CreditCard, ChevronLeft, Check, Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';
import { MagneticButton, RevealOnScroll } from '@/components/animation-provider';

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/checkout');
      return;
    }
    if (user) {
      (async () => {
        const [cartResp, profileResp] = await Promise.all([
          api.cart.get(),
          api.profile.get(),
        ]);
        if (cartResp.success) {
          setItems(cartResp.items || []);
          if ((cartResp.items || []).length === 0) {
            router.push('/cart');
            return;
          }
        }
        if (profileResp.success && profileResp.profile) {
          setFullName(profileResp.profile.full_name || '');
          setPhone(profileResp.profile.phone || '');
          setAddress(profileResp.profile.address || '');
        }
        setLoading(false);
      })();
    }
  }, [user, authLoading, router]);

  // Prices calculated CLIENT-SIDE for display only.
  // The SERVER recalculates everything — never trusts these values.
  const subtotal = items.reduce((sum, i) => sum + (i.products?.price || 0) * i.quantity, 0);
  const shipping = subtotal > 50000 ? 0 : 1500;
  const total = subtotal + shipping;

  const placeOrder = async () => {
    if (!fullName || !phone || !address) {
      toast({ title: 'Missing info', description: 'Please fill name, phone, and address', variant: 'destructive' });
      return;
    }
    setPlacing(true);

    try {
      // Save profile
      api.profile.update({ fullName, phone, address }).catch(() => {});

      // Step 1: Create order via checkout API (server calculates total)
      const checkoutResp = await api.checkout.placeOrder({
        name: fullName,
        phone,
        address,
        city,
        state,
      });

      if (!checkoutResp.success || !checkoutResp.order) {
        toast({ title: 'Error', description: checkoutResp.error || 'Failed to create order', variant: 'destructive' });
        setPlacing(false);
        return;
      }

      const orderId = checkoutResp.order.id || checkoutResp.orderId;

      // Step 2: Initialize Paystack payment via Edge Function
      const paymentResp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'initialize',
          orderId,
          email: user?.email,
        }),
      });
      const paymentData = await paymentResp.json();

      if (paymentData.success && paymentData.authorizationUrl) {
        // Redirect to Paystack checkout
        toast({ title: 'Order placed!', description: 'Redirecting to secure payment...' });
        window.location.href = paymentData.authorizationUrl;
      } else {
        // Payment init failed — order is created but unpaid
        toast({ title: 'Payment setup failed', description: paymentData.error || 'Please try again', variant: 'destructive' });
        router.push('/orders');
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
    setPlacing(false);
  };

  if (authLoading || loading) {
    return <PageSkeleton variant="checkout" />;
  }

  const inputClass = "w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#111827] focus:bg-white transition";
  const labelClass = "text-xs font-semibold text-[#6B7280]";

  return (
    <div className="min-h-screen bg-white page-fade-in pb-32" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 h-14 flex items-center gap-2">
        <button onClick={() => router.push('/cart')} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6]" aria-label="Back">
          <ChevronLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-base font-semibold text-[#111827]">Checkout</h1>
      </div>

      <div className="px-4 py-4 space-y-6 max-w-md mx-auto">
        {/* Shipping Address */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#111827]" />
            <h3 className="font-semibold text-sm text-[#111827]">Shipping Address</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Full name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Phone *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>State</label>
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Lagos" className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Street address *</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House number, street, area" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Delivery notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Landmark, delivery time preference..." className={inputClass} />
            </div>
          </div>
        </section>

        {/* Payment method — Paystack */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-[#111827]" />
            <h3 className="font-semibold text-sm text-[#111827]">Payment Method</h3>
          </div>
          <div className="border border-[#E5E7EB] card-premium  rounded-xl p-4 flex items-center gap-3 bg-[#F9FAFB]">
            <div className="w-10 h-10 rounded-lg bg-[#111827] btn-ripple  flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-[#111827]">Paystack Secure Payment</div>
              <div className="text-xs text-[#6B7280]">Card, bank transfer, USSD — secured by Paystack</div>
            </div>
            <div className="w-5 h-5 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
        </section>

        {/* Order summary */}
        <section>
          <h3 className="font-semibold text-sm text-[#111827] mb-3">Order Summary</h3>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] overflow-hidden shrink-0">
                  {item.products?.image_url ? (
                    <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#111827] truncate">{item.products?.name}</div>
                  <div className="text-[10px] text-[#6B7280]">Qty {item.quantity} · {formatPrice(item.products?.price || 0)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm border-t border-[#E5E7EB] pt-3">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Subtotal</span>
              <span className="text-[#111827]">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Shipping</span>
              <span className="text-[#111827]">{shipping === 0 ? <span className="text-[#16A34A]">FREE</span> : formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-[#E5E7EB]">
              <span className="text-[#111827]">Total</span>
              <span className="text-[#111827] text-lg">{formatPrice(total)}</span>
            </div>
          </div>
        </section>

        {/* Security note */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD]">
          <Shield className="w-4 h-4 shrink-0 text-[#0284C7]" />
          <p className="text-xs text-[#0C4A6E]">
            Your payment is processed securely by Paystack. We never see or store your card details. Funds are held in escrow for 3 days before being released to the seller.
          </p>
        </div>
      </div>

      {/* Sticky bottom place order bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 z-40">
        <div className="max-w-md mx-auto">
          <MagneticButton strength={0.15}>
          <button
            onClick={placeOrder}
            disabled={placing}
            className="w-full bg-[#111827] btn-ripple  text-white font-semibold rounded-xl py-3.5 hover:bg-[#374151] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {placing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>Pay {formatPrice(total)}</>
            )}
          </button>
          </MagneticButton>
        </div>
      </div>
    </div>
  );
}
