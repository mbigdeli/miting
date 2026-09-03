'use client';

import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { EngineDownloadState } from './EngineDownloadCard';

export interface EngineDownloadEvents {
  /** Emits `{ progress, status, error }` plus a name the matcher checks. */
  progress: string;
  complete?: string;
  error?: string;
}

interface UseEngineDownloadArgs {
  events: EngineDownloadEvents;
  /** True when the event payload refers to this engine's model. */
  matches: (payload: Record<string, unknown>) => boolean;
  totalMb: number;
  alreadyDownloaded: boolean;
  start: () => Promise<void>;
  onDownloaded: () => void;
}

/**
 * Download state for one onboarding engine card.
 *
 * Nothing starts on mount: onboarding used to fire ~670 MB of downloads the
 * moment the step rendered, with no way to decline. `begin` is only called
 * from the card's own button.
 */
export function useEngineDownload({
  events,
  matches,
  totalMb,
  alreadyDownloaded,
  start,
  onDownloaded,
}: UseEngineDownloadArgs) {
  const [state, setState] = useState<EngineDownloadState>({
    status: alreadyDownloaded ? 'completed' : 'waiting',
    progress: alreadyDownloaded ? 100 : 0,
    downloadedMb: 0,
    totalMb,
  });
  const inFlight = useRef(false);

  useEffect(() => {
    setState((prev) => ({ ...prev, totalMb: prev.totalMb || totalMb }));
  }, [totalMb]);

  useEffect(() => {
    const subscriptions = [
      listen<Record<string, unknown>>(events.progress, ({ payload }) => {
        if (!matches(payload)) return;
        const status = payload.status as string | undefined;
        const progress = Number(payload.progress ?? 0);
        setState((prev) => ({
          ...prev,
          status: status === 'completed' ? 'completed' : status === 'error' ? 'error' : 'downloading',
          progress,
          downloadedMb: Number(payload.downloaded_mb ?? prev.downloadedMb),
          totalMb: Number(payload.total_mb ?? prev.totalMb) || prev.totalMb,
          error: status === 'error' ? String(payload.error ?? '') : undefined,
        }));
        if (status === 'completed' || progress >= 100) {
          inFlight.current = false;
          onDownloaded();
        }
      }),
      events.complete
        ? listen<Record<string, unknown>>(events.complete, ({ payload }) => {
            if (!matches(payload)) return;
            inFlight.current = false;
            setState((prev) => ({ ...prev, status: 'completed', progress: 100 }));
            onDownloaded();
          })
        : null,
      events.error
        ? listen<Record<string, unknown>>(events.error, ({ payload }) => {
            if (!matches(payload)) return;
            inFlight.current = false;
            setState((prev) => ({ ...prev, status: 'error', error: String(payload.error ?? '') }));
          })
        : null,
    ].filter(Boolean) as Promise<() => void>[];

    return () => {
      subscriptions.forEach((pending) => void pending.then((unlisten) => unlisten()));
    };
  }, [events.progress, events.complete, events.error, matches, onDownloaded]);

  const begin = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((prev) => ({ ...prev, status: 'downloading', error: undefined }));
    try {
      await start();
    } catch (error) {
      inFlight.current = false;
      setState((prev) => ({ ...prev, status: 'error', error: String(error) }));
    }
  };

  return { state, begin };
}
