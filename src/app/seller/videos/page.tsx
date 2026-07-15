'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice, timeAgo } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold">Product Videos</h1>
        <p className="text-sm text-slate-500">Showcase your products with short videos</p>
      </div>

      <Card className="p-4 border-slate-100 space-y-3">
        <h3 className="font-bold text-sm">Upload new video</h3>
        <div className="space-y-1.5">
          <Label className="text-xs">Video URL *</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://... (mp4 or HLS)" />
          <p className="text-[10px] text-slate-400">Upload your video to a hosting service and paste the URL here</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Caption *</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Check out this amazing product!" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Link to product (optional)</Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">No product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>
            ))}
          </select>
        </div>
        <Button onClick={create} disabled={uploading} className="w-full brand-gradient text-primary-foreground font-bold">
          <Upload className="w-4 h-4 mr-1" />
          {uploading ? 'Posting...' : 'Post video'}
        </Button>
      </Card>

      {videos.length === 0 ? (
        <EmptyState
          icon={<Video className="w-8 h-8" />}
          title="No videos yet"
          message="Post your first product video to attract more buyers."
        />
      ) : (
        <div className="space-y-3">
          <h3 className="font-bold text-sm">Your videos ({videos.length})</h3>
          {videos.map((v) => (
            <Card key={v.id} className="p-3 border-slate-100 flex gap-3">
              <div className="w-24 h-24 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                {v.video_url ? (
                  <video src={v.video_url} className="w-full h-full object-cover rounded-lg" muted />
                ) : (
                  <Video className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold line-clamp-1">{v.caption}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {v.views_count || 0}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {v.likes_count || 0}</span>
                  <span>{timeAgo(v.created_at)}</span>
                </div>
                {v.product && (
                  <div className="text-xs text-slate-600 mt-1">Product: {v.product.name}</div>
                )}
              </div>
              <button onClick={() => remove(v.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
