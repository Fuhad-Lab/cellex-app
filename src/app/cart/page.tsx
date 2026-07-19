'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { ShoppingCart, Trash2, Minus, Plus, Store, ChevronLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
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
    if (result.success) { load(); refreshCartCount(); }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    const result = await api.cart.remove(itemId);
    setUpdating(null);
    if (result.success) { toast({ title: 'Removed from cart' }); load(); refreshCartCount(); }
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

  if (authLoading || loading) return <PageSkeleton variant="cart" />;

  if (items.length === 0) {
    return (
      <div className="ig-container bg-white min-h-screen ig-topbar-offset">
        <div className="ig-topbar">
          <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Cart</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <ShoppingCart className="w-10 h-10 text-neutral-300" />
          </div>
          <h2 className="text-lg font-bold mb-1">Your cart is empty</h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-xs">Browse our marketplace and find great deals from local Nigerian sellers.</p>
          <Link href="/categories" className="bg-black text-white font-semibold rounded-full px-6 py-3 text-sm hover:bg-neutral-800 transition-colors">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ig-container bg-white min-h-screen ig-topbar-offset pb-44">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Cart ({items.length})</h1>
        <button onClick={clearCart} className="text-xs font-semibold text-[#ed4956] hover:underline px-3" aria-label="Clear cart">
          Clear all
        </button>
      </div>

      {/* Cart items — each is a floating glass card */}
      <div className="px-3 pt-3 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="ig-card relative" style={{ borderRadius: '20px' }}>
            {/* Remove button — top right corner */}
            <button
              onClick={() => removeItem(item.id)}
              disabled={updating === item.id}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-[#ed4956] hover:text-white transition-colors z-10"
              aria-label="Remove item"
            >
              <Trash2 className="w-4 h-4 text-neutral-400" />
            </button>

            <div className="p-4 flex gap-3">
              {/* Product image */}
              <Link href={`/product?id=${item.product_id}`} className="shrink-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-50">
                  {item.products?.image_url ? (
                    <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      <Store className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Product details */}
              <div className="flex-1 min-w-0 pr-8">
                <Link href={`/product?id=${item.product_id}`}>
                  <h3 className="font-semibold text-sm text-black line-clamp-2 hover:opacity-70">
                    {item.products?.name || 'Product'}
                  </h3>
                </Link>
                {item.products?.category && (
                  <span className="inline-block text-[10px] text-neutral-500 mt-1">{item.products.category}</span>
                )}
                <div className="text-black font-bold text-base mt-1">{formatPrice(item.products?.price || 0)}</div>
              </div>
            </div>

            {/* Quantity selector — bottom of card */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateQty(item.id, -1)}
                  disabled={updating === item.id}
                  className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.id, 1)}
                  disabled={updating === item.id}
                  className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs text-neutral-500">
                Subtotal: <span className="font-semibold text-black">{formatPrice((item.products?.price || 0) * item.quantity)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Continue shopping */}
      <div className="px-3 py-4">
        <Link
          href="/categories"
          className="block text-center text-sm font-semibold text-black border border-neutral-200 rounded-full py-3 hover:bg-neutral-50 transition-colors"
        >
          Continue shopping
        </Link>
      </div>

      {/* Floating checkout summary — glass card above bottom nav */}
      <div
        className="glass fixed left-1/2 -translate-x-1/2 z-40"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
          width: 'calc(100% - 24px)',
          maxWidth: '446px',
          borderRadius: '24px',
          padding: '20px',
        }}
      >
        <div className="space-y-1.5 text-sm mb-4">
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
          {shipping > 0 && subtotal < 50000 && (
            <div className="text-[10px] text-neutral-400">
              Add {formatPrice(50000 - subtotal)} more for free shipping
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-neutral-100">
            <span className="font-bold">Total</span>
            <span className="font-extrabold text-black text-lg">{formatPrice(total)}</span>
          </div>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          className="w-full bg-black text-white font-semibold rounded-full py-3.5 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
        >
          Checkout <ArrowRight className="w-4 h-4" />
        </button>
        <div className="mt-2 text-center text-[10px] text-neutral-400">
          Secure payment via PalmPay bank transfer
        </div>
      </div>
    </div>
  );
}
