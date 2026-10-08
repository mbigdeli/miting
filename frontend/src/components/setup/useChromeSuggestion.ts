'use client';

import { useCallback, useEffect, useState } from 'react';
import { useExtensionConnection } from '@/components/extension-guide/useExtensionConnection';
import { chromeSuggestion } from '@/lib/chromeSuggestion';

const STORE_FILE = 'preferences.json';
const STORE_KEY = 'chrome_suggestion_dismissed_at';

async function preferences() {
  const { Store } = await import('@tauri-apps/plugin-store');
  return Store.load(STORE_FILE);
}

/**
 * Which "Add to Chrome" suggestion Home shows. Closing it stores the time,
 * not a flag, so a reminder can come back if the extension never connects.
 */
export function useChromeSuggestion(setup: {
  loaded: boolean;
  transcriptionDone: boolean;
  setupVisible: boolean;
}) {
  const connection = useExtensionConnection();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [storeLoaded, setStoreLoaded] = useState(false);

  useEffect(() => {
    preferences()
      .then((store) => store.get<number>(STORE_KEY))
      .then((value) => setDismissedAt(typeof value === 'number' ? value : null))
      .catch((error) => console.error('[Setup] Failed to read the Chrome suggestion state:', error))
      .finally(() => setStoreLoaded(true));
  }, []);

  const dismiss = useCallback(async () => {
    const now = Date.now();
    setDismissedAt(now);
    try {
      const store = await preferences();
      await store.set(STORE_KEY, now);
      await store.save();
    } catch (error) {
      console.error('[Setup] Failed to remember closing the Chrome suggestion:', error);
    }
  }, []);

  const kind = chromeSuggestion({
    loaded: setup.loaded && storeLoaded && connection.loaded,
    everConnected: connection.everConnected,
    transcriptionDone: setup.transcriptionDone,
    setupVisible: setup.setupVisible,
    dismissedAt,
    now: Date.now(),
  });

  return { kind, connected: connection.everConnected, dismiss };
}
