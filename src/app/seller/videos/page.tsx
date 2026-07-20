'use client';

import { useEffect, useState, useRef } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Video, Upload, Trash2, Eye, Heart, Clapperboard, Package, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';

/**
 * SellerVideosPage — manage product videos AND reels.
 *
 * Two types of video content:
 * 1. Product Videos — tied to a specific product (shows in product detail)
 * 2. Reels — standalone short-form social content (shows in /shorts feed)
 *
 * The upload form supports both: selecting a product makes it a product video,
 * leaving it as "No product" makes it a reel.
 *
 * The video grid has tabs to filter: All / Product Videos / Reels.
 */
export default function SellerVideosPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState<number | ''>('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'all' | 'product' | 'reels'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [prodResp] = await Promise.all([api.sellerProducts.list()]);
    if (prodResp.success) setProducts(prodResp.products || []);
    try {
      const vidResp = await fetch(`${API_BASE}/api/videos`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'mine' }),
      });
      const data = await vidResp.json();
      if (data.success) setVideos(data.videos || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Video too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Upload the video file to /api/upload-video
        // We need a productId for the upload-video endpoint, so use a temp value
        // The endpoint stores it and returns a URL
        const tempProductId = productId || 0;
        const resp = await fetch(`${API_BASE}/api/upload-video`, {
      credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: tempProductId, videoData: reader.result }),
        });
        const data = await resp.json();
        if (data.success) {
          setVideoUrl(data.videoUrl);
          toast({ title: 'Video uploaded!', description: 'Now add a caption and post.' });
        } else {
          toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Upload failed', variant: 'destructive' });
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const create = async () => {
    if (!videoUrl || !caption) {
      toast({ title: 'Missing fields', description: 'Video and caption are required', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const result = await fetch(`${API_BASE}/api/videos`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'create',
        videoUrl: videoUrl,
        caption,
        productId: productId || null,
      }),
    });
    setUploading(false);
    const data = await result.json();
    if (data.success) {
      toast({ title: productId ? 'Product video posted!' : 'Reel posted!' });
      setCaption(''); setVideoUrl(''); setProductId('');
      load();
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this video?')) return;
    const result = await fetch(`${API_BASE}/api/videos`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'delete', videoId: id }),
    });
    const data = await result.json();
    if (data.success) {
      toast({ title: 'Deleted' });
      load();
    }
  };

  if (loading) { return <PageSkeleton variant="seller-videos" />; }

  const inputClass = "w-full bg-neutral-50 border border-white/10 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  // Filter videos based on tab
  const filteredVideos = videos.filter((v) => {
    if (tab === 'product') return v.product_id !== null && v.product_id !== undefined;
    if (tab === 'reels') return v.product_id === null || v.product_id === undefined;
    return true;
  });

  const isReel = !productId;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Videos & Reels</h1>
        <p className="text-sm text-neutral-500">Post product videos and short reels to engage buyers</p>
      </div>

      {/* Upload form */}
      <div className="border border-white/10 rounded-md p-4 space-y-3 bg-white">
        <div className="flex items-center gap-2">
          <div className={`flex-1 p-2 rounded-md text-center text-xs font-semibold ${isReel ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600'}`}>
            <Clapperboard className="w-4 h-4 inline mr-1" />
            Reel {isReel && '✓'}
          </div>
          <div className={`flex-1 p-2 rounded-md text-center text-xs font-semibold ${!isReel ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600'}`}>
            <Package className="w-4 h-4 inline mr-1" />
            Product Video {!isReel && '✓'}
          </div>
        </div>

        <p className="text-[11px] text-neutral-500">
          {isReel
            ? 'Reels are short standalone videos that appear in the Shorts feed. Great for showcasing your brand, behind-the-scenes, or product highlights.'
            : 'Product videos are tied to a specific product and appear on the product detail page.'}
        </p>

        {/* File upload */}
        {videoUrl ? (
          <div className="flex items-center gap-3">
            <video src={videoUrl} className="w-20 h-20 rounded-md object-cover bg-black" muted />
            <button
              type="button"
              onClick={() => setVideoUrl('')}
              className="text-xs text-red-500 font-medium"
            >
              Remove video
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-white/15 rounded-md p-4 flex items-center justify-center gap-2 hover:border-black hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                <span className="text-xs text-neutral-500">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-neutral-600" />
                <span className="text-xs text-neutral-700 font-medium">Upload from device</span>
                <span className="text-[10px] text-neutral-400 ml-1">Max 10MB</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </button>
        )}

        {/* Caption */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Caption *</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder={isReel ? "Check out our latest collection! 🔥" : "This product is amazing because..."} className={inputClass} />
        </div>

        {/* Product link (optional) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Link to product (optional — leave empty for a Reel)</Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
            className={inputClass}
          >
            <option value="">No product (Reel)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>
            ))}
          </select>
        </div>

        <button onClick={create} disabled={uploading || !videoUrl} className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50">
          <Upload className="w-4 h-4 inline mr-1" />
          {uploading ? 'Posting...' : isReel ? 'Post Reel' : 'Post Product Video'}
        </button>
      </div>

      {/* Video grid with tabs */}
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { key: 'all', label: `All (${videos.length})` },
            { key: 'product', label: `Product Videos (${videos.filter(v => v.product_id).length})` },
            { key: 'reels', label: `Reels (${videos.filter(v => !v.product_id).length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-black text-black'
                  : 'border-transparent text-neutral-500 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={tab === 'reels' ? <Clapperboard className="w-8 h-8" /> : <Video className="w-8 h-8" />}
            title={tab === 'reels' ? 'No reels yet' : tab === 'product' ? 'No product videos yet' : 'No videos yet'}
            message={tab === 'reels' ? 'Post your first reel to engage buyers with short-form content.' : 'Post your first video to attract more buyers.'}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredVideos.map((v) => {
              const isProductVideo = v.product_id !== null && v.product_id !== undefined;
              return (
                <div key={v.id} className="border border-white/10 rounded-md overflow-hidden bg-white">
                  <div className="aspect-[9/16] bg-black relative">
                    {v.video_url ? (
                      <video src={v.video_url} className="w-full h-full object-cover" muted />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <Video className="w-8 h-8" />
                      </div>
                    )}
                    {/* Type badge */}
                    <div className="absolute top-1 left-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isProductVideo ? 'bg-blue-500 text-white' : 'bg-black text-white'}`}>
                        {isProductVideo ? 'PRODUCT' : 'REEL'}
                      </span>
                    </div>
                    <button
                      onClick={() => remove(v.id)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#ed4956]"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium line-clamp-2">{v.caption}</div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-500">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {v.views_count || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {v.likes_count || 0}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{timeAgo(v.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
