'use client';

import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';

const ROUTES_WITHOUT_NAV = ['/login', '/search', '/shorts', '/videos'];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileNav = ROUTES_WITHOUT_NAV.some(route => pathname === route) || pathname.startsWith('/product');

  return (
    <>
      <main className={`flex-1 ${hideMobileNav ? '' : 'pb-28 md:pb-0'}`}>
        {children}
      </main>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}
