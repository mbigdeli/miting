'use client';

/**
 * Model list for one engine: shared cards + selection persistence. Selecting
 * a model saves it to transcript_settings (same config the record-screen
 * picker and the recording pipeline read).
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { toErrorMessage } from '@/lib/utils';
import type { EngineAdapter } from './types';
import { ModelCard } from './ModelCard';
import { useEngineModels } from './useEngineModels';

export function EngineModels({
  adapter,
  selectedModel,
  onModelSelect,
}: {
  adapter: EngineAdapter;
  /** Currently saved model name for this engine, if this engine is active. */
  selectedModel?: string;
  onModelSelect: (name: string) => void;
}) {
  const { models, progress, error, download, cancelDownload, removeCorrupted } =
    useEngineModels(adapter);

  const select = async (name: string) => {
    try {
      await invoke('api_save_transcript_config', {
        provider: adapter.configProvider,
        model: name,
        apiKey: null,
      });
      onModelSelect(name);
    } catch (reason) {
      // Silence here used to leave the card looking selected while recording
      // kept using the previous engine.
      console.error('Failed to save transcription model selection:', reason);
      toast.error('Could not switch the transcription model', {
        description: toErrorMessage(reason, 'The previous model is still in use.'),
      });
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {models.length === 0 && !error && (
        <p className="rounded-[10px] border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
          Loading models…
        </p>
      )}
      {models.map((model) => (
        <ModelCard
          key={model.name}
          model={model}
          selected={selectedModel === model.name}
          progress={progress[model.name]}
          onSelect={() => void select(model.name)}
          onDownload={() => void download(model.name)}
          onCancel={adapter.cancelDownload ? () => void cancelDownload(model.name) : undefined}
          onRemoveCorrupted={
            adapter.removeCorrupted ? () => void removeCorrupted(model.name) : undefined
          }
        />
      ))}
    </div>
  );
}
