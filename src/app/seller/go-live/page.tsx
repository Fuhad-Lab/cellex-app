'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, Eye, Play, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function GoLivePage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [featuredProductId, setFeaturedProductId] = useState<number | ''>('');
  const [starting, setStarting] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const result = await api.sellerProducts.list();
      if (result.success) setProducts(result.products || []);
      // Check if already live
      const liveResp = await api.live.list('live');
      if (liveResp.success) {
        const mine = (liveResp.sessions || []).find((s: any) => s.seller_id === activeSession?.seller_id);
        if (mine) setActiveSession(mine);
      }
    })();
  }, []);

  const startLive = async () => {
    if (!title) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setStarting(true);
    const result = await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'start',
        title,
        stream_url: streamUrl || null,
        featured_product_id: featuredProductId || null,
      }),
    });
    setStarting(false);
    const data = await result.json();
    if (data.success) {
      setActiveSession(data.session);
      toast({ title: 'You are LIVE!', description: 'Your session has started' });
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const endLive = async () => {
    if (!activeSession || !confirm('End this live session?')) return;
    const result = await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'end', sessionId: activeSession.id }),
    });
    const data = await result.json();
    if (data.success) {
      setActiveSession(null);
      toast({ title: 'Session ended' });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold">Go Live</h1>
        <p className="text-sm text-slate-500">Start a live shopping session</p>
      </div>

      {activeSession ? (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </span>
            <span className="text-xs font-bold text-red-700">{activeSession.title}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-700 mb-3">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" /> {activeSession.viewer_count || 0} viewers
            </span>
          </div>
          <a
            href={`/live-watch?id=${activeSession.id}`}
            target="_blank"
            className="text-xs text-primary font-semibold block mb-3"
          >
            View public watch page →
          </a>
          <Button onClick={endLive} variant="destructive" className="w-full">
            <Square className="w-4 h-4 mr-1" /> End session
          </Button>
        </Card>
      ) : (
        <Card className="p-4 border-slate-100 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Session title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Tech Deals — Up to 30% off!" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stream URL (optional)</Label>
            <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="YouTube/HLS link — leave blank for text-only" />
            <p className="text-[10px] text-slate-400">Supports YouTube links or HLS streams. Without a URL, viewers can still chat and buy.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Featured product</Label>
            <select
              value={featuredProductId}
              onChange={(e) => setFeaturedProductId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">No featured product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPrice(p.price)}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={startLive}
            disabled={starting}
            className="w-full brand-gradient text-primary-foreground font-bold"
          >
            <Radio className="w-4 h-4 mr-1" />
            {starting ? 'Starting...' : 'Go Live'}
          </Button>
        </Card>
      )}

      <Card className="p-4 border-slate-100 bg-slate-50">
        <h3 className="font-bold text-sm mb-2">Tips for a great live session</h3>
        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
          <li>Test your stream URL 5 minutes before going live</li>
          <li>Have a clear opening — introduce yourself and what you'll showcase</li>
          <li>Engage with chat — answer questions quickly</li>
          <li>Feature a product with a clear call-to-action</li>
          <li>Typical session length: 15-45 minutes</li>
        </ul>
      </Card>
    </div>
  );
}
