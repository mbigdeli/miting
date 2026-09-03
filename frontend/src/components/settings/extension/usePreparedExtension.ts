'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ExtensionInstallStatus } from '@/lib/extensionGuide';

/**
 * Keeps the companion extension's folder ready and reports what is actually
 * on disk.
 *
 * The app copies the bundled extension into app-data at startup, but that runs
 * fire-and-forget: opening this tab during the copy — or after one that failed
 * — used to advertise a path holding nothing, which Chrome then rejected. So
 * the tab asks again on open. It is idempotent: the Rust side compares content
 * digests and returns immediately when the copy already matches.
 */
export function usePreparedExtension() {
  const [status, setStatus] = useState<ExtensionInstallStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let current = await invoke<ExtensionInstallStatus>('extension_install_status');
        const stale =
          current.bundledVersion !== null && current.installedVersion !== current.bundledVersion;
        if (stale) {
          setPreparing(true);
          current = await invoke<ExtensionInstallStatus>('extension_install_run');
        }
        if (cancelled) return;
        setStatus(current);
        setError(null);
      } catch (e) {
        console.error('preparing the companion extension failed', e);
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(async () => {
    try {
      setStatus(await invoke<ExtensionInstallStatus>('extension_install_status'));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const reinstall = useCallback(async () => {
    setPreparing(true);
    try {
      setStatus(await invoke<ExtensionInstallStatus>('extension_install_run'));
      setError(null);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setPreparing(false);
    }
  }, []);

  return { status, error, preparing, retry, reinstall };
}
