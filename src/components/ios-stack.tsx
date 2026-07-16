'use client';

/**
 * IOSStack — true iOS-style navigation stack for Next.js App Router.
 *
 * Architecture:
 *   1. Maintains a history array of page keys + frozen React elements.
 *   2. A shared MotionValue (`dragX`) controls the TOP page's X position.
 *   3. The BEHIND page's X is derived via `useTransform` (parallax).
 *
 * CRITICAL: Each stack item stores the EXACT `children` React element that was
 * passed to IOSStack at the moment of navigation. This is the "frozen snapshot"
 * of the previous page. The TOP page renders the CURRENT `children` (live).
 *
 * The behind page shows the PREVIOUS page because:
 *   - When navigating A→B, the effect captures `children` (which is A's content
 *     at that point, because the effect runs AFTER render but the `children`
 *     prop hasn't changed yet for this specific pathname change).
 *   - We store `{ key: A, component: children_at_this_moment }` as the behind item.
 *   - We store `{ key: B, component: children_at_this_moment }` as the top item.
 *   - On the NEXT render, `children` becomes B (new page). But the behind item
 *     still holds the OLD children reference (A's content).
 *
 * IMPORTANT: We do NOT use a ref to track live children. Instead, we store
 * the children in the stack state itself. The TOP item's component is updated
 * via a separate effect that fires when `children` changes (but only updates
 * the TOP item, never the behind items).
 */

import { usePathname, useRouter } from 'next/navigation';
import { useMotionValue, useTransform, animate } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Screen } from '@/components/screen';

interface StackItem {
  key: string;
  component: React.ReactNode;
  isExiting?: boolean;
}

const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const PUSH_DURATION = 0.45;
const BACK_DURATION = 0.4;

export function IOSStack({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [stack, setStack] = useState<StackItem[]>([]);
  const isBack = useRef(false);
  const isDragBack = useRef(false);
  const isFirstMount = useRef(true);
  // Track the pathname that was active when `children` was last captured.
  // This lets us know if `children` is for the current pathname or a new one.
  const lastPathRef = useRef<string>('');

  const dragX = useMotionValue(0);
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
  const parallaxX = useTransform(dragX, [0, windowWidth], [0, windowWidth * 0.2]);
  const overlayOpacity = useTransform(dragX, [0, windowWidth], [0.35, 0]);

  // ---- Navigation handler — fires ONLY on pathname change ----
  // At this point, `children` is STILL the OLD page's content (React hasn't
  // re-rendered with the new children yet for this effect cycle).
  // Wait — actually, by the time useEffect runs, the component HAS re-rendered
  // with the new `children`. So `children` is the NEW page's content.
  //
  // This means when navigating A→B:
  //   - pathname changes from A to B
  //   - React re-renders IOSStack with children = B
  //   - useEffect fires with pathname = B, children = B
  //   - The stack already has [A] from before
  //   - We push B: stack becomes [A, B]
  //   - A's component was captured during the PREVIOUS render (when children was A)
  //
  // So A's component is correctly frozen. The issue is that A's component was
  // set to `children` during the first mount, when children WAS A. ✓
  //
  // BUT: on subsequent re-renders (not navigations), `children` changes (e.g.
  // context updates, state changes in parent). We need to update ONLY the TOP
  // item's component, never the behind items.

  useEffect(() => {
    const ww = typeof window !== 'undefined' ? window.innerWidth : 375;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastPathRef.current = pathname;
      setStack([{ key: pathname, component: children }]);
      dragX.set(0);
      return;
    }

    if (isDragBack.current) {
      isDragBack.current = false;
      isBack.current = true;
      setStack((prev) => {
        const cleaned = prev.filter((item) => !item.isExiting);
        return cleaned.slice(0, -1);
      });
      dragX.set(0);
      lastPathRef.current = pathname;
      return;
    }

    // At this point, `children` is the NEW page's content.
    // The `prev` stack has the OLD pages with their frozen components.
    setStack((prev) => {
      if (prev.length === 0) {
        isBack.current = false;
        return [{ key: pathname, component: children }];
      }

      // Back detection: new path matches the item below the top
      if (prev.length > 1 && prev[prev.length - 2].key === pathname) {
        isBack.current = true;
        // Mark the top as exiting — keep its frozen component
        return prev.map((item, i) =>
          i === prev.length - 1 ? { ...item, isExiting: true } : item
        );
      }

      // Same path — just update the top's component
      if (prev[prev.length - 1].key === pathname) {
        isBack.current = false;
        return [...prev.slice(0, -1), { key: pathname, component: children }];
      }

      // Push — the OLD top becomes the BEHIND (its component is already frozen).
      // The NEW page becomes the TOP with the current `children`.
      isBack.current = false;
      const clean = prev.filter((item) => !item.isExiting && item.key !== pathname);
      return [...clean, { key: pathname, component: children }];
    });

    lastPathRef.current = pathname;

    if (isBack.current) {
      animate(dragX, ww, {
        duration: BACK_DURATION,
        ease: SLIDE_EASE,
        onComplete: () => {
          setStack((prev) => prev.filter((item) => !item.isExiting).slice(0, -1));
          dragX.set(0);
        },
      });
    } else {
      dragX.set(ww);
      animate(dragX, 0, {
        duration: PUSH_DURATION,
        ease: SLIDE_EASE,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ---- Update ONLY the top item's component when children changes ----
  // This fires on every render where children is different but pathname
  // hasn't changed (e.g. context updates, cart count changes).
  // It ONLY updates the TOP item — behind items keep their frozen components.
  useEffect(() => {
    if (pathname !== lastPathRef.current) return; // Skip during navigation
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.isExiting) return prev; // Don't update exiting items
      if (last.key !== pathname) return prev; // Safety check
      // Only update if the component reference actually changed
      if (last.component === children) return prev;
      return [...prev.slice(0, -1), { ...last, component: children }];
    });
  }, [children, pathname]);

  // ---- Handle drag-triggered back ----
  const handleDragBack = () => {
    isDragBack.current = true;
    router.back();
  };

  // ---- Render ----
  if (stack.length === 0) return null;

  const hasExiting = stack.some((item) => item.isExiting);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
      {stack.map((item, index) => {
        const isExiting = !!item.isExiting;
        const isLast = index === stack.length - 1;
        const isSecondLast = index === stack.length - 2;

        if (!isLast && !isSecondLast && !isExiting) return null;

        const useDragX = isExiting || (isLast && !hasExiting);
        const useParallaxX = !useDragX;

        // The TOP page renders `item.component` (which is kept up-to-date by
        // the children-update effect above). The BEHIND page renders its
        // frozen `item.component` (captured at navigation time, never updated).
        // Both use `item.component` — the difference is that the TOP item's
        // component is updated on every render via the effect, while the
        // BEHIND item's component is NEVER updated after it's pushed.

        return (
          <Screen
            key={item.key}
            isTop={isLast && !isExiting}
            isExiting={isExiting}
            xValue={useDragX ? dragX : parallaxX}
            overlayOpacity={useParallaxX ? overlayOpacity : undefined}
            onBack={handleDragBack}
          >
            {item.component}
          </Screen>
        );
      })}
    </div>
  );
}
