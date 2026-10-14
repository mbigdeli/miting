import type { AskItem, EarlierSummary, NoteCard } from './types';

/**
 * Notes and questions from the recording in progress. There is no saved
 * miting until the recording stops, so they live in the page and are
 * mirrored here (a reload or crash keeps them), then handed over at save.
 */
export interface LiveNotes {
  /** The recording they belong to (TranscriptContext's session id). */
  session: string;
  cards: NoteCard[];
  asks: AskItem[];
  earlier: EarlierSummary | null;
}

const KEY = 'miting.liveNotes';
export const LIVE_ASK_EVENT = 'miting:live-ask';
/** Questions sent and not yet answered, for this page session (survives navigation). */
const inflight = new Set<string>();

export function markInflight(id: string): void {
  inflight.add(id);
}

/**
 * An answer (or error) arrived. Written to storage even if the screen that
 * asked is gone, then announced so a screen shown again picks it up.
 */
export function resolveLiveAsk(session: string, id: string, patch: (a: AskItem) => AskItem, earlier?: EarlierSummary | null): void {
  const v = loadLive(session); // read while the question still counts as in flight
  inflight.delete(id);
  saveLive({ ...v, asks: v.asks.map((a) => (a.id === id ? patch(a) : a)), earlier: earlier ?? v.earlier });
  try {
    window.dispatchEvent(new CustomEvent(LIVE_ASK_EVENT, { detail: { session } }));
  } catch {
    // No window (tests): nothing is listening anyway.
  }
}

export function emptyLive(session: string): LiveNotes {
  return { session, cards: [], asks: [], earlier: null };
}

/** Stored notes for `session`, or a fresh set (stale ones are dropped). */
export function loadLive(session: string, storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): LiveNotes {
  try {
    const raw = storage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as LiveNotes) : null;
    if (v && v.session === session && Array.isArray(v.cards) && Array.isArray(v.asks)) {
      // A question still being answered by this app session stays; one left
      // over from a reload or crash will never get its answer.
      return { ...v, asks: v.asks.filter((a) => !a.pending || inflight.has(a.id)) };
    }
  } catch {
    // Unreadable: start over rather than block the recording.
  }
  return emptyLive(session);
}

export function saveLive(v: LiveNotes, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(v));
  } catch {
    // Storage full or blocked: notes still live in the page.
  }
}

/** Whatever was taken during the last recording (any session). */
export function peekLive(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): LiveNotes | null {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as LiveNotes) : null;
  } catch {
    return null;
  }
}

/** Forget the handed-over notes (only after they were stored). */
export function clearLive(storage: Pick<Storage, 'removeItem'> | undefined = safeStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to do: a stale set is dropped when the next recording starts.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
