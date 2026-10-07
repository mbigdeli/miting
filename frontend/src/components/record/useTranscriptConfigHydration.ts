'use client';

/**
 * Hydrate ConfigContext with the persisted transcript config on mount —
 * the context starts from a default until Settings (or this) loads it.
 * Returns whether the saved config has been read, so callers can wait
 * instead of deciding from the default.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TranscriptModelProps } from '@/types/transcript';

export function useTranscriptConfigHydration(
  setTranscriptModelConfig: (config: TranscriptModelProps) => void,
) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await invoke<{ provider?: string; model?: string } | null>(
          'api_get_transcript_config',
        );
        if (!cancelled && saved?.provider && saved.model) {
          setTranscriptModelConfig({
            provider: saved.provider as TranscriptModelProps['provider'],
            model: saved.model,
            apiKey: null,
          });
        }
      } catch {
        // Keep the context default.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return hydrated;
}
