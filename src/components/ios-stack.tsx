'use client';

/**
 * IOSStack — true iOS-style navigation stack for Next.js App Router.
 *
 * Architecture:
 *   1. Maintains a history array of pages so the "previous" page stays alive.
 *   2. A shared MotionValue (`dragX`) is the SINGLE source of truth for the
 *      horizontal position of the TOP page. The BEHIND page's x is derived
 *      from it via `useTransform` (parallax).
 *   3. ALL animations are driven by `animate(dragX, ...)` calls — no
 *      framer-motion variants, no `drag` prop, no AnimatePresence. This
 *      avoids the MotionValue-vs-variant conflict that caused the exit
 *      animation to freeze.
 *
 * Navigation flow:
 *   PUSH:  dragX set to W → animated to 0. New page slides in from right,
 *          old page shifts to parallax (-30%).
 *   BACK (drag):  Screen animates dragX to W (page slides off), THEN calls
 *                 onBack. Stack removes the exiting page, dragX reset to 0.
 *   BACK (button): IOSStack marks top as exiting, animates dragX to W,
 *                  then removes it and resets dragX.
 */

import { usePathname, useRouter } from 'next/navigation';
import { useMotionValue, useTransform, animate } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Screen } from '@/components/screen';

interface StackItem {
  key: string;
  component: React.ReactNode;
  isExiting?: boolean;
}

const IOS_SPRING = { type: 'spring' as const, stiffness: 350, damping: 40, mass: 1 };
const SLIDE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function IOSStack({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [stack, setStack] = useState<StackItem[]>([]);
  const isBack = useRef(false);
  const isDragBack = useRef(false); // true when back was triggered by a drag (animation already done)
  const isAnimating = useRef(false); // prevent double-animation

  // Single shared MotionValue — the x position of the TOP page
  const dragX = useMotionValue(0);

  // Parallax transform for the BEHIND page
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
  const parallaxX = useTransform(dragX, [0, windowWidth], [-windowWidth * 0.3, 0]);
  const overlayOpacity = useTransform(dragX, [0, windowWidth], [0.35, 0]);

  // ---- Navigation handler — fires on every pathname change ----
  useEffect(() => {
    const ww = typeof window !== 'undefined' ? window.innerWidth : 375;

    if (isDragBack.current) {
      // Back was triggered by a drag — the Screen already animated dragX to W.
      // Just clean up the stack and reset.
      isDragBack.current = false;
      isBack.current = true;
      setStack((prev) => {
        const cleaned = prev.filter((item) => !item.isExiting);
        return cleaned.slice(0, -1); // remove the top (exiting) page
      });
      // Reset dragX to 0 — the remaining page was at parallaxX(0)=0 when dragX was W,
      // and now it becomes the top with x=dragX=0. No visual jump.
      dragX.set(0);
      return;
    }

    // Normal navigation (push or browser-back)
    setStack((prev) => {
      if (prev.length === 0) {
        isBack.current = false;
        return [{ key: pathname, component: children }];
      }

      // Back detection
      if (prev.length > 1 && prev[prev.length - 2].key === pathname) {
        isBack.current = true;
        // Mark the top as exiting — DON'T remove it yet (need it for the animation)
        return prev.map((item, i) =>
          i === prev.length - 1 ? { ...item, isExiting: true } : item
        );
      }

      // Same path — just update the top's component
      if (prev[prev.length - 1].key === pathname) {
        isBack.current = false;
        return [...prev.slice(0, -1), { key: pathname, component: children }];
      }

      // Push
      isBack.current = false;
      // Clean up any stale exiting items
      const clean = prev.filter((item) => !item.isExiting);
      return [...clean, { key: pathname, component: children }];
    });

    if (isBack.current) {
      // Button back (not drag) — need to animate dragX from 0 to W
      isAnimating.current = true;
      animate(dragX, ww, {
        duration: 0.3,
        ease: SLIDE_EASE,
        onComplete: () => {
          isAnimating.current = false;
          // Now remove the exiting page and reset
          setStack((prev) => prev.filter((item) => !item.isExiting).slice(0, -1));
          dragX.set(0);
        },
      });
    } else {
      // Push — set dragX to W, then animate to 0
      isAnimating.current = true;
      dragX.set(ww);
      animate(dragX, 0, {
        ...IOS_SPRING,
        onComplete: () => {
          isAnimating.current = false;
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ---- Update top component when children changes (context propagation) ----
  const updateTopComponent = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      // Find the top non-exiting item
      for (let i = prev.length - 1; i >= 0; i--) {
        if (!prev[i].isExiting) {
          if (prev[i].key === pathname) {
            const updated = [...prev];
            updated[i] = { ...updated[i], component: children };
            return updated;
          }
          break;
        }
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    updateTopComponent();
  }, [children, updateTopComponent]);

  // ---- Handle drag-triggered back ----
  const handleDragBack = useCallback(() => {
    // The Screen already animated dragX to W. We just need to trigger the route change.
    isDragBack.current = true;
    router.back();
  }, [router]);

  // ---- Render ----
  if (stack.length === 0) {
    return null;
  }

  const hasExiting = stack.some((item) => item.isExiting);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {stack.map((item, index) => {
        const isExiting = !!item.isExiting;
        const isLast = index === stack.length - 1;
        const isSecondLast = index === stack.length - 2;

        // Only render the top 2 non-exit-hidden items + any exiting item
        if (!isLast && !isSecondLast && !isExiting) return null;

        // Determine role:
        // - EXITING page: uses dragX (sliding off-screen)
        // - TOP page (no exiting): uses dragX (draggable)
        // - BEHIND page OR new top (when exiting exists): uses parallaxX
        const useDragX = isExiting || (isLast && !hasExiting);
        const useParallaxX = !useDragX;

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
