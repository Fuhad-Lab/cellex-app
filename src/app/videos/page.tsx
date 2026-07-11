'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Heart, Share2, Play, Volume2, VolumeX, ChevronLeft, ChevronRight,
  MessageCircle, Send, ShoppingBag, Bookmark, Star, Eye
} from 'lucide-react';
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
  const [saved, setSaved] = useState<Record<number, boolean>>({});
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

  const toggleSave = (videoId: number) => {
    setSaved({ ...saved, [videoId]: !saved[videoId] });
    toast({ title: saved[videoId] ? 'Removed from saved' : 'Saved!' });
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
        <div className="w-7 h-7 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16">
        <Play className="w-12 h-12 mx-auto text-slate-300 mb-2" />
        <p className="text-slate-500 text-sm">No videos yet</p>
        <p className="text-xs text-slate-400 mt-1">Sellers can upload product videos from their dashboard</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[calc(100vh-3rem)] md:h-[calc(100vh-3.5rem)] overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black"
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

          {/* Top gradient + back button */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
          <Link href="/" className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
            <ChevronLeft className="w-4 h-4" />
          </Link>

          {/* Top-left: live badge + seller name */}
          <div className="absolute top-3 left-14 z-20 flex items-center gap-1.5">
            <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">VIDEO</span>
            <span className="text-white text-xs font-bold">@{video.seller_name || 'seller'}</span>
          </div>

          {/* Mute toggle (top right) */}
          <button
            onClick={() => setMuted(!muted)}
            className="absolute top-3 right-3 z-20 bg-black/40 backdrop-blur rounded-full p-1.5 text-white"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Right-side action rail (like/comment/share/save) */}
          <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3 z-20">
            {/* Like */}
            <button
              onClick={() => toggleLike(video.id)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className={`w-10 h-10 rounded-full backdrop-blur flex items-center justify-center ${likes[video.id] ? 'bg-primary' : 'bg-black/40'}`}>
                <Heart className={`w-5 h-5 ${likes[video.id] ? 'fill-white text-white' : 'text-white'}`} />
              </div>
              <span className="text-[10px] text-white font-bold">{(video.likes_count || 0) + (likes[video.id] ? 1 : 0)}</span>
            </button>

            {/* Comments */}
            <button className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-white font-bold">{Math.floor((video.views_count || 0) / 10)}</span>
            </button>

            {/* Share */}
            <button
              onClick={() => share(video)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-white font-bold">Share</span>
            </button>

            {/* Save */}
            <button
              onClick={() => toggleSave(video.id)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className={`w-10 h-10 rounded-full backdrop-blur flex items-center justify-center ${saved[video.id] ? 'bg-yellow-500' : 'bg-black/40'}`}>
                <Bookmark className={`w-5 h-5 ${saved[video.id] ? 'fill-white text-white' : 'text-white'}`} />
              </div>
              <span className="text-[10px] text-white font-bold">Save</span>
            </button>
          </div>

          {/* Bottom info — seller + caption + product card */}
          <div className="absolute bottom-20 left-2 right-16 z-20">
            {/* Seller row */}
            <div className="flex items-center gap-1.5 mb-2">
              <Link href={`/seller-profile?id=${video.seller_id}`}>
                <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center font-bold text-[10px] text-white border-2 border-white">
                  {(video.seller_name || 'S').charAt(0)}
                </div>
              </Link>
              <Link href={`/seller-profile?id=${video.seller_id}`}>
                <span className="text-white text-xs font-bold">{video.seller_name || 'Seller'}</span>
              </Link>
              <span className="text-white/70 text-[10px]">·</span>
              <span className="text-white/70 text-[10px]">{video.views_count || 0} views</span>
            </div>

            {/* Caption */}
            {video.caption && (
              <p className="text-white text-[11px] mb-2 line-clamp-2 leading-tight">{video.caption}</p>
            )}

            {/* Product card — white with red price */}
            {video.product_id && video.product && (
              <Link href={`/product?id=${video.product_id}`} className="block max-w-[280px]">
                <Card className="p-1.5 bg-white border-0 flex items-center gap-1.5 shadow-lg">
                  <div className="w-10 h-10 rounded-md bg-slate-100 overflow-hidden shrink-0">
                    {video.product.image_url ? (
                      <img src={video.product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 m-auto mt-3 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {video.product_id && (
                      <span className="inline-block bg-primary text-white text-[8px] font-bold px-1 py-0 rounded mb-0.5">FEATURED</span>
                    )}
                    <div className="text-[10px] font-bold text-slate-900 truncate">{video.product.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-extrabold price">{formatPrice(video.product.price)}</span>
                      {typeof video.product.units_sold === 'number' && video.product.units_sold > 0 && (
                        <span className="text-[9px] text-slate-400">{video.product.units_sold} sold</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" className="commerce-gradient text-white h-6 text-[10px] px-2 shrink-0">
                    Buy
                  </Button>
                </Card>
              </Link>
            )}

            {/* Trust badge */}
            <div className="flex items-center gap-1 mt-2 text-white/80 text-[9px]">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>Verified Seller</span>
              <span>·</span>
              <span>7-Day Returns</span>
            </div>
          </div>

          {/* Bottom CTA — full-width dark button */}
          {video.product_id && video.product && (
            <Link href={`/product?id=${video.product_id}`} className="absolute bottom-2 left-2 right-2 z-20 block">
              <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-9 text-xs">
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                Shop this product · {formatPrice(video.product.price)}
              </Button>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
