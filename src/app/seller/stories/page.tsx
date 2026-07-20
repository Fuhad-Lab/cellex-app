'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Send, Eye, Trash2, Megaphone, Tag, Package, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/product-card';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/api';
import { PageSkeleton } from '@/components/page-skeleton';
import { API_BASE } from '@/lib/api';
const STORY_TYPES = [
  { key: 'announcement', label: 'Announcement', icon: Megaphone },
  { key: 'deal', label: 'Deal', icon: Tag },
  { key: 'product_spotlight', label: 'Product Spotlight', icon: Package },
  { key: 'behind_scenes', label: 'Behind the Scenes', icon: Camera },
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
      const sResp = await fetch(`${API_BASE}/api/stories`, {
      credentials: 'include',
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
    const result = await fetch(`${API_BASE}/api/stories`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'create',
        story_type: storyType,
        image_url: imageUrl || null,
        body: caption,
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
    const result = await fetch(`${API_BASE}/api/stories`, {
      credentials: 'include',
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

  if (loading) { return <PageSkeleton variant="seller-stories" />; }

  const inputClass = "w-full bg-neutral-50 border border-white/10 rounded-md px-3 py-2.5 text-sm focus:bg-white focus:border-neutral-400 outline-none";

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Stories</h1>
        <p className="text-sm text-neutral-500">Post 24-hour stories to engage your followers</p>
      </div>

      {/* Post form */}
      <div className="border border-white/10 rounded-md p-4 space-y-3 bg-white">
        <h3 className="font-semibold text-sm">Post a story</h3>

        {/* Story type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Story type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STORY_TYPES.map((t) => {
              const Icon = t.icon;
              const isActive = storyType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setStoryType(t.key)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md border-2 text-[10px] font-semibold transition-all ${
                    isActive ? 'border-black bg-neutral-50 text-black' : 'border-white/10 text-neutral-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Image URL (optional)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-neutral-700">Caption</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Big announcement! 30% off everything today!" className={inputClass} />
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
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button onClick={post} disabled={posting} className="w-full bg-black text-white font-semibold rounded-md py-3 hover:bg-neutral-800 disabled:opacity-50">
          <Send className="w-4 h-4 inline mr-1" />
          {posting ? 'Posting...' : 'Post story (24h)'}
        </button>
      </div>

      {/* Active stories */}
      {stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-8 h-8" />}
          title="No active stories"
          message="Stories disappear after 24 hours. Post one to engage your followers."
        />
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Active stories ({stories.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stories.map((s) => (
              <div key={s.id} className="border border-white/10 rounded-md overflow-hidden bg-white relative">
                <div className="aspect-[9/16] bg-neutral-100 relative">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <button
                    onClick={() => remove(s.id)}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#ed4956]"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-[9px] font-bold uppercase text-white/80">{s.story_type?.replace(/_/g, ' ')}</span>
                    <p className="text-xs text-white line-clamp-2">{s.caption}</p>
                    <div className="text-[9px] text-white/70 mt-0.5 flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> {s.views_count || 0}
                    </div>
                  </div>
                </div>
                <div className="px-2 py-1 text-[10px] text-neutral-400">
                  {timeAgo(s.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
