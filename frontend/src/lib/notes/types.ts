/** Shapes shared with the Rust `ask` module (camelCase on the wire). */

/** Transcript text a note or question is about, with its start second. */
export interface Quote {
  quote: string;
  at: number;
}

export interface NoteCard {
  id: string;
  /** Recording clock in seconds; null for a note with no moment. */
  atSec: number | null;
  bodyHtml: string;
  quotes: Quote[];
  /** `user` typed it; `ask` is a saved Ask AI answer. */
  source: 'user' | 'ask';
  edited: boolean;
}

export interface AskMessage {
  id: string;
  askedAtSec: number | null;
  question: string;
  quotes: Quote[];
  answerMd: string | null;
  citations: number[];
  error: string | null;
  provider: string | null;
  model: string | null;
  savedNoteId: string | null;
}

/** A question in the panel: stored, or still waiting for its answer. */
export type AskItem = AskMessage & { pending?: boolean };

export interface EarlierSummary {
  text: string;
  untilSec: number;
}

/** A transcript line as the AI sees it. */
export interface AskLine {
  at: number | null;
  speaker?: string | null;
  text: string;
}

export interface AskReply {
  message: AskMessage;
  earlierSummary: EarlierSummary | null;
}

/** A transcript line on screen: its DOM key and start second. */
export interface LineRef {
  key: string;
  at: number | null;
}

export type ComposerMode = 'note' | 'ask';
