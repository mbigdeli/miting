'use client';

/**
 * Transcription settings tab: engine tiles + the shared model cards.
 * Picking an engine only changes the visible list; the saved config updates
 * when a model is selected.
 */

import { useEffect, useState } from 'react';
import type { TranscriptModelProps } from '@/types/transcript';
import { SectionLabel } from './primitives';
import { EnginePicker, type LocalProvider } from './EnginePicker';
import { EngineModels } from './model-cards/EngineModels';
import { parakeetAdapter, shenavaAdapter, whisperAdapter } from './model-cards/adapters';

const ADAPTERS = {
  parakeet: parakeetAdapter,
  localWhisper: whisperAdapter,
  shenava: shenavaAdapter,
} as const;

const isLocal = (p: TranscriptModelProps['provider']): p is LocalProvider =>
  p === 'parakeet' || p === 'localWhisper' || p === 'shenava';

export function TranscriptionTab({
  transcriptModelConfig,
  setTranscriptModelConfig,
  onModelSelect,
}: {
  transcriptModelConfig: TranscriptModelProps;
  setTranscriptModelConfig: (config: TranscriptModelProps) => void;
  /** Optional hook for dialog hosts (close after a successful selection). */
  onModelSelect?: () => void;
}) {
  const [engine, setEngine] = useState<LocalProvider>(
    isLocal(transcriptModelConfig.provider) ? transcriptModelConfig.provider : 'parakeet'
  );

  // Follow backend config changes (initial load, selections elsewhere).
  useEffect(() => {
    if (isLocal(transcriptModelConfig.provider)) setEngine(transcriptModelConfig.provider);
  }, [transcriptModelConfig.provider]);

  const selectModel = (model: string) => {
    setTranscriptModelConfig({ ...transcriptModelConfig, provider: engine, model });
    onModelSelect?.();
  };

  return (
    <div>
      <SectionLabel>Engine</SectionLabel>
      <EnginePicker value={engine} onChange={setEngine} />

      <SectionLabel>Models</SectionLabel>
      <EngineModels
        adapter={ADAPTERS[engine]}
        selectedModel={
          transcriptModelConfig.provider === engine ? transcriptModelConfig.model : undefined
        }
        onModelSelect={selectModel}
      />
      {engine === 'shenava' && (
        <p className="mt-2.5 text-[11.5px] leading-snug text-zinc-400">
          Shenava v1.0 is free to use — keep attribution to the model author when sharing
          output or redistributing the weights.
        </p>
      )}
    </div>
  );
}
