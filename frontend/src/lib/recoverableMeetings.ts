/**
 * Which meetings the recovery dialog should offer.
 *
 * IndexedDB keeps a row for every session the app starts, and the dialog used
 * to list all of them from the last seven days. So every call that saved
 * perfectly was presented back as "interrupted", and every start that produced
 * nothing left an entry with no transcript and no audio behind it — a dialog
 * offering to recover work that either was never lost or never existed.
 */

export interface RecoverableCandidate {
  lastUpdated: number;
  savedToSQLite: boolean;
  transcriptCount: number;
  folderPath?: string;
}

/** A week: older than this and the audio checkpoints are gone anyway. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** A session that just stopped is still being written; leave it alone. */
export const SETTLE_MS = 2 * 1000;

export function isRecoverable<T extends RecoverableCandidate>(meeting: T, now: number): boolean {
  if (meeting.lastUpdated <= now - RETENTION_MS) return false;
  if (meeting.lastUpdated >= now - SETTLE_MS) return false;
  // Reaching SQLite is what "not interrupted" means. `deleteSavedMeetings`
  // only purges these a day later, so the flag has to be read here too.
  if (meeting.savedToSQLite) return false;
  // Nothing to hand back is not a recovery.
  return meeting.transcriptCount > 0 || Boolean(meeting.folderPath);
}

export function recoverableMeetings<T extends RecoverableCandidate>(all: T[], now: number): T[] {
  return all.filter((m) => isRecoverable(m, now));
}
