'use client';

/**
 * One click Connect for a plan the user already pays for (Claude Code or
 * Codex). Already signed in: save the choice. Signed out: start the CLI's
 * browser sign in and poll its status, as Settings does. App missing: open
 * its install page and check again when the window regains focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CliStatusLike } from '@/lib/cliProviderStatus';
import type { RowState } from '@/lib/setupSteps';
import { saveSummaryProvider } from '@/lib/summaryProvider';

const CLIS = {
  claude: {
    status: 'claude_code_status',
    login: 'claude_code_login_start',
    provider: 'claude-code',
    install: 'https://docs.claude.com/en/docs/claude-code/setup',
  },
  chatgpt: {
    status: 'codex_status',
    login: 'codex_login_start',
    provider: 'codex',
    install: 'https://developers.openai.com/codex/cli',
  },
} as const;

const POLL_MS = 3000;
/** Just under the CLI's own five minute sign in deadline, by the clock. */
const POLL_WINDOW_MS = 290_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SIGNED_OUT: CliStatusLike = { connected: false, cli_installed: false };

export function useCliOption(id: keyof typeof CLIS, currentProvider: string | null) {
  const cli = CLIS[id];
  const [status, setStatus] = useState<CliStatusLike | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const next = await invoke<CliStatusLike>(cli.status).catch(() => SIGNED_OUT);
    if (alive.current) setStatus(next);
    return next;
  }, [cli.status]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (status?.cli_installed !== false) return;
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [status?.cli_installed, refresh]);

  const connect = useCallback(async () => {
    const current = status ?? (await refresh());
    if (!current.cli_installed) {
      await invoke('api_open_external', { url: cli.install }).catch(() => undefined);
      return;
    }
    setFailed(false);
    setBusy(true);
    try {
      let signedIn = current.connected;
      if (!signedIn) {
        await invoke(cli.login); // opens the browser itself
        // A status check can be slow, so count wall time rather than tries.
        const deadline = Date.now() + POLL_WINDOW_MS;
        while (alive.current && !signedIn && Date.now() < deadline) {
          await sleep(POLL_MS);
          signedIn = (await refresh()).connected;
        }
      }
      if (signedIn) await saveSummaryProvider(cli.provider, 'default');
      else setFailed(true);
    } catch (error) {
      console.error(`[SetupSteps] Could not connect ${id}:`, error);
      setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [status, refresh, cli, id]);

  let state: RowState = { kind: 'idle' };
  if (busy) state = { kind: 'connecting' };
  else if (status && !status.cli_installed) state = { kind: 'missingApp' };
  else if (status?.connected && currentProvider === cli.provider) state = { kind: 'done' };
  else if (failed) state = { kind: 'error' };

  return {
    state,
    connect,
    installed: !!status?.cli_installed,
    connected: !!status?.connected,
    checked: status !== null,
  };
}
