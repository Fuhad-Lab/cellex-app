'use client';

import { useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';
import { Trash2, Archive, Check } from 'lucide-react';

/**
 * SwipeableRow — Telegram-style swipeable list item.
 *
 * Swipe left to reveal action buttons (delete, archive, etc.)
 * Works on both iOS and Android with physics-based spring animation.
 *
 * Usage:
 *   <SwipeableRow onDelete={() => removeItem(id)}>
 *     <div>Item content here</div>
 *   </SwipeableRow>
 *
 * Props:
 *   - onDelete: called when the delete action is triggered
 *   - onArchive: optional, called when archive action is triggered
 *   - threshold: drag distance to trigger action (default: 120px)
 */
export function SwipeableRow({
  children,
  onDelete,
  onArchive,
  threshold = 120,
}: {
  children: React.ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
  threshold?: number;
}) {
  const [{ x }, api] = useSpring(() => ({ x: 0 }));
  const [showActions, setShowActions] = useState(false);

  const bind = useDrag(
    ({ down, movement: [mx], direction: [dx], velocity: [vx] }) => {
      // Only allow leftward drag (negative x) to reveal actions
      const clamped = Math.max(0, -mx); // 0 to threshold
      const maxDrag = onArchive ? 160 : 80; // wider if 2 actions

      if (down) {
        // While dragging: follow finger with slight resistance
        api.start({ x: Math.max(-maxDrag, -clamped), immediate: true });
      } else {
        // Released: snap to open or closed based on threshold
        if (clamped > threshold || (vx > 0.5 && dx < 0)) {
          // Snap open to reveal actions
          api.start({ x: -maxDrag });
          setShowActions(true);
        } else {
          // Snap closed
          api.start({ x: 0 });
          setShowActions(false);
        }
      }
    },
    { axis: 'x', filterTaps: true }
  );

  const handleClose = () => {
    api.start({ x: 0 });
    setShowActions(false);
  };

  const handleDelete = () => {
    api.start({ x: -500, immediate: true });
    setTimeout(() => {
      onDelete?.();
      handleClose();
    }, 200);
  };

  const handleArchive = () => {
    onArchive?.();
    handleClose();
  };

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons behind the row */}
      <div className="absolute inset-0 flex justify-end">
        {onArchive && (
          <button
            onClick={handleArchive}
            className="w-20 h-full bg-neutral-500 flex items-center justify-center"
            aria-label="Archive"
          >
            <Archive className="w-5 h-5 text-white" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className={`h-full flex items-center justify-center ${onArchive ? 'w-20 bg-[#ed4956]' : 'w-20 bg-[#ed4956]'}`}
            aria-label="Delete"
            style={{ width: onArchive ? 80 : 80 }}
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* The draggable row content */}
      <animated.div
        {...bind()}
        style={{ x, touchAction: 'pan-y' }}
        className="relative bg-white"
      >
        {children}
      </animated.div>
    </div>
  );
}

/**
 * SwipeableCard — a simpler variant for cards that can be swiped away.
 * When swiped past the threshold, the card animates off-screen and
 * calls onDismiss.
 */
export function SwipeableCard({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const [{ x, opacity }, api] = useSpring(() => ({ x: 0, opacity: 1 }));

  const bind = useDrag(
    ({ down, movement: [mx], direction: [dx], velocity: [vx] }) => {
      if (down) {
        api.start({ x: mx, opacity: 1 - Math.min(Math.abs(mx) / 300, 0.5), immediate: true });
      } else {
        // If dragged far enough or flicked, dismiss
        if (Math.abs(mx) > 150 || (vx > 0.5 && Math.abs(mx) > 50)) {
          const direction = mx > 0 ? 1 : -1;
          api.start({ x: direction * 500, opacity: 0 });
          setTimeout(() => onDismiss?.(), 300);
        } else {
          // Snap back
          api.start({ x: 0, opacity: 1 });
        }
      }
    },
    { axis: 'x' }
  );

  return (
    <animated.div
      {...bind()}
      style={{ x, opacity, touchAction: 'pan-y' }}
    >
      {children}
    </animated.div>
  );
}
