'use client';

import { useEffect, useState, useRef, useCallback , Suspense} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, formatPrice } from '@/lib/api';
import { Send, Eye, ChevronLeft, ShoppingBag, Radio } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { PageSkeleton } from '@/components/page-skeleton';
function LiveWatchContent() {
  const params = useSearchParams();
  const sessionId = params.get('id') || '';
  const router = useRouter();
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

  if (loading) { return <PageSkeleton variant="live" />; }

  if (!session) {
    return (
      <div className="ig-container bg-white min-h-screen ig-topbar-offset">
        <div className="ig-topbar">
          <button onClick={() => router.push('/live')} className="ig-icon-btn" aria-label="Back">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold flex-1 ml-2">Live</h1>
        </div>
        <div className="text-center py-20">
          <p className="text-neutral-500">Session not found</p>
          <Link href="/live" className="text-black font-semibold mt-3 inline-block">Back to live</Link>
        </div>
      </div>
    );
  }

  const isLive = session.status === 'live';

  return (
    <div className="ig-container bg-white min-h-screen pb-24">
      {/* Top bar */}
      <div className="ig-topbar">
        <button onClick={() => router.push('/live')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2 truncate">{session.title}</h1>
      </div>

      {/* Stream */}
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
            <span className="bg-[#ed4956] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </span>
          )}
          <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Eye className="w-3 h-3" /> {session.viewer_count || 0}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="p-4">
        <h2 className="font-semibold text-base">{session.title}</h2>
        <div className="text-xs text-neutral-500 mt-0.5">
          by{' '}
          <Link href={session.seller_slug ? `/${session.seller_slug}` : `/seller-profile?id=${session.seller_id}`} className="text-black font-medium">
            {session.seller_name}
          </Link>
        </div>

        {session.featured_product && (
          <div className="mt-3 border border-neutral-200 rounded-md p-3 flex items-center gap-3">
            <div className="w-16 h-16 rounded-md bg-neutral-50 overflow-hidden">
              {session.featured_product.image_url && (
                <img src={session.featured_product.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm line-clamp-1">{session.featured_product.name}</div>
              <div className="text-black font-bold">{formatPrice(session.featured_product.price)}</div>
            </div>
            <Link href={`/product?id=${session.featured_product.id}`}>
              <button className="bg-black text-white font-semibold rounded-md px-3 py-2 text-xs hover:bg-neutral-800">
                <ShoppingBag className="w-3.5 h-3.5 inline mr-1" /> Buy
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="border-t border-neutral-200 flex flex-col h-[50vh]">
        <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm">Live Chat</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-neutral-400 mt-8">No messages yet. Be the first.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className={`font-semibold ${m.message_type === 'system' ? 'text-amber-600' : m.message_type === 'purchase' ? 'text-green-600' : 'text-black'}`}>
                {m.name || m.sender_name || 'Anonymous'}:
              </span>{' '}
              <span className="text-neutral-800">{m.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="p-2 border-t border-neutral-100 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={user ? 'Type a message...' : 'Login to chat'}
            disabled={!user || !isLive}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2 text-sm disabled:opacity-50 focus:bg-white focus:border-neutral-400 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!user || !isLive || !chatInput.trim()}
            className="bg-black text-white rounded-md px-4 disabled:opacity-30 hover:bg-neutral-800"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveWatchPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="live" />}>
      <LiveWatchContent />
    </Suspense>
  );
}

