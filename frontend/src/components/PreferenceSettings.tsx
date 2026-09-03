"use client"

/**
 * General settings tab (mockup 3a): notifications, storage, and privacy.
 * Logic lives in useNotificationsToggle; this file is layout only.
 */

import { invoke } from "@tauri-apps/api/core"
import Analytics from "@/lib/analytics"
import { SectionLabel, SettingRow, RowText, Toggle } from "./settings/primitives"
import { useNotificationsToggle } from "./settings/useNotificationsToggle"

export function PreferenceSettings() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
  } = useNotificationsToggle();

  const handleOpenFolder = async (folderType: 'database' | 'models' | 'recordings') => {
    try {
      switch (folderType) {
        case 'database':
          await invoke('open_database_folder');
          break;
        case 'models':
          await invoke('open_models_folder');
          break;
        case 'recordings':
          await invoke('open_recordings_folder');
          break;
      }
      await Analytics.track('storage_folder_opened', { folder_type: folderType });
    } catch (error) {
      console.error(`Failed to open ${folderType} folder:`, error);
    }
  };

  if (
    (isLoadingPreferences && !notificationSettings && !storageLocations) ||
    (notificationsEnabled === null && !isLoadingPreferences)
  ) {
    return <div className="py-6 text-sm text-zinc-500">Loading preferences…</div>
  }

  return (
    <div>
      <SectionLabel>Notifications</SectionLabel>
      <SettingRow>
        <RowText
          title="Desktop notifications"
          desc="Alert me when a recording starts and stops"
        />
        <Toggle
          checked={notificationsEnabled ?? false}
          onChange={setNotificationsEnabled}
          label="Desktop notifications"
        />
      </SettingRow>

      <SectionLabel>Storage</SectionLabel>
      <SettingRow>
        <RowText
          title="Recordings & data"
          desc={storageLocations?.recordings || 'Loading…'}
          mono
        />
        <button
          type="button"
          onClick={() => handleOpenFolder('recordings')}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-[13px] py-[7px] text-[12.5px] font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Open Folder
        </button>
      </SettingRow>
      <p className="mt-2 text-xs text-zinc-400">
        The database and transcription models live alongside recordings in the app data directory.
      </p>
    </div>
  )
}
