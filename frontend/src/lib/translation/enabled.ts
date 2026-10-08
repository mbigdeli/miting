'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether translation is on in the app (Settings > Translation). On by
 * default; stored per device.
 */

const KEY = 'translationEnabled';
const EVENT = 'miting:translation-enabled';

export function loadTranslationEnabled(): boolean {
  try {
    return typeof window === 'undefined' ? true : window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveTranslationEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // Not fatal: the choice just lasts until the page is reloaded.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Live value; every screen that reads it follows the setting at once. */
export function useTranslationEnabled(): boolean {
  return useSyncExternalStore(subscribe, loadTranslationEnabled, () => true);
}
