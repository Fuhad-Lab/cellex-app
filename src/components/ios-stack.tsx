'use client';

/**
 * IOSStack — iOS-style navigation with "Move with me" drag + frozen previous page.
 *
 * Architecture:
 *   Layer 0 (z-0): Frozen previous page — captured BEFORE navigation, never updated.
 *                   Has a dimming overlay that fades as you drag.
 *   Layer 1 (z-10): Active page — draggable via framer-motion's `drag` prop.
 *                   Follows finger 1:1 (dragElastic right: 1).
 *
 * How the "frozen previous page" works:
 *   - We use a render-time ref check (NOT a useEffect) to capture the old children.
 *   - When `pathname` changes between renders, the ref still holds the PREVIOUS
 *     render's children. We snapshot that into `previousChildren.current`.
 *   - This must happen during render, NOT in useEffect, because by the time
 *     useEffect fires, `children` has already become the new page.
 *
 * Improvements over the proposed spec:
 *   1. SSR-safe: `window.innerWidth` guarded with `typeof window` check.
 *   2. Correct children capture: Uses render-time ref, not useEffect.
 *   3. Drag enabled whenever there's a previous page (not based on direction).
 *   4. Parallax at rest is 0 (previous page fully hidden, no left-edge gap).
 *   5. Manual touch handlers for edge-zone detection (framer's drag is too
 *      aggressive — it captures ALL horizontal touches, blocking vertical scroll).
 */

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { Screen } from '@/components/screen';

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
  // previousChildren: snapshot of the page we just left (captured during render)
  // lastChildren: the children from the PREVIOUS render (used to detect changes)
  // lastPath: the pathname from the PREVIOUS render
  const previousChildren = useRef<ReactNode | null>(null);
  const lastChildren = useRef<ReactNode>(children);
  const lastPath = useRef<string>(pathname);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // --- Render-time capture of previous children ---
  // This runs DURING render (not in useEffect). When pathname changes between
  // renders, lastChildren.current still holds the OLD page's children.
  // We snapshot it into previousChildren BEFORE updating lastChildren.
  if (lastPath.current !== pathname) {
    // Pathname changed! Capture the old children as the "previous page"
    previousChildren.current = lastChildren.current;
    setHasPrevious(true);
    // Detect direction: if the new path is shorter, it's likely a "back"
    setDirection(lastPath.current.length > pathname.length ? 'back' : 'forward');
    lastPath.current = pathname;
  }
  lastChildren.current = children;

  // --- Motion values ---
  const x = useMotionValue(0);
  // Previous page: at rest (x=0), fully hidden at position 0 (behind current).
  // During drag (x→W), shifts right 20% for parallax depth.
  const prevPageX = useTransform(x, [0, windowWidth], [0, windowWidth * 0.2]);
  // Dimming overlay: dark at rest, fades as you drag
  const shadowOpacity = useTransform(x, [0, windowWidth], [0.35, 0]);
  // Subtle scale on previous page (zoom in slightly as revealed)
  const prevPageScale = useTransform(x, [0, windowWidth], [0.96, 1]);

  // --- Manual touch handlers for edge-zone swipe-back ---
  // We DON'T use framer-motion's `drag` prop because it captures ALL horizontal
  // touches and blocks vertical scrolling. Instead, we use manual touch handlers
  // that only activate when the touch starts within the left edge zone.
  const touchState = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    horizontal: boolean | null;
  }>({ startX: 0, startY: 0, active: false, horizontal: null });
  const [isDragging, setIsDragging] = useState(false);

  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if (!hasPrevious) return;
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
          setHasPrevious(false);
          previousChildren.current = null;
          router.back();
          requestAnimationFrame(() => x.set(0));
        },
      });
    } else {
      // Cancel: snap back
      animate(x, 0, {
        duration: 0.3,
        ease: SLIDE_EASE,
        onComplete: () => setIsDragging(false),
      });
    }
  }

  // --- Animation variants for push/back (non-drag) ---
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
      {/* --- LAYER 0: Frozen Previous Page --- */}
      {hasPrevious && previousChildren.current && (
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
          {/* Dimming overlay — fades as the current page is dragged away */}
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none"
            style={{ opacity: shadowOpacity }}
          />
        </motion.div>
      )}

      {/* --- LAYER 1: Active Page (draggable via manual touch handlers) --- */}
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
