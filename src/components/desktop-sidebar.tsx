'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Search, ShoppingBag, Heart, MessageCircle, ShoppingCart,
  User, Settings, Store, Plus, Bell, Sparkles, Bookmark,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

/**
 * DesktopSidebar — left sidebar for desktop (md+ screens).
 *
 * DIFFERENT for buyers vs sellers (per user spec):
 *
 * Seller sidebar:
 *   Home, Explore, Messages, Saved, Cart, WishList, My Shop, Settings
 *
 * Buyer sidebar:
 *   Home, Explore, Messages, Saved, Cart, Settings
 *
 * Unauthenticated users see the buyer sidebar (so they can browse).
 * The sidebar is sticky and full-height. Active route gets a black pill
 * background with white icon/text.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, isSeller } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const itemClass = (href: string) => {
    const active = isActive(href);
    return `flex items-center gap-4 px-4 py-3 rounded-full transition-colors text-sm font-medium ${
      active
        ? 'bg-[#111827] text-white'
        : 'text-[#111827] hover:bg-[#F3F4F6]'
    }`;
  };

  const iconClass = 'w-5 h-5 shrink-0';

  // Build nav items based on user type.
  // Seller sees: Home, Explore, Messages, Saved, Cart, WishList, My Shop, Settings
  // Buyer sees:  Home, Explore, Messages, Saved, Cart, Settings
  const navItems = isSeller
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/categories', label: 'Explore', icon: Search },
        { href: '/messenger', label: 'Messages', icon: MessageCircle },
        { href: '/wishlist', label: 'Saved', icon: Bookmark },
        { href: '/cart', label: 'Cart', icon: ShoppingCart },
        { href: '/wishlist', label: 'WishList', icon: Heart }, // WishList = wishlist page (Saved uses Bookmark, WishList uses Heart to distinguish)
        { href: '/seller-dashboard', label: 'My Shop', icon: Store },
        { href: '/settings', label: 'Settings', icon: Settings },
      ]
    : [
        { href: '/', label: 'Home', icon: Home },
        { href: '/categories', label: 'Explore', icon: Search },
        { href: '/messenger', label: 'Messages', icon: MessageCircle },
        { href: '/wishlist', label: 'Saved', icon: Bookmark },
        { href: '/cart', label: 'Cart', icon: ShoppingCart },
        { href: '/settings', label: 'Settings', icon: Settings },
      ];

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-60 lg:w-64 xl:w-72 bg-white border-r border-[#E5E7EB] px-3 py-4 z-40"
      aria-label="Desktop sidebar"
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-3 py-2 mb-4">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#111827] btn-ripple "
          aria-hidden
        >
          <ShoppingBag className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <span className="text-xl font-bold tracking-tight text-[#111827]">Cellex</span>
      </Link>

      {/* Search button */}
      <button
        onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-spotlight')); }}
        className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors text-sm text-[#6B7280] mb-3"
      >
        <Search className="w-4 h-4" />
        <span>Search</span>
      </button>

      {/* Main nav — different for buyer vs seller */}
      <nav className="flex flex-col gap-0.5 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={itemClass(item.href)}
              aria-label={item.label}
            >
              <Icon className={iconClass} /> <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* AI assistant — below nav, above logout area */}
      <div className="mt-4">
        <Link
          href="/ai-chat"
          className="flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-[#111827] to-[#374151] text-white text-sm font-medium hover:opacity-90 transition"
        >
          <Sparkles className="w-5 h-5" /> <span>AI Assistant</span>
        </Link>
      </div>

      {/* Auth area — bottom */}
      <div className="mt-auto pt-4 border-t border-[#E5E7EB]">
        {user ? (
          <Link
            href={isSeller ? '/seller-dashboard' : '/profile'}
            className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-[#F3F4F6] transition"
          >
            <div className="w-9 h-9 rounded-full bg-[#111827] btn-ripple  flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">
                {(user as any)?.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#111827] truncate">
                {(user as any)?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-[10px] text-[#6B7280]">
                {isSeller ? 'Seller' : 'Buyer'}
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#111827] btn-ripple  text-white text-sm font-semibold hover:bg-[#374151] transition"
          >
            <User className="w-4 h-4" /> Log in
          </Link>
        )}
      </div>
    </aside>
  );
}
