'use client';

/** Whether the user closed the Home setup steps, remembered across launches. */

import { useCallback, useEffect, useState } from 'react';

const STORE_FILE = 'preferences.json';
const STORE_KEY = 'setup_steps_dismissed';

async function preferences() {
  const { Store } = await import('@tauri-apps/plugin-store');
  return Store.load(STORE_FILE);
}

export function useHomeStepsState() {
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    preferences()
      .then((store) => store.get<boolean>(STORE_KEY))
      .then((value) => setDismissed(Boolean(value)))
      .catch((error) => console.error('[Setup] Failed to read the dismissed steps:', error))
      .finally(() => setLoaded(true));
  }, []);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    try {
      const store = await preferences();
      await store.set(STORE_KEY, true);
      await store.save();
    } catch (error) {
      console.error('[Setup] Failed to remember the dismissed steps:', error);
    }
  }, []);

  return { dismissed, loaded, dismiss };
}
