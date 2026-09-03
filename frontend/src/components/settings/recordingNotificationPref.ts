'use client';

/**
 * "Notify me when recording starts" lives in the Tauri store rather than the
 * recording-preferences record, so its load/save sit apart from the rest of
 * the Recordings tab state.
 */

import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

const STORE_FILE = 'preferences.json';
const STORE_KEY = 'show_recording_notification';

export async function loadNotifyOnStart(): Promise<boolean> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(STORE_FILE);
    return (await store.get<boolean>(STORE_KEY)) ?? true;
  } catch (error) {
    console.error('Failed to load notification preference:', error);
    return true;
  }
}

export async function saveNotifyOnStart(enabled: boolean): Promise<void> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(STORE_FILE);
    await store.set(STORE_KEY, enabled);
    await store.save();
    toast.success('Preference saved');
    await Analytics.track('recording_notification_preference_changed', {
      enabled: enabled.toString(),
    });
  } catch (error) {
    console.error('Failed to save notification preference:', error);
    toast.error('Failed to save preference');
  }
}
