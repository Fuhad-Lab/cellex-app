'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Package, Video, FileText, Camera, BookOpen, ChevronLeft, Upload, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
import { api, formatPrice, API_BASE } from '@/lib/api';

type PostType = 'video' | 'photo' | 'text' | 'story';

export default function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSeller, setIsSeller] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  // Form state
  const [postType, setPostType] = useState<PostType>('photo');
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/create');
      return;
    }
    if (user) {
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/seller-profile`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'get' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.seller) {
              setIsSeller(true);
              // Fetch seller's products for the dropdown
              const prodResp = await api.sellerProducts.list();
              if (prodResp.success) setProducts(prodResp.products || []);
            }
          }
        } catch {}
        setChecking(false);
      })();
    }
  }, [user, authLoading, router]);

  const postTypes = [
    { type: 'photo' as PostType, icon: Camera, label: 'Photo', desc: 'Share a product photo' },
    { type: 'video' as PostType, icon: Video, label: 'Video', desc: 'Showcase a product' },
    { type: 'text' as PostType, icon: FileText, label: 'Text', desc: 'Write about a product' },
    { type: 'story' as PostType, icon: BookOpen, label: 'Story', desc: '24h story post' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Use the upload-image or upload-video endpoint
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/api/upload-video' : '/api/upload-image';
        const bodyKey = isVideo ? 'videoData' : 'imageData';
        const resp = await fetch(`${API_BASE}${endpoint}`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: base64 }),
        });
        const data = await resp.json();
        if (data.success) {
          setMediaUrl(data.url);
          toast({ title: 'Upload complete!' });
        } else {
          toast({ title: 'Upload failed', description: data.error });
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({ title: 'Upload failed' });
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast({ title: 'Please select a product', description: 'Every post must have a product attached.' });
      return;
    }
    if (postType !== 'text' && !mediaUrl) {
      toast({ title: 'Please upload media', description: `${postType} posts require an image or video.` });
      return;
    }
    if (postType === 'text' && !caption.trim()) {
      toast({ title: 'Please write a caption', description: 'Text posts need a caption.' });
      return;
    }

    setPosting(true);
    try {
      const resp = await api.feedPosts.create({
        postType,
        productId: Number(selectedProduct),
        caption,
        mediaUrl,
      });
      if (resp.success) {
        toast({ title: 'Post created!', description: 'Your post is now live in the feed.' });
        router.push('/');
      } else {
        toast({ title: 'Failed to create post', description: resp.error });
      }
    } catch (err) {
      toast({ title: 'Failed to create post' });
    }
    setPosting(false);
  };

  if (authLoading || checking) {
    return <PageSkeleton variant="create" />;
  }

  if (!isSeller) {
    return (
      <div className="ig-container min-h-screen ig-topbar-offset">
        <div className="fx-topbar ig-topbar">
          <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2" style={{ color: 'var(--cellex-text)' }}>Create</h1>
        </div>
        <div className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--cellex-text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--cellex-text-muted)' }}>
            You need a seller account to create posts.
          </p>
          <button
            onClick={() => router.push('/become-seller')}
            className="fx-btn-primary text-sm"
          >
            Become a Seller
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ig-container min-h-screen ig-topbar-offset pb-24">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.back()} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2" style={{ color: 'var(--cellex-text)' }}>Create Post</h1>
        <button
          onClick={handleSubmit}
          disabled={posting || uploading || !selectedProduct || (postType !== 'text' && !mediaUrl)}
          className="text-sm font-bold px-4 py-1.5 rounded-full transition disabled:opacity-40"
          style={{ background: 'var(--cellex-coral)', color: 'var(--cellex-bg)' }}
        >
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Post type selector */}
        <div>
          <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--cellex-text-muted)' }}>POST TYPE</label>
          <div className="grid grid-cols-4 gap-2">
            {postTypes.map((pt) => {
              const Icon = pt.icon;
              const active = postType === pt.type;
              return (
                <button
                  key={pt.type}
                  onClick={() => { setPostType(pt.type); setMediaUrl(''); }}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border transition"
                  style={{
                    background: active ? 'var(--cellex-coral)' : 'var(--cellex-surface)',
                    borderColor: active ? 'var(--cellex-coral)' : 'var(--cellex-border)',
                    color: active ? 'var(--cellex-bg)' : 'var(--cellex-text)',
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{pt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product attachment — REQUIRED */}
        <div>
          <label className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--cellex-text-muted)' }}>
            PRODUCT <span style={{ color: 'var(--cellex-coral)' }}>*</span>
            <span className="font-normal">(required — the product in this post)</span>
          </label>
          {products.length === 0 ? (
            <div className="p-4 rounded-xl text-center" style={{ background: 'var(--cellex-surface)', border: '1px solid var(--cellex-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--cellex-text-muted)' }}>No products yet. Add a product first.</p>
              <button onClick={() => router.push('/seller/products')} className="text-xs font-bold" style={{ color: 'var(--cellex-coral)' }}>
                Add Product →
              </button>
            </div>
          ) : (
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl p-3 text-sm outline-none"
              style={{ background: 'var(--cellex-surface)', border: '1px solid var(--cellex-border)', color: 'var(--cellex-text)' }}
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>
              ))}
            </select>
          )}
          {/* Show selected product preview */}
          {selectedProduct && (() => {
            const p = products.find((x) => x.id === Number(selectedProduct));
            if (!p) return null;
            return (
              <div className="mt-2 flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--cellex-surface)', border: '1px solid var(--cellex-border)' }}>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 shrink-0">
                  {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--cellex-text)' }}>{p.name}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--cellex-text)' }}>{formatPrice(p.price)}</div>
                </div>
                <Check className="w-4 h-4" style={{ color: 'var(--cellex-success)' }} />
              </div>
            );
          })()}
        </div>

        {/* Media upload (not needed for text posts) */}
        {postType !== 'text' && (
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--cellex-text-muted)' }}>
              {postType === 'video' ? 'VIDEO' : postType === 'photo' ? 'PHOTO' : 'MEDIA'} <span style={{ color: 'var(--cellex-coral)' }}>*</span>            </label>
            {mediaUrl ? (
              <div className="relative rounded-xl overflow-hidden" style={{ background: 'var(--cellex-surface)', border: '1px solid var(--cellex-border)' }}>
                {postType === 'video' || mediaUrl.includes('.mp4') ? (
                  <video src={mediaUrl} className="w-full max-h-64 object-contain" controls />
                ) : (
                  <img src={mediaUrl} alt="preview" className="w-full max-h-64 object-contain" />
                )}
                <button
                  onClick={() => setMediaUrl('')}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                  aria-label="Remove media"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition"
                style={{ borderColor: 'var(--cellex-border)', color: 'var(--cellex-text-muted)' }}
              >
                {uploading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--cellex-coral)', borderTopColor: 'transparent' }} />
                    <span className="text-xs">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" />
                    <span className="text-xs">Tap to upload {postType === 'video' ? 'a video' : 'an image'}</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={postType === 'video' ? 'video/*' : 'image/*'}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Caption */}
        <div>
          <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--cellex-text-muted)' }}>
            CAPTION {postType === 'text' && <span style={{ color: 'var(--cellex-coral)' }}>*</span>}
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={postType === 'text' ? 'Write about your product...' : 'Add a caption...'}
            rows={postType === 'text' ? 6 : 3}
            maxLength={2000}
            className="w-full rounded-xl p-3 text-sm outline-none resize-none"
            style={{ background: 'var(--cellex-surface)', border: '1px solid var(--cellex-border)', color: 'var(--cellex-text)' }}
          />
          <div className="text-right text-[10px] mt-1" style={{ color: 'var(--cellex-text-muted)' }}>
            {caption.length}/2000
          </div>
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--cellex-coral)' }} />
          <p className="text-xs" style={{ color: 'var(--cellex-text-muted)' }}>
            Every post must have a product attached. The product will be shown in the feed card so buyers can shop directly from your post.
            {postType === 'story' && ' Stories disappear after 24 hours.'}
          </p>
        </div>
      </div>
    </div>
  );
}
