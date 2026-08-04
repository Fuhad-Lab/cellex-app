'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Bell, Package, Heart, Store, Radio, Users, Sparkles, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { PageSkeleton } from '@/components/page-skeleton';
import { api, timeAgo } from '@/lib/api';

import { usePersistedState, useScrollPreservation } from '@/components/global-state-provider';
interface Notification {
  id: string;
  type: 'order' | 'like' | 'follow' | 'live' | 'group_buy' | 'system' | 'product';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  href?: string;
}

export default function NotificationsPage() {
  useScrollPreservation('notifications');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = usePersistedState<Notification[]>('notifications:data', []);
  const [loading, setLoading] = useState(notifications.length === 0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/notifications');
      return;
    }
    if (user) {
      // REAL: fetch from buyers_notifications table via /api/notifications
      (async () => {
        try {
          const resp = await api.notifications.list(50);
          if (resp.success) {
            const mapped = (resp.notifications || []).map((n: any) => ({
              id: n.id,
              type: n.type || 'system',
              title: n.title || '',
              body: n.body || '',
              timestamp: timeAgo(n.timestamp),
              read: !!n.read,
              href: n.data?.href || (n.type === 'order' ? '/orders' : n.type === 'product' ? `/product?id=${n.data?.product_id}` : undefined),
            }));
            setNotifications(mapped);
          }
        } catch (e) {
          // API not available — show empty state (no fake notifications)
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, authLoading, router]);

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.notifications.markAllRead(); } catch {}
  };

  if (authLoading || loading) {
    return (
      <PageSkeleton variant="notifications" />
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return ShoppingBag;
      case 'like': return Heart;
      case 'follow': return Users;
      case 'live': return Radio;
      case 'group_buy': return Users;
      case 'product': return Package;
      case 'system': return Sparkles;
      default: return Bell;
    }
  };

  return (
    <div className="ig-container min-h-screen ig-topbar-offset">
      {/* Top bar */}
      <div className="fx-topbar ig-topbar">
        <button onClick={() => router.push('/')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Notifications</h1>
        <button
          onClick={markAllRead}
          className="text-xs font-semibold text-[#666666] hover:text-black px-3"
          aria-label="Mark all read"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-[#666666]" />
          </div>
          <h2 className="text-base font-semibold mb-1">No notifications yet</h2>
          <p className="text-sm text-[#666666] mb-6">
            When you get order updates, new followers, or deal alerts, they&apos;ll show up here.
          </p>
          <Link
            href="/categories"
            className="bg-[#171717] text-black text-sm font-semibold px-6 py-3 rounded-md"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {notifications.map((notif) => {
            const Icon = getIcon(notif.type);
            return (
              <Link
                key={notif.id}
                href={notif.href || '#'}
                className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#F5F5F5] transition-colors ${
                  !notif.read ? 'bg-[#F5F5F5]/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{notif.title}</span>
                    <span className="text-[10px] text-[#666666] shrink-0">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-[#666666] mt-0.5 line-clamp-2">{notif.body}</p>
                </div>
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-[#0095f6] shrink-0 mt-2" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
