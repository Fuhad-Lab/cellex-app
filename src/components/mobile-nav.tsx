'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, Send, Play } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — dark glass pill + SEPARATE circular search button (WA0058 style).
 *
 * Layout: [pill nav bar]  [search circle]
 * The search button is BESIDE the pill, not inside it. Both are dark glass.
 * Small gap between them. Same height. Same glass material.
 *
 * Auth-aware:
 * 1. BUYER: Messenger | Shorts | [Home] | Cart   +  [Search]
 * 2. BUYER-SELLER: Home | Shorts | [+] | Cart   +  [Search]
 * 3. NOT AUTHENTICATED: same as buyer
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
      ]
    : [
        { href: '/messenger', label: 'Messages', icon: Send },
        { href: '/shorts', label: 'Shorts', icon: Play },
        { href: '/', label: 'Home', icon: Home, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
      ];

  const openSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-spotlight'));
    }
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden flex items-center gap-2"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        maxWidth: '440px',
        width: '90%',
      }}
    >
      {/* Nav pill — dark glass */}
      <div
        className="flex items-center justify-around h-full px-4"
        style={{
          flex: '1 1 0',
          height: '64px',
          borderRadius: '32px',
          background: 'rgba(20, 20, 22, 0.72)',
          backdropFilter: 'blur(25px) saturate(180%)',
          WebkitBackdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
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
                  <Icon className="w-5 h-5" style={{ color: '#000000' }} strokeWidth={2.5} />
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
                  className="absolute"
                  style={{
                    width: '48px',
                    height: '38px',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '14px',
                    background: 'rgba(212, 175, 55, 0.2)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
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
                    color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.7)',
                    fill: isActive && (item.label === 'Home' || item.label === 'Messages' || item.label === 'Shorts') ? '#D4AF37' : 'none',
                  }}
                />
                {item.showBadge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1" style={{ background: '#D4AF37', color: '#000' }}>
                    {cartCount}
                  </span>
                )}
                {item.label === 'Messages' && user && unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center" style={{ background: '#D4AF37', border: '2px solid rgba(20,20,22,0.9)' }}>
                    <span className="text-[9px] font-bold leading-none" style={{ color: '#000' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Search button — SEPARATE circular button BESIDE the pill (WA0058 style) */}
      <button
        onClick={openSearch}
        className="flex items-center justify-center shrink-0 transition-transform active:scale-90"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(20, 20, 22, 0.72)',
          backdropFilter: 'blur(25px) saturate(180%)',
          WebkitBackdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        aria-label="Search"
      >
        <Search
          className="w-6 h-6"
          strokeWidth={1.8}
          style={{ color: 'rgba(255,255,255,0.7)' }}
        />
      </button>
    </div>
  );
}
