'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Heart, Share2, Play, Volume2, VolumeX, ChevronLeft,
  MessageCircle, ShoppingBag, Bookmark, Star, UserPlus, Gift
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
  const [following, setFollowing] = useState<Record<string, boolean>>({});
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

  const toggleFollow = async (sellerId: string) => {
    if (!user) { toast({ title: 'Please login to follow sellers' }); return; }
    const isFollowing = following[sellerId];
    setFollowing({ ...following, [sellerId]: !isFollowing });
    const result = isFollowing ? await api.social.unfollow(sellerId) : await api.social.follow(sellerId);
    if (!result.success) {
      setFollowing({ ...following, [sellerId]: isFollowing });
    } else {
      toast({ title: isFollowing ? 'Unfollowed' : 'Following!' });
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
        <p className="text-slate-500 text-base">No videos yet</p>
        <p className="text-sm text-slate-400 mt-1">Sellers can upload product videos from their dashboard</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black"
    >
      {videos.map((video, idx) => {
        // API returns seller as nested object: { id, business_name, profile_image }
        const seller = video.seller || {};
        const sellerName = seller.business_name || 'Seller';
        const sellerId = seller.id;
        const sellerImg = seller.profile_image;
        const product = video.product;
        const isFollowing = following[sellerId] || false;

        return (
          <div
            key={video.id}
            className="h-full w-full snap-start relative flex items-center justify-center"
          >
            {/* Video */}
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

            {/* Top gradient */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

            {/* Top-left: Follow / Recommend tabs */}
            <div className="absolute top-4 left-3 z-20 flex items-center gap-4">
              <span className="text-white text-sm font-medium opacity-80">Follow</span>
              <span className="text-white text-sm font-bold border-b-2 border-white pb-0.5">Recommend</span>
            </div>

            {/* Top-right: mute toggle */}
            <button
              onClick={() => setMuted(!muted)}
              className="absolute top-4 right-3 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* === RIGHT-SIDE ACTION RAIL (matches reference) === */}
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4 z-20">
              {/* Seller avatar + Follow button (TOP of rail) */}
              {sellerId && (
                <div className="relative mb-1">
                  <Link href={`/seller-profile?id=${sellerId}`}>
                    <div className="w-12 h-12 rounded-full brand-gradient flex items-center justify-center text-white font-bold border-2 border-white overflow-hidden">
                      {sellerImg ? (
                        <img src={sellerImg} alt="" className="w-full h-full object-cover" />
                      ) : (
                        sellerName.charAt(0).toUpperCase()
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => toggleFollow(sellerId)}
                    className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      isFollowing ? 'bg-slate-500' : 'bg-primary'
                    }`}
                  >
                    {isFollowing ? '✓' : '+'}
                  </button>
                </div>
              )}

              {/* Like button */}
              <button
                onClick={() => toggleLike(video.id)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors ${likes[video.id] ? 'bg-primary' : 'bg-black/40'}`}>
                  <Heart className={`w-6 h-6 ${likes[video.id] ? 'fill-white text-white' : 'text-white'}`} />
                </div>
                <span className="text-xs text-white font-bold">{(video.likes_count || 0) + (likes[video.id] ? 1 : 0)}</span>
              </button>

              {/* Comment button */}
              <button className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-white font-bold">{Math.floor((video.views_count || 0) / 10)}</span>
              </button>

              {/* Share button */}
              <button
                onClick={() => share(video)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-white font-bold">Share</span>
              </button>

              {/* Save button */}
              <button
                onClick={() => toggleSave(video.id)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors ${saved[video.id] ? 'bg-yellow-500' : 'bg-black/40'}`}>
                  <Bookmark className={`w-6 h-6 ${saved[video.id] ? 'fill-white text-white' : 'text-white'}`} />
                </div>
                <span className="text-xs text-white font-bold">Save</span>
              </button>
            </div>

            {/* === BOTTOM-LEFT INFO (matches reference) === */}
            <div className="absolute bottom-20 left-3 right-20 z-20">
              {/* LIVE badge + @username */}
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  VIDEO
                </span>
                <Link href={sellerId ? `/seller-profile?id=${sellerId}` : '#'}>
                  <span className="text-white text-sm font-bold">@{sellerName}</span>
                </Link>
              </div>

              {/* Caption */}
              {video.caption && (
                <p className="text-white text-sm mb-2 line-clamp-2 leading-snug">{video.caption}</p>
              )}

              {/* Product card — white with cyan price */}
              {product && (
                <Link href={`/product?id=${product.id}`} className="block max-w-xs">
                  <Card className="p-2 bg-white border-0 flex items-center gap-2 shadow-lg">
                    <div className="w-12 h-12 rounded-md bg-slate-100 overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 m-auto mt-3.5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded mb-0.5">FEATURED</span>
                      <div className="text-sm font-bold text-black truncate">{product.name}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold price">{formatPrice(product.price)}</span>
                        {typeof product.units_sold === 'number' && product.units_sold > 0 && (  
                          <span className="text-xs text-slate-400">
                            {product.units_sold > 1000 ? `${(product.units_sold / 1000).toFixed(1)}k` : product.units_sold} sold
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" className="brand-gradient text-white h-8 shrink-0">
                      Buy
                    </Button>
                  </Card>
                </Link>
              )}

              {/* Trust badges — black background */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="bg-black/70 backdrop-blur text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  Verified Seller
                </span>
                <span className="bg-black/70 backdrop-blur text-white text-xs px-2 py-0.5 rounded">
                  7-Day Returns
                </span>
              </div>
            </div>

            {/* Bottom CTA — dark button */}
            {product && (
              <Link href={`/product?id=${product.id}`} className="absolute bottom-3 left-3 right-3 z-20 block">
                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 text-base">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Shop this product · {formatPrice(product.price)}
                </Button>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
