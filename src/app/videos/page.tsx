'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Share2, Play, Volume2, VolumeX, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

export default function VideosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<Record<number, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const result = await api.videos.feed(20);
      if (result.success) setVideos(result.videos || []);
      setLoading(false);
    })();
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.children;
    const containerTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      const dist = Math.abs(child.offsetTop - containerTop - containerHeight / 2 + child.clientHeight / 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setActiveIdx(closest);
  }, []);

  const toggleLike = async (videoId: number) => {
    if (!user) { toast({ title: 'Please login to like videos' }); return; }
    const isLiked = likes[videoId];
    setLikes({ ...likes, [videoId]: !isLiked });
    const result = isLiked ? await api.videos.unlike(videoId) : await api.videos.like(videoId);
    if (!result.success) {
      setLikes({ ...likes, [videoId]: isLiked });
    }
  };

  const share = (video: any) => {
    const url = `${window.location.origin}/videos`;
    if (navigator.share) {
      navigator.share({ title: video.caption || 'Cellex video', url });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-20">
        <Play className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500">No videos yet</p>
        <p className="text-xs text-slate-400 mt-1">Sellers can upload product videos from their dashboard</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black"
    >
      {videos.map((video, idx) => (
        <div
          key={video.id}
          className="h-full w-full snap-start relative flex items-center justify-center"
        >
          {video.video_url ? (
            <video
              src={video.video_url}
              autoPlay={idx === activeIdx}
              muted={muted}
              loop
              playsInline
              className="max-h-full max-w-full object-cover"
            />
          ) : (
            <div className="bg-slate-900 w-full h-full flex items-center justify-center text-white">
              <Play className="w-12 h-12" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

          {/* Mute toggle (top right) */}
          <button
            onClick={() => setMuted(!muted)}
            className="absolute top-4 right-4 bg-black/50 backdrop-blur rounded-full p-2 text-white"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Right action rail */}
          <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
            <button
              onClick={() => toggleLike(video.id)}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <Heart className={`w-6 h-6 ${likes[video.id] ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </div>
              <span className="text-xs text-white font-bold">{(video.likes_count || 0) + (likes[video.id] ? 1 : 0)}</span>
            </button>
            <button
              onClick={() => share(video)}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-white font-bold">Share</span>
            </button>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-20 left-3 right-20 text-white z-10">
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/seller-profile?id=${video.seller_id}`}>
                <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center font-bold text-sm">
                  {(video.seller_name || 'S').charAt(0)}
                </div>
              </Link>
              <div>
                <Link href={`/seller-profile?id=${video.seller_id}`}>
                  <div className="font-bold text-sm">{video.seller_name || 'Seller'}</div>
                </Link>
                <div className="text-xs opacity-80">{video.views_count || 0} views · {timeAgo(video.created_at)}</div>
              </div>
            </div>
            {video.caption && (
              <p className="text-sm mb-2 line-clamp-2">{video.caption}</p>
            )}
            {video.product_id && video.product && (
              <Link href={`/product?id=${video.product_id}`}>
                <Card className="p-2 bg-white/15 backdrop-blur border-0 flex items-center gap-2 max-w-xs">
                  <div className="w-10 h-10 rounded-lg bg-white/20 overflow-hidden">
                    {video.product.image_url ? (
                      <img src={video.product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-4 h-4 m-auto mt-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{video.product.name}</div>
                    <div className="text-sm font-extrabold text-cyan-300">{formatPrice(video.product.price)}</div>
                  </div>
                  <Button size="sm" variant="secondary" className="text-xs">Buy</Button>
                </Card>
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
