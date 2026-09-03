import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { BuiltInModelInfo } from '@/lib/builtin-ai';
import type { GenerationGateOpts } from './generationGate';

/**
 * Built-in AI branch of the summary generation gate. Verifies the selected
 * bundled model is downloaded and healthy before generating; otherwise guides
 * the user into model settings. Extracted verbatim from
 * SummaryGeneratorButtonGroup so the redesigned Overview tab shares it.
 */
export async function checkBuiltInAIModelAndGenerate(opts: GenerationGateOpts): Promise<void> {
  const { modelConfig, generate, openSettings } = opts;
  const selectedModel = modelConfig.model;

  if (!selectedModel) {
    toast.error('No built-in AI model selected', {
      description: 'Please select a model in settings',
      duration: 5000,
    });
    openSettings();
    return;
  }

  // Check model readiness (with filesystem refresh)
  const isReady = await invoke<boolean>('builtin_ai_is_model_ready', {
    modelName: selectedModel,
    refresh: true,
  });

  if (isReady) {
    await generate();
    return;
  }

  // Model not ready - check detailed status
  const modelInfo = await invoke<BuiltInModelInfo | null>('builtin_ai_get_model_info', {
    modelName: selectedModel,
  });

  if (!modelInfo) {
    toast.error('Model not found', {
      description: `Could not find information for model: ${selectedModel}`,
      duration: 5000,
    });
    openSettings();
    return;
  }

  const status = modelInfo.status;

  if (status.type === 'downloading') {
    toast.info('Model download in progress', {
      description: `${selectedModel} is downloading (${status.progress}%). Please wait until download completes.`,
      duration: 5000,
    });
    return;
  }

  if (status.type === 'not_downloaded') {
    toast.error('Model not downloaded', {
      description: `${selectedModel} needs to be downloaded before use. Opening model settings...`,
      duration: 5000,
    });
    openSettings();
    return;
  }

  if (status.type === 'corrupted') {
    toast.error('Model file corrupted', {
      description: `${selectedModel} file is corrupted. Please delete and re-download.`,
      duration: 7000,
    });
    openSettings();
    return;
  }

  if (status.type === 'error') {
    toast.error('Model error', {
      description: status.message || 'An error occurred with the model',
      duration: 5000,
    });
    openSettings();
    return;
  }

  toast.error('Model not available', {
    description: 'The selected model is not ready for use',
    duration: 5000,
  });
  openSettings();
}
