'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, User, Send, Grid3x3, Play } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — smart floating island bottom navigation.
 *
 * Behavior depends on auth state (from Supabase session):
 *
 * 1. AUTHENTICATED BUYER:
 *    Messenger | Shorts | [Home] | Cart | Account
 *
 * 2. AUTHENTICATED BUYER-SELLER (isSeller=true):
 *    Home | Shorts | [+] | Cart | Account
 *
 * 3. NOT AUTHENTICATED:
 *    Messenger | Shorts | [Home] | Cart | Account
 *    (same as buyer — Cart/Account redirect to login when clicked)
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user, isSeller, unreadMessages } = useAuth();

  const navItems = isSeller
    ? [
        // Buyer-seller: Home | Shorts | [+] | Cart | Account
        { href: '/', label: 'Home', icon: Home },
        { href: '/shorts', label: 'Shorts', icon: Play },
        { href: '/create', label: 'Add', icon: Plus, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showAvatar: true },
      ]
    : [
        // Buyer (auth or not): Messenger | Shorts | [Home] | Cart | Account
        { href: '/messenger', label: 'Messages', icon: Send },
        { href: '/shorts', label: 'Shorts', icon: Play },
        { href: '/', label: 'Home', icon: Home, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: user ? '/profile' : '/login', label: 'Account', icon: User, showAvatar: !!user },
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
                    background: 'linear-gradient(135deg, #D4AF37 0%, #C4A030 100%)',
                    boxShadow: '0 4px 16px rgba(212,175,55,0.4)',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#1A1D20' }} strokeWidth={2.5} />
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
                    color: isActive ? '#D4AF37' : '#666666',
                    fill: isActive && (item.label === 'Home' || item.label === 'Messages' || item.label === 'Shorts') ? '#D4AF37' : 'none',
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
