'use client';

/**
 * Device picker (Recordings settings + model-selector dialog): microphone and
 * system-audio selects, a working Test Mic level check, and backend choice.
 * Logic lives in settings/devices/useAudioDevices.
 */

import { Mic, Speaker } from 'lucide-react';
import { AudioLevelMeter } from './AudioLevelMeter';
import { AudioBackendSelector } from './AudioBackendSelector';
import { DeviceSelect } from './settings/devices/DeviceSelect';
import { DeviceToolbar } from './settings/devices/DeviceToolbar';
import { useAudioDevices } from './settings/devices/useAudioDevices';
import type { SelectedDevices } from './settings/devices/deviceTypes';

export type { AudioDevice, AudioLevelData, AudioLevelUpdate, SelectedDevices } from './settings/devices/deviceTypes';

interface DeviceSelectionProps {
  selectedDevices: SelectedDevices;
  onDeviceChange: (devices: SelectedDevices) => void;
  disabled?: boolean;
}

export function DeviceSelection({ selectedDevices, onDeviceChange, disabled = false }: DeviceSelectionProps) {
  const d = useAudioDevices(selectedDevices, onDeviceChange);

  if (d.loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-1/3 rounded bg-zinc-200" />
        <div className="h-10 rounded bg-zinc-200" />
        <div className="h-10 rounded bg-zinc-200" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DeviceToolbar
        disabled={disabled}
        canTest={d.inputDevices.length > 0}
        isMonitoring={d.isMonitoring}
        onToggleMonitoring={() => void d.toggleMonitoring()}
        refreshing={d.refreshing}
        onRefresh={() => void d.refresh()}
      />

      {d.error && (
        <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-xs text-red-700">{d.error}</div>
      )}

      <DeviceSelect
        id="mic-selection"
        label="Microphone"
        icon={Mic}
        value={selectedDevices.micDevice || 'default'}
        onChange={d.onMicChange}
        disabled={disabled}
        devices={d.inputDevices}
        defaultLabel="Default Microphone"
        emptyText="No microphone devices found"
      >
        {d.isMonitoring &&
          d.inputDevices.map((device) => {
            const level = d.audioLevels.get(device.name);
            return level ? (
              <AudioLevelMeter
                key={`level-${device.name}`}
                rmsLevel={level.rms_level}
                peakLevel={level.peak_level}
                isActive={level.is_active}
                deviceName={device.name}
                size="small"
              />
            ) : null;
          })}
      </DeviceSelect>

      <DeviceSelect
        id="system-selection"
        label="System Audio"
        icon={Speaker}
        value={selectedDevices.systemDevice || 'default'}
        onChange={d.onSystemChange}
        disabled={disabled}
        devices={d.outputDevices}
        defaultLabel="Default System Audio"
        emptyText="No system audio devices found"
      >
        {!disabled && (
          <div className="border-t border-zinc-100 pt-3">
            <AudioBackendSelector disabled={disabled} />
          </div>
        )}
      </DeviceSelect>

    </div>
  );
}
