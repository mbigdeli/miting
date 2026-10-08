'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface ConnectionStatus {
  everConnected: boolean;
  lastSeenAt: number | null;
}

/**
 * Whether the Chrome extension has ever reached the app. Refetches when the
 * app hears from it (`extension-seen`), so the guide turns green by itself
 * the moment Chrome loads the folder.
 */
export function useExtensionConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await invoke<ConnectionStatus>('extension_connection_status'));
    } catch (error) {
      console.error('[Extension] Could not read the connection status:', error);
      setStatus({ everConnected: false, lastSeenAt: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unlisten = listen('extension-seen', () => void refresh());
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [refresh]);

  return {
    loaded: status !== null,
    everConnected: status?.everConnected ?? false,
    lastSeenAt: status?.lastSeenAt ?? null,
  };
}
