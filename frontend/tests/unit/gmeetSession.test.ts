import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  gmeetMeetingName,
  gmeetRecordingNotice,
  gmeetTranscriptSource,
  isGmeetSession,
} from '../../src/lib/gmeetSession';

/**
 * A Meet-driven session must declare `companion` so the recorder skips the
 * local engine: Meet already produced the captions, and starting an engine
 * would cost startup time and RAM to write a transcript nobody reads.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('gmeetTranscriptSource', () => {
  test('a normal session transcribes locally', () => {
    expect(isGmeetSession()).toBe(false);
    expect(gmeetTranscriptSource()).toBe('local');
  });

  test('a Meet session hands transcription to the companion', () => {
    store.set('gmeet_session_id', 'abc');
    expect(isGmeetSession()).toBe(true);
    expect(gmeetTranscriptSource()).toBe('companion');
  });

  test('storage being unavailable falls back to local, never crashes', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(gmeetTranscriptSource()).toBe('local');
  });
});

describe('gmeetRecordingNotice', () => {
  test('names the Meet so the user knows what is being captured', () => {
    expect(gmeetRecordingNotice('Weekly sync')).toBe(
      'Recording from Google Meet · Weekly sync',
    );
  });

  test('stays short when the extension sent no title', () => {
    expect(gmeetRecordingNotice(null)).toBe('Recording from Google Meet');
    expect(gmeetRecordingNotice('   ')).toBe('Recording from Google Meet');
  });

  test('reads the stored title when called with no argument', () => {
    store.set('gmeet_title', 'Design review');
    expect(gmeetRecordingNotice()).toBe('Recording from Google Meet · Design review');
  });
});

describe('gmeetMeetingName', () => {
  test('a Meet session is named after the Meet, not the timestamp', () => {
    store.set('gmeet_session_id', 'abc');
    store.set('gmeet_title', 'Design review');
    expect(gmeetMeetingName('Miting 2026-08-17_00-47-50')).toBe('Design review');
  });

  test('a normal session keeps the generated name', () => {
    expect(gmeetMeetingName('Miting 2026-08-17_00-47-50')).toBe(
      'Miting 2026-08-17_00-47-50',
    );
  });

  test('a Meet with no title falls back rather than going blank', () => {
    store.set('gmeet_session_id', 'abc');
    store.set('gmeet_title', '   ');
    expect(gmeetMeetingName('Miting fallback')).toBe('Miting fallback');
  });
});
