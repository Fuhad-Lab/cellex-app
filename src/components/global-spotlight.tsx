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

  // Pages where the floating search button should NOT appear at all.
  // These pages either have their own search bar (categories, search, wishlist,
  // sellers) or are flows where search doesn't make sense (login, checkout,
  // payment, seller dashboard, link-account, telegram).
  const hideOnRoutes = [
    '/login',
    '/checkout',
    '/payment',
    '/seller',      // seller dashboard has its own sidebar nav
    '/link-account',
    '/telegram',
    '/categories',  // has its own product search bar in the topbar
    '/search',      // IS the search page — no need for a FAB
    '/wishlist',    // simple list page, no search needed
    '/sellers',     // sellers directory, no search needed
    '/cart',        // cart page, no search needed
    '/orders',      // orders list, no search needed
    '/profile',     // profile page, no search needed
    '/settings',    // settings page, no search needed
    '/notifications', // notifications list, no search needed
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
      {/* Search FAB removed — search is now in the mobile nav bar */}
    </>
  );
}
