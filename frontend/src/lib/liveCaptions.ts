/**
 * Live Google Meet captions, merged by the row the app stored them in.
 *
 * Meet re-sends an utterance as it grows — "salam", "salam chetori", "salam
 * chetori khubi" — and the ingest server collapses those into one row. Keyed by
 * that row id, the line already on screen grows in place. Keyed by arrival, the
 * same sentence would stack up three times.
 *
 * Kept apart from the local engine's `transcript-update`: that listener drops
 * any sequence id it has seen before, which would pin a companion caption to
 * its first two words forever.
 */

export interface LiveCaption {
  /** `gmeet_captions.id` — stable across the rewrites of one utterance. */
  id: number;
  speaker: string | null;
  text: string;
  /** Recorder-relative seconds when the line first appeared. */
  at?: number;
}

/**
 * Fold one caption into the list, newest last.
 *
 * Returns the same array when nothing changed, so React can skip the render:
 * Meet emits several frames a second and most carry no new characters.
 */
export function mergeCaption(current: LiveCaption[], incoming: LiveCaption): LiveCaption[] {
  const text = incoming.text.trim();
  if (!text) return current;

  const at = current.findIndex((c) => c.id === incoming.id);
  if (at === -1) {
    return [...current, { ...incoming, text }];
  }

  const existing = current[at];
  if (existing.text === text && existing.speaker === incoming.speaker) {
    return current;
  }

  const next = current.slice();
  // Keep the FIRST at: a line is stamped when it began, not when it last grew.
  next[at] = { ...existing, speaker: incoming.speaker, text, at: existing.at ?? incoming.at };
  return next;
}

/**
 * Consecutive lines from one speaker read as one turn, which is how the
 * transcript is shown once the meeting is saved. Doing it here keeps the live
 * view and the saved view looking like the same thing.
 */
export function groupBySpeaker(captions: LiveCaption[]): { speaker: string | null; text: string }[] {
  const turns: { speaker: string | null; text: string }[] = [];
  for (const caption of captions) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === caption.speaker) {
      last.text = `${last.text} ${caption.text}`;
    } else {
      turns.push({ speaker: caption.speaker, text: caption.text });
    }
  }
  return turns;
}

/**
 * True only on the edge where a recording begins.
 *
 * The list used to be cleared whenever `isRecording` was true, which was every
 * time the Record screen mounted — so returning from Settings mid-call wiped
 * the lines already on screen. Clearing on the transition keeps one meeting's
 * captions apart from the next without punishing navigation.
 */
export function startsNewSession(previousIsRecording: boolean, isRecording: boolean): boolean {
  return isRecording && !previousIsRecording;
}
