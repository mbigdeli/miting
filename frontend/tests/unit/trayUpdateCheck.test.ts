import { describe, expect, test } from 'vitest';
import { trayCheckFailure, trayCheckResult } from '../../src/lib/trayUpdateCheck';
import type { UpdateInfo } from '../../src/services/updateService';

const info = (available: boolean): UpdateInfo =>
  ({ available, currentVersion: '1.0.0', version: '1.1.0' }) as UpdateInfo;

describe('trayCheckResult', () => {
  test('an available update opens the dialog', () => {
    expect(trayCheckResult(info(true))).toEqual({ kind: 'dialog' });
  });

  test('no update reports up to date instead of an empty dialog', () => {
    expect(trayCheckResult(info(false))).toEqual({ kind: 'up-to-date' });
  });

  test('a skipped check still gives the user an answer', () => {
    expect(trayCheckResult(null)).toEqual({ kind: 'up-to-date' });
  });
});

describe('trayCheckFailure', () => {
  test('offline / unreachable channels read as up to date', () => {
    expect(trayCheckFailure('error sending request').kind).toBe('up-to-date');
    expect(trayCheckFailure('could not fetch a valid release json').kind).toBe('up-to-date');
  });

  test('a concurrent check stays silent', () => {
    expect(trayCheckFailure('an update check is already in progress')).toEqual({ kind: 'silent' });
  });

  test('a real failure surfaces its message', () => {
    const outcome = trayCheckFailure('minisign signature mismatch');
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message.length).toBeGreaterThan(0);
  });
});
