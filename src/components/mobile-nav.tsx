'use client';

import InternalLink from '@/components/internal-link';
import { usePathname } from 'next/navigation';
import { Home, Compass, MessageCircle, Bookmark, ShoppingCart, Settings } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — Glassmorphism floating pill (WhatsApp iOS style).
 *
 * 6 items: Home | Explore | Messages | Saved | Cart | Settings
 * Same for buyer and buyer-seller.
 *
 * Style: Floating pill with dark translucent glass + blur, floating above
 * content with margins from edges. White icons, active = #111827 with
 * subtle light circle.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, savedCount, user, unreadMessages } = useAuth();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/categories', label: 'Explore', icon: Compass },
    { href: '/messenger', label: 'Messages', icon: MessageCircle, showBadge: true },
    { href: '/wishlist', label: 'Saved', icon: Bookmark, showSavedBadge: true },
    { href: '/cart', label: 'Cart', icon: ShoppingCart, showCartBadge: true },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        width: '92%',
        maxWidth: '420px',
      }}
    >
      <nav
        className="flex items-center justify-around"
        style={{
          height: '60px',
          borderRadius: '30px',
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(25px) saturate(180%)',
          WebkitBackdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
        aria-label="Bottom navigation"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <InternalLink
              key={item.href}
              href={item.href}
              className="flex items-center justify-center relative transition-colors"
              style={{ flex: '1 1 0', height: '100%' }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className="flex items-center justify-center transition-all"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '9999px',
                  background: isActive ? 'rgba(17, 24, 39, 0.08)' : 'transparent',
                }}
              >
                <div className="relative">
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={isActive ? 2.5 : 1.8}
                    style={{ color: isActive ? '#111827' : '#6B7280' }}
                  />
                  {/* Cart badge */}
                  {item.showCartBadge && cartCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                      style={{ background: '#111827' }}
                    >
                      <span className="text-[9px] font-bold leading-none text-white">
                        {cartCount > 9 ? '9+' : cartCount}
                      </span>
                    </span>
                  )}
                  {/* Saved/wishlist badge */}
                  {item.showSavedBadge && user && savedCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                      style={{ background: '#111827' }}
                    >
                      <span className="text-[9px] font-bold leading-none text-white">
                        {savedCount > 9 ? '9+' : savedCount}
                      </span>
                    </span>
                  )}
                  {/* Unread messages badge */}
                  {item.showBadge && user && unreadMessages > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                      style={{ background: '#111827' }}
                    >
                      <span className="text-[9px] font-bold leading-none text-white">
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </InternalLink>
          );
        })}
      </nav>
    </div>
  );
}
