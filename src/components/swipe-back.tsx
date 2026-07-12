'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

/**
 * SwipeBack — iOS-style edge swipe to go back.
 * 
 * Uses framer-motion's drag with spring physics.
 * - Touch starts within 40px of left edge → activates
 * - Drags the entire page to the right with rubber-band resistance
 * - Ghost chevron appears during drag
 * - If swipe > 30% of screen → navigates back with exit animation
 * - If < 30% → snaps back with spring physics
 */
export function SwipeBack({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [exitX, setExitX] = useState<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  // Reset on path change
  useEffect(() => {
    setDragX(0);
    setExitX(null);
    setIsDragging(false);
  }, [pathname]);

  // Only enable on pages that have a "back" (not homepage)
  const canSwipeBack = pathname !== '/';

  useEffect(() => {
    if (!canSwipeBack) return;

    let active = false;
    const threshold = window.innerWidth * 0.3;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX < 40) {
        active = true;
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        setIsDragging(true);
        setExitX(null);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      if (dy > 60 && dy > Math.abs(dx)) {
        active = false;
        setIsDragging(false);
        setDragX(0);
        return;
      }

      if (dx > 0) {
        // Rubber-band resistance
        const resistance = 0.4;
        setDragX(dx * resistance);
        if (dx > 10) e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!active) return;
      active = false;
      setIsDragging(false);

      if (dragX > threshold) {
        // Exit animation then navigate back
        setExitX(window.innerWidth);
        setTimeout(() => router.back(), 300);
      } else {
        // Snap back
        setDragX(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [canSwipeBack, dragX, router]);

  const currentX = exitX !== null ? exitX : dragX;

  return (
    <>
      {/* Ghost back indicator */}
      <AnimatePresence>
        {isDragging && dragX > 15 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(dragX / 60, 1) }}
            exit={{ opacity: 0 }}
            className="fixed top-1/2 -translate-y-1/2 z-[9998] pointer-events-none"
            style={{ left: `${dragX * 0.3}px` }}
          >
            <div className="w-12 h-12 rounded-full bg-black/10 backdrop-blur-md flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <motion.div
        animate={{ x: currentX }}
        transition={isDragging || exitX !== null ? { duration: 0.3, ease: [0.32, 0.72, 0, 1] } : { type: 'spring', stiffness: 400, damping: 35 }}
        style={{ willChange: 'transform' }}
      >
        {children}
      </motion.div>
    </>
  );
}

import { useRef } from 'react';
