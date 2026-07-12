'use client';

import { useSpotlight, SpotlightSearch } from '@/components/spotlight-search';
import { Search } from 'lucide-react';

/**
 * GlobalSpotlight — renders the SpotlightSearch overlay + a floating search trigger.
 * 
 * - Listens for Cmd+K / Ctrl+K
 * - Shows a floating search button on mobile (bottom-right, above nav)
 * - The SpotlightSearch component handles all the UI/UX
 */
export function GlobalSpotlight() {
  const { isOpen, setIsOpen } = useSpotlight();

  return (
    <>
      <SpotlightSearch isOpen={isOpen} onClose={() => setIsOpen(false)} />
      
      {/* Floating search trigger (mobile only) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-black shadow-lg flex items-center justify-center md:hidden hover:scale-105 transition-transform"
        >
          <Search className="w-5 h-5 text-white" />
        </button>
      )}
    </>
  );
}
