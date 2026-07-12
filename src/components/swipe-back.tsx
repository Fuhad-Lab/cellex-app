'use client';

import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';

/**
 * SwipeBack — iOS-style edge swipe to go back.
 *
 * Behaviour:
 *   - Touch must start within the leftmost ~28px of the screen.
 *   - After the first move, the gesture is classified as horizontal or
 *     vertical. Vertical gestures are released to the browser (page scroll).
 *   - Horizontal drags move the page rightward with the finger (clamped to
 *     a sensible max so it doesn't fly off-screen).
 *   - On release: if dragged past 120px → commit (animate off-screen + call
 *     router.back()). Otherwise snap back to x=0.
 *   - A `suppressNextEntrance` module flag tells the next page's entrance
 *     animation to skip itself (the user already saw the page revealed by
 *     the drag — replaying a slide-in would feel like a glitch).
 *
 * Implementation notes:
 *   - Uses useMotionValue + animate() directly, so the touchmove handler
 *     only updates a single mutable value — no React re-render per frame.
 *   - Touch listeners are bound once per mount (not re-bound on every drag
 *     change), which is a perf fix vs. the previous version.
 */

// ---- Tunable constants ------------------------------------------------------
const EDGE_ZONE_PX = 28;        // Touch must start within this many px of the left edge.
const COMMIT_THRESHOLD_PX = 120; // Drag this far right to actually go back.
const DRAG_MAX_PX = 280;         // Visual cap on how far the page will follow the finger.

// Module-level flag — set to true right before a swipe-back commit so the
// NEXT mount of any entrance-animation component knows to skip itself.
export let suppressNextEntrance = false;
function setSuppressNext(v: boolean) {
  suppressNextEntrance = v;
}

export function SwipeBack({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, DRAG_MAX_PX], [1, 0.7]);
  const scale = useTransform(x, [0, DRAG_MAX_PX], [1, 0.96]);

  const [isDragging, setIsDragging] = useState(false);
  const [showChevron, setShowChevron] = useState(false);

  const touchState = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    horizontal: boolean | null;
  } | null>(null);

  // Reset on path change
  useEffect(() => {
    x.set(0);
    setIsDragging(false);
    setShowChevron(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Only enable on pages that have a "back" (not homepage)
  const canSwipeBack = pathname !== '/';

  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if (!canSwipeBack) return;
    const t = e.touches[0];
    if (!t) return;

    if (t.clientX > EDGE_ZONE_PX) {
      touchState.current = null;
      return;
    }

    touchState.current = {
      startX: t.clientX,
      startY: t.clientY,
      active: true,
      horizontal: null,
    };
  }

  function onTouchMove(e: ReactTouchEvent<HTMLDivElement>) {
    const state = touchState.current;
    if (!state || !state.active) return;

    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (state.horizontal === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return;
      if (absDy > absDx) {
        // Vertical-dominant: release to browser
        state.active = false;
        return;
      }
      state.horizontal = true;
      setIsDragging(true);
    }

    if (!state.horizontal) return;

    if (e.cancelable) e.preventDefault();
    const clamped = Math.max(0, Math.min(dx, DRAG_MAX_PX));
    x.set(clamped);
    setShowChevron(clamped > 15);
  }

  function onTouchEnd() {
    const state = touchState.current;
    touchState.current = null;
    if (!state || !state.active || !state.horizontal) {
      setIsDragging(false);
      setShowChevron(false);
      return;
    }

    const current = x.get();
    if (current >= COMMIT_THRESHOLD_PX) {
      const target = typeof window !== 'undefined' ? window.innerWidth : DRAG_MAX_PX;
      animate(x, target, {
        duration: 0.22,
        ease: [0.4, 0, 1, 1],
        onComplete: () => {
          // Tell the next entrance animation to skip itself
          setSuppressNext(true);
          router.back();
          requestAnimationFrame(() => x.set(0));
          setIsDragging(false);
          setShowChevron(false);
        },
      });
    } else {
      animate(x, 0, {
        duration: 0.24,
        ease: [0.32, 0.72, 0, 1],
        onComplete: () => {
          setIsDragging(false);
          setShowChevron(false);
        },
      });
    }
  }

  return (
    <>
      {/* Ghost back chevron — fades in as the user drags */}
      <AnimatePresence>
        {showChevron && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(x.get() / 60, 1) }}
            exit={{ opacity: 0 }}
            className="fixed top-1/2 -translate-y-1/2 z-[9998] pointer-events-none"
            style={{ left: `${Math.min(x.get() * 0.3, 60)}px` }}
          >
            <div className="w-12 h-12 rounded-full bg-black/10 backdrop-blur-md flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={`page-shell${isDragging ? ' is-dragging' : ''}`}
        style={{ x, opacity, scale, willChange: 'transform, opacity' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        data-swipe-back="true"
      >
        {children}
      </motion.div>
    </>
  );
}

// Export a helper so template.tsx (entrance animation) can check + clear the flag.
export function consumeSuppressNextEntrance(): boolean {
  const v = suppressNextEntrance;
  setSuppressNext(false);
  return v;
}
