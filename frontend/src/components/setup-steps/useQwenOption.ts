'use client';

/**
 * The built in local model row. Which model (recommended for this machine's
 * memory) and its size come from the backend, like the Summary settings.
 * "Ready" means it writes the notes now; on disk but unused offers "Use".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { formatSummaryModelSizeLabelFromMb } from '@/lib/onboarding-summary-model';
import { downloadRowState } from '@/lib/setupSteps';
import { readSummaryConfig, saveSummaryProvider } from '@/lib/summaryProvider';

interface BuiltinModel {
  name: string;
  size_mb: number;
  status: { type: string; progress?: number };
}

interface ProgressEvent {
  model: string;
  progress?: number;
  status?: string;
}

const sameChoice = (a: { provider?: string; model?: string } | null, b: typeof a) =>
  a?.provider === b?.provider && a?.model === b?.model;

export function useQwenOption(current: { provider: string | null; model: string | null }, aiReady: boolean) {
  const [model, setModel] = useState<string | null>(null);
  const [sizeMb, setSizeMb] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  const aiReadyNow = useRef(aiReady);
  aiReadyNow.current = aiReady;

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const name = await invoke<string>('builtin_ai_get_recommended_model');
        const info = (await invoke<BuiltinModel[]>('builtin_ai_list_models')).find((m) => m.name === name);
        if (!alive.current) return;
        setModel(name);
        setSizeMb(info?.size_mb ?? 0);
        setReady(info?.status.type === 'available');
        if (info?.status.type === 'downloading') setProgress(info.status.progress ?? 0);
      } catch (error) {
        console.error('[SetupSteps] Failed to read the local AI model:', error);
      }
    })();
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!model) return;
    const pending = listen<ProgressEvent>('builtin-ai-download-progress', ({ payload }) => {
      if (payload.model !== model) return;
      setProgress(payload.status === 'downloading' ? payload.progress ?? 0 : null);
      if (payload.status === 'completed') setReady(true);
    });
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, [model]);

  const act = useCallback(async () => {
    if (!model) return;
    if (ready) {
      await saveSummaryProvider('builtin-ai', model).catch(() => setFailed(true));
      return;
    }
    setFailed(false);
    setProgress(0);
    // Notes that already work keep working until the download lands; with
    // nothing working, switch now so a reload mid download keeps the pick.
    const switchNow = !aiReadyNow.current;
    const before = await readSummaryConfig().catch(() => null);
    if (switchNow) await saveSummaryProvider('builtin-ai', model).catch(() => undefined);
    try {
      await invoke('builtin_ai_download_model', { modelName: model });
      if (alive.current) setReady(true);
      // Switch only if nobody picked something else while it downloaded.
      const now = await readSummaryConfig().catch(() => null);
      if (!switchNow && sameChoice(now, before)) await saveSummaryProvider('builtin-ai', model);
    } catch (error) {
      if (alive.current && !String(error).startsWith('CANCELLED')) setFailed(true);
    } finally {
      if (alive.current) setProgress(null);
    }
  }, [model, ready]);

  return {
    state: downloadRowState({
      progress,
      onDisk: ready,
      selected: current.provider === 'builtin-ai' && current.model === model,
      failed,
    }),
    act,
    size: sizeMb ? formatSummaryModelSizeLabelFromMb(sizeMb) : undefined,
  };
}
