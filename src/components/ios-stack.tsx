'use client';

/**
 * IOSStack — true iOS-style navigation stack for Next.js App Router.
 *
 * Architecture:
 *   1. Maintains a history array of page keys + frozen components.
 *   2. A shared MotionValue (`dragX`) controls the TOP page's X position.
 *   3. The BEHIND page's X is derived via `useTransform` (parallax).
 *
 * CRITICAL FIXES vs. previous version:
 *   - Parallax: [0, W] → [0, W*0.2]. At rest (dragX=0), behind page is at
 *     x=0 (completely hidden behind top page). Previous [-W*0.3, 0] had the
 *     behind page visible at -30% on the left edge at rest.
 *   - Removed the `updateTopComponent` effect that fired on every render.
 *     Instead, the TOP page always renders the LIVE `children` prop (via a ref),
 *     and only BEHIND pages use frozen components from the stack state.
 *     This prevents the "duplicate page" bug where the behind page showed
 *     the same content as the top page.
 *   - Added deduplication: never push a page with the same key as the top.
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

  // Ref to always access the latest `children` for the TOP page.
  // This replaces the old `updateTopComponent` effect that caused the
  // duplicate-page bug by firing on every render.
  const liveChildrenRef = useRef(children);
  liveChildrenRef.current = children;

  const dragX = useMotionValue(0);

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;

  // Parallax: at rest (dragX=0), behind page is at x=0 (hidden behind top).
  // During drag (dragX→W), behind page shifts right 20% (parallax following).
  const parallaxX = useTransform(dragX, [0, windowWidth], [0, windowWidth * 0.2]);
  const overlayOpacity = useTransform(dragX, [0, windowWidth], [0.35, 0]);

  // ---- Navigation handler — fires ONLY on pathname change ----
  useEffect(() => {
    const ww = typeof window !== 'undefined' ? window.innerWidth : 375;

    if (isFirstMount.current) {
      isFirstMount.current = false;
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
      return;
    }

    setStack((prev) => {
      if (prev.length === 0) {
        isBack.current = false;
        return [{ key: pathname, component: children }];
      }

      // Back detection: new path matches the item below the top
      if (prev.length > 1 && prev[prev.length - 2].key === pathname) {
        isBack.current = true;
        return prev.map((item, i) =>
          i === prev.length - 1 ? { ...item, isExiting: true } : item
        );
      }

      // Same path — just update the top's component (no duplicate push)
      if (prev[prev.length - 1].key === pathname) {
        isBack.current = false;
        return [...prev.slice(0, -1), { key: pathname, component: children }];
      }

      // Push — but DEDUPLICATE: if the new key already exists in the stack,
      // remove the old entry first to prevent duplicates.
      isBack.current = false;
      const clean = prev.filter((item) => !item.isExiting && item.key !== pathname);
      return [...clean, { key: pathname, component: children }];
    });

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

        // CRITICAL: The TOP page (non-exiting, last in stack) always renders
        // the LIVE children (via ref), NOT the frozen component from state.
        // This ensures the top page always shows the correct, up-to-date content.
        // The BEHIND page renders its frozen component from state (captured at
        // navigation time), which is the PREVIOUS page's content.
        const renderedComponent = (isLast && !isExiting) ? liveChildrenRef.current : item.component;

        return (
          <Screen
            key={item.key}
            isTop={isLast && !isExiting}
            isExiting={isExiting}
            xValue={useDragX ? dragX : parallaxX}
            overlayOpacity={useParallaxX ? overlayOpacity : undefined}
            onBack={handleDragBack}
          >
            {renderedComponent}
          </Screen>
        );
      })}
    </div>
  );
}
