'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { MobileNav } from '@/components/mobile-nav';

/**
 * AppChrome — the consistent navigation shell for the buyer-facing app.
 *
 * It renders three pieces of navigation that match the reference screens:
 *   1. Desktop sidebar      (left rail, visible md+)  — buyer / seller variants
 *   2. Mobile header        (top bar, visible <md)    — buyer / buyer-seller variants
 *   3. Mobile bottom nav    (floating bar, visible <md)
 *
 * Routes that are full-screen flows or have their own chrome are excluded
 * (login, checkout, payment, the seller backend, immersive video/live screens).
 *
 * The mobile header is applied to the six core screen families from the spec
 * (Home, Product, Store, Explore, Cart, Profile) so their per-page top bars can
 * be removed in favour of the unified header. Other buyer pages keep their own
 * top bars but still gain the desktop sidebar + mobile bottom nav.
 */

// Routes that should render with NO app chrome at all.
const NO_CHROME_PREFIXES = [
  '/login',
  '/checkout',
  '/payment',
  '/seller', // seller backend has its own layout/sidebar
  '/live-watch',
  '/videos',
  '/shorts',
  '/become-seller',
  '/link-account',
  '/telegram',
  '/ai-chat',
];

// Core screens that use the unified mobile header (and drop their own top bar).
// The homepage is the showcase screen (Screen 1 / Screen 7). Other buyer pages
// keep their own contextual top bars (which carry screen-specific actions such
// as cart "Clear all", product share/save, store follow, category filtering).
const HEADER_ROUTES = new Set(['/']);

function isNoChrome(path: string) {
  return NO_CHROME_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

function usesHeader(path: string) {
  return HEADER_ROUTES.has(path);
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chrome = !isNoChrome(pathname);

  if (!chrome) {
    return <>{children}</>;
  }

  const header = usesHeader(pathname);

  return (
    <>
      <AppSidebar />
      {header && <MobileHeader />}
      <MobileNav />
      <div
        className={
          'min-h-screen ' +
          'md:pl-[var(--app-sidebar-w)] ' +
          (header ? 'pt-[var(--app-header-h)] md:pt-0 ' : '') +
          'pb-[124px] md:pb-0'
        }
      >
        {children}
      </div>
    </>
  );
}
