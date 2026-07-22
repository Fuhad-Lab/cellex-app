'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * NativeBackGesture — handles Android back navigation.
 *
 * iOS: Native swipe-back is enabled via allowsBackForwardNavigationGestures
 * in the WKWebView (set during the GitHub Actions iOS build).
 *
 * Android: Listens for @capacitor/app 'backButton' event.
 */
export function NativeBackGesture({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let backListener: { remove: () => void } | null = null;

    const setup = async () => {
      try {
        // Dynamic imports — won't crash on web where these don't exist
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { App: CapacitorApp } = await import('@capacitor/app');
        backListener = await CapacitorApp.addListener('backButton', () => {
          const exitRoutes = ['/', '/home', '/login'];
          if (exitRoutes.includes(pathname)) {
            CapacitorApp.exitApp();
          } else {
            router.back();
          }
        });
      } catch {
        // Not in Capacitor environment — do nothing
      }
    };

    setup();

    return () => {
      if (backListener) backListener.remove();
    };
  }, [router, pathname]);

  return <>{children}</>;
}
