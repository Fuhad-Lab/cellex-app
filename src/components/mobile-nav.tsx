'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, User, Send, Grid3x3, Play } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — WhatsApp Liquid Glass floating island bottom navigation.
 *
 * BUYER nav: Messenger | Shorts | [Home] | Category | Cart
 *   (Notification + Account icons are in the HEADER, not the nav)
 *
 * SELLER nav: Home | Shorts | [+] | Cart | Account
 *   (Messenger + Notification icons are in the HEADER, not the nav)
 *   (Account in nav = /profile personal profile; Account in header = /seller-dashboard store)
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user, isSeller, unreadMessages } = useAuth();

  const navItems = isSeller
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/shorts', label: 'Shorts', icon: Play },
        { href: '/create', label: 'Add', icon: Plus, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showAvatar: true },
      ]
    : [
        { href: '/messenger', label: 'Messages', icon: Send },
        { href: '/shorts', label: 'Shorts', icon: Play },
        { href: '/', label: 'Home', icon: Home, center: true },
        { href: '/categories', label: 'Category', icon: Grid3x3 },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
      ];

  return (
    <div
      className="fx-nav glass-nav fixed left-1/2 -translate-x-1/2 z-50 md:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        width: '90%',
        maxWidth: '400px',
        height: '64px',
        borderRadius: '32px',
      }}
    >
      <div className="flex items-center justify-around h-full px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center"
                aria-label={item.label}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  }}
                >
                  <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-center relative transition-all"
              style={{ flex: '1 1 0', height: '100%' }}
              aria-label={item.label}
            >
              {isActive && (
                <div
                  className="glass-active-pill glass-pill-enter absolute"
                  style={{
                    width: '48px',
                    height: '38px',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '14px',
                  }}
                />
              )}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-6 h-6 transition-all duration-300 ${
                    isActive ? 'scale-110' : ''
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    color: isActive ? 'var(--cellex-coral)' : 'var(--cellex-text-muted)',
                    fill: isActive && (item.label === 'Home' || item.label === 'Messages' || item.label === 'Shorts') ? 'var(--cellex-coral)' : 'none',
                  }}
                />
                {item.showBadge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
                {item.showAvatar && user && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
                {item.label === 'Messages' && user && unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold leading-none">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
