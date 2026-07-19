'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, User, Send, Grid3x3 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — WhatsApp "Liquid Glass" floating island bottom navigation.
 *
 * Design features:
 * - Floating island container with 28px rounded corners
 * - Glassmorphism: translucent frosted glass with 20px backdrop blur
 * - 16px margin from bottom + 12px from sides (floats above safe area)
 * - Dynamic active pill indicator that resizes to hug the active icon
 * - Spring animation when switching tabs (cubic-bezier 0.34, 1.56, 0.64, 1)
 * - Hyper-thin white border for crisp edge definition
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user, isSeller, unreadMessages } = useAuth();

  const navItems = isSeller
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/shorts', label: 'Shorts', icon: Grid3x3 },
        { href: '/create', label: 'Add', icon: Plus, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showAvatar: true },
      ]
    : [
        { href: '/messenger', label: 'Messages', icon: Send },
        { href: '/shorts', label: 'Shorts', icon: Grid3x3 },
        { href: '/', label: 'Home', icon: Home, center: true },
        { href: '/categories', label: 'Category', icon: Search },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
      ];

  return (
    <div
      className="glass-nav fixed left-3 right-3 z-[60] md:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        borderRadius: '28px',
        height: '62px',
      }}
    >
      <div className="flex items-center justify-around h-full px-2">
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
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), 0 1px 0 rgba(255, 255, 255, 0.15) inset',
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
              {/* Active pill indicator — dynamically sized background capsule */}
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
                    isActive ? 'text-black scale-110' : 'text-neutral-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  fill={isActive && (item.label === 'Home' || item.label === 'Messages') ? 'currentColor' : 'none'}
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
