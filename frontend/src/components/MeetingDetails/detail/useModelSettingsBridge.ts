import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ModelConfig } from '@/components/ModelSettingsModal';

/**
 * Bridge between the summary-generation error path and whichever layout is
 * mounted: the layout registers a "open model settings" function; generation
 * failures call it. Also owns persisting the model config (extracted verbatim
 * from the legacy PageContent).
 */
export function useModelSettingsBridge() {
  const openModelSettingsRef = useRef<(() => void) | null>(null);

  // Layout side: register the dialog-opening function.
  const handleRegisterModalOpen = useCallback((openFn: () => void) => {
    console.log('📝 Registering modal open function in PageContent');
    openModelSettingsRef.current = openFn;
  }, []);

  // Generation side: open the dialog (called from error handlers).
  const handleOpenModelSettings = useCallback(() => {
    console.log('🔔 Opening model settings from PageContent');
    if (openModelSettingsRef.current) {
      openModelSettingsRef.current();
    } else {
      console.warn('⚠️ Modal open function not yet registered');
    }
  }, []);

  // Save model config to backend database and sync via event.
  const handleSaveModelConfig = useCallback(async (config?: ModelConfig) => {
    if (!config) return;
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey ?? null,
        ollamaEndpoint: config.ollamaEndpoint ?? null,
      });

      // Emit event so ConfigContext and other listeners stay in sync.
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

      toast.success('Model settings saved successfully');
    } catch (error) {
      console.error('Failed to save model config:', error);
      toast.error('Failed to save model settings');
    }
  }, []);

  return { handleRegisterModalOpen, handleOpenModelSettings, handleSaveModelConfig };
}
