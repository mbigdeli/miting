'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether notes and Ask AI are on (Settings > Summary). On by default;
 * stored per device. Off hides the box, the note cards and the Ask AI panel;
 * saved notes and conversations are kept.
 */

const KEY = 'notesAskEnabled';
const EVENT = 'miting:notes-ask-enabled';

export function loadNotesEnabled(): boolean {
  try {
    return typeof window === 'undefined' ? true : window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveNotesEnabled(enabled: boolean): void {
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

export function useNotesEnabled(): boolean {
  return useSyncExternalStore(subscribe, loadNotesEnabled, () => true);
}
