'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, User, MessageCircle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useEffect, useState } from 'react';

/**
 * MobileNav — bottom navigation bar (ROLE-AWARE).
 *
 * BUYER (no seller profile):
 *   Chat | Category | [Discover] | Cart | Account
 *   - Chat → /ai-chat (AI shopping assistant)
 *   - Category → /categories
 *   - [Discover] → / (homepage feed, center button)
 *   - Cart → /cart
 *   - Account → /profile
 *
 * BUYER-SELLER (has seller profile):
 *   Home | Category | [+ Add] | Cart | Account
 *   - Home → /
 *   - Category → /categories
 *   - [+ Add] → /create (center button, opens create menu)
 *   - Cart → /cart
 *   - Account → /profile
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user } = useAuth();
  const [isSeller, setIsSeller] = useState(false);

  // Check if the current user is a buyer-seller
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/seller-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'get' }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled && data.success && data.seller) {
            setIsSeller(true);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Role-based nav items
  const navItems = isSeller
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/categories', label: 'Category', icon: Search },
        { href: '/create', label: 'Add', icon: Plus, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showDot: true },
      ]
    : [
        { href: '/ai-chat', label: 'Chat', icon: MessageCircle },
        { href: '/categories', label: 'Category', icon: Search },
        { href: '/', label: 'Discover', icon: Home, center: true },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, showBadge: true },
        { href: '/profile', label: 'Account', icon: User, showDot: true },
      ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-slate-200 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto py-2 relative">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5"
                style={{ transform: 'scale(1.15)' }}
              >
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center glow">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-black">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 relative ${
                isActive ? 'text-black' : 'text-neutral-500'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.showBadge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
                {item.showDot && user && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
