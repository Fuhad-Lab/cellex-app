'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Store } from 'lucide-react';
import { Product, formatPrice } from '@/lib/api';

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  return (
    <Link href={`/product?id=${product.id}`} className="block group">
      <Card className={`overflow-hidden border-white/10 shadow-sm hover-lift card-transition ${compact ? '' : ''}`}>
        <div className={`aspect-square bg-neutral-50 relative ${compact ? '' : 'img-zoom'}`}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300">
              <Store className="w-10 h-10" />
            </div>
          )}
          {typeof product.units_sold === 'number' && product.units_sold > 50 && (
            <span className="absolute top-2 left-2 sale-badge">Hot</span>
          )}
        </div>
        <div className="p-2 sm:p-3">
          <div className="text-sm font-medium text-black line-clamp-2 h-10 overflow-hidden leading-tight">
            {product.name}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-lg font-bold price">
              {formatPrice(product.price)}
            </div>
            {typeof product.units_sold === 'number' && product.units_sold > 0 && (
              <div className="text-xs text-neutral-400">
                {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ProductGrid({ products, loading }: { products: Product[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton rounded-lg aspect-[3/4]" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <Store className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
        <p className="text-neutral-500 text-base">No products found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
      {products.map((p, i) => (
        <div key={p.id} className="animate-scale-in" style={{ animationDelay: `${i * 30}ms` }}>
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: React.ReactNode; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-400">
        {icon}
      </div>
      <h3 className="font-bold text-base text-black mb-1">{title}</h3>
      {message && <p className="text-sm text-neutral-500 mb-4 max-w-sm mx-auto">{message}</p>}
      {action}
    </div>
  );
}
