'use client';

import { useEffect, useState, useRef, useCallback , Suspense} from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Send, Eye, ChevronLeft, ShoppingBag, Radio } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

function LiveWatchContent() {
  const params = useSearchParams();
  const sessionId = params.get('id') || '';
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [joined, setJoined] = useState(false);
  const [lastMsgId, setLastMsgId] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [sessResp, msgsResp] = await Promise.all([
      api.live.get(sessionId),
      api.live.messages(sessionId, 0),
    ]);
    if (sessResp.success && sessResp.session) {
      setSession(sessResp.session);
      if (sessResp.session.status === 'live' && user && !joined) {
        api.live.join(sessionId).then(() => setJoined(true));
      }
    }
    if (msgsResp.success) {
      setMessages(msgsResp.messages || []);
      const lastId = Math.max(0, ...(msgsResp.messages || []).map((m: any) => m.id || 0));
      setLastMsgId(lastId);
    }
    setLoading(false);
  }, [sessionId, user, joined]);

  useEffect(() => { load(); }, [load]);

  // Poll messages
  useEffect(() => {
    if (!sessionId || session?.status !== 'live') return;
    pollRef.current = setInterval(async () => {
      const result = await api.live.messages(sessionId, lastMsgId);
      if (result.success && result.messages?.length) {
        setMessages((prev) => [...prev, ...result.messages]);
        const newLast = Math.max(lastMsgId, ...result.messages.map((m: any) => m.id || 0));
        setLastMsgId(newLast);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, lastMsgId, session?.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !user) return;
    const text = chatInput.trim();
    setChatInput('');
    const result = await api.live.message(sessionId, text);
    if (!result.success) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Session not found</p>
        <Link href="/live" className="text-primary font-bold mt-3 inline-block">Back to live</Link>
      </div>
    );
  }

  const isLive = session.status === 'live';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
      <Link href="/live" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-2">
        <ChevronLeft className="w-4 h-4" /> Back to live
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Stream */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-slate-100">
            <div className="aspect-video bg-black relative">
              {session.stream_url ? (
                session.stream_url.includes('youtube') || session.stream_url.includes('youtu.be') ? (
                  <iframe
                    src={session.stream_url.replace('watch?v=', 'embed/')}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <video src={session.stream_url} autoPlay muted loop controls className="w-full h-full" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white flex-col gap-2">
                  <Radio className="w-12 h-12" />
                  <p className="text-sm">Audio-only / text live session</p>
                </div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-2">
                {isLive && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                )}
                <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {session.viewer_count || 0}
                </span>
              </div>
            </div>
            <div className="p-3">
              <h1 className="font-bold text-base">{session.title}</h1>
              <div className="text-xs text-slate-500 mt-0.5">
                by <Link href={`/seller-profile?id=${session.seller_id}`} className="text-primary font-semibold">{session.seller_name}</Link>
              </div>

              {session.featured_product && (
                <Card className="mt-3 p-3 border-slate-100 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-slate-50 overflow-hidden">
                    {session.featured_product.image_url && (
                      <img src={session.featured_product.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm line-clamp-1">{session.featured_product.name}</div>
                    <div className="text-primary font-extrabold">{formatPrice(session.featured_product.price)}</div>
                  </div>
                  <Link href={`/product?id=${session.featured_product.id}`}>
                    <Button size="sm" className="brand-gradient text-primary-foreground">
                      <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Buy
                    </Button>
                  </Link>
                </Card>
              )}
            </div>
          </Card>
        </div>

        {/* Chat */}
        <div className="lg:col-span-1">
          <Card className="border-slate-100 flex flex-col h-[60vh] lg:h-[calc(100vh-7rem)]">
            <div className="p-3 border-b border-slate-100 font-bold text-sm">Live Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-xs text-slate-400 mt-8">No messages yet. Be the first!</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className={`font-bold ${m.message_type === 'system' ? 'text-amber-600' : m.message_type === 'purchase' ? 'text-green-600' : 'text-primary'}`}>
                    {m.name || m.sender_name || 'Anonymous'}:
                  </span>{' '}
                  <span className="text-slate-700">{m.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 border-t border-slate-100 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={user ? 'Type a message...' : 'Login to chat'}
                disabled={!user || !isLive}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50"
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!user || !isLive || !chatInput.trim()}
                className="brand-gradient text-primary-foreground"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LiveWatchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" /></div>}>
      <LiveWatchContent />
    </Suspense>
  );
}

