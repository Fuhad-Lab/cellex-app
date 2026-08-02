'use client';
import { useEffect } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function OTAUpdater() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      try { await CapacitorUpdater.notifyAppReady(); } catch (e) { console.error('OTA rollback', e); }
    });
    CapacitorUpdater.addListener('downloadComplete', (info) => console.log('OTA ready', info));
    CapacitorUpdater.setChannel({ channel: 'production' }).catch(() => {});
    CapacitorUpdater.notifyAppReady().catch(() => {});
  }, []);
  return null;
}
