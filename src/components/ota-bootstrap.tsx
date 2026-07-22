'use client';
import { useEffect } from 'react';

export function OTABootstrap() {
  useEffect(() => {
    // Only run in native app
    if (typeof window === 'undefined') return;
    
    // Check if Capacitor is available
    const checkCapacitor = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const { App } = await import('@capacitor/app');
        
        // Notify app is ready (required by Capgo)
        await CapacitorUpdater.notifyAppReady();
        console.log('OTA: App ready notified');
        
        // Listen for app state changes
        App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return;
          try {
            await CapacitorUpdater.notifyAppReady();
          } catch (e) {
            console.error('OTA: rollback triggered', e);
          }
        });
        
        // Set channel
        await CapacitorUpdater.setChannel({ channel: 'production' });
        
        // Listen for download complete
        CapacitorUpdater.addListener('downloadComplete', (info) => {
          console.log('OTA: Update downloaded, will apply on next launch', info);
        });
      } catch (e) {
        // Not in Capacitor environment — do nothing
      }
    };
    
    checkCapacitor();
  }, []);
  
  return null;
}
