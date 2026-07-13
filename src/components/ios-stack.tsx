'use client';

/**
 * IOSStack — true iOS-style navigation stack for Next.js App Router.
 *
 * Architecture:
 *   1. Keeps a history array of pages so the "previous" page stays alive
 *      in the DOM (unlike default Next.js which unmounts it).
 *   2. A shared MotionValue (`activeDragX`) connects the drag of the top
 *      page to the parallax movement of the page behind it.
 *   3. Only the top 2 pages are rendered at any time (memory optimization).
 *
 * Bug fixes vs. the original spec:
 *   - Removed `useSearchParams` from the dependency array — it would cause
 *     the effect to fire on every render (since `children` changes each time)
 *     and also requires a Suspense boundary which breaks static export.
 *     We now key the stack on `pathname` only; search-param changes update
 *     the top page in-place (no stack push).
 *   - Added a "same path" check so re-renders that don't change the pathname
 *     update the top item's component instead of pushing a duplicate.
 *   - Guarded against SSR (stack starts empty, fills on first client render).
 */

import { usePathname, useRouter } from 'next/navigation';
import { useMotionValue, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Screen } from '@/components/screen';

interface StackItem {
  key: string;
  component: React.ReactNode;
}

export function IOSStack({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // 1. The History Stack
  const [stack, setStack] = useState<StackItem[]>([]);
  const isBack = useRef(false);
  const isReady = useRef(false);

  // 2. Shared Physics State
  // This value tracks the drag position of the TOP page.
  // We pass it down so the page BEHIND can "watch" the drag and move in parallax.
  const activeDragX = useMotionValue(0);

  // 3. Navigation detection — only fires on pathname change, NOT on every children update
  useEffect(() => {
    const fullPath = pathname;

    setStack((prev) => {
      // First render — just add the initial page
      if (prev.length === 0) {
        isBack.current = false;
        return [{ key: fullPath, component: children }];
      }

      // Back detection: if the new path matches the item below the top, it's a "Back" action
      if (prev.length > 1 && prev[prev.length - 2].key === fullPath) {
        isBack.current = true;
        return prev.slice(0, -1); // remove the top item
      }

      // Same path (e.g. search params changed) — just update the top item's component
      if (prev[prev.length - 1].key === fullPath) {
        isBack.current = false;
        return [...prev.slice(0, -1), { key: fullPath, component: children }];
      }

      // Otherwise, it's a "Push" action
      isBack.current = false;
      return [...prev, { key: fullPath, component: children }];
    });

    // Reset drag value on navigation
    activeDragX.set(0);
    isReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Update the top item's component whenever children changes (without pushing)
  // This ensures context updates (cart count, auth, etc.) propagate to the visible page.
  const updateTopComponent = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const top = prev[prev.length - 1];
      if (top.key === pathname) {
        return [...prev.slice(0, -1), { key: top.key, component: children }];
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    updateTopComponent();
  }, [children, updateTopComponent]);

  // Hydration safety — don't render anything until the first effect runs
  if (stack.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <AnimatePresence initial={false} custom={isBack.current}>
        {stack.map((item, index) => {
          const isTop = index === stack.length - 1;
          const isBehind = index === stack.length - 2;

          // Optimization: Only render the top 2 pages to save memory
          if (!isTop && !isBehind) return null;

          return (
            <Screen
              key={item.key}
              index={index}
              isTop={isTop}
              isBack={isBack.current}
              dragX={activeDragX}
              onBack={() => router.back()}
            >
              {item.component}
            </Screen>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
