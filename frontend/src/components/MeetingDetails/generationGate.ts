import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { isOllamaNotInstalledError } from '@/lib/utils';
import { checkBuiltInAIModelAndGenerate } from './generationGateBuiltin';

export interface GenerationGateOpts {
  modelConfig: ModelConfig;
  /** Kick off the actual summary generation once the model checks pass. */
  generate: () => void | Promise<void>;
  /** Open the model-settings dialog so the user can fix the configuration. */
  openSettings: () => void;
}

/**
 * Pre-generation model checks shared by the legacy button group and the
 * redesigned Overview tab. Verifies the configured provider actually has a
 * usable model before calling `generate`; otherwise guides the user into
 * model settings. Behavior extracted verbatim from
 * SummaryGeneratorButtonGroup.checkOllamaModelsAndGenerate.
 */
export async function runGenerationGate(opts: GenerationGateOpts): Promise<void> {
  const { modelConfig, generate, openSettings } = opts;

  if (modelConfig.provider === 'builtin-ai') {
    await checkBuiltInAIModelAndGenerate(opts);
    return;
  }

  // Only Ollama needs a pre-flight model listing.
  if (modelConfig.provider !== 'ollama') {
    await generate();
    return;
  }

  try {
    const endpoint = modelConfig.ollamaEndpoint || null;
    const models = (await invoke('get_ollama_models', { endpoint })) as any[];

    if (!models || models.length === 0) {
      toast.error(
        'No Ollama models found. Please download gemma3:1b from Model Settings.',
        { duration: 5000 }
      );
      openSettings();
      return;
    }

    await generate();
  } catch (error) {
    console.error('Error checking Ollama models:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isOllamaNotInstalledError(errorMessage)) {
      toast.error('Ollama is not installed', {
        description: 'Please download and install Ollama to use local models.',
        duration: 7000,
        action: {
          label: 'Download',
          onClick: () => invoke('open_external_url', { url: 'https://ollama.com/download' }),
        },
      });
    } else {
      toast.error(
        'Failed to check Ollama models. Please check if Ollama is running and download a model.',
        { duration: 5000 }
      );
    }
    openSettings();
  }
}
