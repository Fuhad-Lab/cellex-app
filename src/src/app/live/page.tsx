'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, Users, Eye, ChevronRight, Store } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/product-card';

export default function LivePage() {
  const [liveNow, setLiveNow] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [liveResp, recentResp] = await Promise.all([
        api.live.list('live'),
        api.live.list('ended'),
      ]);
      if (liveResp.success) setLiveNow(liveResp.sessions || []);
      if (recentResp.success) setRecent(recentResp.sessions || []);
      setLoading(false);
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
    <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 space-y-6">
      <div className="flex items-center gap-2">
        <Radio className="w-6 h-6 text-red-500" />
        <h1 className="text-xl font-bold">Live Shopping</h1>
      </div>

      {/* Live Now */}
      <section>
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          LIVE NOW ({liveNow.length})
        </h2>
        {liveNow.length === 0 ? (
          <Card className="p-6 text-center border-slate-100">
            <Radio className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No live sessions right now</p>
            <p className="text-xs text-slate-400 mt-1">Check back later or follow your favorite sellers</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveNow.map((s) => (
              <Link key={s.id} href={`/live-watch?id=${s.id}`}>
                <Card className="overflow-hidden border-slate-100 hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-slate-900 relative">
                    {s.stream_url ? (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <Radio className="w-10 h-10 animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <Radio className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {s.viewer_count || 0}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-1">{s.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <div className="w-5 h-5 rounded-full brand-gradient flex items-center justify-center text-white text-[10px] font-bold">
                        {(s.seller_name || 'S').charAt(0)}
                      </div>
                      <span>{s.seller_name}</span>
                    </div>
                    {s.featured_product && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 line-clamp-1">{s.featured_product.name}</span>
                        <span className="text-sm font-bold text-primary">{formatPrice(s.featured_product.price)}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      {recent.length > 0 && (
        <section>
          <h2 className="font-bold text-sm mb-3">Recent Sessions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/live-watch?id=${s.id}`}>
                <Card className="overflow-hidden border-slate-100 hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-slate-100 flex items-center justify-center">
                    <Radio className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm line-clamp-1">{s.title}</h3>
                    <div className="text-xs text-slate-500 mt-1">{s.seller_name}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {liveNow.length === 0 && recent.length === 0 && (
        <EmptyState
          icon={<Radio className="w-8 h-8" />}
          title="No live sessions yet"
          message="Sellers can go live to showcase their products in real-time. Follow sellers to get notified when they go live!"
          action={
            <Link href="/categories">
              <Button className="brand-gradient text-primary-foreground">Browse products</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
