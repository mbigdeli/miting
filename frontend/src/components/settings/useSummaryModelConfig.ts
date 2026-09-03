'use client';

/**
 * Summary model config fetch/save/sync — extracted unchanged from the legacy
 * SummaryModelSettings component (same invokes, events, and toasts).
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { ModelConfig } from '@/components/ModelSettingsModal';

export function useSummaryModelConfig(refetchTrigger?: number) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'llama3.2:latest',
    whisperModel: 'large-v3',
    apiKey: null,
    ollamaEndpoint: null,
  });

  const fetchModelConfig = useCallback(async () => {
    try {
      const data = (await invoke('api_get_model_config')) as any;
      if (data && data.provider !== null) {
        if (
          data.provider !== 'ollama' &&
          data.provider !== 'builtin-ai' &&
          data.provider !== 'codex' &&
          !data.apiKey
        ) {
          try {
            data.apiKey = (await invoke('api_get_api_key', { provider: data.provider })) as string;
          } catch (err) {
            console.error('Failed to fetch API key:', err);
          }
        }
        if (data.provider === 'custom-openai') {
          try {
            const customConfig = (await invoke('api_get_custom_openai_config')) as any;
            if (customConfig) {
              data.customOpenAIDisplayName = customConfig.displayName || null;
              data.customOpenAIEndpoint = customConfig.endpoint || null;
              data.customOpenAIModel = customConfig.model || null;
              data.customOpenAIApiKey = customConfig.apiKey || null;
              data.maxTokens = customConfig.maxTokens || null;
              data.temperature = customConfig.temperature || null;
              data.topP = customConfig.topP || null;
              data.model = customConfig.model || data.model;
            }
          } catch (err) {
            console.error('Failed to fetch custom OpenAI config:', err);
          }
        }
        setModelConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch model config:', error);
      toast.error('Failed to load model settings');
    }
  }, []);

  useEffect(() => {
    fetchModelConfig();
  }, [fetchModelConfig]);

  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      fetchModelConfig();
    }
  }, [refetchTrigger, fetchModelConfig]);

  // Stay in sync with saves made from other components.
  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return listen<ModelConfig>('model-config-updated', (event) => {
        setModelConfig(event.payload);
      });
    };
    let cleanup: (() => void) | undefined;
    setupListener().then((fn) => (cleanup = fn));
    return () => {
      cleanup?.();
    };
  }, []);

  const handleSaveModelConfig = async (config: ModelConfig) => {
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey,
        ollamaEndpoint: config.ollamaEndpoint,
      });
      setModelConfig(config);
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);
      toast.success('Model settings saved successfully');
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error('Failed to save model settings');
    }
  };

  return { modelConfig, setModelConfig, handleSaveModelConfig };
}
