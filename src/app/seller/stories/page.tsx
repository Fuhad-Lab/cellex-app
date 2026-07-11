'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Send, Eye, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/api';

const STORY_TYPES = [
  { key: 'announcement', label: '📢 Announcement', color: 'bg-blue-100 text-blue-700' },
  { key: 'deal', label: '💰 Deal', color: 'bg-red-100 text-red-700' },
  { key: 'product_spotlight', label: '📦 Product Spotlight', color: 'bg-purple-100 text-purple-700' },
  { key: 'behind_scenes', label: '🎬 Behind the Scenes', color: 'bg-green-100 text-green-700' },
];

export default function SellerStoriesPage() {
  const { toast } = useToast();
  const [stories, setStories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storyType, setStoryType] = useState('announcement');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState<number | ''>('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [prodResp] = await Promise.all([api.sellerProducts.list()]);
    if (prodResp.success) setProducts(prodResp.products || []);
    try {
      const sResp = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'mine' }),
      });
      const data = await sResp.json();
      if (data.success) setStories(data.stories || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!caption) {
      toast({ title: 'Caption required', variant: 'destructive' });
      return;
    }
    setPosting(true);
    const result = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'create',
        story_type: storyType,
        image_url: imageUrl || null,
        caption,
        product_id: productId || null,
      }),
    });
    setPosting(false);
    const data = await result.json();
    if (data.success) {
      toast({ title: 'Story posted! Expires in 24h' });
      setCaption(''); setImageUrl(''); setProductId('');
      load();
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this story?')) return;
    const result = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'delete', storyId: id }),
    });
    const data = await result.json();
    if (data.success) {
      toast({ title: 'Deleted' });
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold">Stories</h1>
        <p className="text-sm text-slate-500">Post 24-hour stories to engage your followers</p>
      </div>

      <Card className="p-4 border-slate-100 space-y-3">
        <h3 className="font-bold text-sm">Post a story</h3>

        <div className="space-y-1.5">
          <Label className="text-xs">Story type</Label>
          <div className="flex gap-2 flex-wrap">
            {STORY_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setStoryType(t.key)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  storyType === t.key ? t.color + ' ring-2 ring-offset-1 ring-primary' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Image URL (optional)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Caption</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Big announcement! 30% off everything today!" />
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
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <Button onClick={post} disabled={posting} className="w-full brand-gradient text-primary-foreground font-bold">
          <Send className="w-4 h-4 mr-1" />
          {posting ? 'Posting...' : 'Post story (24h)'}
        </Button>
      </Card>

      {stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8" />}
          title="No active stories"
          message="Stories disappear after 24 hours. Post one to engage your followers!"
        />
      ) : (
        <div className="space-y-3">
          <h3 className="font-bold text-sm">Active stories ({stories.length})</h3>
          {stories.map((s) => (
            <Card key={s.id} className="p-3 border-slate-100 flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {s.image_url ? (
                  <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <BookOpen className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded">{s.story_type?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(s.created_at)}</span>
                </div>
                <p className="text-sm mt-1 line-clamp-2">{s.caption}</p>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <Eye className="w-3 h-3" /> {s.views_count || 0} views
                </div>
              </div>
              <button onClick={() => remove(s.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
