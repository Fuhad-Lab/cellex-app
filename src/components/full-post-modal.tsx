'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Heart, MessageCircle, Share2, Bookmark, Send, BadgeCheck, MoreHorizontal, Store } from 'lucide-react';
import Link from 'next/link';
import { SmartImage } from '@/components/smart-image';
import { SmartVideo } from '@/components/smart-video';
import { CommentsModal } from '@/components/comments-modal';
import { api, formatPrice } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface FeedPost {
  type: 'video' | 'product';
  id: string;
  videoId?: number;
  productId?: number;
  sellerId?: string;
  sellerSlug?: string;
  sellerName: string;
  sellerImage?: string;
  mediaUrl: string;
  caption: string;
  likes: number;
  views?: number;
  comments: number;
  product?: any;
  soldCount?: number;
  createdAt?: string;
  isLive?: boolean;
  verified?: boolean;
  liked?: boolean;
}

interface FullPostModalProps {
  post: FeedPost | null;
  onClose: () => void;
}

/**
 * FullPostModal — X/Twitter detail view style full-screen overlay.
 *
 * Triggered by clicking the card HEADER (seller info) — NOT the media.
 * The media click goes directly to the product page (high intent).
 *
 * Structure (top to bottom):
 * 1. Top navigation bar (back button)
 * 2. Post body (caption text)
 * 3. Media (photo/video)
 * 4. Engagement bar (Like, Comment, Share)
 * 5. Comments section
 *
 * Scroll position is preserved: the modal locks body scroll on open
 * and restores it on close.
 */
