'use client';

import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { IOSStack } from '@/components/ios-stack';

/**
 * NavShell — the fixed chrome (Navbar + MobileNav) with the IOSStack
 * holding the page content in between.
 *
 * The Navbar and MobileNav live OUTSIDE the IOSStack so they stay fixed
 * during page transitions (like iOS Safari's top/bottom bars).
 * Only the page content swipes.
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileNav = pathname === '/login' || pathname.startsWith('/product');

  return (
    <>
      <IOSStack>
        <main className={`flex-1 ${hideMobileNav ? '' : 'pb-20 md:pb-0'}`}>
          {children}
        </main>
      </IOSStack>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}
