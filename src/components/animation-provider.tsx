'use client';

import { useEffect, useRef, ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitType from 'split-type';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * AnimationProvider — Global animation initialization
 *
 * Implements the premium animation pipeline:
 * 1. Lenis smooth scroll (silky trackpad/mouse wheel)
 * 2. Text splitting for headings (character/line stagger)
 * 3. Scroll-triggered reveal animations
 * 4. Page loader sequence
 * 5. Magnetic button effects
 * 6. prefers-reduced-motion respect
 *
 * Architecture:
 * - This component wraps the entire app
 * - It initializes Lenis on mount and connects it to GSAP ScrollTrigger
 * - It uses a MutationObserver to detect new headings and split them
 * - All animations use transform + opacity (no layout thrashing)
 * - Custom cubic-bezier: cubic-bezier(0.25, 1, 0.5, 1) for premium feel
 */

const EASE_PREMIUM = 'power3.out';
const EASE_CUSTOM = 'cubic-bezier(0.25, 1, 0.5, 1)';
const STAGGER_DELAY = 0.03;
const REVEAL_DURATION = 0.8;
const REVEAL_Y = 20;

export function AnimationProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Skip all animations for users who prefer reduced motion
      document.documentElement.style.scrollBehavior = 'auto';
      return;
    }

    // === 1. LENIS SMOOTH SCROLL ===
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });
    lenisRef.current = lenis;

    // Connect Lenis to GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // === 2. TEXT SPLITTING + SCROLL REVEALS ===
    const splitHeadings = () => {
      const headings = document.querySelectorAll('h1, h2, h3');
      headings.forEach((heading) => {
        // Skip if already split
        if (heading.querySelector('.char') || heading.querySelector('.line')) return;
        // Skip if inside a modal or has data-no-split
        if (heading.closest('[data-no-split]') || heading.closest('[role="dialog"]')) return;

        try {
          const split = new SplitType(heading as HTMLElement, {
            types: 'lines,words,chars',
            tagName: 'span',
          });

          // Animate characters with stagger
          if (split.chars && split.chars.length > 0) {
            gsap.from(split.chars as any, {
              opacity: 0,
              y: REVEAL_Y,
              duration: REVEAL_DURATION,
              ease: EASE_PREMIUM,
              stagger: STAGGER_DELAY,
              scrollTrigger: {
                trigger: heading,
                start: 'top 90%',
                toggleActions: 'play none none reverse',
                once: true,
              },
            });
          }
        } catch (e) {
          // SplitType can fail on empty or complex headings — skip silently
        }
      });
    };

    // Initial split
    setTimeout(splitHeadings, 100);

    // === 3. SCROLL REVEAL FOR CARDS & SECTIONS ===
    // DISABLED — scroll reveal animations cause re-animation on every page
    // return visit. The user wants pages to appear exactly as they left them.
    // Elements are now visible by default (no opacity:0 initial state).
    const revealElements = () => {
      const revealTargets = document.querySelectorAll(
        '[data-reveal]:not([data-revealed])'
      );
      revealTargets.forEach((el) => {
        el.setAttribute('data-revealed', 'true');
        // Just make the element visible immediately — no animation
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
      });
    };

    setTimeout(revealElements, 50);

    // === 4. MUTATION OBSERVER — detect new content ===
    const observer = new MutationObserver((mutations) => {
      let shouldSplit = false;
      let shouldReveal = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldSplit = true;
          shouldReveal = true;
          break;
        }
      }

      if (shouldSplit) {
        clearTimeout(splitTimeout);
        splitTimeout = setTimeout(splitHeadings, 50);
      }
      if (shouldReveal) {
        clearTimeout(revealTimeout);
        revealTimeout = setTimeout(revealElements, 50);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    let splitTimeout: ReturnType<typeof setTimeout>;
    let revealTimeout: ReturnType<typeof setTimeout>;

    // === CLEANUP ===
    return () => {
      lenis.destroy();
      observer.disconnect();
      gsap.ticker.remove(lenis.raf);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return <>{children}</>;
}

/**
 * MagneticButton — wraps any element with magnetic cursor attraction
 *
 * The element subtly attracts toward the cursor when it's nearby,
 * creating a premium, tactile feel. Uses translate3d for GPU acceleration.
 *
 * Usage:
 * <MagneticButton>
 *   <button>Click me</button>
 * </MagneticButton>
 */
export function MagneticButton({
  children,
  strength = 0.3,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.4,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.3)',
      });
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className} style={{ display: 'inline-block', willChange: 'transform' }}>
      {children}
    </div>
  );
}

