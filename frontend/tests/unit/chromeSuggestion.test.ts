import { describe, expect, it } from 'vitest';
import {
  chromeSuggestion,
  REMIND_AFTER_MS,
  type ChromeSuggestionFacts,
} from '@/lib/chromeSuggestion';

const NOW = 1_800_000_000_000;
const base: ChromeSuggestionFacts = {
  loaded: true,
  everConnected: false,
  transcriptionDone: true,
  setupVisible: false,
  dismissedAt: null,
  now: NOW,
};
const at = (patch: Partial<ChromeSuggestionFacts>) => chromeSuggestion({ ...base, ...patch });

describe('chromeSuggestion', () => {
  it('waits for the facts before showing anything', () => {
    expect(at({ loaded: false })).toBe('hidden');
  });

  it('never shows once the extension has connected', () => {
    expect(at({ everConnected: true })).toBe('hidden');
    expect(at({ everConnected: true, dismissedAt: NOW - REMIND_AFTER_MS * 2 })).toBe('hidden');
  });

  it('stays out of the way until a transcription model works', () => {
    expect(at({ transcriptionDone: false, setupVisible: true })).toBe('hidden');
  });

  it('joins the setup steps while they are open, stands alone after', () => {
    expect(at({ setupVisible: true })).toBe('inline');
    expect(at({ setupVisible: false })).toBe('card');
  });

  it('hides after closing, then comes back as a reminder a week later', () => {
    expect(at({ dismissedAt: NOW - 1000 })).toBe('hidden');
    expect(at({ dismissedAt: NOW - REMIND_AFTER_MS + 1 })).toBe('hidden');
    expect(at({ dismissedAt: NOW - REMIND_AFTER_MS })).toBe('reminder');
  });
});
