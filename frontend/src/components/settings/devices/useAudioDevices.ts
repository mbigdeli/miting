'use client';

/** Device list + mic-level monitoring state behind the device picker UI. */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import Analytics from '@/lib/analytics';
import {
  AudioDevice,
  AudioLevelData,
  AudioLevelUpdate,
  SelectedDevices,
  deviceMetadata,
} from './deviceTypes';

export function useAudioDevices(
  selectedDevices: SelectedDevices,
  onDeviceChange: (devices: SelectedDevices) => void,
) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<Map<string, AudioLevelData>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(false);

  const inputDevices = devices.filter((device) => device.device_type === 'Input');
  const outputDevices = devices.filter((device) => device.device_type === 'Output');

  const fetchDevices = async () => {
    try {
      setError(null);
      setDevices(await invoke<AudioDevice[]>('get_audio_devices'));
    } catch (err) {
      console.error('Failed to fetch audio devices:', err);
      setError('Failed to load audio devices. Please check your system audio settings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<AudioLevelUpdate>('audio-levels', (event) => {
      setAudioLevels(new Map(event.payload.levels.map((level) => [level.device_name, level])));
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      unlisten?.();
      if (isMonitoring) void invoke('stop_audio_level_monitoring').catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoring]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchDevices();
  };

  const pickDevice = (kind: 'micDevice' | 'systemDevice') => (deviceName: string) => {
    onDeviceChange({
      ...selectedDevices,
      [kind]: deviceName === 'default' ? null : deviceName,
    });
    const metadata = deviceMetadata(deviceName);
    void Analytics.track(kind === 'micDevice' ? 'microphone_selected' : 'system_audio_selected', {
      device_category: metadata.category,
      is_bluetooth: metadata.isBluetooth.toString(),
    }).catch(() => {});
  };

  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await invoke('stop_audio_level_monitoring');
        setIsMonitoring(false);
        setAudioLevels(new Map());
      } else {
        const deviceNames = inputDevices.map((device) => device.name);
        if (deviceNames.length === 0) {
          setError('No microphone devices found to monitor');
          return;
        }
        await invoke('start_audio_level_monitoring', { deviceNames });
        setIsMonitoring(true);
      }
    } catch (err) {
      console.error('Failed to toggle mic monitoring:', err);
      setError('Could not start the microphone test.');
    }
  };

  return {
    inputDevices,
    outputDevices,
    loading,
    error,
    refreshing,
    refresh,
    audioLevels,
    isMonitoring,
    toggleMonitoring,
    onMicChange: pickDevice('micDevice'),
    onSystemChange: pickDevice('systemDevice'),
  };
}
