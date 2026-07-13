'use client';

/**
 * Screen — the interactive view layer for the IOSStack.
 *
 * Each Screen represents one page in the navigation stack.
 *
 *   - The TOP page is draggable (swipe right to go back).
 *   - The BEHIND page follows the top page's drag in parallax (0 → -30%).
 *   - A dark overlay dims the behind page; it fades as the top page is dragged away.
 *   - Uses framer-motion spring physics tuned to feel like iOS.
 */

import { motion, useTransform, type MotionValue, type PanInfo } from 'framer-motion';
import { type ReactNode, useMemo } from 'react';

// Tuned Physics: High stiffness/damping for that "Apple" snap
const IOS_SPRING = {
  type: 'spring' as const,
  stiffness: 350,
  damping: 40,
  mass: 1,
};

interface ScreenProps {
  children: ReactNode;
  index: number;
  isTop: boolean;
  isBack: boolean;
  dragX: MotionValue<number>;
  onBack: () => void;
}

export function Screen({ children, index, isTop, isBack, dragX, onBack }: ScreenProps) {
  // Calculate window width once (client-side only — this component is 'use client')
  const windowWidth = useMemo(() => {
    if (typeof window === 'undefined') return 375;
    return window.innerWidth;
  }, []);

  // -- PARALLAX LOGIC --
  // If we are the page BEHIND, we map the Top Page's drag (0px -> ScreenWidth)
  // to our parallax movement (-30% -> 0%).
  const parallaxX = useTransform(dragX, [0, windowWidth], [-windowWidth * 0.3, 0]);

  // We also fade the black dimming overlay as the top page is dragged away
  const overlayOpacity = useTransform(dragX, [0, windowWidth], [0.3, 0]);

  // -- ANIMATION VARIANTS --
  const variants = {
    initial: (back: boolean) => ({
      // If pushing: enter from right (100%)
      // If popping: start at parallax position (-30%)
      x: back ? '-30%' : '100%',
      zIndex: index,
    }),
    animate: {
      x: 0,
      zIndex: index,
      transition: IOS_SPRING,
    },
    exit: (back: boolean) => ({
      // If pushing: move to parallax position (-30%)
      // If popping: slide out to right (100%)
      x: back ? '100%' : '-30%',
      zIndex: index,
      transition: IOS_SPRING,
    }),
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    const threshold = windowWidth * 0.35;

    // Trigger 'Back' if dragged 35% of screen OR flicked fast
    if (offset > threshold || velocity > 400) {
      onBack();
    }
  };

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#fff',
        boxShadow: isTop ? '-10px 0 25px rgba(0,0,0,0.2)' : 'none',
        // CRITICAL: If Top, use the raw drag value. If Behind, use the calculated parallax.
        x: isTop ? dragX : parallaxX,
      }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      custom={isBack}
      // Only enable gestures if this is the active top page
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 1 }}
      onDragEnd={handleDragEnd}
    >
      {/* Page Content — each screen has its own scroll container */}
      <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>

      {/* Dimming Overlay (Only for the page sitting behind) */}
      {!isTop && (
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
