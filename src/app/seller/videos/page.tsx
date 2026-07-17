'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Video, Upload, Trash2, Eye, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { PageSkeleton } from '@/components/page-skeleton';
export default function SellerVideosPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState<number | ''>('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [prodResp] = await Promise.all([api.sellerProducts.list()]);
    if (prodResp.success) setProducts(prodResp.products || []);
    // Get seller's videos via by_seller — we don't have sellerId, use mine endpoint
    try {
      const vidResp = await fetch('/api/videos', {
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

  const create = async () => {
    if (!videoUrl || !caption) {
      toast({ title: 'Missing fields', description: 'Video URL and caption are required', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const result = await fetch('/api/videos', {
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
      toast({ title: 'Video posted!' });
      setCaption(''); setVideoUrl(''); setProductId('');
      load();
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this video?')) return;
    const result = await fetch('/api/videos', {
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

  const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Videos</h1>
          <p className="text-sm text-neutral-500">Showcase your products with short videos</p>
        </div>
        <button
          onClick={() => {
            if (navigator.userAgent.includes('Mobile')) {
              // Open file picker
              const el = document.getElementById('video-file-input') as HTMLInputElement | null;
              el?.click();
            }
          }}
          className="bg-black text-white font-semibold rounded-md px-3 py-2 text-xs hover:bg-neutral-800"
        >
          <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
        </button>
      </div>

      {/* Upload form */}
      <div className="border border-neutral-200 rounded-md p-4 space-y-3 bg-white">
        <h3 className="font-semibold text-sm">Upload new video</h3>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Video URL *</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://... (mp4 or HLS)" className={inputClass} />
          <p className="text-[10px] text-neutral-400">Upload your video to a hosting service and paste the URL here</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Caption *</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Check out this amazing product!" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Link to product (optional)</Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
            className={inputClass}
          >
            <option value="">No product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>
            ))}
          </select>
        </div>
        <button onClick={create} disabled={uploading} className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50">
          <Upload className="w-4 h-4 inline mr-1" />
          {uploading ? 'Posting...' : 'Post video'}
        </button>
      </div>

      {/* Video grid */}
      {videos.length === 0 ? (
        <EmptyState
          icon={<Video className="w-8 h-8" />}
          title="No videos yet"
          message="Post your first product video to attract more buyers."
        />
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Your videos ({videos.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {videos.map((v) => (
              <div key={v.id} className="border border-neutral-200 rounded-md overflow-hidden bg-white">
                <div className="aspect-[9/16] bg-black relative">
                  {v.video_url ? (
                    <video src={v.video_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <Video className="w-8 h-8" />
                    </div>
                  )}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
