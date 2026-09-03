'use client';

/**
 * One-line connection row for the CLI summary providers. Replaces the old
 * paragraph + full-width button stack: the state is a dot plus a short line,
 * and the secondary actions are icon buttons whose tooltips carry the wording
 * that used to sit on screen permanently.
 */

import { useState } from 'react';
import { LogOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cliConnectionView, type CliStatusLike } from '@/lib/cliProviderStatus';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const DOT: Record<string, string> = {
  checking: 'bg-zinc-300',
  connected: 'bg-green-500',
  missing: 'bg-amber-500',
  'signed-out': 'bg-amber-500',
};

interface Props {
  /** Human name of the account being connected, e.g. "ChatGPT". */
  account: string;
  status: CliStatusLike | null;
  busy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}

export function CliProviderBar({
  account,
  status,
  busy,
  onSignIn,
  onSignOut,
  onRefresh,
  onCancel,
}: Props) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const view = cliConnectionView(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`size-2 shrink-0 rounded-full ${DOT[view.state]}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-600">{view.text}</span>

      {view.state === 'missing' && (
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
          Re-check
        </Button>
      )}

      {view.state === 'signed-out' && (
        <Button type="button" size="sm" onClick={onSignIn} disabled={busy}>
          {busy ? 'Waiting for browser…' : `Sign in with ${account}`}
        </Button>
      )}

      {busy && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      )}

      {view.state !== 'missing' && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRefresh}
          title={`Re-check the ${account} connection`}
          aria-label={`Re-check the ${account} connection`}
        >
          <RotateCw className="size-4" />
        </Button>
      )}

      {view.state === 'connected' && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setConfirmingSignOut(true)}
          disabled={busy}
          title={`Sign out of ${account}`}
          aria-label={`Sign out of ${account}`}
        >
          <LogOut className="size-4" />
        </Button>
      )}

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title={`Sign out of ${account}?`}
        description="Summaries stop working until you sign in again."
        confirmLabel="Sign out"
        onConfirm={onSignOut}
      />
    </div>
  );
}
