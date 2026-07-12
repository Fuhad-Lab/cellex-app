'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef } from 'react';

/**
 * Playable Skeleton Loader — engagement over waiting.
 * 
 * Instead of a boring spinner, the user sees:
 * 1. Draggable "C" logo with 2D physics (bounces off edges)
 * 2. Playable skeleton cards they can swipe around
 * 3. Smooth spring animations everywhere
 * 
 * Turns waiting into a moment of play.
 */
export default function Loading() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden">
      {/* Draggable C logo with physics */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragElastic={0.6}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 15 }}
        style={{ x, y }}
        className="cursor-grab active:cursor-grabbing mb-10 relative"
      >
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 rounded-full border-[3px] border-neutral-200"
          style={{ borderTopColor: '#000' }}
        />
        {/* Inner C (pulsing) */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="text-3xl font-extrabold text-black" style={{ fontFamily: 'var(--font-geist-mono)' }}>C</span>
        </motion.div>
      </motion.div>

      {/* Playable skeleton cards (draggable) */}
      <div className="flex gap-3 mb-8 px-8">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            drag
            dragConstraints={containerRef}
            dragElastic={0.4}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="w-24 h-32 rounded-xl bg-neutral-100 overflow-hidden cursor-grab active:cursor-grabbing shadow-sm"
          >
            <div className="w-full h-16 skeleton" />
            <div className="p-2 space-y-1.5">
              <div className="skeleton h-2 rounded w-full" />
              <div className="skeleton h-2 rounded w-2/3" />
              <div className="skeleton h-3 rounded w-1/2" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bouncing dots */}
      <div className="flex gap-2 mb-3">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
            className="w-2.5 h-2.5 rounded-full bg-black"
          />
        ))}
      </div>

      <motion.p
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-xs text-neutral-400 font-medium tracking-wide"
      >
        Loading
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-[10px] text-neutral-300"
      >
        Drag the logo or cards to play ↑
      </motion.p>
    </div>
  );
}
