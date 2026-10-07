'use client';

/**
 * Transcription step: Parakeet, Whisper and Shenava rows backed by the same
 * adapters and hook as Settings, so status and size always match it. "Ready"
 * means the model is the one in use; a downloaded model that is not offers
 * "Use". The step is ready when recording can use the saved choice.
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineModels } from '@/components/settings/model-cards/useEngineModels';
import {
  parakeetAdapter,
  shenavaAdapter,
  whisperAdapter,
} from '@/components/settings/model-cards/adapters';
import { useTranscriptConfigHydration } from '@/components/record/useTranscriptConfigHydration';
import { useConfig } from '@/contexts/ConfigContext';
import { formatEngineSize } from '@/lib/modelSize';
import { downloadRowState, isChosen } from '@/lib/setupSteps';
import { transcriptionStepReady } from '@/lib/transcriptionReady';
import { TRANSCRIPTION_OPTIONS, type TranscriptionOption } from './options';
import type { StepRow } from './types';
import { choiceKey, usePendingDownloads } from './usePendingDownloads';

/**
 * `selectOnStart`: point recordings at a model as soon as its download
 * starts. Onboarding needs it because finishing reloads the window, which
 * drops the switch that otherwise waits for the download to land.
 */
export function useTranscriptionStep({ selectOnStart = false } = {}) {
  const engines = {
    parakeet: useEngineModels(parakeetAdapter),
    whisper: useEngineModels(whisperAdapter),
    shenava: useEngineModels(shenavaAdapter),
  };
  const { transcriptModelConfig: config, setTranscriptModelConfig } = useConfig();
  const configLoaded = useTranscriptConfigHydration(setTranscriptModelConfig);

  const select = useCallback(
    async (option: TranscriptionOption) => {
      try {
        await invoke('api_save_transcript_config', {
          provider: option.configProvider,
          model: option.model,
          apiKey: null,
        });
        setTranscriptModelConfig({ provider: option.configProvider, model: option.model, apiKey: null });
      } catch (error) {
        console.error('[SetupSteps] Failed to select the transcription model:', error);
      }
    },
    [setTranscriptModelConfig],
  );

  const configured = TRANSCRIPTION_OPTIONS.find((o) => o.configProvider === config?.provider);
  const ready = transcriptionStepReady({
    engine: configured?.id,
    model: config?.model,
    onDisk: configured
      ? engines[configured.id].models.filter((m) => m.status.kind === 'available').map((m) => m.name)
      : [],
  });
  const loaded =
    configLoaded && Object.values(engines).every((e) => e.models.length > 0 || e.error !== null);
  const currentChoice = choiceKey(config?.provider, config?.model);

  const options = TRANSCRIPTION_OPTIONS.map((option) => {
    const engine = engines[option.id];
    const model = engine.models.find((m) => m.name === option.model);
    const listed = model?.status.kind === 'downloading' ? model.status.progress : undefined;
    const input = {
      progress: engine.progress[option.model] ?? listed,
      onDisk: model?.status.kind === 'available',
      selected: config?.provider === option.configProvider && config?.model === option.model,
    };
    const { kind } = downloadRowState({ ...input, failed: false });
    return { option, engine, model, input, kind, engineFailed: engine.error !== null };
  });
  const pending = usePendingDownloads(options, currentChoice, loaded, select);

  const rows: StepRow[] = options.map(({ option, engine, model, input }) => ({
    key: option.id,
    title: option.title,
    tag: option.tag,
    lead: option.lead,
    size: model ? formatEngineSize(model.sizeMb) : undefined,
    tip: option.tip,
    mark: option.mark,
    state: downloadRowState({ ...input, failed: pending.isFailed(option.model) }),
    action: 'download',
    act: input.onDisk
      ? () => void select(option)
      : () => {
          // With nothing working yet, use it right away. Otherwise switch when
          // it lands, unless the user picks something else meanwhile.
          const now = selectOnStart || !ready;
          pending.start(option, now ? choiceKey(option.configProvider, option.model) : currentChoice);
          if (now) void select(option);
          void engine.download(option.model);
        },
  }));

  return {
    rows,
    ready,
    loaded,
    chosen: rows.some((row) => isChosen(row.state)),
    downloading: rows.some((row) => row.state.kind === 'downloading'),
  };
}
