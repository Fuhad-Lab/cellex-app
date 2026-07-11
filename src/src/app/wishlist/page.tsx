'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, type Product } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Trash2, ShoppingCart, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <EmptyState
          icon={<Heart className="w-8 h-8" />}
          title="Your wishlist is empty"
          message="Save items you love and come back to them later."
          action={
            <Link href="/categories">
              <Button className="brand-gradient text-primary-foreground font-bold">Discover products</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-500" />
        Wishlist ({items.length})
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const product = item.products;
          if (!product) return null;
          return (
            <Card key={item.id} className="p-3 border-slate-100 flex gap-3">
              <Link href={`/product?id=${product.id}`} className="shrink-0">
                <div className="w-20 h-20 rounded-xl bg-slate-50 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Store className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0 flex flex-col">
                <Link href={`/product?id=${product.id}`}>
                  <h3 className="font-semibold text-sm hover:text-primary line-clamp-2">{product.name}</h3>
                </Link>
                <div className="text-primary font-bold mt-1">{formatPrice(product.price)}</div>
                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
                    className="brand-gradient text-primary-foreground flex-1"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(item.id)}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