export function FullPostModal({ post, onClose }: FullPostModalProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(post?.comments || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const { toast } = useToast();

  // Sync state when post changes
  useEffect(() => {
    if (post) {
      setLiked(!!post.liked);
      setLikeCount(post.likes || 0);
      setCommentCount(post.comments || 0);
    }
  }, [post]);

  // Lock body scroll when modal is open, restore on close
  useEffect(() => {
    if (post) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [post]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (post) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [post, onClose]);

  const handleLike = useCallback(async () => {
    if (!post) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      const itemId = post.videoId ? `video:${post.videoId}` : post.productId ? `product:${post.productId}` : post.id;
      await api.feedback(itemId, newLiked ? 'like' : 'unlike', newLiked ? 1 : 0);
    } catch {}
  }, [post, liked]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    const url = post.product ? `${window.location.origin}/product?id=${post.product.id}` : window.location.href;
    if (navigator.share) {
      navigator.share({ title: post.caption || 'Check this out on Cellex', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast({ title: 'Link copied!' });
    }
    if (post.videoId) api.feedback(`video:${post.videoId}`, 'share', 0.5);
    else if (post.productId) api.feedback(`product:${post.productId}`, 'share', 0.5);
  }, [post, toast]);

  const handleSave = useCallback(async () => {
    if (!post) return;
    const newSaved = !saved;
    setSaved(newSaved);
    toast({ title: newSaved ? 'Saved!' : 'Removed from saved' });
  }, [post, saved, toast]);

  const isVideo = post?.type === 'video';
  const handle = post?.sellerSlug || (post?.sellerName || 'seller').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sellerHref = post?.sellerSlug ? `/${post.sellerSlug}` : '#';
  const productHref = post?.product ? `/product?id=${post.product.id}` : '#';
  const subtext = post?.soldCount && post.soldCount > 0
    ? `${post.soldCount > 1000 ? `${(post.soldCount / 1000).toFixed(1)}k` : post.soldCount} sold`
    : 'Free shipping';

  return (
    <>
      {post && (
        <div
          className="fixed inset-0 z-[100] bg-white"
        >
          {/* ===== TOP NAVIGATION BAR ===== */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5]">
            <div className="flex items-center gap-4 px-4 h-14 max-w-2xl mx-auto">
              <button
                onClick={onClose}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F5F5F5] transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6 text-[#171717]" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#171717] truncate">Post</div>
              </div>
              <button
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F5F5F5] transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-5 h-5 text-[#737373]" />
              </button>
            </div>
          </div>

          {/* ===== SCROLLABLE CONTENT ===== */}
          <div className="overflow-y-auto h-[calc(100vh-3.5rem)]">
            <div className="max-w-2xl mx-auto pb-32">
              {/* ===== SELLER HEADER ===== */}
              <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                <Link href={sellerHref} className="flex items-center gap-3 min-w-0">
                  <div
                    className="shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ width: '44px', height: '44px', borderRadius: '999px', background: '#F3F4F6' }}
                  >
                    {post.sellerImage ? (
                      <SmartImage src={post.sellerImage} alt={post.sellerName} width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-base text-[#6B7280]">{post.sellerName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-[15px] text-[#171717] truncate">{post.sellerName}</span>
                      {post.verified && <BadgeCheck className="w-4 h-4 shrink-0 text-[#3B82F6]" strokeWidth={2} />}
                    </div>
                    <div className="text-[13px] text-[#6B7280] truncate">@{handle}</div>
                  </div>
                </Link>
              </div>

              {/* ===== 1. POST BODY (caption) ===== */}
              {post.caption && (
                <div className="px-4 pb-4">
                  <p className="text-[16px] text-[#171717] leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                </div>
              )}

              {/* ===== 2. MEDIA (photo/video) ===== */}
              <div className="px-4 pb-4">
                <div
                  className="relative overflow-hidden rounded-xl"
                  style={{ aspectRatio: '4 / 5', background: '#F3F4F6' }}
                >
                  {isVideo ? (
                    <SmartVideo src={post.mediaUrl} className="w-full h-full" autoPlay={true} loop={true} />
                  ) : (
                    <SmartImage
                      src={post.mediaUrl}
                      alt={post.caption || post.product?.name || ''}
                      width={800}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Product overlay */}
                  {post.product && (
                    <Link
                      href={productHref}
                      className="absolute"
                      style={{
                        bottom: '12px',
                        left: '12px',
                        background: 'rgba(17, 24, 39, 0.85)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        maxWidth: 'calc(100% - 24px)',
                      }}
                    >
                      <div className="font-semibold text-[15px] text-white truncate" style={{ maxWidth: '220px' }}>
                        {post.product.name}
                      </div>
                      <div className="text-[12px] text-white/80 mt-0.5">{subtext}</div>
                      <div className="font-bold text-[16px] text-white mt-1">{formatPrice(post.product.price)}</div>
                    </Link>
                  )}
                </div>
              </div>

              {/* ===== 3. ENGAGEMENT BAR ===== */}
              <div className="px-4 py-3 border-t border-[#F3F4F6]">
                <div className="flex items-center gap-6">
                  {/* Like */}
                  <button
                    onClick={handleLike}
                    className="flex items-center gap-2 "
                    aria-label={liked ? 'Unlike' : 'Like'}
                  >
                    <Heart
                      className="w-5 h-5"
                      strokeWidth={2}
                      style={{ color: liked ? '#EF4444' : '#374151', fill: liked ? '#EF4444' : 'none' }}
                    />
                    <span className="text-[14px] text-[#374151] font-medium">{likeCount}</span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => setCommentsOpen(true)}
                    className="flex items-center gap-2 "
                    aria-label="Comments"
                  >
                    <MessageCircle className="w-5 h-5 text-[#374151]" strokeWidth={2} />
                    <span className="text-[14px] text-[#374151] font-medium">{commentCount}</span>
                  </button>

                  {/* Share */}
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 "
                    aria-label="Share"
                  >
                    <Share2 className="w-5 h-5 text-[#374151]" strokeWidth={2} />
                    <span className="text-[14px] text-[#374151] font-medium">{post.views || 0}</span>
                  </button>

                  {/* Bookmark */}
                  <button
                    onClick={handleSave}
                    className="ml-auto flex items-center justify-center "
                    aria-label={saved ? 'Unsave' : 'Save'}
                  >
                    <Bookmark
                      className="w-5 h-5"
                      strokeWidth={2}
                      style={{ color: saved ? '#171717' : '#374151', fill: saved ? '#171717' : 'none' }}
                    />
                  </button>
                </div>
              </div>

              {/* ===== 4. COMMENTS SECTION ===== */}
              <div className="px-4 py-3 border-t border-[#F3F4F6]">
                <h3 className="text-sm font-semibold text-[#171717] mb-3">Comments</h3>
                <CommentsSection post={post} onCommentAdded={() => setCommentCount(c => c + 1)} />
              </div>
            </div>
          </div>

          {/* Comments modal (for adding/viewing all comments) */}
          {commentsOpen && (
            <CommentsModal
              open={commentsOpen}
              onClose={() => setCommentsOpen(false)}
              postType={isVideo ? 'video' : 'product'}
              postId={post.videoId || post.productId || post.id}
              postCaption={post.caption}
              onCommentAdded={() => setCommentCount(c => c + 1)}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ===== Comments Section (inline in the modal) ===== */
function CommentsSection({ post, onCommentAdded }: { post: FeedPost; onCommentAdded: () => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
  }, [post.id]);

  const loadComments = async () => {
    try {
      const postType = post.type === 'video' ? 'video' : 'product';
      const postId = post.videoId || post.productId || post.id;
      const result = await api.comments.list(postType, postId);
      if (result.success) setComments(result.comments || []);
    } catch {}
    setLoading(false);
  };

  const submitComment = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const postType = post.type === 'video' ? 'video' : 'product';
      const postId = post.videoId || post.productId || post.id;
      const result = await api.comments.create(postType, postId, input.trim());
      if (result.success) {
        setComments(prev => [...prev, result.comment]);
        setInput('');
        onCommentAdded();
        toast({ title: 'Comment added!' });
      } else {
        toast({ title: 'Could not add comment', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="text-sm text-[#737373] py-4 text-center">Loading comments...</div>;
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-[#737373] py-4 text-center">No comments yet. Be the first to comment!</p>
      ) : (
        comments.slice(0, 10).map((c: any) => (
          <div key={c.id} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0 text-xs font-bold text-[#6B7280]">
              {(c.user?.full_name || c.user_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="bg-[#F5F5F5] rounded-xl rounded-tl-md px-3 py-2">
                <div className="text-xs font-semibold text-[#171717]">{c.user?.full_name || c.user_name || 'User'}</div>
                <div className="text-sm text-[#171717] mt-0.5">{c.content}</div>
              </div>
              <div className="text-[10px] text-[#a3a3a3] mt-1 ml-2">
                {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Comment input */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitComment()}
          placeholder="Add a comment..."
          className="flex-1 bg-[#F5F5F5] border border-[#E5E5E5] rounded-full px-4 py-2 text-sm text-[#171717] outline-none focus:border-[#171717] transition-colors"
        />
        <button
          onClick={submitComment}
          disabled={!input.trim() || submitting}
          className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 shrink-0 bg-[#171717] hover:bg-[#333] transition-colors"
          aria-label="Send comment"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
