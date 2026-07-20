'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Bell, Package, Heart, Store, Radio, Users, Sparkles, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { PageSkeleton } from '@/components/page-skeleton';

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/notifications');
      return;
    }
    if (user) {
      // TODO: Replace with real notifications API
      // For now, show a welcome notification
      setNotifications([
        {
          id: '1',
          type: 'system',
          title: 'Welcome to Cellex!',
          body: 'Thanks for joining. Browse products, watch videos, and discover deals.',
          timestamp: '2m ago',
          read: false,
          href: '/',
        },
      ]);
      setLoading(false);
    }
  }, [user, authLoading, router]);

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
      <div className="ig-topbar">
        <button onClick={() => router.push('/')} className="ig-icon-btn" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-semibold flex-1 ml-2">Notifications</h1>
        <button
          onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
          className="text-xs font-semibold text-neutral-500 hover:text-black px-3"
          aria-label="Mark all read"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-base font-semibold mb-1">No notifications yet</h2>
          <p className="text-sm text-neutral-500 mb-6">
            When you get order updates, new followers, or deal alerts, they&apos;ll show up here.
          </p>
          <Link
            href="/categories"
            className="bg-black text-white text-sm font-semibold px-6 py-3 rounded-md"
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
                className={`flex items-start gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors ${
                  !notif.read ? 'bg-neutral-50/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{notif.title}</span>
                    <span className="text-[10px] text-neutral-400 shrink-0">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{notif.body}</p>
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
