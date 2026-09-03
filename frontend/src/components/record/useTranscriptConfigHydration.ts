'use client';

/**
 * Hydrate ConfigContext with the persisted transcript config on mount —
 * the context starts from a default until Settings (or this) loads it.
 */

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TranscriptModelProps } from '@/types/transcript';

export function useTranscriptConfigHydration(
  setTranscriptModelConfig: (config: TranscriptModelProps) => void,
) {
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
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
