/**
 * View-model for the CLI summary providers (Codex / Claude Code) connection
 * row. Component-free so the node test suite can cover the wording, and shared
 * by both providers so they cannot drift apart.
 */

export interface CliStatusLike {
  connected: boolean;
  cli_installed: boolean;
  cli_version?: string | null;
  user_email?: string | null;
  subscription_type?: string | null;
  detail?: string | null;
}

export type CliConnectionState = 'checking' | 'connected' | 'missing' | 'signed-out';

export interface CliConnectionView {
  state: CliConnectionState;
  text: string;
}

/** Compact one-liner replacing the old paragraph + status pair. */
export function cliConnectionView(status: CliStatusLike | null): CliConnectionView {
  if (status === null) return { state: 'checking', text: 'Checking…' };

  if (!status.cli_installed) {
    return { state: 'missing', text: status.detail?.trim() || 'CLI not found on this machine.' };
  }

  if (!status.connected) {
    return { state: 'signed-out', text: status.detail?.trim() || 'Not signed in.' };
  }

  const suffix = status.user_email?.trim();
  const badge = status.cli_version?.trim() || status.subscription_type?.trim();
  return {
    state: 'connected',
    text: [suffix ? `Connected as ${suffix}` : 'Connected', badge].filter(Boolean).join(' · '),
  };
}
