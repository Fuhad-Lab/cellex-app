'use client';
/**
 * GlobalStateProvider — page-state preservation that survives ANY number of
 * navigation hops (not just the 2-3 that Next.js Cache Components keeps alive).
 *
 * Why this exists:
 *   `cacheComponents` keeps up to ~3 previously-visited pages in RAM via
 *   React's <Activity> component. Once the user navigates to a 4th page
 *   (Home → Cart → Saved → Home), the first Home is evicted and its state
 *   is lost — the page reloads from scratch.
 *
 *   This provider lifts the *volatile* bits of page state (active tab, liked
 *   sets, feed cache, search input, scroll position, etc.) up into the Root
 *   Layout. Because `layout.tsx` never unmounts during client-side navigation,
 *   the data lives as long as the user is on the site.
 *
 *   Everything is held in browser RAM only — no localStorage / sessionStorage /
 *   cookies — so it is XSS-safe.
 *
 * Usage:
 *   // 1. Wrap root layout:
 *   <GlobalStateProvider> ...children... </GlobalStateProvider>
 *
 *   // 2. In a page, swap useState for usePersistedState (1-line change):
 *   const [activeTab, setActiveTab] = usePersistedState('home:activeTab', 'For You');
 *
 *   // 3. Once per page, preserve scroll:
 *   useScrollPreservation('home');
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface GlobalStateContextValue {
  /** Read a persisted value, falling back to `initial` if not yet stored. */
  getState: <T>(key: string, initial: T) => T;
  /** Overwrite a persisted value. */
  setState: (key: string, value: unknown) => void;
  /** Read the last-saved scroll position for a page key. */
  getScroll: (key: string) => number;
  /** Save the current scroll position for a page key. */
  saveScroll: (key: string, pos: number) => void;
}

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  // In-memory map of arbitrary page state. Held in the Root Layout, so it
  // survives any number of client-side route changes.
  //
  // IMPORTANT: We keep the canonical store in a REF (not React state) so that
  // reads are always O(1) and never depend on a re-render. This is critical
  // because `usePersistedState` reads from the store in its `useState`
  // initializer — if the value depended on a React render cycle, the timing
  // could be wrong (especially under React 19 concurrent rendering and
  // Next.js cacheComponents which can defer commits).
  //
  // We ALSO keep a React state counter (`version`) to force consumers to
  // re-render when setState is called. This way, the value is always current
  // for reads, AND React knows to re-render when writes happen.
  const storeRef = useRef<Record<string, unknown>>({});
  const [, setVersion] = useState(0);

  // Debug: track mount count to verify the provider stays mounted across navigation.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      w.__globalStateMountCount = (w.__globalStateMountCount || 0) + 1;
      w.__globalStateStore = storeRef.current;
      console.log(`[GlobalStateProvider] MOUNT #${w.__globalStateMountCount}`);
    }
    return () => {
      if (typeof window !== 'undefined') {
        console.log('[GlobalStateProvider] UNMOUNT');
      }
    };
  }, []);

  // Scroll positions — same pattern. Ref for reads, no re-render needed.
  const scrollRef = useRef<Record<string, number>>({});

  const getState = useCallback(<T,>(key: string, initial: T): T => {
    return key in storeRef.current ? (storeRef.current[key] as T) : initial;
  }, []);

  const setState = useCallback((key: string, value: unknown) => {
    storeRef.current[key] = value;
    // Debug: expose the store on window so we can inspect it from devtools.
    if (typeof window !== 'undefined') {
      (window as any).__globalStateStore = storeRef.current;
    }
    // Bump version to trigger re-renders in consumers that read this value
    // through `useGlobalState()` directly. (usePersistedState doesn't need
    // this because it has its own local useState.)
    setVersion((v) => v + 1);
  }, []);

  const getScroll = useCallback((key: string): number => {
    return scrollRef.current[key] ?? 0;
  }, []);

  const saveScroll = useCallback((key: string, pos: number) => {
    scrollRef.current[key] = pos;
  }, []);

  return (
    <GlobalStateContext.Provider
      value={{ getState, setState, getScroll, saveScroll }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState(): GlobalStateContextValue {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) {
    throw new Error('useGlobalState must be used within GlobalStateProvider');
  }
  return ctx;
}

/**
 * Drop-in replacement for `useState` that persists the value across page
 * navigation. The value is stored in the Root Layout's memory and survives
 * any number of route changes (Home → Cart → Saved → Home keeps Home's state).
 *
 * @param key      Unique key — typically `${routePath}:${fieldName}`.
 * @param initial  Initial value (or factory) — same semantics as useState.
 */
export function usePersistedState<T>(
  key: string,
  initial: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const { getState, setState } = useGlobalState();

  const initialValue = useMemoInitial(initial);

  const [local, setLocal] = useState<T>(() => getState(key, initialValue));

  // Whenever the local state changes, mirror it into the global map so it
  // survives the next unmount. We compute `next` OUTSIDE the setLocal updater
  // so we don't perform a side effect inside a reducer (which React 19
  // concurrent rendering may defer or drop).
  const setter = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next =
        typeof value === 'function'
          ? (value as (p: T) => T)(local)
          : value;
      setLocal(next);
      setState(key, next);
    },
    [key, local, setState],
  );

  // Belt-and-suspenders: also sync local → global whenever local changes.
  // This catches any state updates that bypass our setter (e.g. async
  // setState calls that React batched differently).
  useEffect(() => {
    setState(key, local);
  }, [key, local, setState]);

  return [local, setter];
}

/**
 * Restores scroll position on mount and saves it on unmount + on user scroll.
 * Call this ONCE per page (e.g. at the top of the page component).
 *
 * @param pageKey  Unique key for the page — typically the route path.
 */
export function useScrollPreservation(pageKey: string): void {
  const { getScroll, saveScroll } = useGlobalState();

  // Restore on mount, save on unmount.
  useEffect(() => {
    const saved = getScroll(pageKey);
    if (saved > 0) {
      // Defer one frame so the page content has rendered.
      const raf = requestAnimationFrame(() => {
        try {
          window.scrollTo({ top: saved, left: 0, behavior: 'auto' });
        } catch {
          // Some browsers don't support the options form — fall back.
          window.scrollTo(0, saved);
        }
      });
      return () => {
        cancelAnimationFrame(raf);
        saveScroll(pageKey, window.scrollY);
      };
    }
    return () => {
      saveScroll(pageKey, window.scrollY);
    };
  }, [pageKey, getScroll, saveScroll]);

  // Continuously save scroll position so it's captured even if the user
  // never leaves the page (e.g. they hard-refresh — though that wipes RAM
  // anyway). The debounced handler keeps this cheap.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveScroll(pageKey, window.scrollY);
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timeout) clearTimeout(timeout);
      saveScroll(pageKey, window.scrollY);
    };
  }, [pageKey, saveScroll]);
}

/**
 * Helper — handles the `T | (() => T)` initial-value pattern from useState
 * without re-evaluating the factory on every render.
 */
function useMemoInitial<T>(initial: T | (() => T)): T {
  const ref = useRef<{ value: T } | null>(null);
  if (ref.current === null) {
    ref.current = {
      value:
        typeof initial === 'function'
          ? (initial as () => T)()
          : initial,
    };
  }
  return ref.current.value;
}
