'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ChevronRight, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/product-card';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_payment_sent: 'bg-blue-100 text-blue-700',
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="No orders yet"
          message="When you place your first order, it will appear here."
          action={
            <Link href="/categories">
              <Button className="brand-gradient text-primary-foreground font-bold">Start shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <h1 className="text-xl font-bold mb-4">My Orders</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const isExpanded = expanded === order.id;
          const status = (order.status || 'pending').toLowerCase();
          const statusColor = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700';
          const isPendingPayment = status === 'pending' || status === 'pending_payment_sent' || status === 'confirmed';

          return (
            <Card key={order.id} className="border-slate-100 overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : order.id)}
                className="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-50/50"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">#{order.id?.slice(0, 8)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColor}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {order.item_count || 0} item(s) · {formatPrice(order.total)} · {timeAgo(order.created_at)}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3">
                  {/* Items */}
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-2">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex gap-3 items-center">
                          <div className="w-12 h-12 rounded-lg bg-slate-50 overflow-hidden shrink-0">
                            {item.products?.image_url ? (
                              <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Store className="w-4 h-4 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/product?id=${item.product_id}`} className="text-sm font-medium hover:text-primary line-clamp-1">
                              {item.product_name || item.products?.name}
                            </Link>
                            <div className="text-xs text-slate-500">
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
                    <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                      <div className="font-bold mb-1">Shipping to:</div>
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
                      <Button className="w-full brand-gradient text-primary-foreground font-bold">
                        Complete payment
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
