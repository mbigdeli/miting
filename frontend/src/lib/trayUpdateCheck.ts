/**
 * What the tray's "Check for Updates" should show. Kept component-free so the
 * node test suite can cover it: the bug this replaces was the tray opening a
 * dialog that renders nothing when no update exists, which read as a dead menu
 * item.
 */

import type { UpdateInfo } from '@/services/updateService';
import { isBenignUpdateError, toUpdateCheckError } from '@/services/updateErrors';

export type TrayCheckOutcome =
  /** An update exists — open the update dialog. */
  | { kind: 'dialog' }
  /** Nothing new, or a channel that had nothing to say. */
  | { kind: 'up-to-date' }
  /** A real failure worth an error toast. */
  | { kind: 'error'; message: string }
  /** Another check is already running — say nothing. */
  | { kind: 'silent' };

export function trayCheckResult(info: UpdateInfo | null): TrayCheckOutcome {
  return info?.available ? { kind: 'dialog' } : { kind: 'up-to-date' };
}

export function trayCheckFailure(error: unknown): TrayCheckOutcome {
  const failure = toUpdateCheckError(error);
  if (isBenignUpdateError(failure.kind)) return { kind: 'up-to-date' };
  if (failure.kind === 'in-progress') return { kind: 'silent' };
  return { kind: 'error', message: failure.message };
}
