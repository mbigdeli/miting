import { describe, expect, it } from 'vitest';
import {
  formatBackupSize,
  formatBackupWhen,
  resolveAppScreen,
  sortBackupsNewestFirst,
  type DatabaseBackup,
} from '@/lib/databaseRecovery';

describe('resolveAppScreen', () => {
  it('shows recovery when the database failed, even mid-onboarding', () => {
    const failed = { state: 'failed', error: 'migration modified' } as const;
    expect(resolveAppScreen(failed, true)).toBe('recovery');
    expect(resolveAppScreen(failed, false)).toBe('recovery');
  });

  it('falls through to onboarding and the app when the database is usable', () => {
    expect(resolveAppScreen({ state: 'firstLaunch' }, true)).toBe('onboarding');
    expect(resolveAppScreen({ state: 'ready' }, false)).toBe('app');
  });

  it('does not hijack the app while the status is still unknown', () => {
    expect(resolveAppScreen({ state: 'pending' }, false)).toBe('app');
  });
});

describe('backup formatting', () => {
  it('renders a size in MB', () => {
    expect(formatBackupSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('labels a missing timestamp instead of showing the epoch', () => {
    expect(formatBackupWhen(0)).toBe('unknown date');
    expect(formatBackupWhen(1_700_000_000)).not.toBe('unknown date');
  });
});

describe('sortBackupsNewestFirst', () => {
  it('orders newest first without mutating the input', () => {
    const backups: DatabaseBackup[] = [
      { fileName: 'old.sqlite', sizeBytes: 1, modifiedSecs: 100 },
      { fileName: 'new.sqlite', sizeBytes: 1, modifiedSecs: 300 },
      { fileName: 'mid.sqlite', sizeBytes: 1, modifiedSecs: 200 },
    ];

    const sorted = sortBackupsNewestFirst(backups);

    expect(sorted.map((b) => b.fileName)).toEqual(['new.sqlite', 'mid.sqlite', 'old.sqlite']);
    expect(backups[0].fileName).toBe('old.sqlite');
  });
});
