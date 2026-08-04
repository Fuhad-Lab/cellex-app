'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice, timeAgo, API_BASE } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Package, ChevronRight, ChevronLeft, Store, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
import { useToast } from '@/hooks/use-toast';

import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-[#F5F5F5] text-[#666666]',
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function OrdersContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [orders, setOrders] = usePersistedState<any[]>('orders:data', []);
  const [loading, setLoading] = useState(orders.length === 0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/orders');
      return;
    }
    if (user) {
      (async () => {
        // Check for Paystack payment callback
        const paymentRef = searchParams.get('payment_ref');
        if (paymentRef) {
          await verifyPayment(paymentRef);
        }

        const result = await api.orders.list();
        if (result.success) setOrders(result.orders || []);
        setLoading(false);
      })();
    }
  }, [user, authLoading, router, searchParams]);

  const verifyPayment = async (reference: string) => {
    setVerifyingPayment(true);
    try {
      // Extract order ID from the reference (format: CELLEX_<orderId>_<timestamp>)
      const match = reference.match(/CELLEX_(.+?)_\d+$/);
      const orderId = match ? match[1] : '';

      const resp = await fetch(`${API_BASE}/api/payment`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'verify', reference, orderId }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Payment verified!', description: data.message || 'Your order has been confirmed.' });
      } else {
        toast({ title: 'Payment verification failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Verification error', variant: 'destructive' });
    }
    setVerifyingPayment(false);
    // Clean the URL
    router.replace('/orders');
  };

  if (authLoading || loading) {
    return (
      <PageSkeleton variant="orders" />
    );
  }

  if (orders.length === 0) {
    return (
      <div className="ig-container min-h-screen ig-topbar-offset">
        <div className="fx-topbar ig-topbar">
          <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">My Orders</h1>
        </div>
        <div className="px-4 py-10">
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title="No orders yet"
            message="When you place your first order, it will appear here."
            action={
              <Link href="/categories">
                <button className="bg-[#171717] text-black font-semibold rounded-md px-4 py-2.5 hover:bg-[#F5F5F5]">
                  Start shopping
                </button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ig-container min-h-screen">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">My Orders</h1>
      </div>

      <div className="divide-y divide-white/5">
        {orders.map((order) => {
          const isExpanded = expanded === order.id;
          const status = (order.status || 'pending').toLowerCase();
          const statusStyle = STATUS_STYLES[status] || 'bg-[#F5F5F5] text-[#666666]';
          const isPendingPayment = status === 'pending' || status === 'pending_payment_sent' || status === 'confirmed';

          return (
            <div key={order.id}>
              <button
                onClick={() => setExpanded(isExpanded ? null : order.id)}
                className="w-full p-4 text-left flex items-center gap-3 hover:bg-[#F5F5F5]"
              >
                <div className="w-10 h-10 rounded-md bg-[#F5F5F5] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-[#666666]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">#{order.id?.slice(0, 8)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusStyle}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-[#666666] mt-0.5">
                    {order.item_count || 0} item(s) · {formatPrice(order.total)} · {timeAgo(order.created_at)}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-[#666666] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Items */}
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-2">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-center">
                          <div className="w-12 h-12 rounded-md bg-[#F5F5F5] overflow-hidden shrink-0">
                            {item.products?.image_url ? (
                              <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Store className="w-4 h-4 text-[#666666]" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/product?id=${item.product_id}`} className="text-sm font-medium hover:opacity-70 line-clamp-1">
                              {item.product_name || item.products?.name}
                            </Link>
                            <div className="text-xs text-[#666666]">
                              Qty {item.quantity} × {formatPrice(item.price)}
                            </div>
                          </div>
                          <div className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shipping */}
                  {order.shipping_address && (
                    <div className="bg-[#F5F5F5] rounded-md p-3 text-xs text-[#666666]">
                      <div className="font-semibold mb-1">Shipping to:</div>
                      <div>
                        {typeof order.shipping_address === 'string'
                          ? order.shipping_address
                          : `${order.shipping_address.full_name || ''} ${order.shipping_address.address || ''} ${order.shipping_address.city || ''} ${order.shipping_address.state || ''}`.trim()}
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  {isPendingPayment && (
                    <button
                      onClick={async () => {
                        const resp = await fetch(`${API_BASE}/api/payment`, {
                          credentials: 'include',
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ op: 'initialize', orderId: order.id, email: user?.email }),
                        });
                        const data = await resp.json();
                        if (data.success && data.authorizationUrl) {
                          window.location.href = data.authorizationUrl;
                        } else {
                          toast({ title: 'Payment failed', description: data.error, variant: 'destructive' });
                        }
                      }}
                      className="w-full bg-[#111827] btn-ripple  text-white font-semibold rounded-xl py-2.5 hover:bg-[#374151] transition"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  useScrollPreservation('orders');

  return (
    <Suspense fallback={<PageSkeleton variant="orders" />}>
      <OrdersContent />
    </Suspense>
  );
}
