'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * Template — cinematic page transitions using framer-motion.
 * 
 * Each page:
 * - Enters: slides in from right (12px) + fades in + slides up (8px)
 * - Uses spring physics for a natural, premium feel
 * - Re-triggers on every pathname change
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, x: 12, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -12, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
