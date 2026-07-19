'use client';

import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useRouter, usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

/**
 * NativeBackGesture — handles Android back navigation.
 *
 * iOS: Native swipe-back is enabled via allowsBackForwardNavigationGestures
 * in the WKWebView (set during the GitHub Actions iOS build). The WKWebView
 * handles it natively — no JavaScript needed.
 *
 * Android: Listens for @capacitor/app 'backButton' event (triggered by both
 * hardware back button AND edge swipe gesture). Calls router.back() for
 * in-app navigation, or exits the app on the homepage.
 */
export function NativeBackGesture({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backListener: { remove: () => void } | null = null;

    const setupListener = async () => {
      backListener = await CapacitorApp.addListener('backButton', () => {
        const exitRoutes = ['/', '/home', '/login'];
        if (exitRoutes.includes(pathname)) {
          CapacitorApp.exitApp();
        } else {
          router.back();
        }
      });
    };

    setupListener();

    return () => {
      if (backListener) backListener.remove();
    };
  }, [router, pathname]);

  return <>{children}</>;
}
