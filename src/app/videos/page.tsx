'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Share2, Play, Volume2, VolumeX, ChevronLeft,
  MessageCircle, ShoppingBag, Bookmark, Star, X, Send } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';

interface Comment {
  id: number;
  user: string;
  text: string;
  avatar?: string;
  time: string;
}

export default function VideosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<any[]>([]);
  const [followedVideos, setFollowedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'recommend' | 'follow'>('recommend');
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentCount, setCommentCount] = useState<Record<number, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const result = await api.videos.feed(30);
      if (result.success) {
        setVideos(result.videos || []);
        // Initialize comment counts with fake data
        const counts: Record<number, number> = {};
        (result.videos || []).forEach((v: any) => {
          counts[v.id] = Math.floor((v.views_count || 0) / 20) + Math.floor(Math.random() * 50);
        });
        setCommentCount(counts);
      }
      setLoading(false);
    })();
  }, []);

  // Load followed sellers' videos
  useEffect(() => {
    if (tab === 'follow') {
      loadFollowedVideos();
    }
  }, [tab]);

  const loadFollowedVideos = async () => {
    if (!user) return;
    // Get followed sellers
    const followingResp = await api.social.following();
    if (followingResp.success && followingResp.sellers) {
      const followedIds = new Set(followingResp.sellers.map((s: any) => s.id));
      // Filter the main feed to only include videos from followed sellers
      const filtered = videos.filter(v => v.seller && followedIds.has(v.seller.id));
      setFollowedVideos(filtered);
    }
  };

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
      if (tab === 'follow') loadFollowedVideos();
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

  // Comments overlay
  const openComments = (video: any) => {
    // Generate mock comments for now
    const mockUsers = ['Adebayo', 'Chioma', 'Tunde', 'Zainab', 'Emeka', 'Fatima', 'Kunle', 'Aisha'];
    const mockComments = [
      'This looks amazing! 🔥',
      'How much is delivery to Lagos?',
      'Is this still available?',
      'Great product, just ordered one',
      'Can I get a discount?',
      'What\'s the warranty?',
      'Love this! Ordering now',
      'Quality looks good',
    ];
    const count = commentCount[video.id] || 5;
    const generated: Comment[] = [];
    for (let i = 0; i < Math.min(count, 8); i++) {
      generated.push({
        id: i,
        user: mockUsers[Math.floor(Math.random() * mockUsers.length)],
        text: mockComments[Math.floor(Math.random() * mockComments.length)],
        time: `${Math.floor(Math.random() * 24)}h ago`,
      });
    }
    setComments(generated);
    setShowComments(true);
  };

  const sendComment = () => {
    if (!commentInput.trim()) return;
    setComments([
      { id: Date.now(), user: 'You', text: commentInput.trim(), time: 'now' },
      ...comments,
    ]);
    setCommentInput('');
  };

  const displayVideos = tab === 'follow' ? followedVideos : videos;

  if (loading) { return <PageSkeleton variant="videos" />; }

  if (displayVideos.length === 0) {
    return (
      <div className="bg-black min-h-screen flex flex-col items-center justify-center text-white px-6">
        <Play className="w-12 h-12 mx-auto text-white/30 mb-3" />
        {tab === 'follow' ? (
          <>
            <p className="text-white text-base font-bold">No videos from followed sellers</p>
            <p className="text-white/60 text-sm mt-1 text-center">Follow sellers to see their videos here</p>
            <Button
              onClick={() => setTab('recommend')}
              className="mt-4 brand-gradient text-white"
            >
              Browse recommended
            </Button>
          </>
        ) : (
          <p className="text-white/60 text-sm">No videos yet</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen relative">
      {/* Top bar: Back button + tabs */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3 py-3 px-4">
          <button
            onClick={() => window.history.back()}
            className="text-white shrink-0"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center justify-center gap-6 flex-1">
            <button
              onClick={() => setTab('follow')}
              className={`text-sm font-medium ${tab === 'follow' ? 'text-white' : 'text-white/60'}`}
            >
              Follow
            </button>
            <button
              onClick={() => setTab('recommend')}
              className={`text-sm font-bold ${tab === 'recommend' ? 'text-white border-b-2 border-white pb-0.5' : 'text-white/60'}`}
          >
            Recommend
          </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] overflow-y-auto snap-y snap-mandatory no-scrollbar"
      >
        {displayVideos.map((video, idx) => {
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

              {/* Top-right: mute toggle */}
              <button
                onClick={() => setMuted(!muted)}
                className="absolute top-12 right-3 z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* === RIGHT-SIDE ACTION RAIL === */}
              <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4 z-20">
                {/* Seller avatar + Follow button */}
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

                {/* Like */}
                <button onClick={() => toggleLike(video.id)} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors ${likes[video.id] ? 'bg-primary' : 'bg-black/40'}`}>
                    <Heart className={`w-6 h-6 ${likes[video.id] ? 'fill-white text-white' : 'text-white'}`} />
                  </div>
                  <span className="text-xs text-white font-bold">{(video.likes_count || 0) + (likes[video.id] ? 1 : 0)}</span>
                </button>

                {/* Comment (opens overlay) */}
                <button onClick={() => openComments(video)} className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-white font-bold">{commentCount[video.id] || 0}</span>
                </button>

                {/* Share */}
                <button onClick={() => share(video)} className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-white font-bold">Share</span>
                </button>

                {/* Save */}
                <button onClick={() => toggleSave(video.id)} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors ${saved[video.id] ? 'bg-yellow-500' : 'bg-black/40'}`}>
                    <Bookmark className={`w-6 h-6 ${saved[video.id] ? 'fill-white text-white' : 'text-white'}`} />
                  </div>
                  <span className="text-xs text-white font-bold">Save</span>
                </button>
              </div>

              {/* === BOTTOM-LEFT INFO === */}
              <div className="absolute bottom-20 left-3 right-20 z-20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    VIDEO
                  </span>
                  <Link href={sellerId ? `/seller-profile?id=${sellerId}` : '#'}>
                    <span className="text-white text-sm font-bold">@{sellerName}</span>
                  </Link>
                </div>

                {video.caption && (
                  <p className="text-white text-sm mb-2 line-clamp-2 leading-snug">{video.caption}</p>
                )}

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
                        </div>
                      </div>
                      <Button size="sm" className="brand-gradient text-white h-8 shrink-0">Buy</Button>
                    </Card>
                  </Link>
                )}

                <div className="flex items-center gap-1.5 mt-2">
                  <span className="bg-black/70 backdrop-blur text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> Verified Seller
                  </span>
                  <span className="bg-black/70 backdrop-blur text-white text-xs px-2 py-0.5 rounded">7-Day Returns</span>
                </div>
              </div>

              {/* Bottom CTA */}
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

      {/* === COMMENTS OVERLAY (slide-up panel) === */}
      {showComments && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowComments(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-white rounded-t-2xl max-h-[60vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-black">{comments.length} Comments</h3>
              <button onClick={() => setShowComments(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {c.user.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-black">{c.user}</span>
                      <span className="text-xs text-slate-400">{c.time}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5">{c.text}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary">
                        <Heart className="w-3 h-3" /> Like
                      </button>
                      <button className="text-xs text-slate-400 hover:text-primary">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <div className="border-t border-slate-100 p-3 flex items-center gap-2">
              {user ? (
                <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {(user.email || '?').charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
              )}
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                placeholder={user ? 'Add a comment...' : 'Login to comment'}
                disabled={!user}
                className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50"
              />
              <button
                onClick={sendComment}
                disabled={!commentInput.trim() || !user}
                className="text-primary font-bold text-sm disabled:opacity-30"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
