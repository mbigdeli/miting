/**
 * Pure view-model helpers for the database recovery screen.
 *
 * Kept free of React and Tauri so the screen-precedence rule — the thing that
 * decides whether a user with a broken database sees a recovery screen or an
 * app shell wired to a dead backend — is unit-testable.
 */

export type DatabaseInitStatus =
  | { state: 'pending' }
  | { state: 'firstLaunch' }
  | { state: 'ready' }
  | { state: 'failed'; error: string };

export interface DatabaseBackup {
  fileName: string;
  sizeBytes: number;
  modifiedSecs: number;
}

export type AppScreen = 'recovery' | 'onboarding' | 'app';

/**
 * Recovery outranks onboarding: the onboarding gate reads its status from the
 * store, not the database, so it would happily hand a user with an unopenable
 * database straight into a flow that needs one.
 */
export function resolveAppScreen(
  status: DatabaseInitStatus,
  showOnboarding: boolean
): AppScreen {
  if (status.state === 'failed') return 'recovery';
  return showOnboarding ? 'onboarding' : 'app';
}

export function formatBackupWhen(modifiedSecs: number): string {
  return modifiedSecs > 0 ? new Date(modifiedSecs * 1000).toLocaleString() : 'unknown date';
}

export function formatBackupSize(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Newest first, so the least data-losing restore is the first option shown. */
export function sortBackupsNewestFirst(backups: DatabaseBackup[]): DatabaseBackup[] {
  return [...backups].sort((a, b) => b.modifiedSecs - a.modifiedSecs);
}
