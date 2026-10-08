import { describe, expect, it, beforeEach } from 'vitest';
import { aiProblem } from '@/lib/translation/aiProblem';
import { isRtlLanguage, languageList, languageName } from '@/lib/translation/languages';
import {
  diarizedKey,
  liveTranslationFor,
  newestTranslated,
  savedTranslationFor,
} from '@/lib/translation/lineTranslation';
import { loadRecents, pillLanguages, rememberLanguage } from '@/lib/translation/recents';
import { LIVE_OFF, type JobProgress, type LiveStatus } from '@/lib/translation/types';

const running: LiveStatus = { ...LIVE_OFF, state: 'running', language: 'fa', provider: 'Claude' };

describe('languageName', () => {
  it('uses each language in its own script', () => {
    expect(languageName('fa')).toBe('فارسی');
    expect(languageName('en')).toBe('English');
    expect(languageName('de')).toBe('Deutsch');
  });
  it('falls back to the code for unknown input', () => {
    expect(languageName('xx-not-real')).toBe('xx-not-real');
  });
  it('lists names and knows right-to-left languages', () => {
    expect(languageList(['fa', 'en'])).toBe('فارسی, English');
    expect(isRtlLanguage('fa')).toBe(true);
    expect(isRtlLanguage('ar-EG')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
    expect(isRtlLanguage(null)).toBe(false);
  });
});

describe('liveTranslationFor', () => {
  const lines = { 3: 'سلام', 5: 'ممنون' };
  it('shows a finished line', () => {
    expect(liveTranslationFor(3, lines, running, 5)).toEqual({ language: 'fa', text: 'سلام' });
  });
  it('shows a placeholder for new lines and while the backlog runs', () => {
    expect(liveTranslationFor(6, lines, running, 5)).toEqual({ language: 'fa', pending: true });
    const busy = { ...running, backlog_total: 4, backlog_done: 1 };
    expect(liveTranslationFor(1, lines, busy, 5)).toEqual({ language: 'fa', pending: true });
  });
  it('shows nothing for skipped old lines, when off, or without an id', () => {
    expect(liveTranslationFor(1, lines, running, 5)).toBeUndefined();
    expect(liveTranslationFor(6, lines, LIVE_OFF, 5)).toBeUndefined();
    expect(liveTranslationFor(undefined, lines, running, 5)).toBeUndefined();
  });
  it('keeps finished lines visible after translation is turned off', () => {
    const off = { ...LIVE_OFF, language: 'fa' };
    expect(liveTranslationFor(3, lines, off, 5)).toEqual({ language: 'fa', text: 'سلام' });
  });
  it('tracks the newest finished line', () => {
    expect(newestTranslated(lines)).toBe(5);
    expect(newestTranslated({})).toBe(-1);
  });
});

describe('savedTranslationFor', () => {
  const job: JobProgress = { meeting_id: 'm', language: 'en', done: 1, total: 3, state: 'running', error: null };
  it('only shows the chosen language', () => {
    expect(savedTranslationFor('t1', null, { t1: 'Hi' }, null)).toBeUndefined();
    expect(savedTranslationFor('t1', 'en', { t1: 'Hi' }, null)).toEqual({ language: 'en', text: 'Hi' });
  });
  it('shows a placeholder while that language is being translated', () => {
    expect(savedTranslationFor('t2', 'en', {}, job)).toEqual({ language: 'en', pending: true });
    expect(savedTranslationFor('t2', 'fa', {}, job)).toBeUndefined();
  });
});

describe('diarizedKey', () => {
  it('matches the key Rust stores for speaker-view lines', () => {
    expect(diarizedKey(7)).toBe('diarized-7');
  });
});

describe('recents', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
        },
      },
      configurable: true,
    });
  });
  it('starts with English and Persian and remembers new picks first', () => {
    expect(loadRecents()).toEqual(['en', 'fa']);
    expect(rememberLanguage('de')).toEqual(['de', 'en', 'fa']);
    expect(rememberLanguage('fa')).toEqual(['fa', 'de', 'en']);
    expect(loadRecents()).toEqual(['fa', 'de', 'en']);
  });
  it('offers the selected language first and skips excluded ones', () => {
    expect(pillLanguages(['de', 'en'], 'ja')).toEqual(['ja', 'de', 'en']);
    expect(pillLanguages(['en', 'fa'], null, ['en'])).toEqual(['fa']);
  });
});

describe('aiProblem', () => {
  it('sends setup problems to Settings', () => {
    expect(aiProblem('no_ai_configured')).toMatchObject({ title: 'No AI connected', needsSettings: true });
    expect(aiProblem('claude_code_not_logged_in').needsSettings).toBe(true);
  });
  it('shows other errors as they are', () => {
    expect(aiProblem('rate limited')).toMatchObject({ body: 'rate limited', needsSettings: false });
  });
});

describe('translation setting', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
        },
        dispatchEvent: () => true,
      },
      configurable: true,
    });
  });
  it('is on by default and remembers being switched off and on', async () => {
    const { loadTranslationEnabled, saveTranslationEnabled } = await import('@/lib/translation/enabled');
    expect(loadTranslationEnabled()).toBe(true);
    saveTranslationEnabled(false);
    expect(loadTranslationEnabled()).toBe(false);
    saveTranslationEnabled(true);
    expect(loadTranslationEnabled()).toBe(true);
  });
});
