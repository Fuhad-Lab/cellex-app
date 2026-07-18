'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, ShoppingCart, User, Send, Grid3x3, Clapperboard } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — Instagram-style bottom navigation bar.
 *
 * - 5 icons evenly spaced, NO labels (matches IG mobile web)
 * - White background, 1px top border (#dbdbdb)
 * - Active state: bold black icon (instead of gray)
 * - Center button: filled black circle with white icon (IG Create style)
 *
 * BUYER:
 *   [Messenger] [Shorts] [⬛ Home ⬛] [Category] [Cart]
 *   (Account icon is in the HEADER beside Notifications)
 *
 * BUYER-SELLER:
 *   [Home] [Shorts] [⬛ + Add ⬛] [Cart] [Account]
 *   (Explore/Categories removed to make room for Shorts — sellers can still
 *    reach Categories via search spotlight or by tapping a product's
 *    category hashtag. Account stays in nav because it links to /profile
 *    which is DIFFERENT from the header's User icon which links to
 *    /seller-dashboard.)
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user, isSeller, unreadMessages } = useAuth();

  const navItems = isSeller
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/shorts', label: 'Shorts', icon: Clapperboard },
        { href: '/create', label: 'Add', icon: Plus, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showAvatar: true },
      ]
    : [
        { href: '/messenger', label: 'Messages', icon: Send },
        { href: '/shorts', label: 'Shorts', icon: Clapperboard },
        { href: '/', label: 'Home', icon: Home, center: true },
        { href: '/categories', label: 'Category', icon: Grid3x3 },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
      ];

  return (
    <nav className="ig-bottom-nav md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.center) {
          // Center button — IG Create style: solid black circle, white icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-center w-10 h-10"
              aria-label={item.label}
            >
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-center w-12 h-12 relative"
            aria-label={item.label}
          >
            <div className="relative">
              {/* Active state: filled icon (matches IG) */}
              <Icon
                className={`w-6 h-6 transition-colors ${isActive ? 'text-black' : 'text-neutral-700'}`}
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
              {/* Functional unread badge for messenger — only shows when logged
                  in AND there are actual conversations with messages. Count
                  comes from AuthProvider which polls every 30s. */}
              {item.label === 'Messages' && user && unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold leading-none">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
