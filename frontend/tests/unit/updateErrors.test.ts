import { describe, expect, it } from 'vitest';
import {
  describeUpdateError,
  isBenignUpdateError,
  rawUpdateError,
  toUpdateCheckError,
  UpdateCheckError,
} from '@/services/updateErrors';

describe('rawUpdateError', () => {
  it('passes plain strings through — the updater plugin rejects with one', () => {
    expect(rawUpdateError('boom')).toBe('boom');
  });

  it('reads Error.message', () => {
    expect(rawUpdateError(new Error('boom'))).toBe('boom');
  });

  it('survives null and odd shapes', () => {
    expect(rawUpdateError(null)).toBe('');
    expect(rawUpdateError({ code: 7 })).toBe('{"code":7}');
  });
});

describe('describeUpdateError', () => {
  it('classifies a non-2xx endpoint response as unreachable', () => {
    const info = describeUpdateError(
      '`update endpoint did not respond with a successful status code`'
    );
    expect(info.kind).toBe('unreachable');
    expect(info.message).toMatch(/unreachable/i);
  });

  it('classifies a missing manifest as unreachable', () => {
    expect(describeUpdateError('Could not fetch a valid release JSON from the remote').kind).toBe(
      'unreachable'
    );
  });

  it('classifies transport failures as offline', () => {
    expect(describeUpdateError('error sending request for url (https://x/latest.json)').kind).toBe(
      'offline'
    );
  });

  it('classifies an empty endpoint list as not-configured', () => {
    expect(describeUpdateError('Updater does not have any endpoints set.').kind).toBe(
      'not-configured'
    );
  });

  it('classifies a missing platform entry', () => {
    const raw = 'the platform `windows-x86_64` was not found in the response `platforms` object';
    expect(describeUpdateError(raw).kind).toBe('no-build-for-platform');
  });

  it('classifies signature failures', () => {
    expect(describeUpdateError('The signature abc could not be decoded').kind).toBe('bad-signature');
  });

  it('classifies a concurrent check', () => {
    expect(describeUpdateError(new Error('Update check already in progress')).kind).toBe(
      'in-progress'
    );
  });

  it('never degrades to "Unknown error" — it surfaces the raw text', () => {
    const info = describeUpdateError('weird internal thing');
    expect(info.kind).toBe('unknown');
    expect(info.message).toContain('weird internal thing');
    expect(info.message).not.toMatch(/unknown error/i);
  });

  it('has a message even when the rejection carries no text', () => {
    expect(describeUpdateError(undefined).message.length).toBeGreaterThan(0);
  });
});

describe('isBenignUpdateError', () => {
  it('treats a silent update channel as up-to-date', () => {
    expect(isBenignUpdateError('unreachable')).toBe(true);
    expect(isBenignUpdateError('offline')).toBe(true);
    expect(isBenignUpdateError('no-build-for-platform')).toBe(true);
  });

  it('still surfaces real faults', () => {
    expect(isBenignUpdateError('bad-signature')).toBe(false);
    expect(isBenignUpdateError('not-configured')).toBe(false);
    expect(isBenignUpdateError('unknown')).toBe(false);
  });
});

describe('toUpdateCheckError', () => {
  it('carries the kind alongside the message', () => {
    const error = toUpdateCheckError('`update endpoint did not respond with a successful status code`');
    expect(error).toBeInstanceOf(UpdateCheckError);
    expect(error.kind).toBe('unreachable');
    expect(error.message).toMatch(/unreachable/i);
  });

  it('is idempotent — re-wrapping does not reclassify to unknown', () => {
    const first = toUpdateCheckError('error sending request for url');
    expect(toUpdateCheckError(first)).toBe(first);
    expect(toUpdateCheckError(first).kind).toBe('offline');
  });
});
