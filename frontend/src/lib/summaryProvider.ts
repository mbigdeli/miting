/**
 * Read and change which AI writes meeting notes, the same way Settings does:
 * `api_save_model_config`, then `model-config-updated` so every listener
 * (ConfigContext, Settings, Home) picks the change up.
 */

import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

export interface SummaryModelConfig {
  provider: string;
  model: string;
  whisperModel: string;
  apiKey: string | null;
  ollamaEndpoint: string | null;
}

export const readSummaryConfig = () =>
  invoke<SummaryModelConfig | null>('api_get_model_config');

export async function saveSummaryProvider(provider: string, model: string): Promise<SummaryModelConfig> {
  // Keep fields this choice does not touch; the save overwrites the whole row,
  // so passing null would wipe a saved Ollama endpoint.
  const current = await readSummaryConfig();
  const next: SummaryModelConfig = {
    provider,
    model,
    whisperModel: current?.whisperModel ?? 'large-v3',
    apiKey: null,
    ollamaEndpoint: current?.ollamaEndpoint ?? null,
  };
  await invoke('api_save_model_config', { ...next });
  await emit('model-config-updated', next);
  return next;
}
