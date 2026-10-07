'use client';

/**
 * Transcription downloads started from the setup steps, and what happens
 * when each one ends. The record lives at module scope so leaving Home mid
 * download still applies it when the model lands, and it remembers which
 * saved choice it may replace: a pick the user made meanwhile always wins.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RowState } from '@/lib/setupSteps';
import type { TranscriptionOption } from './options';

/** Model -> the "provider:model" choice that must still be saved when it lands. */
const pending = new Map<string, string>();

export const choiceKey = (provider: string | undefined, model: string | undefined) =>
  `${provider}:${model}`;

export interface PendingRow {
  option: TranscriptionOption;
  kind: RowState['kind'];
  engineFailed: boolean;
}

export function usePendingDownloads(
  rows: PendingRow[],
  currentChoice: string,
  loaded: boolean,
  select: (option: TranscriptionOption) => Promise<void>,
) {
  const [failed, setFailed] = useState<string[]>([]);
  const seenDownloading = useRef(new Set<string>());
  const latest = useRef(rows);
  latest.current = rows;

  const start = useCallback((option: TranscriptionOption, keepChoice: string) => {
    pending.set(option.model, keepChoice);
    setFailed((list) => list.filter((model) => model !== option.model));
  }, []);

  const statesKey = rows.map((row) => row.kind).join(',');
  useEffect(() => {
    if (!loaded) return;
    for (const { option, kind, engineFailed } of latest.current) {
      const keep = pending.get(option.model);
      if (keep === undefined) continue;
      if (kind === 'downloading') {
        seenDownloading.current.add(option.model);
        continue;
      }
      if (kind === 'done' || kind === 'available') {
        pending.delete(option.model);
        if (keep === currentChoice) void select(option);
      } else if (seenDownloading.current.has(option.model)) {
        // It stopped without landing (failed or cancelled): forget it, so a
        // later download made elsewhere cannot switch models behind the user.
        pending.delete(option.model);
        if (engineFailed) setFailed((list) => [...list, option.model]);
      }
    }
  }, [statesKey, currentChoice, loaded, select]);

  return { start, isFailed: (model: string) => failed.includes(model) };
}
