'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Store } from 'lucide-react';
import { Product, formatPrice } from '@/lib/api';

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  return (
    <Link href={`/product?id=${product.id}`} className="block group">
      <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
        <div className={`aspect-square bg-slate-50 relative ${compact ? '' : 'overflow-hidden'}`}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Store className="w-10 h-10" />
            </div>
          )}
          {typeof product.units_sold === 'number' && product.units_sold > 50 && (
            <span className="absolute top-1.5 left-1.5 sale-badge">Hot</span>
          )}
        </div>
        <div className="p-1.5 sm:p-2">
          <div className="text-[11px] sm:text-xs font-medium text-slate-700 line-clamp-2 h-7 sm:h-8 overflow-hidden leading-tight">
            {product.name}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-sm sm:text-base font-bold price">
              {formatPrice(product.price)}
            </div>
            {typeof product.units_sold === 'number' && product.units_sold > 0 && (
              <div className="text-[10px] text-slate-400">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-lg animate-pulse aspect-[3/4]" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-slate-500 text-xs">No products found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: React.ReactNode; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
        {icon}
      </div>
      <h3 className="font-bold text-sm text-slate-800 mb-1">{title}</h3>
      {message && <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">{message}</p>}
      {action}
    </div>
  );
}
