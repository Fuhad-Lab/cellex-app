'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { consumeSuppressNextEntrance } from '@/components/swipe-back';

/**
 * Template — cinematic page transitions using framer-motion.
 *
 * Default behaviour: a new page slides in from the right (x: 30 → 0) with a
 * subtle scale + fade. This is the "opening a new page" animation.
 *
 * Exception: if the user just performed a swipe-back gesture, the destination
 * page is already visible underneath the dragging page — so we skip the
 * slide-in animation that frame (just fade in instantly).
 *
 * Re-triggers on every pathname change because Next.js remounts `template.tsx`
 * on every navigation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    // If we just landed here via a swipe-back gesture, skip the slide-in.
    if (consumeSuppressNextEntrance()) {
      setSkipAnimation(true);
    } else {
      setSkipAnimation(false);
    }
  }, [pathname]);

  if (skipAnimation) {
    // No animation — just render the children at their final position.
    return <>{children}</>;
  }

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