/**
 * PageLoader — minimalist loading sequence that masks asset loading
 *
 * Shows a clean black screen with the Cellex logo, then fades out
 * smoothly when the page is ready. Duration: ~1.2s
 */
export function PageLoader() {
  const loaderRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loader = loaderRef.current;
    const logo = logoRef.current;
    if (!loader || !logo) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      loader.style.display = 'none';
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        loader.style.pointerEvents = 'none';
      },
    });

    // Logo scale-in
    tl.from(logo, {
      scale: 0.8,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
    });

    // Hold
    tl.to({}, { duration: 0.3 });

    // Fade out loader
    tl.to(loader, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.inOut',
      onComplete: () => {
        loader.style.display = 'none';
        loader.style.pointerEvents = 'none';
        loader.style.zIndex = '-1';
      },
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={loaderRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
    >
      <div ref={logoRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            background: '#FFFFFF',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <span style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Cellex
        </span>
      </div>
    </div>
  );
}

/**
 * SmoothSlider — infinite-loop slider with physics-based drag
 *
 * Replaces basic carousels with smooth, momentum-based scrolling
 * that responds to drag velocity and swipe gestures.
 *
 * Usage:
 * <SmoothSlider>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </SmoothSlider>
 */
export function SmoothSlider({
  children,
  gap = 16,
  className = '',
}: {
  children: ReactNode;
  gap?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let momentum = 0;
    let animationId: number;

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      isDown = true;
      track.style.cursor = 'grabbing';
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      startX = clientX - scrollLeft;
      velocity = 0;
      cancelAnimationFrame(animationId);
    };

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDown) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - startX;
      const delta = x - scrollLeft;
      velocity = delta * 0.5;
      scrollLeft = x;

      // Infinite loop: wrap around
      const maxScroll = track.scrollWidth / 2;
      if (scrollLeft < -maxScroll / 2) scrollLeft += maxScroll;
      if (scrollLeft > maxScroll / 2) scrollLeft -= maxScroll;

      gsap.to(track, { x: -scrollLeft, duration: 0, ease: 'none' });
    };

    const handleMouseUp = () => {
      isDown = false;
      track.style.cursor = 'grab';
      momentum = velocity;
      animate();
    };

    const animate = () => {
      if (Math.abs(momentum) < 0.1) return;
      scrollLeft += momentum;
      momentum *= 0.95; // Friction

      const maxScroll = track.scrollWidth / 2;
      if (scrollLeft < -maxScroll / 2) scrollLeft += maxScroll;
      if (scrollLeft > maxScroll / 2) scrollLeft -= maxScroll;

      gsap.to(track, { x: -scrollLeft, duration: 0, ease: 'none' });
      animationId = requestAnimationFrame(animate);
    };

    track.addEventListener('mousedown', handleMouseDown);
    track.addEventListener('mousemove', handleMouseMove);
    track.addEventListener('mouseup', handleMouseUp);
    track.addEventListener('mouseleave', handleMouseUp);
    track.addEventListener('touchstart', handleMouseDown, { passive: true });
    track.addEventListener('touchmove', handleMouseMove, { passive: true });
    track.addEventListener('touchend', handleMouseUp);

    track.style.cursor = 'grab';

    return () => {
      track.removeEventListener('mousedown', handleMouseDown);
      track.removeEventListener('mousemove', handleMouseMove);
      track.removeEventListener('mouseup', handleMouseUp);
      track.removeEventListener('mouseleave', handleMouseUp);
      track.removeEventListener('touchstart', handleMouseDown);
      track.removeEventListener('touchmove', handleMouseMove);
      track.removeEventListener('touchend', handleMouseUp);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: `${gap}px`,
          willChange: 'transform',
          width: 'max-content',
        }}
      >
        {children}
        {/* Duplicate children for infinite loop */}
        {children}
      </div>
    </div>
  );
}

/**
 * RevealOnScroll — DISABLED. Content is now visible immediately.
 * The wrapper is kept for backward compatibility but does no animation.
 */
export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
