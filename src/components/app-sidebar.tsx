'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  MessageCircle,
  Bookmark,
  ShoppingCart,
  Heart,
  Store,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * AppSidebar — desktop left navigation.
 *
 * Matches the reference "Sidebar rules for desktop":
 *   - SELLER:  Home, Explore, Messages, Saved, Cart, WishList, My Shop, Settings
 *   - BUYER:   Home, Explore, Messages, Saved, Cart, Settings
 *
 * The sidebar is hidden on mobile (the mobile bottom nav + header take over).
 * It is fixed to the left edge and the page content is offset by its width
 * via the --app-sidebar-w variable applied in AppChrome.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Match exactly this path (used for Home so /product etc. don't highlight). */
  exact?: boolean;
  /** Open in a way that needs the seller slug. */
  needsSlug?: boolean;
}

const BUYER_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/categories', label: 'Explore', icon: Compass },
  { href: '/messenger', label: 'Messages', icon: MessageCircle },
  { href: '/wishlist', label: 'Saved', icon: Bookmark },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const SELLER_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/categories', label: 'Explore', icon: Compass },
  { href: '/messenger', label: 'Messages', icon: MessageCircle },
  { href: '/wishlist', label: 'Saved', icon: Bookmark },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/wishlist', label: 'WishList', icon: Heart },
  { href: '/seller', label: 'My Shop', icon: Store, needsSlug: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isSeller, sellerSlug, user, unreadMessages } = useAuth();

  const items = isSeller ? SELLER_ITEMS : BUYER_ITEMS;

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const resolveHref = (item: NavItem) => {
    if (item.needsSlug && sellerSlug) return `/${sellerSlug}`;
    return item.href;
  };

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-[#ECECEC]"
      style={{
        width: 'var(--app-sidebar-w)',
        // The sidebar scrolls independently of the page content.
      }}
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 px-5 h-[64px] shrink-0 border-b border-[#F1F1F1]">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#D4AF37,#C4A030)' }}
        >
          <Sparkles className="w-5 h-5 text-black" strokeWidth={2.4} />
        </div>
        <span
          className="text-xl font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#0F1115' }}
        >
          Cellex
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const href = resolveHref(item);
          return (
            <Link
              key={item.label}
              href={href}
              className="relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors group"
              style={{
                background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
                color: active ? '#9A7B16' : '#3A3A3A',
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg,#D4AF37,#C4A030)' }}
                />
              )}
              <Icon
                className="w-[22px] h-[22px] transition-colors"
                strokeWidth={active ? 2.4 : 1.9}
              />
              <span
                className="text-[15px] font-semibold"
                style={{ color: active ? '#0F1115' : 'inherit' }}
              >
                {item.label}
              </span>

              {/* Badges */}
              {item.label === 'Messages' && user && unreadMessages > 0 && (
                <span
                  className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#D4AF37', color: '#0F1115' }}
                >
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
              {item.label === 'Cart' && user && (
                <CartBadge />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / account */}
      <div className="px-3 py-4 border-t border-[#F1F1F1] shrink-0">
        {user ? (
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F6F6F6] transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[#F1F1F1] flex items-center justify-center text-sm font-bold text-[#0F1115]">
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#0F1115] truncate">
                {isSeller ? 'Seller account' : 'My account'}
              </div>
              <div className="text-[11px] text-[#8A8A8A] truncate">
                {user.email}
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-[14px] text-black"
            style={{ background: 'linear-gradient(135deg,#D4AF37,#C4A030)' }}
          >
            Log in
          </Link>
        )}
      </div>
    </aside>
  );
}

function CartBadge() {
  const { cartCount } = useAuth();
  if (cartCount <= 0) return null;
  return (
    <span
      className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
      style={{ background: '#0F1115', color: '#fff' }}
    >
      {cartCount > 9 ? '9+' : cartCount}
    </span>
  );
}
