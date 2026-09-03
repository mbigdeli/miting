'use client';

/**
 * Recordings settings tab (mockup 3b): saving behaviour, devices, engine.
 * Device/engine pickers reuse the shared DeviceSelection component so the
 * capture wiring stays identical to the legacy dialog.
 */

import { FolderOpen } from 'lucide-react';
import { DeviceSelection } from '@/components/DeviceSelection';
import { SectionLabel, SettingRow, RowText, Toggle } from './primitives';
import { useRecordingPreferences } from './useRecordingPreferences';

export function RecordingsTab() {
  const {
    preferences,
    loading,
    saving,
    notifyOnStart,
    toggleAutoSave,
    changeDevices,
    toggleNotifyOnStart,
    openFolder,
  } = useRecordingPreferences();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-4 h-4 w-1/4 rounded bg-zinc-200" />
        <div className="mb-4 h-8 rounded bg-zinc-200" />
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Saving</SectionLabel>
      <SettingRow>
        <RowText title="Auto-save recordings" desc="Keep the audio file after each miting ends" />
        <Toggle
          checked={preferences.auto_save}
          onChange={toggleAutoSave}
          disabled={saving}
          label="Auto-save recordings"
        />
      </SettingRow>

      {preferences.auto_save ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={openFolder}
            title="Open recordings folder"
            className="flex w-full items-center gap-3.5 rounded-[10px] border border-zinc-200 bg-white px-4 py-3.5 text-left hover:bg-zinc-50"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-xs font-semibold text-zinc-600">Save location</div>
              <div className="truncate text-[13.5px] text-zinc-900">
                {preferences.save_folder || 'Default folder'}
              </div>
            </div>
            <FolderOpen size={16} className="shrink-0 text-zinc-400" />
          </button>
          <p className="mt-1.5 px-1 text-xs text-zinc-500">
            Saved as {preferences.file_format.toUpperCase()} · recording_YYYYMMDD_HHMMSS
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Audio is discarded when recording stops. Turn auto-save on to keep miting audio.
        </p>
      )}

      <SettingRow className="mt-2">
        <RowText
          title="Notify when recording starts"
          desc="Show a reminder to inform participants when recording starts"
        />
        <Toggle
          checked={notifyOnStart}
          onChange={toggleNotifyOnStart}
          label="Notify when recording starts"
        />
      </SettingRow>

      <SectionLabel>Devices &amp; engine</SectionLabel>
      <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
        <DeviceSelection
          selectedDevices={{
            micDevice: preferences.preferred_mic_device,
            systemDevice: preferences.preferred_system_device,
          }}
          onDeviceChange={changeDevices}
          disabled={saving}
        />
      </div>
    </div>
  );
}
