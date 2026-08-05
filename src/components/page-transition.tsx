'use client';

/**
 * PageTransition
 * --------------
 * Wraps every Next.js App Router page and:
 *
 *  1. **Slide-in on navigation** — when the route changes, the new page slides
 *     in from right-to-left (x: 100% -> 0). This is the "opening a new page"
 *     animation the user asked for.
 *
 *  2. **iOS-style swipe-back gesture** — when the user starts a touch within
 *     the leftmost ~28px of the screen and drags rightward, the page follows
 *     their finger (sliding left-to-right, as if being pushed off-screen).
 *     Releasing past ~120px commits the back navigation; otherwise the page
 *     snaps back. This is the "exiting a page" animation the user asked for
 *     and matches the iOS native feel.
 *
 *  3. Sizing safety — the shell is pinned to `width:100%` and overflow is
 *     hidden on <main>, so the slide animation can never introduce a
 *     horizontal scrollbar.
 *
 * The component is intentionally self-contained: it owns its own motion
 * values, its own touch listeners, and its own route-change subscription
 * (via usePathname). It does NOT use AnimatePresence because the App Router
 * swaps `children` in place — keyed remounting via `key={pathname}` is enough
 * to trigger the entrance animation on every navigation.
 */

import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';

// ---- Tunable constants ------------------------------------------------------
const EDGE_ZONE_PX = 28;        // Touch must start within this many px of the left edge.
const COMMIT_THRESHOLD_PX = 120; // Drag this far right to actually go back.
const DRAG_MAX_PX = 280;         // Visual cap on how far the page will follow the finger.
const SLIDE_DURATION = 0.32;     // seconds — entrance animation length
const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]; // iOS-like ease

// Module-level flag — set to true right before a swipe-back commit so the
// NEXT mount of <PageTransition> knows to skip its slide-in animation.
// (The user already saw the previous page revealed as they dragged; replaying
// a slide-in would feel like a glitch.)
let suppressNextEntrance = false;

// Module-level set of visited pages — pages that have been visited before
// don't replay the entrance animation (only first visit or reload animates).
const visitedPages = new Set<string>();

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Single source of truth for the shell's horizontal position.
  const x = useMotionValue(0);
  // Dim the page slightly as it slides off — sells the "card being pushed
  // over the previous page" effect.
  const opacity = useTransform(x, [0, DRAG_MAX_PX], [1, 0.7]);
  // Subtle scale on the underlying card so the depth reads correctly.
  const scale = useTransform(x, [0, DRAG_MAX_PX], [1, 0.96]);

  const [isDragging, setIsDragging] = useState(false);
  const touchState = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    horizontal: boolean | null;
  } | null>(null);

  // ----- Entrance animation: slide in from the right (x = innerWidth -> 0) --
  // Runs on every pathname change because key={pathname} remounts the shell.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If this mount immediately follows a swipe-back commit, skip the
    // slide-in animation — the user already saw the previous page revealed.
    if (suppressNextEntrance) {
      suppressNextEntrance = false;
      x.set(0);
      return;
    }

    // Skip animation for pages already visited — only animate on first visit.
    // This prevents the animation from replaying every time the user navigates
    // back to a page they've already seen.
    if (visitedPages.has(pathname)) {
      x.set(0);
      return;
    }

    // First visit to this page — mark as visited and play the slide-in.
    visitedPages.add(pathname);

    // Default forward navigation: slide in from the right.
    x.set(window.innerWidth);
    const controls = animate(x, 0, {
      duration: SLIDE_DURATION,
      ease: SLIDE_EASE,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ----- Swipe-back gesture handlers -----------------------------------------
  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if (typeof window === 'undefined') return;
    const t = e.touches[0];
    if (!t) return;

    // Only begin tracking if the touch began inside the left edge zone.
    if (t.clientX > EDGE_ZONE_PX) {
      touchState.current = null;
      return;
    }

    touchState.current = {
      startX: t.clientX,
      startY: t.clientY,
      active: true,
      horizontal: null, // undecided yet — we decide after the first move
    };
  }

  function onTouchMove(e: ReactTouchEvent<HTMLDivElement>) {
    const state = touchState.current;
    if (!state || !state.active) return;

    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    // Decide gesture direction once we have enough movement.
    if (state.horizontal === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return; // ignore micro-jitter
      // Vertical-dominant movement = the user is scrolling the page, not
      // swiping back. Release control to the browser.
      if (absDy > absDx) {
        state.active = false;
        return;
      }
      state.horizontal = true;
      setIsDragging(true);
    }

    if (!state.horizontal) return;

    // Block the page from scrolling while we drag horizontally.
    if (e.cancelable) e.preventDefault();

    // Only allow rightward movement, and cap it so the page doesn't fly off.
    const clamped = Math.max(0, Math.min(dx, DRAG_MAX_PX));
    x.set(clamped);
  }

  function onTouchEnd() {
    const state = touchState.current;
    touchState.current = null;
    if (!state || !state.active || !state.horizontal) {
      // No active drag — nothing to commit / cancel.
      setIsDragging(false);
      return;
    }

    const current = x.get();
    if (current >= COMMIT_THRESHOLD_PX) {
      // Commit: animate the rest of the way off-screen, then go back.
      const target = typeof window !== 'undefined' ? window.innerWidth : DRAG_MAX_PX;
      animate(x, target, {
        duration: 0.22,
        ease: [0.4, 0, 1, 1],
        onComplete: () => {
          // Tell the next <PageTransition> mount (the page we're going back
          // to) to skip its slide-in animation — the gesture already revealed it.
          suppressNextEntrance = true;
          router.back();
          // Safety net in case the route change doesn't remount the shell
          // (e.g. navigating to the same pathname). Reset on next frame.
          requestAnimationFrame(() => x.set(0));
          setIsDragging(false);
        },
      });
    } else {
      // Cancel: snap back to 0.
      animate(x, 0, {
        duration: 0.24,
        ease: SLIDE_EASE,
        onComplete: () => setIsDragging(false),
      });
    }
  }

  // ----- Render --------------------------------------------------------------
  return (
    <motion.div
      key={pathname}
      className={`page-shell${isDragging ? ' is-dragging' : ''}`}
      style={{ x, opacity, scale }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      // Prevent the browser from intercepting the gesture as a native
      // overscroll/refresh once we're committed to a horizontal drag.
      // (Per-gesture preventDefault in onTouchMove handles the actual blocking;
      // this attribute is the belt-and-braces version.)
      data-swipe-back="true"
    >
      {children}
    </motion.div>
  );
}

// Re-export PanInfo so downstream consumers can type their own handlers if needed.
export type { PanInfo };
