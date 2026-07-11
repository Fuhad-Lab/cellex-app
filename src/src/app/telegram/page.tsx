'use client';

import { useEffect, useState } from 'react';
import { api, timeAgo } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Users, Bell, ChevronLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function TelegramPage() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isConfigured = info?.configured;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      <Link href="/profile" className="inline-flex items-center text-xs text-slate-500 hover:text-primary mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to profile
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0088cc] flex items-center justify-center">
          <Send className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Telegram Channel</h1>
          <p className="text-xs text-slate-500">Get deals, new arrivals & live alerts</p>
        </div>
      </div>

      {/* Channel card */}
      <Card className={`p-4 border-slate-100 mb-4 ${isConfigured ? '' : 'opacity-60'}`}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[#0088cc] flex items-center justify-center text-white">
            <Send className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">{info?.channelTitle || 'Cellex Official'}</h3>
            <div className="text-xs text-slate-500 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {info?.subscriberCount || 0} subscribers
              </span>
              {isConfigured ? (
                <span className="text-green-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Active
                </span>
              ) : (
                <span className="text-amber-600">Coming soon</span>
              )}
            </div>
          </div>
        </div>
        {isConfigured && info?.channelUrl && (
          <Button
            onClick={() => window.open(info.channelUrl, '_blank')}
            className="w-full mt-3 bg-[#0088cc] hover:bg-[#0077b3] text-white font-bold"
          >
            <Send className="w-4 h-4 mr-1" /> Join channel
          </Button>
        )}
      </Card>

      {/* What you'll get */}
      <Card className="p-4 border-slate-100 mb-4">
        <h3 className="font-bold text-sm mb-3">What you'll get</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Live alerts</div>
              <div className="text-xs text-slate-500">Get notified when sellers go live</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">New products</div>
              <div className="text-xs text-slate-500">Be first to see fresh listings</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Group buys</div>
              <div className="text-xs text-slate-500">Join group buys before they fill up</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Flash deals</div>
              <div className="text-xs text-slate-500">Limited-time offers and discounts</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent broadcasts */}
      <Card className="p-4 border-slate-100">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Recent broadcasts
        </h3>
        {recent.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">No broadcasts yet</p>
        ) : (
          <div className="space-y-2">
            {recent.map((b) => (
              <div key={b.id} className="p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {b.broadcast_type?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">{timeAgo(b.created_at)}</span>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2">{b.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Bot commands */}
      <Card className="p-4 border-slate-100 mt-4">
        <h3 className="font-bold text-sm mb-3">Telegram bot commands</h3>
        <p className="text-xs text-slate-500 mb-3">
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
              <code className="bg-slate-100 px-2 py-1 rounded font-mono text-primary font-bold whitespace-nowrap">{c.cmd}</code>
              <span className="text-slate-600">{c.desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
