'use client';

/**
 * Screen — the interactive view layer for the IOSStack.
 *
 * Each Screen is an absolutely-positioned layer. Its horizontal position
 * is controlled by a MotionValue passed from IOSStack:
 *   - TOP page: x = dragX (draggable via touch)
 *   - BEHIND page: x = parallaxX (derived from dragX)
 *   - EXITING page: x = dragX (animating to W)
 *
 * Drag gesture:
 *   - Touch must start within EDGE_ZONE_PX of the left edge
 *   - Only horizontal-dominant gestures are intercepted (vertical = page scroll)
 *   - On release: if past COMMIT_THRESHOLD → animate dragX to W, then onBack()
 *                 otherwise → animate dragX back to 0 (snap back)
 */

import { motion, animate, type MotionValue } from 'framer-motion';
import {
  type ReactNode,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
  useEffect,
} from 'react';

const EDGE_ZONE_PX = 28;
const COMMIT_THRESHOLD_PX = 120;
const DRAG_MAX_PX = 320;
// Match the IOSStack push/back durations for visual consistency.
// Drag-commit is slightly faster (0.35s) because the user has already
// visually "committed" by dragging past the threshold — a long animation
// here would feel laggy.
const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const SNAP_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const DRAG_COMMIT_DURATION = 0.35;
const DRAG_CANCEL_DURATION = 0.3;

interface ScreenProps {
  children: ReactNode;
  isTop: boolean;
  isExiting: boolean;
  xValue: MotionValue<number>;
  overlayOpacity?: MotionValue<number>;
  onBack: () => void;
}

export function Screen({ children, isTop, isExiting, xValue, overlayOpacity, onBack }: ScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const touchState = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    horizontal: boolean | null;
  } | null>(null);

  // Get window width (cached)
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;

  // ---- Touch handlers (only for the TOP, non-exiting page) ----
  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if (!isTop || isExiting) return;
    const t = e.touches[0];
    if (!t) return;

    // Only start tracking if touch is in the left edge zone
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
    if (!isTop || isExiting) return;
    const state = touchState.current;
    if (!state || !state.active) return;

    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    // Decide gesture direction on first significant move
    if (state.horizontal === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return;
      // Vertical-dominant → let the browser handle it (page scroll)
      if (absDy > absDx) {
        state.active = false;
        return;
      }
      state.horizontal = true;
      setIsDragging(true);
    }

    if (!state.horizontal) return;

    // Prevent vertical scroll while dragging horizontally
    if (e.cancelable) e.preventDefault();

    // Follow the finger, capped at DRAG_MAX_PX
    const clamped = Math.max(0, Math.min(dx, DRAG_MAX_PX));
    xValue.set(clamped);
  }

  function onTouchEnd() {
    if (!isTop || isExiting) return;
    const state = touchState.current;
    touchState.current = null;
    if (!state || !state.active || !state.horizontal) {
      setIsDragging(false);
      return;
    }

    const current = xValue.get();
    if (current >= COMMIT_THRESHOLD_PX) {
      // COMMIT: animate the page all the way off-screen, THEN navigate back
      animate(xValue, windowWidth, {
        duration: DRAG_COMMIT_DURATION,
        ease: SLIDE_EASE,
        onComplete: () => {
          onBack();
        },
      });
    } else {
      // CANCEL: snap back to 0
      animate(xValue, 0, {
        duration: DRAG_CANCEL_DURATION,
        ease: SNAP_EASE,
        onComplete: () => setIsDragging(false),
      });
    }
  }

  // ---- Render ----
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        x: xValue,
        background: '#fff',
        boxShadow: isTop && !isExiting ? '-10px 0 25px rgba(0,0,0,0.2)' : 'none',
        zIndex: isExiting ? 2 : isTop ? 2 : 1,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Page content — each screen has its own scroll container */}
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: '#fff',
        }}
      >
        {children}
      </div>

      {/* Dimming overlay for the BEHIND page */}
      {overlayOpacity && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            opacity: overlayOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  );
}
