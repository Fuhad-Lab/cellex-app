'use client';

import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';

/**
 * LayoutShell — conditionally renders the mobile bottom nav.
 *
 * Rules:
 * - Login page (/login): NO mobile bottom nav (clean auth page)
 * - All other pages: mobile bottom nav visible
 * - The global top Navbar is removed entirely — the homepage has its own
 *   top nav built into its desktop/mobile layouts.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide mobile nav on login page
  const hideMobileNav = pathname === '/login';

  return (
    <>
      <main className={`flex-1 ${hideMobileNav ? '' : 'pb-20 md:pb-0'}`}>
        {children}
      </main>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}
