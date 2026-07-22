'use client';

import { useEffect } from 'react';
import { setupIonicReact, IonApp } from '@ionic/react';

/* Core CSS required for Ionic components to work properly.
   NOTE: We ONLY import core.css and structure.css.
   We SKIP normalize.css and typography.css because they contain unlayered
   `button { padding: 0; border: 0; border-radius: 0 }` rules that override
   Tailwind's utility classes (which are in @layer utilities). Unlayered CSS
   always wins over layered CSS in the cascade.

   Without normalize.css and typography.css, Ionic components still work —
   they just use our Tailwind-based styles instead of Ionic's resets. */
import '@ionic/react/css/core.css';
import '@ionic/react/css/structure.css';

/**
 * IonicProvider — wraps the app in <IonApp> and initializes Ionic's gesture
 * engine, platform detection, and global styles.
 *
 * Uses mode: 'ios' to force iOS-style animations and components on all
 * platforms (iPhone AND Android). This gives a consistent, premium feel.
 *
 * NOTE: This does NOT include IonRouterOutlet (which requires
 * @ionic/react-router, incompatible with Next.js App Router). For page
 * transitions, we use a custom framer-motion implementation instead.
 *
 * Ionic components (IonModal, IonButton, IonContent, etc.) are available
 * for use on any page.
 */
export function IonicProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setupIonicReact({
      mode: 'ios',
      rippleEffect: true,
    });
  }, []);

  return <IonApp>{children}</IonApp>;
}
