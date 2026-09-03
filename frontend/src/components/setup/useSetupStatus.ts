'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  missingSetupItems,
  setupFingerprint,
  shouldShowNotice,
  type SetupItem,
  type SetupStatus,
} from '@/lib/setupChecklist';

const STORE_FILE = 'preferences.json';
const STORE_KEY = 'setup_notice_dismissed_fingerprint';

/** Events after which what is installed may have changed. */
const REFRESH_EVENTS = [
  'parakeet-model-download-complete',
  'whisper-model-download-complete',
  'builtin-ai-download-progress',
  'transcription-unavailable',
  'model-config-updated',
];

async function readDismissed(): Promise<string | null> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(STORE_FILE);
    return (await store.get<string>(STORE_KEY)) ?? null;
  } catch (error) {
    console.error('[Setup] Failed to read the dismissed setup notice:', error);
    return null;
  }
}

export function useSetupStatus() {
  const [items, setItems] = useState<SetupItem[]>([]);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await invoke<SetupStatus>('get_setup_status');
      setItems(missingSetupItems(status));
    } catch (error) {
      // The database recovery screen owns backend-down reporting; stay quiet.
      console.error('[Setup] Failed to read setup status:', error);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void readDismissed().then(setDismissed);

    const subscriptions = REFRESH_EVENTS.map((event) => listen(event, () => void refresh()));
    return () => {
      subscriptions.forEach((pending) => void pending.then((unlisten) => unlisten()));
    };
  }, [refresh]);

  const dismiss = useCallback(async () => {
    const fingerprint = setupFingerprint(items);
    setDismissed(fingerprint);
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load(STORE_FILE);
      await store.set(STORE_KEY, fingerprint);
      await store.save();
    } catch (error) {
      console.error('[Setup] Failed to persist the dismissed setup notice:', error);
    }
  }, [items]);

  return { items, visible: shouldShowNotice(items, dismissed), refresh, dismiss };
}
