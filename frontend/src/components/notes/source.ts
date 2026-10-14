import type { AskLine } from '@/lib/notes/types';

/** Where notes live: a saved miting, or the recording in progress. */
export type NotesSource =
  | { live: false; meetingId: string }
  | {
      live: true;
      /** The recording's session id (cleared notes from another session are dropped). */
      session: string;
      title: string;
      /** The lines on screen, for live questions. */
      lines: () => AskLine[];
      /** The recording clock in seconds. */
      clock: () => number;
    };

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
