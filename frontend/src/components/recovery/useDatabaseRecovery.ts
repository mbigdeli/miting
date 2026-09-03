'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DatabaseBackup } from '@/lib/databaseRecovery';

type Action = 'restore' | 'fresh' | null;

/**
 * Backing actions for the recovery screen. Each action reloads the window on
 * success so every provider re-reads a database that now opens.
 */
export function useDatabaseRecovery() {
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [busy, setBusy] = useState<Action>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    invoke<DatabaseBackup[]>('list_database_backups')
      .then(setBackups)
      .catch((error) => console.error('[Recovery] Failed to list backups:', error));
  }, []);

  const run = useCallback(async (
    action: Exclude<Action, null>,
    command: string,
    args: Record<string, unknown> = {}
  ) => {
    setBusy(action);
    setActionError(null);
    try {
      await invoke(command, args);
      window.location.reload();
    } catch (error) {
      setActionError(String(error));
      setBusy(null);
    }
  }, []);

  return {
    backups,
    busy,
    actionError,
    restore: (fileName: string) =>
      run('restore', 'restore_database_backup', { backupFile: fileName }),
    startFresh: () => run('fresh', 'discard_database_and_start_fresh'),
    openDataFolder: () =>
      invoke('open_database_folder').catch((error) =>
        console.error('[Recovery] Failed to open data folder:', error)
      ),
  };
}
