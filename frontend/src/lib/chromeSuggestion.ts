/**
 * Where Home suggests adding the Chrome extension, if at all.
 *
 * One thing at a time: nothing until a transcription model works. While the
 * model setup steps are still open, it sits under the finished transcription
 * step; on its own it is a row under the record button. Closing it is not
 * forever: if the extension still has not connected some days later, a one
 * line reminder comes back.
 */

export type ChromeSuggestion = 'hidden' | 'inline' | 'card' | 'reminder';

export const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChromeSuggestionFacts {
  loaded: boolean;
  everConnected: boolean;
  transcriptionDone: boolean;
  /** The Home model setup steps are on screen. */
  setupVisible: boolean;
  /** When the user last closed the suggestion, in ms. */
  dismissedAt: number | null;
  now: number;
}

export function chromeSuggestion(f: ChromeSuggestionFacts): ChromeSuggestion {
  if (!f.loaded || f.everConnected || !f.transcriptionDone) return 'hidden';
  if (f.dismissedAt === null) return f.setupVisible ? 'inline' : 'card';
  return f.now - f.dismissedAt >= REMIND_AFTER_MS ? 'reminder' : 'hidden';
}
