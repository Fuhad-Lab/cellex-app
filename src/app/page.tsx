'use client';

import { useEffect, useState } from 'react';
import { api, Product, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Flame, TrendingUp, Store, Radio, Video, Users, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [homeResp, sellersResp] = await Promise.all([
          api.products.home(),
          api.social.discover(12),
        ]);

        if (homeResp.success) {
          setFlashDeals(homeResp.flashDeals || []);
          setTrending(homeResp.trending || []);
          setNewArrivals(homeResp.newArrivals || []);
        }
        if (sellersResp.success) {
          setSellers(sellersResp.sellers || []);
        }
      } catch (e) {
        console.error('Home load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 space-y-6 pt-4">
      {/* Hero */}
      <div className="brand-gradient rounded-2xl p-6 sm:p-8 text-primary-foreground relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Shop smarter with Cellex
          </h1>
          <p className="text-primary-foreground/80 text-sm mb-4">
            Nigeria's #1 social commerce marketplace
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/categories">
              <Button variant="secondary" size="sm">Start shopping</Button>
            </Link>
            <Link href="/ai-chat">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Sparkles className="w-4 h-4 mr-1" /> AI Shopping
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      {/* Flash Deals */}
      {flashDeals.length > 0 && (
        <Section
          icon={<Flame className="w-5 h-5 text-primary" />}
          title="Flash Deals"
          href="/categories?sort=flash"
        >
          <ProductScroll products={flashDeals} />
        </Section>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <Section
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          title="Trending Now"
          href="/categories?sort=trending"
        >
          <ProductScroll products={trending} />
        </Section>
      )}

      {/* Meet Top Sellers */}
      {sellers.length > 0 && (
        <Section
          icon={<Store className="w-5 h-5 text-primary" />}
          title="Meet the Top Sellers"
          href="/sellers"
        >
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {sellers.slice(0, 3).map((seller) => {
              const sellerProducts = [...flashDeals, ...trending, ...newArrivals]
                .filter(p => p.seller_id === seller.id)
                .slice(0, 4);
              const name = seller.business_name || seller.farm_name || 'Unnamed store';
              const initial = name.charAt(0).toUpperCase();

              return (
                <Card key={seller.id} className="p-3 border-slate-100 shadow-sm shrink-0 w-64 sm:w-72">
                  {/* 2x2 product grid */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {sellerProducts.length > 0 ? (
                      sellerProducts.map((p) => (
                        <Link key={p.id} href={`/product?id=${p.id}`}>
                          <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Store className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                        </Link>
                      ))
                    ) : (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg bg-slate-50" />
                      ))
                    )}
                  </div>

                  {/* Seller info + Shop button */}
                  <div className="flex items-center gap-3">
                    <Link href={`/seller-profile?id=${seller.id}`} className="shrink-0">
                      {seller.profile_image ? (
                        <img src={seller.profile_image} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm">
                          {initial}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/seller-profile?id=${seller.id}`} className="font-bold text-sm text-slate-900 hover:text-primary truncate block">
                        {name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {seller.followers || 0} followers · {seller.business_category || seller.seller_type || 'Seller'}
                      </div>
                    </div>
                    <Link href={`/seller-profile?id=${seller.id}`}>
                      <Button size="sm" variant="default">Shop</Button>
                    </Link>
                  </div>
                </Card>
              );
            })}

            {/* See more card */}
            <Link
              href="/sellers"
              className="shrink-0 w-32 sm:w-36 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold mb-2">
                →
              </div>
              <div className="text-xs font-bold text-slate-700 text-center px-2">
                See all<br/>sellers
              </div>
            </Link>
          </div>
        </Section>
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <Section
          icon={<Sparkles className="w-5 h-5 text-primary" />}
          title="New Arrivals"
          href="/categories?sort=newest"
        >
          <ProductScroll products={newArrivals} />
        </Section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4">
        <Link href="/videos" className="bg-slate-900 rounded-2xl p-4 text-center hover:opacity-90 transition-opacity">
          <Video className="w-6 h-6 text-primary mx-auto mb-1" />
          <div className="text-xs font-semibold text-white">Watch Videos</div>
        </Link>
        <Link href="/live" className="bg-red-500 rounded-2xl p-4 text-center hover:opacity-90 transition-opacity">
          <Radio className="w-6 h-6 text-white mx-auto mb-1" />
          <div className="text-xs font-semibold text-white">Live Now</div>
        </Link>
        <Link href="/group-buy" className="brand-gradient rounded-2xl p-4 text-center hover:opacity-90 transition-opacity">
          <Users className="w-6 h-6 text-primary-foreground mx-auto mb-1" />
          <div className="text-xs font-semibold text-primary-foreground">Group Buys</div>
        </Link>
        <Link href="/ai-chat" className="bg-violet-500 rounded-2xl p-4 text-center hover:opacity-90 transition-opacity">
          <Sparkles className="w-6 h-6 text-white mx-auto mb-1" />
          <div className="text-xs font-semibold text-white">AI Assistant</div>
        </Link>
      </div>
    </div>
  );
}

function Section({ icon, title, href, children }: { icon: React.ReactNode; title: string; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="text-xs font-semibold text-primary hover:underline">
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function ProductScroll({ products }: { products: Product[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      {products.map((p) => (
        <Link key={p.id} href={`/product?id=${p.id}`} className="shrink-0 w-32 sm:w-40">
          <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-square bg-slate-50">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Store className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="text-xs font-medium text-slate-700 line-clamp-2 h-8 overflow-hidden">{p.name}</div>
              <div className="text-sm font-bold text-primary mt-1">{formatPrice(p.price)}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
