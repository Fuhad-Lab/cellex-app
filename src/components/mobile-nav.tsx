'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  MessageCircle,
  Bookmark,
  ShoppingCart,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — floating bottom navigation for mobile.
 *
 * Matches the reference "Mobile bottom navigation":
 *   - BUYER:         Home · Explore · Messages · Saved · Cart · Settings
 *   - BUYER-SELLER:  Home · Explore · Messages · Saved · Cart · Settings
 *
 * (The two variants share the same six destinations in the reference.)
 * Hidden on desktop where the sidebar owns navigation.
 */
const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/categories', label: 'Explore', icon: Compass },
  { href: '/messenger', label: 'Messages', icon: MessageCircle },
  { href: '/wishlist', label: 'Saved', icon: Bookmark },
  { href: '/cart', label: 'Cart', icon: ShoppingCart, badge: 'cart' as const },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user, unreadMessages } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="md:hidden fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-around"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 14px)',
        width: 'min(440px, 92%)',
        height: 'var(--app-nav-h)',
        borderRadius: '22px',
        background: 'rgba(20, 20, 22, 0.72)',
        backdropFilter: 'blur(25px) saturate(180%)',
        WebkitBackdropFilter: 'blur(25px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Primary"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, item.exact);
        const Icon = item.icon;
        const showCartBadge = item.badge === 'cart' && user && cartCount > 0;
        const showMsgBadge = item.label === 'Messages' && user && unreadMessages > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            style={{ color: active ? '#D4AF37' : 'rgba(255,255,255,0.7)' }}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative flex items-center justify-center">
              <Icon
                className="w-[22px] h-[22px] transition-all"
                strokeWidth={active ? 2.4 : 1.9}
                style={{
                  fill: active && item.label === 'Home' ? '#D4AF37' : 'none',
                }}
              />
              {showCartBadge && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: '#D4AF37', color: '#000' }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
              {showMsgBadge && (
                <span
                  className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: '#D4AF37', color: '#000', border: '2px solid rgba(20,20,22,0.9)' }}
                >
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </span>
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: active ? '#D4AF37' : 'rgba(255,255,255,0.7)' }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
