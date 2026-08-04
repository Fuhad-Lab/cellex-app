'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Heart, Send, Bookmark, Share2, MessageCircle, Volume2, VolumeX, ChevronLeft, ShoppingBag, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { CommentsModal } from '@/components/comments-modal';

import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
/**
 * ShortsPage — immersive full-screen vertical video experience.
 *
 * This is the Reels/Shorts experience: each video fills the screen,
 * you swipe up/down to navigate. Auto-plays when in view, pauses when out.
 *
 * Layout per video:
 * - Full-screen video (object-cover)
 * - Right rail: like, comment, share, save, product link
 * - Bottom: seller name, caption, product CTA (if any)
 * - Top: back button + mute toggle
 */
export default function ShortsPage() {
  useScrollPreservation('shorts');

  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = usePersistedState<any[]>('shorts:videos', []);
  const [loading, setLoading] = useState(videos.length === 0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [commentsOpenFor, setCommentsOpenFor] = useState<number | null>(null);
  const [commentsCounts, setCommentsCounts] = useState<Record<number, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    (async () => {
      const result = await api.videos.feed(30);
      if (result.success) {
        setVideos(result.videos || []);
      }
      setLoading(false);
    })();
  }, []);

  // Track which video is in view using IntersectionObserver
  useEffect(() => {
    if (!containerRef.current || videos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            setActiveIdx(idx);
          }
        });
      },
      { root: containerRef.current, threshold: [0.6] }
    );
    const items = containerRef.current.querySelectorAll('[data-index]');
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [videos]);

  // Play/pause based on active index
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIdx) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeIdx, videos]);

  const toggleLike = useCallback((videoId: number) => {
    setLikes((prev) => {
      const newLiked = !prev[videoId];
      // REAL: persist to Supabase via the videos edge function + fire Gorse feedback
      if (newLiked) api.videos.like(videoId);
      else api.videos.unlike(videoId);
      api.feedback(`video:${videoId}`, newLiked ? 'like' : 'unlike', newLiked ? 1 : 0);
      return { ...prev, [videoId]: newLiked };
    });
  }, []);

  const toggleSave = useCallback((videoId: number) => {
    setSaved((prev) => {
      const newState = !prev[videoId];
      if (newState) toast({ title: 'Saved!' });
      // REAL: fire save/unsave feedback to Gorse (prefixed so Gorse sees it as a video)
      api.feedback(`video:${videoId}`, newState ? 'save' : 'unsave', newState ? 1 : 0);
      return { ...prev, [videoId]: newState };
    });
  }, [toast]);

  if (loading) {
    return <PageSkeleton variant="videos" />;
  }

  if (videos.length === 0) {
    return (
      <div className="ig-container bg-[#171717] min-h-screen flex flex-col items-center justify-center text-black">
        <Play className="w-12 h-12 text-black/30 mb-3" />
        <p className="text-sm font-semibold">No shorts yet</p>
        <p className="text-xs text-black/50 mt-1">Check back later for short videos</p>
        <Link href="/" className="mt-6 bg-[#F5F5F5] text-black text-sm font-semibold px-6 py-2.5 rounded-md">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#171717] h-screen overflow-hidden fixed inset-0 z-[100]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Top bar — minimal, overlaid on video */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-black"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-black font-semibold text-base">Shorts</h1>
        <button
          onClick={() => setMuted(!muted)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-black"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Vertical scroll container — snap to each video */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {videos.map((video, idx) => {
          const seller = video.seller || {};
          const sellerName = seller.business_name || 'Seller';
          const sellerImage = seller.profile_image;
          const caption = video.caption || '';
          const views = video.views_count || 0;
          const likesCount = video.likes_count || 0;
          const isLiked = likes[video.id];
          const isSaved = saved[video.id];
          const commentsCount = commentsCounts[video.id] ?? video.comments_count ?? 0;
          const product = video.product;

          return (
            <div
              key={video.id}
              data-index={idx}
              className="snap-start h-screen w-full relative flex items-center justify-center"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Video */}
              <video
                ref={(el) => { videoRefs.current[idx] = el; }}
                src={video.video_url}
                muted={muted}
                loop
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

              {/* Right rail — action buttons */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
                {/* Like */}
                <button
                  onClick={() => toggleLike(video.id)}
                  className="flex flex-col items-center gap-1 text-black"
                  aria-label="Like"
                >
                  <Heart
                    className={`w-8 h-8 transition-transform ${isLiked ? 'fill-[#171717] text-[#171717] scale-110' : 'text-black'}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] font-semibold">{formatCount(likesCount + (isLiked ? 1 : 0))}</span>
                </button>

                {/* Comment */}
                <button
                  onClick={() => setCommentsOpenFor(video.id)}
                  className="flex flex-col items-center gap-1 text-black"
                  aria-label="Comments"
                >
                  <MessageCircle className="w-8 h-8" strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold">{formatCount(commentsCount)}</span>
                </button>

                {/* Share */}
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      navigator.share({ title: caption, url: window.location.href }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(window.location.href);
                      toast({ title: 'Link copied' });
                    }
                  }}
                  className="flex flex-col items-center gap-1 text-black"
                  aria-label="Share"
                >
                  <Share2 className="w-8 h-8" strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold">Share</span>
                </button>

                {/* Save */}
                <button
                  onClick={() => toggleSave(video.id)}
                  className="flex flex-col items-center gap-1 text-black"
                  aria-label="Save"
                >
                  <Bookmark
                    className={`w-8 h-8 ${isSaved ? 'fill-white text-black' : 'text-black'}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] font-semibold">Save</span>
                </button>
              </div>

              {/* Bottom — seller info + caption + product CTA */}
              <div className="absolute left-0 right-16 bottom-24 px-4 z-20">
                {/* Seller row */}
                <div className="flex items-center gap-2 mb-2">
                  <Link href={seller.slug ? `/${seller.slug}` : (seller.id ? `/seller-profile?id=${seller.id}` : '#')}>
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white bg-[#F5F5F5] shrink-0">
                      {sellerImage ? (
                        <img src={sellerImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black font-bold text-sm">
                          {sellerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>
                  <Link href={seller.slug ? `/${seller.slug}` : (seller.id ? `/seller-profile?id=${seller.id}` : '#')} className="text-black font-semibold text-sm hover:opacity-80">
                    {sellerName}
                  </Link>
                  {!user && (
                    <Link
                      href="/login"
                      className="ml-2 bg-[#F5F5F5] text-black text-xs font-semibold px-3 py-1 rounded-md"
                    >
                      Follow
                    </Link>
                  )}
                </div>

                {/* Caption */}
                {caption && (
                  <p className="text-black text-sm leading-snug mb-2 line-clamp-2">{caption}</p>
                )}

                {/* Product CTA */}
                {product && (
                  <Link
                    href={`/product?id=${product.id}`}
                    className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg pl-2 pr-3 py-1.5 max-w-full"
                  >
                    <div className="w-8 h-8 rounded overflow-hidden bg-[#F5F5F5] shrink-0">
                      {product.image_url && (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium text-black truncate">{product.name}</div>
                      <div className="text-xs font-bold text-black">{formatPrice(product.price)}</div>
                    </div>
                    <ShoppingBag className="w-4 h-4 text-black ml-1 shrink-0" />
                  </Link>
                )}
              </div>

              {/* Index indicator (top center) */}
              {videos.length > 1 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm text-black text-[10px] font-semibold px-2 py-0.5 rounded-full z-20">
                  {idx + 1} / {videos.length}
                </div>
              )}

              {/* Comments modal (per-video) */}
              <CommentsModal
                open={commentsOpenFor === video.id}
                onClose={() => setCommentsOpenFor(null)}
                postType="video"
                postId={video.id}
                postCaption={caption}
                onCommentAdded={(count) => setCommentsCounts(prev => ({ ...prev, [video.id]: count }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
