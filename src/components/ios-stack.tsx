'use client';

/**
 * IOSStack — iOS-style navigation with "Move with me" drag + frozen previous page.
 *
 * FIX: hasPrevious uses a ref (not state) to avoid race conditions between
 * the drag-back callback's setHasPrevious(false) and the render-time
 * setHasPrevious(true). Refs update synchronously — no batching issues.
 */

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';

const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const PUSH_DURATION = 0.45;
const BACK_DURATION = 0.4;
const EDGE_ZONE_PX = 28;
const COMMIT_THRESHOLD_PX = 120;

export function IOSStack({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;

  // --- Frozen previous page ---
  const previousChildren = useRef<ReactNode | null>(null);
  const lastChildren = useRef<ReactNode>(children);
  const lastPath = useRef<string>(pathname);
  // FIX: Use a ref for hasPrevious to avoid race conditions.
  // State batching can cause setHasPrevious(false) from drag-back to
  // override setHasPrevious(true) from the render-time check.
  const hasPreviousRef = useRef(false);
  const [hasPreviousState, setHasPreviousState] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // Helper to update both ref and state
  const setHasPrevious = (val: boolean) => {
    hasPreviousRef.current = val;
    setHasPreviousState(val);
  };

  // --- Render-time capture of previous children ---
  if (lastPath.current !== pathname) {
    previousChildren.current = lastChildren.current;
    setHasPrevious(true);
    setDirection(lastPath.current.length > pathname.length ? 'back' : 'forward');
    lastPath.current = pathname;
  }
  lastChildren.current = children;

  // --- Motion values ---
  const x = useMotionValue(0);
  const prevPageX = useTransform(x, [0, windowWidth], [0, windowWidth * 0.2]);
  const shadowOpacity = useTransform(x, [0, windowWidth], [0.35, 0]);
  const prevPageScale = useTransform(x, [0, windowWidth], [0.96, 1]);

  // --- Manual touch handlers ---
  const touchState = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    horizontal: boolean | null;
  }>({ startX: 0, startY: 0, active: false, horizontal: null });
  const [isDragging, setIsDragging] = useState(false);

  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    // FIX: Use the ref (synchronous) instead of state (may be stale due to batching)
    if (!hasPreviousRef.current) return;
    const t = e.touches[0];
    if (!t || t.clientX > EDGE_ZONE_PX) {
      touchState.current = { startX: 0, startY: 0, active: false, horizontal: null };
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
    if (!state.active) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (state.horizontal === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return;
      if (absDy > absDx) {
        state.active = false;
        return;
      }
      state.horizontal = true;
      setIsDragging(true);
    }

    if (!state.horizontal) return;
    if (e.cancelable) e.preventDefault();

    const clamped = Math.max(0, Math.min(dx, windowWidth));
    x.set(clamped);
  }

  function onTouchEnd() {
    const state = touchState.current;
    touchState.current = { startX: 0, startY: 0, active: false, horizontal: null };
    if (!state.active || !state.horizontal) {
      setIsDragging(false);
      return;
    }

    const current = x.get();
    if (current >= COMMIT_THRESHOLD_PX) {
      // Commit: animate off-screen, then navigate back
      animate(x, windowWidth, {
        duration: 0.3,
        ease: SLIDE_EASE,
        onComplete: () => {
          // FIX: Don't clear hasPrevious here — let the render-time check
          // handle it when the pathname changes after router.back().
          // This prevents the race condition where setHasPrevious(false)
          // overrides the render-time setHasPrevious(true).
          router.back();
          requestAnimationFrame(() => {
            x.set(0);
            setIsDragging(false);
          });
        },
      });
    } else {
      animate(x, 0, {
        duration: 0.3,
        ease: SLIDE_EASE,
        onComplete: () => setIsDragging(false),
      });
    }
  }

  // --- Animation variants ---
  const variants = {
    enter: (dir: string) => ({
      x: dir === 'forward' ? '100%' : '0%',
      zIndex: 10,
    }),
    center: {
      x: 0,
      zIndex: 10,
      transition: { duration: PUSH_DURATION, ease: SLIDE_EASE },
    },
    exit: (dir: string) => ({
      x: dir === 'forward' ? '-20%' : '100%',
      zIndex: dir === 'forward' ? 1 : 10,
      transition: { duration: BACK_DURATION, ease: SLIDE_EASE },
    }),
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
      {/* Layer 0: Frozen Previous Page */}
      {hasPreviousState && previousChildren.current && (
        <motion.div
          className="absolute inset-0 bg-white"
          style={{
            x: prevPageX,
            scale: prevPageScale,
            zIndex: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {previousChildren.current}
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ opacity: shadowOpacity }}
          />
        </motion.div>
      )}

      {/* Layer 1: Active Page */}
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{
            x,
            zIndex: 10,
            position: 'absolute',
            inset: 0,
            background: '#fff',
            boxShadow: isDragging ? '-8px 0 25px rgba(0,0,0,0.2)' : 'none',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
