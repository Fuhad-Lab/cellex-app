'use client';

import { useRef, useState, useCallback, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { motion } from 'framer-motion';

/**
 * PullToRefresh — swipe-down-to-refresh with 5 dancing circles.
 *
 * Behavior:
 *   1. User swipes down from the top of the scroll container
 *   2. Instead of a reload icon, 5 circles appear and "dance" (bounce up
 *      and down in sequence, like a wave)
 *   3. If the user releases past the threshold, onRefresh() is called
 *   4. The circles continue dancing while the refresh is in progress
 *   5. When the refresh completes, the circles retract and disappear
 *
 * The dancing circles animation: 5 dots that scale up and down in sequence,
 * creating a wave effect. No reload/spinner icon — just the dancing dots.
 */

const PULL_THRESHOLD = 80;   // px the user needs to pull down to trigger refresh
const MAX_PULL = 120;        // visual cap on how far the content moves down
const CIRCLE_SIZE = 8;       // px diameter of each dancing circle
const CIRCLE_GAP = 6;        // px gap between circles

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchState = useRef<{
    startY: number;
    active: boolean;
    pulling: boolean;
  }>({ startY: 0, active: false, pulling: false });

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    // Only activate pull-to-refresh if the scroll container is at the top
    if (el.scrollTop <= 0) {
      touchState.current = {
        startY: e.touches[0].clientY,
        active: true,
        pulling: false,
      };
    } else {
      touchState.current.active = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const state = touchState.current;
    if (!state.active || refreshing) return;

    const dy = e.touches[0].clientY - state.startY;
    if (dy > 0) {
      // User is pulling down
      state.pulling = true;
      const clamped = Math.min(dy * 0.5, MAX_PULL); // rubber-band resistance
      setPullDistance(clamped);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    const state = touchState.current;
    if (!state.active) return;
    state.active = false;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      // Trigger refresh
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6); // hold at a reduced height
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const showCircles = pullDistance > 5 || refreshing;

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Dancing circles indicator */}
      {showCircles && (
        <div
          className="flex items-center justify-center gap-1.5 overflow-hidden transition-opacity"
          style={{
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="rounded-full bg-black"
              style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
              animate={{
                y: refreshing || pullDistance >= PULL_THRESHOLD
                  ? [0, -8, 0]  // dancing
                  : [0, -pullDistance * 0.15, 0], // gentle preview bounce
              }}
              transition={{
                duration: 0.6,
                repeat: refreshing || pullDistance >= PULL_THRESHOLD ? Infinity : 0,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: `translateY(${showCircles ? 0 : 0}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
