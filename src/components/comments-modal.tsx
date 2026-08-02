'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

interface Comment {
  id: number;
  text: string;
  createdAt: string;
  userId: string;
  userName: string;
  userImage?: string;
}

interface CommentsModalProps {
  open: boolean;
  onClose: () => void;
  postType: 'video' | 'product';
  postId: string | number;
  postCaption?: string;
  onCommentAdded?: (count: number) => void;
}

export function CommentsModal({ open, onClose, postType, postId, postCaption, onCommentAdded }: CommentsModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load comments when modal opens
  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await api.comments.list(postType, postId);
        if (!cancelled && resp.success) {
          setComments(resp.comments || []);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load comments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, postType, postId]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setText('');
      setError('');
    }
  }, [open]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    if (!user) {
      onClose();
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const resp = await api.comments.create(postType, postId, trimmed);
      if (resp.success && resp.comment) {
        setComments(prev => [resp.comment, ...prev]);
        setText('');
        onCommentAdded?.(comments.length + 1);
        // Scroll to top to show new comment
        if (listRef.current) listRef.current.scrollTop = 0;
      } else {
        setError(resp.error || 'Failed to post comment');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    try {
      const resp = await api.comments.delete(commentId);
      if (resp.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        onCommentAdded?.(comments.length - 1);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <h3 className="text-base font-semibold text-white">Comments</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Post caption (context) */}
            {postCaption && (
              <div className="px-4 py-2.5 border-b border-white/5 text-sm text-slate-300 shrink-0">
                {postCaption}
              </div>
            )}

            {/* Comments list */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-center text-slate-500 text-sm py-8">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 overflow-hidden">
                      {c.userImage ? (
                        <img src={c.userImage} alt={c.userName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-slate-300">
                          {c.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white/5 rounded-2xl px-3 py-2">
                        <div className="text-xs font-semibold text-white mb-0.5">{c.userName}</div>
                        <div className="text-sm text-slate-200 break-words">{c.text}</div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-3">
                        <span className="text-[10px] text-slate-500">{timeAgoShort(c.createdAt)}</span>
                        {user?.id === c.userId && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-[10px] text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10 shrink-0">
              {error && <div className="text-xs text-red-400 mb-2 px-1">{error}</div>}
              {user ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment..."
                    maxLength={1000}
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/30"
                    disabled={submitting}
                  />
                  <button
                    onClick={submit}
                    disabled={!text.trim() || submitting}
                    className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                    aria-label="Post comment"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { onClose(); router.push('/login'); }}
                  className="w-full text-center text-sm text-sky-400 hover:text-sky-300 py-2"
                >
                  Log in to comment
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function timeAgoShort(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}
