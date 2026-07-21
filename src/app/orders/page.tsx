'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Package, ChevronRight, ChevronLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-white/5 text-slate-300',
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-white/5 text-slate-300',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_payment_sent: 'bg-white/5 text-slate-300',
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/orders');
      return;
    }
    if (user) {
      (async () => {
        const result = await api.orders.list();
        if (result.success) setOrders(result.orders || []);
        setLoading(false);
      })();
    }
  }, [user, authLoading, router]);

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
                <button className="bg-indigo-600 text-white font-semibold rounded-md px-4 py-2.5 hover:bg-white/10">
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
          const statusStyle = STATUS_STYLES[status] || 'bg-white/5 text-slate-300';
          const isPendingPayment = status === 'pending' || status === 'pending_payment_sent' || status === 'confirmed';

          return (
            <div key={order.id}>
              <button
                onClick={() => setExpanded(isExpanded ? null : order.id)}
                className="w-full p-4 text-left flex items-center gap-3 hover:bg-white/5"
              >
                <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">#{order.id?.slice(0, 8)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusStyle}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {order.item_count || 0} item(s) · {formatPrice(order.total)} · {timeAgo(order.created_at)}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Items */}
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-2">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-center">
                          <div className="w-12 h-12 rounded-md bg-white/5 overflow-hidden shrink-0">
                            {item.products?.image_url ? (
                              <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Store className="w-4 h-4 text-slate-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/product?id=${item.product_id}`} className="text-sm font-medium hover:opacity-70 line-clamp-1">
                              {item.product_name || item.products?.name}
                            </Link>
                            <div className="text-xs text-slate-400">
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
                    <div className="bg-white/5 rounded-md p-3 text-xs text-slate-300">
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
                    <Link href={`/payment?order=${order.id}`}>
                      <button className="w-full bg-indigo-600 text-white font-semibold rounded-md py-2.5 hover:bg-white/10">
                        Complete payment
                      </button>
                    </Link>
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
