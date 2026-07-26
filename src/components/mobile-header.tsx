'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  User,
  Bell,
  Plus,
  Store,
  Settings,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useSpotlight } from '@/components/spotlight-search';

/**
 * MobileHeader — top app bar shown on mobile for opted-in screens.
 *
 * Matches the reference "Header rules for mobile":
 *   - BUYER:            platform name (far left) · search bar · profile · notifications
 *   - BUYER-SELLER:     platform name (far left) · search bar · + · My Shop · notifications · settings
 *
 * Hidden on desktop (the desktop sidebar owns navigation there).
 */
export function MobileHeader() {
  const { isSeller, sellerSlug, user, unreadMessages } = useAuth();
  const { setIsOpen } = useSpotlight();
  const pathname = usePathname();
  const router = useRouter();

  const openSearch = () => setIsOpen(true);
  const myShopHref = sellerSlug ? `/${sellerSlug}` : '/seller';

  // A back control is shown on every screen except the home feed.
  const showBack = pathname !== '/';

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-2 bg-white border-b border-[#ECECEC]"
      style={{
        height: 'var(--app-header-h)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex items-center gap-1.5 pl-3 shrink-0">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-[#0F1115] active:bg-[#F2F2F2]"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.2} />
          </button>
        )}
        <Link href="/" className="flex items-center gap-1.5" aria-label="Cellex home">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#D4AF37,#C4A030)' }}
          >
            <Sparkles className="w-4 h-4 text-black" strokeWidth={2.4} />
          </div>
          <span
            className="text-lg font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-geist-mono)', color: '#0F1115' }}
          >
            Cellex
          </span>
        </Link>
      </div>

      {/* Search bar — opens the global spotlight search */}
      <button
        onClick={openSearch}
        className="flex-1 mx-1 h-9 rounded-full bg-[#F4F4F5] border border-[#ECECEC] flex items-center gap-2 px-3.5 text-left"
        aria-label="Search"
      >
        <Search className="w-4 h-4 text-[#9A9A9A]" strokeWidth={2} />
        <span className="text-[13px] text-[#9A9A9A] font-medium">Search products, shops…</span>
      </button>

      {/* Right-side action icons */}
      <div className="flex items-center gap-0.5 pr-2 shrink-0">
        {isSeller && (
          <>
            <HeaderIcon href="/create" label="Create" icon={Plus} />
            <HeaderIcon href={myShopHref} label="My Shop" icon={Store} />
          </>
        )}
        <HeaderIcon href="/notifications" label="Notifications" icon={Bell} badge={user ? unreadMessages : 0} />
        {isSeller ? (
          <HeaderIcon href="/settings" label="Settings" icon={Settings} />
        ) : (
          <HeaderIcon href="/profile" label="Profile" icon={User} />
        )}
      </div>
    </header>
  );
}

function HeaderIcon({
  href,
  label,
  icon: Icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative w-9 h-9 flex items-center justify-center rounded-full text-[#0F1115] active:bg-[#F2F2F2]"
      aria-label={label}
    >
      <Icon className="w-[22px] h-[22px]" strokeWidth={1.9} />
      {badge && badge > 0 && (
        <span
          className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{ background: '#D4AF37', color: '#0F1115', border: '2px solid #fff' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}
