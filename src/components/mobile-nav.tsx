'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * MobileNav — bottom navigation bar.
 *
 *   Home | Category | [+ Add] | Cart | Account
 *
 * The center + button opens the "create" menu (add product, make post, etc.)
 * for sellers. For buyers it opens a simplified create menu.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { cartCount, user } = useAuth();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/categories', label: 'Category', icon: Search },
    { href: '/create', label: 'Add', icon: Plus, center: true },
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
