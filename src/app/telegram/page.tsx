'use client';

import { useEffect, useState } from 'react';
import { api, timeAgo } from '@/lib/api';
import { Send, Users, ChevronLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/page-skeleton';
export default function TelegramPage() {
  const router = useRouter();
  const [info, setInfo] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [infoResp, recentResp] = await Promise.all([
        api.telegram.channelInfo(),
        api.telegram.recent(10),
      ]);
      if (infoResp.success) setInfo(infoResp);
      if (recentResp.success) setRecent(recentResp.broadcasts || []);
      setLoading(false);
    })();
  }, []);

  if (loading) { return <PageSkeleton variant="telegram" />; }

  const isConfigured = info?.configured;

  return (
    <div className="ig-container min-h-screen pb-24 ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.push('/profile')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Telegram Channel</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Channel card */}
        <div className={`border border-white/10 rounded-md p-4 ${isConfigured ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#0088cc] flex items-center justify-center text-white">
              <Send className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{info?.channelTitle || 'Cellex Official'}</h3>
              <div className="text-xs text-slate-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {info?.subscriberCount || 0} subscribers
                </span>
                {isConfigured ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Active
                  </span>
                ) : (
                  <span className="text-amber-600">Coming soon</span>
                )}
              </div>
            </div>
          </div>
          {isConfigured && info?.channelUrl && (
            <button
              onClick={() => window.open(info.channelUrl, '_blank')}
              className="w-full mt-3 bg-[#0088cc] hover:opacity-90 text-white font-semibold rounded-md py-2.5"
            >
              <Send className="w-4 h-4 inline mr-1" /> Join channel
            </button>
          )}
        </div>

        {/* What you'll get */}
        <div className="border border-white/10 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3">What you&apos;ll get</h3>
          <div className="space-y-2 text-sm">
            {[
              { title: 'Live alerts', desc: 'Get notified when sellers go live' },
              { title: 'New products', desc: 'Be first to see fresh listings' },
              { title: 'Group buys', desc: 'Join group buys before they fill up' },
              { title: 'Flash deals', desc: 'Limited-time offers and discounts' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-2 shrink-0" />
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent broadcasts */}
        <div className="border border-white/10 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white" /> Recent broadcasts
          </h3>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">No broadcasts yet</p>
          ) : (
            <div className="space-y-2">
              {recent.map((b) => (
                <div key={b.id} className="p-2 bg-white/5 rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase text-white bg-white/10 px-1.5 py-0.5 rounded">
                      {b.broadcast_type?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeAgo(b.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{b.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bot commands */}
        <div className="border border-white/10 rounded-md p-4">
          <h3 className="font-semibold text-sm mb-3">Telegram bot commands</h3>
          <p className="text-xs text-slate-400 mb-3">
            Chat with our bot to interact with Cellex right from Telegram:
          </p>
          <div className="space-y-2 text-xs">
            {[
              { cmd: '/subscribe', desc: 'Subscribe to broadcasts' },
              { cmd: '/latest', desc: 'See latest products' },
              { cmd: '/live', desc: 'See active live sessions' },
              { cmd: '/groupbuys', desc: 'See active group buys' },
              { cmd: '/buy <id>', desc: 'Get checkout URL for product' },
              { cmd: '/unsubscribe', desc: 'Stop receiving broadcasts' },
            ].map((c) => (
              <div key={c.cmd} className="flex items-center gap-3">
                <code className="bg-white/5 px-2 py-1 rounded font-mono text-white font-semibold whitespace-nowrap">{c.cmd}</code>
                <span className="text-slate-400">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
