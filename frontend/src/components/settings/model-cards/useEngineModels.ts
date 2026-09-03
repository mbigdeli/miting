'use client';

/** Shared list/download/progress state for one transcription engine. */

import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { EngineAdapter, EngineModel } from './types';

type DownloadEvent = { modelName?: string; model_name?: string; progress?: number; error?: string };

const eventModelName = (payload: DownloadEvent) => payload.modelName ?? payload.model_name ?? '';

export function useEngineModels(adapter: EngineAdapter) {
  const [models, setModels] = useState<EngineModel[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      await adapter.init();
      setModels(await adapter.list());
    } catch (reason) {
      setError(String(reason));
    }
  }, [adapter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    void Promise.all([
      listen<DownloadEvent>(adapter.events.progress, ({ payload }) => {
        const name = eventModelName(payload);
        setProgress((value) => ({ ...value, [name]: payload.progress ?? 0 }));
      }),
      listen<DownloadEvent>(adapter.events.complete, ({ payload }) => {
        const name = eventModelName(payload);
        setProgress((value) => {
          const next = { ...value };
          delete next[name];
          return next;
        });
        void refresh();
      }),
      listen<DownloadEvent>(adapter.events.error, ({ payload }) => {
        setError(`${eventModelName(payload)}: ${payload.error ?? 'download failed'}`);
        setProgress((value) => {
          const next = { ...value };
          delete next[eventModelName(payload)];
          return next;
        });
        void refresh();
      }),
    ]).then((items) => unlisteners.push(...items));
    return () => unlisteners.forEach((unlisten) => unlisten());
  }, [adapter, refresh]);

  const download = useCallback(
    async (name: string) => {
      setError(null);
      setProgress((value) => ({ ...value, [name]: 0 }));
      try {
        await adapter.download(name);
      } catch (reason) {
        setError(String(reason));
        setProgress((value) => {
          const next = { ...value };
          delete next[name];
          return next;
        });
      }
    },
    [adapter],
  );

  const cancelDownload = useCallback(
    async (name: string) => {
      try {
        await adapter.cancelDownload?.(name);
      } finally {
        setProgress((value) => {
          const next = { ...value };
          delete next[name];
          return next;
        });
        void refresh();
      }
    },
    [adapter, refresh],
  );

  const removeCorrupted = useCallback(
    async (name: string) => {
      setError(null);
      try {
        await adapter.removeCorrupted?.(name);
        await refresh();
      } catch (reason) {
        setError(String(reason));
      }
    },
    [adapter, refresh],
  );

  return { models, progress, error, refresh, download, cancelDownload, removeCorrupted };
}
