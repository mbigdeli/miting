'use client';

/**
 * Downloaded transcription models across the local engines, for the record
 * screen picker. Re-read whenever a download lands, so a model added from the
 * Home setup steps shows up without leaving the page.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PickerModel, PickerProvider } from './modelPickerOptions';

interface RawModel {
  name: string;
  display_name?: string;
  status: unknown;
}

const ENGINE_COMMANDS: [PickerProvider, string][] = [
  ['parakeet', 'parakeet_get_available_models'],
  ['whisper', 'whisper_get_available_models'],
  ['shenava', 'shenava_get_available_models'],
];

const REFRESH_EVENTS = [
  'parakeet-model-download-complete',
  'model-download-complete',
  'shenava-model-download-complete',
];

async function listDownloaded(): Promise<PickerModel[]> {
  const downloaded: PickerModel[] = [];
  for (const [provider, command] of ENGINE_COMMANDS) {
    try {
      const list = await invoke<RawModel[]>(command);
      downloaded.push(
        ...list
          .filter((m) => m.status === 'Available')
          .map((m) => ({ provider, name: m.name, displayName: m.display_name })),
      );
    } catch {
      // Engine unavailable on this build: skip silently.
    }
  }
  return downloaded;
}

export function useDownloadedModels() {
  const [models, setModels] = useState<PickerModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      void listDownloaded().then((list) => {
        if (cancelled) return;
        setModels(list);
        setLoaded(true);
      });

    refresh();
    const subscriptions = REFRESH_EVENTS.map((event) => listen(event, refresh));
    return () => {
      cancelled = true;
      subscriptions.forEach((pending) => void pending.then((unlisten) => unlisten()));
    };
  }, []);

  return { models, loaded };
}
