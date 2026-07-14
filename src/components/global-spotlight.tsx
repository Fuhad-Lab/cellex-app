'use client';

import { useSpotlight, SpotlightSearch } from '@/components/spotlight-search';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * GlobalSpotlight — renders the SpotlightSearch overlay + a floating search trigger.
 *
 * - Listens for Cmd+K / Ctrl+K
 * - Shows a floating search button on mobile (bottom-right, above nav)
 * - The floating button is HIDDEN on pages where search doesn't make sense:
 *   login, checkout, payment, seller dashboard (has its own nav)
 * - The floating button is ALSO hidden when a top search bar is visible on
 *   the current page (e.g. the homepage's sticky search bar). When the user
 *   scrolls past the top search bar, the floating button appears.
 *   This is controlled via a 'searchbar-visibility' CustomEvent that pages
 *   dispatch from an IntersectionObserver on their search bar element.
 */
export function GlobalSpotlight() {
  const { isOpen, setIsOpen } = useSpotlight();
  const pathname = usePathname();
  const [searchBarVisible, setSearchBarVisible] = useState(false);

  // Pages where the floating search button should NOT appear at all
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

  // Listen for search-bar visibility events from pages that have a top search bar.
  // When the bar is visible on screen, hide the FAB. When scrolled past, show it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ visible: boolean }>).detail;
      setSearchBarVisible(detail?.visible ?? false);
    };
    window.addEventListener('searchbar-visibility', handler);
    return () => window.removeEventListener('searchbar-visibility', handler);
  }, []);

  // Reset visibility state when navigating to a new page
  useEffect(() => {
    setSearchBarVisible(false);
  }, [pathname]);

  const showFloatingButton = !isOpen && !shouldHideButton && !searchBarVisible;

  return (
    <>
      <SpotlightSearch isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Floating search trigger (mobile only) */}
      {showFloatingButton && (
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
