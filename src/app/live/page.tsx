'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Radio, Eye, ChevronLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
import { useScrollPreservation } from '@/components/global-state-provider';
export default function LivePage() {
  useScrollPreservation('live');

  const router = useRouter();
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

  if (loading) { return <PageSkeleton variant="live" />; }

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Live Shopping</h1>
      </div>

      {/* Live Now */}
      <section className="px-4 py-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          LIVE NOW ({liveNow.length})
        </h2>
        {liveNow.length === 0 ? (
          <div className="text-center py-8">
            <Radio className="w-8 h-8 mx-auto text-[#666666] mb-2" />
            <p className="text-sm text-[#666666]">No live sessions right now</p>
            <p className="text-xs text-[#666666] mt-1">Check back later or follow your favorite sellers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveNow.map((s) => (
              <Link key={s.id} href={`/live-watch?id=${s.id}`}>
                <div className="overflow-hidden border border-[#E5E5E5] rounded-md hover:opacity-90 transition-opacity">
                  <div className="aspect-video bg-[#D4AF37] relative">
                    <div className="w-full h-full flex items-center justify-center text-black">
                      <Radio className="w-10 h-10" />
                    </div>
                    <div className="absolute top-2 left-2 bg-red-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#F5F5F5] rounded-full animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {s.viewer_count || 0}
                    </div>
                  </div>
                  <div className="p-3 bg-[#F5F5F5]">
                    <h3 className="font-semibold text-sm line-clamp-1">{s.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#666666]">
                      <div className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center text-black text-[10px] font-bold">
                        {(s.seller_name || 'S').charAt(0)}
                      </div>
                      <span>{s.seller_name}</span>
                    </div>
                    {s.featured_product && (
                      <div className="mt-2 pt-2 border-t border-[#E5E5E5] flex items-center justify-between">
                        <span className="text-xs text-[#666666] line-clamp-1">{s.featured_product.name}</span>
                        <span className="text-sm font-bold text-black">{formatPrice(s.featured_product.price)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      {recent.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="font-semibold text-sm mb-3">Recent Sessions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {recent.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/live-watch?id=${s.id}`}>
                <div className="overflow-hidden border border-[#E5E5E5] rounded-md hover:opacity-90 transition-opacity">
                  <div className="aspect-video bg-[#F5F5F5] flex items-center justify-center">
                    <Radio className="w-6 h-6 text-[#666666]" />
                  </div>
                  <div className="p-2 bg-[#F5F5F5]">
                    <h3 className="font-semibold text-xs line-clamp-1">{s.title}</h3>
                    <div className="text-[10px] text-[#666666] mt-0.5">{s.seller_name}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {liveNow.length === 0 && recent.length === 0 && (
        <div className="px-4 py-10">
          <EmptyState
            icon={<Radio className="w-8 h-8" />}
            title="No live sessions yet"
            message="Sellers can go live to showcase their products in real-time. Follow sellers to get notified when they go live."
            action={
              <Link href="/categories">
                <button className="bg-[#D4AF37] text-black font-semibold rounded-md px-4 py-2.5 hover:bg-[#F5F5F5]">
                  Browse products
                </button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
