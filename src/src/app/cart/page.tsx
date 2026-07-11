'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type CartItem } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Trash2, Minus, Plus, Store, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyState
          icon={<ShoppingCart className="w-8 h-8" />}
          title="Your cart is empty"
          message="Browse our marketplace and find great deals from local Nigerian sellers."
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
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Cart ({items.length})
        </h1>
        <button onClick={clearCart} className="text-xs text-red-500 hover:underline">Clear all</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-3 border-slate-100">
              <div className="flex gap-3">
                <Link href={`/product?id=${item.product_id}`} className="shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50">
                    {item.products?.image_url ? (
                      <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Store className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/product?id=${item.product_id}`}>
                    <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 hover:text-primary">
                      {item.products?.name || 'Product'}
                    </h3>
                  </Link>
                  <div className="text-xs text-slate-400 mt-0.5">{item.products?.category}</div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-primary font-bold">{formatPrice(item.products?.price || 0)}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-200 rounded-lg">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          disabled={updating === item.id}
                          className="px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1 text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          disabled={updating === item.id}
                          className="px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-right text-xs text-slate-500">
                Subtotal: <span className="font-bold text-slate-700">{formatPrice((item.products?.price || 0) * item.quantity)}</span>
              </div>
            </Card>
          ))}

          <Link href="/categories" className="block">
            <Button variant="outline" className="w-full border-dashed">
              + Continue shopping
            </Button>
          </Link>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="p-4 border-slate-100 sticky top-20">
            <h3 className="font-bold text-sm mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping</span>
                <span className="font-semibold">
                  {shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}
                </span>
              </div>
              {shipping === 0 && (
                <div className="text-[10px] text-green-600 bg-green-50 rounded p-1.5">
                  🎉 You qualify for free shipping!
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-extrabold text-primary text-lg">{formatPrice(total)}</span>
              </div>
            </div>

            <Button
              onClick={() => router.push('/checkout')}
              className="w-full mt-4 brand-gradient text-primary-foreground font-bold"
            >
              Proceed to checkout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>

            <div className="mt-3 text-center text-[10px] text-slate-400">
              Secure payment via PalmPay bank transfer
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
