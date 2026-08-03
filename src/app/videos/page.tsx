'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Play, Eye, Heart, ChevronLeft, Store, Clapperboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/page-skeleton';

import { useScrollPreservation } from '@/components/global-state-provider';
/**
 * VideosPage — grid browse page for all videos.
 *
 * This is DIFFERENT from /shorts:
 * - /shorts = immersive full-screen vertical swipe experience (like IG Reels)
 * - /videos = grid of video thumbnails, tap to open in /shorts
 *
 * Layout: IG Explore-style grid. Each cell is a 9:16 video thumbnail with
 * play count overlay. Tapping any cell navigates to /shorts.
 */
export default function VideosPage() {
  useScrollPreservation('videos');

  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await api.videos.feed(50);
      if (result.success) {
        setVideos(result.videos || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <PageSkeleton variant="videos" />;
  }

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Videos</h1>
        <Link href="/shorts" className="ig-icon-btn" aria-label="Shorts">
          <Clapperboard className="w-5 h-5" />
        </Link>
      </div>

      {/* Shorts promo banner */}
      <Link
        href="/shorts"
        className="block mx-3 mt-3 bg-gradient-to-r from-neutral-900 to-black text-black rounded-xl p-4 flex items-center gap-3 hover:from-neutral-800 hover:to-neutral-900 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
          <Clapperboard className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Watch Shorts</div>
          <div className="text-xs text-black/70">Swipe through short videos from sellers</div>
        </div>
        <Play className="w-5 h-5 fill-white shrink-0" />
      </Link>

      {/* Section header */}
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black">All Videos</h2>
        <span className="text-xs text-[#666666]">{videos.length} videos</span>
      </div>

      {/* Video grid — 2 columns of 9:16 thumbnails */}
      {videos.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Play className="w-10 h-10 mx-auto text-[#666666] mb-2" />
          <p className="text-sm font-medium text-[#666666]">No videos yet</p>
          <p className="text-xs text-[#666666] mt-1">Videos from sellers will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 px-1">
          {videos.map((video) => {
            const seller = video.seller || {};
            const sellerName = seller.business_name || 'Seller';
            const caption = video.caption || '';
            const views = video.views_count || 0;
            const likes = video.likes_count || 0;
            const product = video.product;

            return (
              <Link
                key={video.id}
                href="/shorts"
                className="relative aspect-[9/16] bg-[#F5F5F5] overflow-hidden group"
              >
                {video.video_url ? (
                  <video
                    src={video.video_url}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : product?.image_url ? (
                  <img src={product.image_url} alt={caption} className="w-full h-full object-cover" loading="lazy" />
                ) : null}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Play count top-right */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-black text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  <Play className="w-2.5 h-2.5 fill-white" />
                  {formatCount(views)}
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="text-[10px] font-semibold text-black truncate mb-0.5">{sellerName}</div>
                  {caption && (
                    <div className="text-[10px] text-black/80 line-clamp-2 leading-tight">{caption}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-0.5 text-[9px] text-black/70">
                      <Heart className="w-2.5 h-2.5 fill-[#D4AF37] text-[#D4AF37]" />
                      {formatCount(likes)}
                    </span>
                    {product && (
                      <span className="text-[9px] text-black/70 truncate">
                        · {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-black fill-white" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
