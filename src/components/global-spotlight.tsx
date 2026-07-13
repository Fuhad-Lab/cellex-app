'use client';

import { useSpotlight, SpotlightSearch } from '@/components/spotlight-search';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';

/**
 * GlobalSpotlight — renders the SpotlightSearch overlay + a floating search trigger.
 *
 * - Listens for Cmd+K / Ctrl+K
 * - Shows a floating search button on mobile (bottom-right, above nav)
 * - The floating button is HIDDEN on pages where search doesn't make sense:
 *   login, checkout, payment, seller dashboard (has its own nav)
 */
export function GlobalSpotlight() {
  const { isOpen, setIsOpen } = useSpotlight();
  const pathname = usePathname();

  // Pages where the floating search button should NOT appear
  const hideOnRoutes = [
    '/login',
    '/checkout',
    '/payment',
    '/seller',      // seller dashboard has its own sidebar nav
    '/link-account',
    '/telegram',
  ];

  const shouldHideButton = hideOnRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + '/')
  );

  return (
    <>
      <SpotlightSearch isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Floating search trigger (mobile only, hidden on auth/seller/checkout pages) */}
      {!isOpen && !shouldHideButton && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-black shadow-lg flex items-center justify-center md:hidden hover:scale-105 transition-transform"
          aria-label="Search"
        >
          <Search className="w-5 h-5 text-white" />
        </button>
      )}
    </>
  );
}
