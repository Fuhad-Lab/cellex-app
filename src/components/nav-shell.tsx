'use client';

import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';

/**
 * NavShell — the fixed chrome (MobileNav) with page content.
 *
 * Uses standard Next.js navigation (no iOS swipe stack).
 * Pages render normally with Next.js's built-in transitions.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileNav = pathname === '/login' || pathname.startsWith('/product') || pathname === '/videos';

  return (
    <>
      <main className={`flex-1 ${hideMobileNav ? '' : 'pb-20 md:pb-0'}`}>
        {children}
      </main>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}
