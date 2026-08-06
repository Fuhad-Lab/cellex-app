'use client';

import { usePathname, useRouter } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

// ONLY these pages show the bottom mobile nav bar.
// All other pages show a back button header instead.
const ROUTES_WITH_NAV = ['/', '/categories', '/wishlist', '/cart', '/settings'];

// These routes have their own custom headers (no back button, no nav bar)
const ROUTES_WITH_CUSTOM_HEADER = ['/login', '/search', '/shorts', '/videos'];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Strip query params and trailing slashes for matching
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';

  // Check if this exact route should have the mobile nav bar
  const hasMobileNav = ROUTES_WITH_NAV.includes(cleanPath);

  // Check if this route has its own custom header (no back button needed)
  const hasCustomHeader = ROUTES_WITH_CUSTOM_HEADER.some(route => pathname === route) ||
                          pathname.startsWith('/product');

  // Dynamic routes (/[slug] storefronts) and /seller/* have their own headers
  const isDynamicStorefront = pathname.match(/^\/[^\/]+$/) && !ROUTES_WITH_NAV.includes(pathname) && !pathname.startsWith('/api');
  const isSellerRoute = pathname.startsWith('/seller');
  const hasOwnHeader = hasCustomHeader || isDynamicStorefront || isSellerRoute;

  const showBackButton = !hasMobileNav && !hasOwnHeader;

  return (
    <>
      {showBackButton && (
        <div className="sticky top-0 z-50 bg-white border-b border-[#E5E5E5] md:hidden">
          <div className="flex items-center h-14 px-2">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#F5F5F5] transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-6 h-6 text-[#171717]" />
            </button>
            <Link href="/" className="ml-1 flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#111827]">
                <span className="font-extrabold text-sm text-white" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
              </div>
              <span className="text-base font-semibold text-[#171717] tracking-tight">Cellex</span>
            </Link>
          </div>
        </div>
      )}
      <main className={`flex-1 ${hasMobileNav ? 'pb-28 md:pb-0' : ''}`}>
        {children}
      </main>
      {hasMobileNav && <MobileNav />}
    </>
  );
}
