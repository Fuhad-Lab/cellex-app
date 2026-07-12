'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * Template — cinematic page transitions using framer-motion.
 * More dramatic: slides in from right + scales up slightly + fades in.
 * Re-triggers on every pathname change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, x: 30, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
