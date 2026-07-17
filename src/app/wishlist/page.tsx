'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Heart, Trash2, ShoppingCart, Store, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
export default function WishlistPage() {
  const { user, loading: authLoading, refreshCartCount } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await api.wishlist.get();
    if (result.success) setItems(result.items || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/wishlist');
      return;
    }
    if (user) load();
  }, [user, authLoading, router]);

  const remove = async (itemId: string) => {
    const result = await api.wishlist.remove(itemId);
    if (result.success) {
      setItems(items.filter((i) => i.id !== itemId));
      toast({ title: 'Removed from wishlist' });
    }
  };

  const addToCart = async (product: Product) => {
    const result = await api.cart.add(product.id, 1);
    if (result.success) {
      await refreshCartCount();
      toast({ title: 'Added to cart', description: product.name });
    }
  };

  if (authLoading || loading) {
    return (
      <PageSkeleton variant="wishlist" />
    );
  }

  if (items.length === 0) {
    return (
      <div className="ig-container bg-white min-h-screen ig-topbar-offset">
        <div className="ig-topbar">
          <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Wishlist</h1>
        </div>
        <div className="px-4 py-10">
          <EmptyState
            icon={<Heart className="w-8 h-8" />}
            title="Your wishlist is empty"
            message="Save items you love and come back to them later."
            action={
              <Link href="/categories">
                <button className="bg-black text-white font-semibold rounded-md px-4 py-2.5 hover:bg-neutral-800">
                  Discover products
                </button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ig-container bg-white min-h-screen">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Wishlist ({items.length})</h1>
      </div>

      <div className="divide-y divide-neutral-100">
        {items.map((item) => {
          const product = item.products;
          if (!product) return null;
          return (
            <div key={item.id} className="p-4 flex gap-3">
              <Link href={`/product?id=${product.id}`} className="shrink-0">
                <div className="w-20 h-20 rounded-md bg-neutral-50 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      <Store className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0 flex flex-col">
                <Link href={`/product?id=${product.id}`}>
                  <h3 className="font-semibold text-sm text-black hover:opacity-70 line-clamp-2">{product.name}</h3>
                </Link>
                <div className="text-black font-bold mt-1">{formatPrice(product.price)}</div>
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => addToCart(product)}
                    className="flex-1 bg-black text-white font-semibold rounded-md py-2 text-xs hover:bg-neutral-800"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 inline mr-1" /> Add
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-[#ed4956] border border-neutral-200 hover:bg-neutral-50 rounded-md px-3"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
