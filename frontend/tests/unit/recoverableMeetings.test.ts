import { describe, expect, it } from 'vitest';
import {
  isRecoverable,
  recoverableMeetings,
  RETENTION_MS,
  type RecoverableCandidate,
} from '@/lib/recoverableMeetings';

const NOW = 1_700_000_000_000;

const meeting = (over: Partial<RecoverableCandidate> = {}): RecoverableCandidate => ({
  lastUpdated: NOW - 60_000,
  savedToSQLite: false,
  transcriptCount: 5,
  ...over,
});

describe('isRecoverable', () => {
  it('offers a session that was interrupted with transcripts in it', () => {
    expect(isRecoverable(meeting(), NOW)).toBe(true);
  });

  /** The bug: every call of the last week came back as "interrupted". */
  it('does not offer a meeting that reached SQLite', () => {
    expect(isRecoverable(meeting({ savedToSQLite: true }), NOW)).toBe(false);
  });

  /** The second bug: a start that produced nothing still left a row. */
  it('does not offer a session with no transcript and no audio', () => {
    expect(isRecoverable(meeting({ transcriptCount: 0 }), NOW)).toBe(false);
  });

  it('offers one with audio even when no transcript was written', () => {
    expect(isRecoverable(meeting({ transcriptCount: 0, folderPath: '/rec/x' }), NOW)).toBe(true);
  });

  it('leaves a session that just stopped alone — it is still being written', () => {
    expect(isRecoverable(meeting({ lastUpdated: NOW - 500 }), NOW)).toBe(false);
  });

  it('drops anything past the retention window', () => {
    expect(isRecoverable(meeting({ lastUpdated: NOW - RETENTION_MS - 1 }), NOW)).toBe(false);
  });
});

describe('recoverableMeetings', () => {
  it('keeps only the sessions worth recovering', () => {
    const all = [
      meeting({ transcriptCount: 3 }),
      meeting({ savedToSQLite: true }),
      meeting({ transcriptCount: 0 }),
      meeting({ transcriptCount: 0, folderPath: '/rec/y' }),
    ];

    expect(recoverableMeetings(all, NOW)).toEqual([all[0], all[3]]);
  });
});
