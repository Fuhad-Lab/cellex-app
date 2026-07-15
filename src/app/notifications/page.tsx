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

  const getIconBg = (type: string) => {
    switch (type) {
      case 'order': return 'bg-blue-100 text-blue-600';
      case 'like': return 'bg-red-100 text-red-600';
      case 'follow': return 'bg-purple-100 text-purple-600';
      case 'live': return 'bg-red-100 text-red-600';
      case 'group_buy': return 'bg-green-100 text-green-600';
      case 'product': return 'bg-orange-100 text-orange-600';
      case 'system': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="bg-white min-h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold flex-1">Notifications</h1>
        <button
          onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
          className="text-xs font-bold text-slate-500 hover:text-black"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications list */}
      <div className="pb-24">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold mb-1">No notifications yet</h2>
            <p className="text-sm text-slate-500 mb-6">
              When you get order updates, new followers, or deal alerts, they&apos;ll show up here.
            </p>
            <Link
              href="/categories"
              className="bg-black text-white text-sm font-bold px-6 py-3 rounded-full"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = getIcon(notif.type);
            return (
              <Link
                key={notif.id}
                href={notif.href || '#'}
                className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  !notif.read ? 'bg-slate-50/50' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getIconBg(notif.type)}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{notif.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.body}</p>
                </div>
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-black shrink-0 mt-2" />
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
