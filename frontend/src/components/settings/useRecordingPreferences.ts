'use client';

/**
 * State + persistence for the Recordings settings tab. Mirrors the legacy
 * RecordingSettings wiring (same invokes, store keys, toasts, analytics) so
 * the two UIs stay behaviourally identical.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import type { RecordingPreferences } from './recordingPreferences';
import type { SelectedDevices } from '@/components/DeviceSelection';
import { loadNotifyOnStart, saveNotifyOnStart } from './recordingNotificationPref';

export function useRecordingPreferences() {
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    save_folder: '',
    auto_save: true,
    file_format: 'mp4',
    preferred_mic_device: null,
    preferred_system_device: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyOnStart, setNotifyOnStart] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await invoke<RecordingPreferences>('get_recording_preferences');
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load recording preferences:', error);
        try {
          const defaultPath = await invoke<string>('get_default_recordings_folder_path');
          setPreferences((prev) => ({ ...prev, save_folder: defaultPath }));
        } catch (defaultError) {
          console.error('Failed to get default folder path:', defaultError);
        }
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  useEffect(() => {
    loadNotifyOnStart().then(setNotifyOnStart);
  }, []);

  const savePreferences = async (prefs: RecordingPreferences) => {
    setSaving(true);
    try {
      await invoke('set_recording_preferences', { preferences: prefs });
      const micDevice = prefs.preferred_mic_device || 'Default';
      const systemDevice = prefs.preferred_system_device || 'Default';
      toast.success('Device preferences saved', {
        description: `Microphone: ${micDevice}, System Audio: ${systemDevice}`,
      });
    } catch (error) {
      console.error('Failed to save recording preferences:', error);
      toast.error('Failed to save device preferences', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoSave = async (enabled: boolean) => {
    const newPreferences = { ...preferences, auto_save: enabled };
    setPreferences(newPreferences);
    await savePreferences(newPreferences);
    await Analytics.track('auto_save_recording_toggled', { enabled: enabled.toString() });
  };

  const changeDevices = async (devices: SelectedDevices) => {
    const newPreferences = {
      ...preferences,
      preferred_mic_device: devices.micDevice,
      preferred_system_device: devices.systemDevice,
    };
    setPreferences(newPreferences);
    await savePreferences(newPreferences);
    await Analytics.track('default_devices_changed', {
      has_preferred_microphone: (!!devices.micDevice).toString(),
      has_preferred_system_audio: (!!devices.systemDevice).toString(),
    });
  };

  const toggleNotifyOnStart = async (enabled: boolean) => {
    setNotifyOnStart(enabled);
    await saveNotifyOnStart(enabled);
  };

  const openFolder = async () => {
    try {
      await invoke('open_recordings_folder');
    } catch (error) {
      console.error('Failed to open recordings folder:', error);
    }
  };

  return {
    preferences,
    loading,
    saving,
    notifyOnStart,
    toggleAutoSave,
    changeDevices,
    toggleNotifyOnStart,
    openFolder,
  };
}
