'use client';

import { useEffect, useState } from 'react';
import { api, formatPrice } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, Eye, Square, Copy, ExternalLink, Video, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/lib/api';

import { useScrollPreservation } from '@/components/global-state-provider';
export default function GoLivePage() {
  useScrollPreservation('seller-go-live');

  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [featuredProductId, setFeaturedProductId] = useState<number | ''>('');
  const [starting, setStarting] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [otherLive, setOtherLive] = useState<any>(null);
  // Stream config fetched from server — NO hardcoded URLs/keys in frontend
  const [streamConfig, setStreamConfig] = useState<{rtmpServer: string; streamKey: string; embedUrl: string; previewUrl: string} | null>(null);

  useEffect(() => {
    (async () => {
      const result = await api.sellerProducts.list();
      if (result.success) setProducts(result.products || []);
      // Fetch stream config from server (Edge Functions)
      const configResp = await api.live.getStreamConfig();
      if (configResp.success && configResp.config) {
        setStreamConfig(configResp.config);
      }
      // Check if already live
      const liveResp = await api.live.list('live');
      if (liveResp.success) {
        const sessions = liveResp.sessions || [];
        if (sessions.length > 0) {
          setOtherLive(sessions[0]);
        }
      }
    })();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast({ title: `${label} copied!` });
  };

  const startLive = async () => {
    if (!title) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    if (otherLive) {
      toast({
        title: 'Another seller is live',
        description: 'Only one live session is supported at a time. Please wait.',
        variant: 'destructive',
      });
      return;
    }
    setStarting(true);
    // Stream URL comes from the server config — NOT hardcoded in frontend
    const streamUrl = streamConfig?.embedUrl || '';
    const result = await fetch(`${API_BASE}/api/live`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'start',
        title,
        stream_url: streamUrl,
        featured_product_id: featuredProductId || null,
      }),
    });
    setStarting(false);
    const data = await result.json();
    if (data.success) {
      setActiveSession(data.session);
      toast({ title: 'You are LIVE!', description: 'Start streaming in OBS to go on air' });
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const endLive = async () => {
    if (!activeSession || !confirm('End this live session?')) return;
    const result = await fetch(`${API_BASE}/api/live`, {
      credentials: 'include',
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

  const inputClass = "w-full bg-[#F5F5F5] border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm focus:bg-[#F5F5F5] focus:border-[#E5E5E5] outline-none";

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Go Live</h1>
        <p className="text-sm text-[#666666]">Start a live shopping session with video streaming</p>
      </div>

      {/* If another seller is already live, show a warning */}
      {otherLive && !activeSession && (
        <div className="border border-amber-200 bg-amber-50 rounded-md p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm text-amber-900">Another seller is currently live</div>
            <p className="text-xs text-amber-700 mt-1">
              {otherLive.title} by {otherLive.seller?.business_name || 'a seller'}.
              Only one live stream is supported at a time. Please wait for their session to end,
              or check back in a few minutes.
            </p>
            <a
              href={`/live-watch?id=${otherLive.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 mt-2 hover:underline"
            >
              Watch their stream <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {activeSession ? (
        <div className="space-y-4">
          {/* Active session banner */}
          <div className="border border-[#E5E5E5] rounded-md p-4 bg-[#F5F5F5]">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#F5F5F5] rounded-full animate-pulse" /> LIVE
              </span>
              <span className="text-xs font-semibold text-black">{activeSession.title}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[#666666] mb-3">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {activeSession.viewer_count || 0} viewers
              </span>
            </div>
            <a
              href={`/live-watch?id=${activeSession.id}`}
              target="_blank"
              className="text-xs text-black font-medium block mb-3 underline"
            >
              View public watch page
            </a>
            <button onClick={endLive} className="w-full bg-red-500 text-black font-semibold rounded-md py-2.5 hover:opacity-90">
              <Square className="w-4 h-4 inline mr-1" /> End session
            </button>
          </div>

          {/* Streaming instructions — shown when session is active */}
          <div className="border border-[#E5E5E5] rounded-md p-4 bg-[#F5F5F5] space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Video className="w-4 h-4" /> How to start streaming
            </h3>
            <p className="text-xs text-[#666666]">
              Your live session is created. Now connect your streaming software (OBS, Streamlabs, or your phone&apos;s live streaming app) to start broadcasting video.
            </p>

            {/* RTMP details — from server config */}
            {streamConfig ? (
              <div className="space-y-2">
                <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-md p-3">
                  <div className="text-[10px] font-semibold text-[#666666] uppercase tracking-wide mb-1">RTMP Server</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-black flex-1 truncate">{streamConfig.rtmpServer}</code>
                    <button
                      onClick={() => copyToClipboard(streamConfig.rtmpServer, 'RTMP server')}
                      className="shrink-0 p-1.5 hover:bg-[#F5F5F5] rounded transition-colors"
                      aria-label="Copy RTMP server"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#666666]" />
                    </button>
                  </div>
                </div>
                <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-md p-3">
                  <div className="text-[10px] font-semibold text-[#666666] uppercase tracking-wide mb-1">Stream Key</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-black flex-1 truncate">{streamConfig.streamKey}</code>
                    <button
                      onClick={() => copyToClipboard(streamConfig.streamKey, 'Stream key')}
                      className="shrink-0 p-1.5 hover:bg-[#F5F5F5] rounded transition-colors"
                      aria-label="Copy stream key"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#666666]" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#666666] p-3 bg-[#F5F5F5] rounded-md">
                Stream configuration is loading. Please wait...
              </div>
            )}

            {/* OBS setup steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-xs font-semibold text-blue-900 mb-2">OBS Setup (recommended):</div>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Download OBS Studio (free) from obsproject.com</li>
                <li>Go to Settings → Stream</li>
                <li>Set Service: Custom</li>
                <li>Paste the RTMP Server URL above</li>
                <li>Paste the Stream Key above</li>
                <li>Click Apply, then OK</li>
                <li>Add your camera/video source, then click Start Streaming</li>
              </ol>
            </div>

            {/* Phone streaming */}
            <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-md p-3">
              <div className="text-xs font-semibold text-[#666666] mb-1">Streaming from your phone?</div>
              <p className="text-xs text-[#666666]">
                Use any RTMP streaming app (e.g. Larix Broadcaster for iOS/Android).
                Set the RTMP URL and stream key above, then start streaming.
              </p>
            </div>

            {/* Preview link — from server config */}
            {streamConfig?.previewUrl && (
              <a
                href={streamConfig.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-semibold text-black border border-white/15 rounded-md py-2.5 hover:bg-[#F5F5F5] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open stream preview (opens in new tab)
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-[#E5E5E5] rounded-md p-4 space-y-3 bg-[#F5F5F5]">
          {/* Camera preview placeholder */}
          <div className="aspect-video bg-[#171717] rounded-md flex items-center justify-center text-black relative">
            <Video className="w-12 h-12" />
            <span className="absolute bottom-2 left-2 text-xs opacity-70">Video will stream via server</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#666666]">Session title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Tech Deals — Up to 30% off!" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#666666]">Featured product</Label>
            <select
              value={featuredProductId}
              onChange={(e) => setFeaturedProductId(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
            >
              <option value="">No featured product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPrice(p.price)}
                </option>
              ))}
            </select>
          </div>

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-xs font-semibold text-blue-900 mb-1">How live streaming works</div>
            <p className="text-xs text-blue-800">
              When you click Go Live, we&apos;ll create your session and give you an RTMP stream key.
              Enter that key in OBS (or any streaming app) to start broadcasting video.
              Viewers watch on your live watch page with real-time chat and your featured product.
            </p>
          </div>

          <button
            onClick={startLive}
            disabled={starting || !!otherLive}
            className="w-full bg-red-500 text-black font-semibold rounded-md py-3 hover:opacity-90 disabled:opacity-50"
          >
            <Radio className="w-4 h-4 inline mr-1" />
            {starting ? 'Starting...' : otherLive ? 'Another seller is live' : 'Go Live'}
          </button>
        </div>
      )}

      <div className="border border-[#E5E5E5] rounded-md p-4 bg-[#F5F5F5]">
        <h3 className="font-semibold text-sm mb-2">Tips for a great live session</h3>
        <ul className="text-xs text-[#666666] space-y-1 list-disc list-inside">
          <li>Test your stream 5 minutes before going live</li>
          <li>Have good lighting and a clear background</li>
          <li>Introduce yourself and what you&apos;ll showcase</li>
          <li>Engage with chat — answer questions quickly</li>
          <li>Feature a product with a clear call-to-action</li>
          <li>Typical session length: 15-45 minutes</li>
        </ul>
      </div>
    </div>
  );
}
