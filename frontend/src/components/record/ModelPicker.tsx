'use client';

/**
 * Transcription-model picker pinned to the top of the record screen. Lists
 * only models already downloaded (status === 'Available') across the local
 * engines and persists the choice to the same config Settings uses.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { toErrorMessage } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranscriptConfigHydration } from './useTranscriptConfigHydration';
import {
  PickerModel,
  PickerProvider,
  fromConfigProvider,
  modelKey,
  optionLabel,
  toConfigProvider,
} from './modelPickerOptions';

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

export function ModelPicker({ onSetUpModels }: { onSetUpModels?: () => void } = {}) {
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const [models, setModels] = useState<PickerModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useTranscriptConfigHydration(setTranscriptModelConfig);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          // Engine unavailable on this build — skip silently.
        }
      }
      if (!cancelled) {
        setModels(downloaded);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = modelKey(
    fromConfigProvider(transcriptModelConfig?.provider),
    transcriptModelConfig?.model ?? '',
  );
  const hasCurrent = models.some((m) => modelKey(m.provider, m.name) === current);

  const handleChange = async (key: string) => {
    const picked = models.find((m) => modelKey(m.provider, m.name) === key);
    if (!picked) return;
    const provider = toConfigProvider(picked.provider) as typeof transcriptModelConfig.provider;
    // Persist BEFORE showing the choice. Recording reads the saved config, not
    // this state, so updating the label first and swallowing a failed save let
    // the picker advertise an engine the recorder never used — the meeting then
    // transcribes with the old engine and is stamped with it.
    try {
      await invoke('api_save_transcript_config', {
        provider,
        model: picked.name,
        apiKey: null,
      });
    } catch (error) {
      console.error('Failed to save transcription model choice:', error);
      toast.error('Could not switch the transcription model', {
        description: toErrorMessage(error, 'The previous model is still in use.'),
      });
      return;
    }
    setTranscriptModelConfig({ provider, model: picked.name, apiKey: null });
  };

  if (!loaded) return null;

  // With nothing downloaded this used to render nothing at all, leaving no clue
  // that meetings would be recorded as audio only.
  if (models.length === 0) {
    return (
      <button
        type="button"
        onClick={onSetUpModels}
        className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-white"
      >
        No transcription model — set one up
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-zinc-600">Model:</span>
      <Select value={hasCurrent ? current : undefined} onValueChange={(v) => void handleChange(v)}>
        <SelectTrigger
          aria-label="Transcription model"
          className="h-9 w-[230px] rounded-lg border-zinc-200 bg-white text-[13px] text-zinc-800 focus:ring-brand"
        >
          <SelectValue placeholder="Choose a model…" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={modelKey(m.provider, m.name)} value={modelKey(m.provider, m.name)}>
              {optionLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
