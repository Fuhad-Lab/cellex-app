'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';

/**
 * Physics Loader — interactive branded loading state.
 * 
 * The "C" logo can be dragged around the screen with spring physics.
 * It bounces off the edges of the viewport.
 * Turns waiting into a moment of play.
 */
export default function Loading() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center overflow-hidden">
      {/* Draggable C logo */}
      <motion.div
        drag
        dragConstraints={{
          left: -(typeof window !== 'undefined' ? window.innerWidth / 2 - 40 : 100),
          right: (typeof window !== 'undefined' ? window.innerWidth / 2 - 40 : 100),
          top: -(typeof window !== 'undefined' ? window.innerHeight / 2 - 40 : 100),
          bottom: (typeof window !== 'undefined' ? window.innerHeight / 2 - 40 : 100),
        }}
        dragElastic={0.6}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 15 }}
        style={{ x, y }}
        className="cursor-grab active:cursor-grabbing mb-12"
      >
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 rounded-full border-3 border-neutral-200"
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

      {/* Bouncing dots */}
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
            className="w-2.5 h-2.5 rounded-full bg-black"
          />
        ))}
      </div>

      {/* Subtle text */}
      <motion.p
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-xs text-neutral-400 font-medium tracking-wide"
      >
        Loading
      </motion.p>

      {/* Hint text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-[10px] text-neutral-300"
      >
        Drag the logo to play ↑
      </motion.p>
    </div>
  );
}
