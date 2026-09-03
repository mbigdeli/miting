'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DatabaseInitStatus } from '@/lib/databaseRecovery';

export type { DatabaseInitStatus };

/**
 * Tracks whether startup database initialization succeeded.
 *
 * Polls once on mount and also subscribes to the startup events, because the
 * backend emits `database-init-failed` on a delay that can land either side of
 * this component mounting.
 */
export function useDatabaseInitStatus() {
  const [status, setStatus] = useState<DatabaseInitStatus>({ state: 'pending' });

  const refresh = useCallback(async () => {
    try {
      setStatus(await invoke<DatabaseInitStatus>('get_database_init_status'));
    } catch (error) {
      // An unreachable status command means the backend is in a far worse
      // state than a bad database; leave the app to render normally.
      console.error('[Recovery] Failed to read database init status:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const subscriptions = [
      listen<{ error: string }>('database-init-failed', (event) => {
        setStatus({ state: 'failed', error: event.payload?.error ?? 'Unknown database error' });
      }),
      listen('database-initialized', () => setStatus({ state: 'ready' })),
    ];

    return () => {
      subscriptions.forEach((pending) => {
        void pending.then((unlisten) => unlisten());
      });
    };
  }, [refresh]);

  return { status, refresh, databaseFailed: status.state === 'failed' };
}
