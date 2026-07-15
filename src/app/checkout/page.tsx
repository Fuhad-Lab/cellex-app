'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Store, MapPin, CreditCard, ChevronLeft } from 'lucide-react';
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

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <Link href="/cart" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to cart
      </Link>

      <h1 className="text-xl font-bold mb-4">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shipping form */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm">Shipping Address</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Full name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Lagos" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Your bank (for payment verification) *</Label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                <p className="text-[10px] text-slate-400">Used to match your PalmPay transfer email — must match the bank you transfer from.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Street address *</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="House number, street, area" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Delivery notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Landmark, delivery time preference..." />
              </div>
            </div>
          </Card>

          {/* Payment method */}
          <Card className="p-4 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm">Payment Method</h3>
            </div>
            <div className="border-2 border-primary bg-primary/5 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">PalmPay Bank Transfer</div>
                <div className="text-xs text-slate-500">Pay via bank transfer — auto-verified within 30 seconds</div>
              </div>
              <input type="radio" checked readOnly className="accent-primary" />
            </div>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="p-4 border-slate-100 sticky top-20">
            <h3 className="font-bold text-sm mb-3">Order Summary</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden shrink-0">
                    {item.products?.image_url ? (
                      <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.products?.name}</div>
                    <div className="text-[10px] text-slate-500">Qty {item.quantity} · {formatPrice(item.products?.price || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping</span>
                <span>{shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-100">
                <span>Total</span>
                <span className="text-primary text-lg">{formatPrice(total)}</span>
              </div>
            </div>

            <Button
              onClick={placeOrder}
              disabled={placing}
              className="w-full mt-4 brand-gradient text-primary-foreground font-bold"
            >
              {placing ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>Place order · {formatPrice(total)}</>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
