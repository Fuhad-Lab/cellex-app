'use client';

import { usePathname } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { SwipeBack } from '@/components/swipe-back';

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileNav = pathname === '/login' || pathname.startsWith('/product');
  
  return (
    <>
      <SwipeBack>
        <main className={`flex-1 ${hideMobileNav ? '' : 'pb-20 md:pb-0'}`}>
          {children}
        </main>
      </SwipeBack>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}
