'use client';

/**
 * Transcription-model picker pinned to the top of the record screen. Lists
 * only models already downloaded across the local engines, persists the
 * choice to the same config Settings uses, and offers "Add a model", which
 * opens the Transcription tab of Settings.
 */

import { invoke } from '@tauri-apps/api/core';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { toErrorMessage } from '@/lib/utils';
import { STEP_COPY } from '@/components/setup-steps/options';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDownloadedModels } from './useDownloadedModels';
import { useTranscriptConfigHydration } from './useTranscriptConfigHydration';
import { fromConfigProvider, modelKey, optionLabel, toConfigProvider } from './modelPickerOptions';

/** A value no real model can have; picking it opens Settings instead. */
const ADD_MODEL = '__add_model__';

export function ModelPicker() {
  const router = useRouter();
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const { models, loaded } = useDownloadedModels();

  useTranscriptConfigHydration(setTranscriptModelConfig);

  const current = modelKey(
    fromConfigProvider(transcriptModelConfig?.provider),
    transcriptModelConfig?.model ?? '',
  );
  const hasCurrent = models.some((m) => modelKey(m.provider, m.name) === current);

  const handleChange = async (key: string) => {
    if (key === ADD_MODEL) {
      router.push(`/settings?tab=${STEP_COPY.transcription.settingsTab}`);
      return;
    }
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

  // With nothing downloaded the Home setup steps, which cannot be closed
  // then, already offer the models; a second button here would compete.
  if (!loaded || models.length === 0) return null;

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
              {optionLabel(m, models)}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={ADD_MODEL} className="font-medium text-brand focus:text-brand">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a model
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
