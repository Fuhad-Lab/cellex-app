'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { ShoppingCart, Trash2, Minus, Plus, Store, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
export default function CartPage() {
  const { user, loading: authLoading, refreshCartCount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await api.cart.get();
    if (result.success) setItems(result.items || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/cart');
      return;
    }
    if (user) load();
  }, [user, authLoading, router]);

  const updateQty = async (itemId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setUpdating(itemId);
    const result = await api.cart.update(itemId, newQty);
    setUpdating(null);
    if (result.success) {
      load();
      refreshCartCount();
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    const result = await api.cart.remove(itemId);
    setUpdating(null);
    if (result.success) {
      toast({ title: 'Removed from cart' });
      load();
      refreshCartCount();
    }
  };

  const clearCart = async () => {
    if (!confirm('Clear all items from cart?')) return;
    await api.cart.clear();
    setItems([]);
    refreshCartCount();
    toast({ title: 'Cart cleared' });
  };

  const subtotal = items.reduce((sum, i) => sum + (i.products?.price || 0) * i.quantity, 0);
  const shipping = subtotal > 0 ? (subtotal > 50000 ? 0 : 1500) : 0;
  const total = subtotal + shipping;

  if (authLoading || loading) {
    return (
      <PageSkeleton variant="cart" />
    );
  }

  if (items.length === 0) {
    return (
      <div className="ig-container bg-white min-h-screen">
        <div className="ig-topbar">
          <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Cart</h1>
        </div>
        <div className="px-4 py-10">
          <EmptyState
            icon={<ShoppingCart className="w-8 h-8" />}
            title="Your cart is empty"
            message="Browse our marketplace and find great deals from local Nigerian sellers."
            action={
              <Link href="/categories">
                <button className="bg-black text-white font-semibold rounded-md px-4 py-2.5 hover:bg-neutral-800">
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
    <div className="ig-container bg-white min-h-screen pb-32">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Cart ({items.length})</h1>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-[#ed4956] hover:underline px-3"
          aria-label="Clear cart"
        >
          Clear all
        </button>
      </div>

      {/* Items list — single column on mobile */}
      <div className="divide-y divide-neutral-100">
        {items.map((item) => (
          <div key={item.id} className="p-4 flex gap-3">
            <Link href={`/product?id=${item.product_id}`} className="shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-neutral-50">
                {item.products?.image_url ? (
                  <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300">
                    <Store className="w-8 h-8" />
                  </div>
                )}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/product?id=${item.product_id}`}>
                <h3 className="font-semibold text-sm text-black line-clamp-2 hover:opacity-70">
                  {item.products?.name || 'Product'}
                </h3>
              </Link>
              <div className="text-xs text-neutral-500 mt-0.5">{item.products?.category}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-black font-bold">{formatPrice(item.products?.price || 0)}</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-neutral-200 rounded-md">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      disabled={updating === item.id}
                      className="px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-1 text-xs font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      disabled={updating === item.id}
                      className="px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={updating === item.id}
                    className="text-neutral-400 hover:text-[#ed4956] p-1"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3">
        <Link
          href="/categories"
          className="block text-center text-sm font-semibold text-black border border-neutral-300 rounded-md py-2.5 hover:bg-neutral-50"
        >
          Continue shopping
        </Link>
      </div>

      {/* Sticky bottom bar with checkout */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[470px] bg-white border-t border-neutral-200 p-4 z-40">
        <div className="space-y-1 text-sm mb-3">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal</span>
            <span className="font-semibold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Shipping</span>
            <span className="font-semibold">
              {shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-neutral-100">
            <span className="font-bold">Total</span>
            <span className="font-extrabold text-black text-lg">{formatPrice(total)}</span>
          </div>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800"
        >
          Proceed to checkout
        </button>
        <div className="mt-2 text-center text-[10px] text-neutral-400">
          Secure payment via PalmPay bank transfer
        </div>
      </div>
    </div>
  );
}
