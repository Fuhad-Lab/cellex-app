'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { ShoppingBag, Package } from 'lucide-react';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
import { useScrollPreservation } from '@/components/global-state-provider';
export default function SellerOrdersPage() {
  useScrollPreservation('seller-orders');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await api.sellerOrders.list();
      if (result.success) setOrders(result.orders || []);
      setLoading(false);
    })();
  }, []);

  if (loading) { return <PageSkeleton variant="seller-orders" />; }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8" />}
          title="No orders yet"
          message="Orders from buyers will appear here."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="border border-[#E5E5E5] rounded-md p-4 bg-[#F5F5F5]">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">#{o.id?.slice(0, 8)}</span>
                  <span className="text-[10px] font-medium bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">{o.status}</span>
                </div>
                <span className="text-xs text-[#666666]">{timeAgo(o.created_at)}</span>
              </div>
              <div className="space-y-1">
                {o.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[#666666]">{item.product_name} × {item.quantity}</span>
                    <span className="font-semibold">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E5E5E5]">
                <span className="text-xs text-[#666666]">Total</span>
                <span className="font-bold text-black">{formatPrice(o.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
