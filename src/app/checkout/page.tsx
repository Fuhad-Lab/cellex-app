'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Store, MapPin, CreditCard, ChevronLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { PageSkeleton } from '@/components/page-skeleton';
export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [bankName, setBankName] = useState('');
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
          setProfile(profileResp.profile);
          setFullName(profileResp.profile.full_name || '');
          setPhone(profileResp.profile.phone || '');
          setAddress(profileResp.profile.address || '');
        }
        setLoading(false);
      })();
    }
  }, [user, authLoading, router]);

  const subtotal = items.reduce((sum, i) => sum + (i.products?.price || 0) * i.quantity, 0);
  const shipping = subtotal > 50000 ? 0 : 1500;
  const total = subtotal + shipping;

  const placeOrder = async () => {
    if (!fullName || !phone || !address || !bankName) {
      toast({ title: 'Missing info', description: 'Please fill name, phone, address, and bank', variant: 'destructive' });
      return;
    }
    setPlacing(true);

    // Save profile updates in parallel with order creation
    api.profile.update({ fullName, phone, address }).catch(() => {});

    // Build items summary for the payment order
    const itemsSummary = items
      .map((i) => `${i.products?.name || 'Item'} x${i.quantity}`)
      .join(', ');

    // Create a payment_order via the payment edge function (PalmPay flow)
    const result = await api.payment.createOrder({
      buyerName: fullName,
      buyerEmail: user?.email || '',
      buyerPhone: phone,
      buyerBankName: bankName || undefined,  // used for name + bank + amount matching
      itemsSummary,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      total,
    });
    setPlacing(false);

    if (result.success && result.orderId) {
      toast({ title: 'Order placed!', description: 'Redirecting to payment...' });
      router.push(`/payment?order=${result.orderId}`);
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to place order', variant: 'destructive' });
    }
  };

  if (authLoading || loading) {
    return (
      <PageSkeleton variant="checkout" />
    );
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm focus:bg-white/10 focus:border-white/10 outline-none";
  const labelClass = "text-xs font-semibold text-slate-300";

  return (
    <div className="ig-container min-h-screen pb-32 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.push('/cart')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Checkout</h1>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Shipping Address */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-white" />
            <h3 className="font-semibold text-sm">Shipping Address</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}>Full name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Phone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>State</label>
              <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Lagos" className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}>Your bank (for payment verification) *</label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select your bank</option>
                <option value="GTBank">GTBank</option>
                <option value="Access Bank">Access Bank</option>
                <option value="Zenith Bank">Zenith Bank</option>
                <option value="UBA">UBA</option>
                <option value="First Bank">First Bank</option>
                <option value="Kuda">Kuda Bank</option>
                <option value="Opay">Opay</option>
                <option value="PalmPay">PalmPay</option>
                <option value="Stanbic IBTC">Stanbic IBTC</option>
                <option value="Wema Bank">Wema Bank</option>
                <option value="Fidelity Bank">Fidelity Bank</option>
                <option value="Union Bank">Union Bank</option>
                <option value="Sterling Bank">Sterling Bank</option>
                <option value="Polaris Bank">Polaris Bank</option>
                <option value="EcoBank">EcoBank</option>
                <option value="FCMB">FCMB</option>
                <option value="Other">Other</option>
              </select>
              <p className="text-[10px] text-slate-500">Used to match your PalmPay transfer email — must match the bank you transfer from.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}>Street address *</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House number, street, area" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" className={inputClass} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={labelClass}>Delivery notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Landmark, delivery time preference..." className={inputClass} />
            </div>
          </div>
        </section>

        {/* Payment method */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-white" />
            <h3 className="font-semibold text-sm">Payment Method</h3>
          </div>
          <div className="border border-white/15 rounded-md p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">PalmPay Bank Transfer</div>
              <div className="text-xs text-slate-400">Pay via bank transfer — auto-verified within 30 seconds</div>
            </div>
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
        </section>

        {/* Order summary */}
        <section>
          <h3 className="font-semibold text-sm mb-3">Order Summary</h3>
          <div className="space-y-2 mb-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-md bg-white/5 overflow-hidden shrink-0">
                  {item.products?.image_url ? (
                    <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.products?.name}</div>
                  <div className="text-[10px] text-slate-400">Qty {item.quantity} · {formatPrice(item.products?.price || 0)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm border-t border-white/5 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shipping</span>
              <span>{shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-white/5">
              <span>Total</span>
              <span className="text-white text-lg">{formatPrice(total)}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky bottom place order bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[470px] bg-white/10 border-t border-white/10 p-4 z-40">
        <button
          onClick={placeOrder}
          disabled={placing}
          className="w-full bg-indigo-600 text-white font-semibold rounded-md py-3 hover:bg-white/10 disabled:opacity-50"
        >
          {placing ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
          ) : (
            <>Place order · {formatPrice(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
