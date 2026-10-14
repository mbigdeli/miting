import type { LineRef, NoteCard } from './types';

/** Where a card sits: its first quote, else the moment it was written. */
export function cardMoment(card: NoteCard): number | null {
  return card.quotes[0]?.at ?? card.atSec;
}

/** Key of the last line that starts at or before `sec` (first line if none). */
export function lineAt(lines: LineRef[], sec: number): string | null {
  let found: string | null = null;
  for (const l of lines) {
    if (l.at === null) continue;
    if (l.at <= sec + 0.5) found = l.key;
    else break;
  }
  return found ?? lines.find((l) => l.at !== null)?.key ?? lines[0]?.key ?? null;
}

/** Cards grouped under the line they belong to; cards with no moment go last. */
export function cardsByLine(lines: LineRef[], cards: NoteCard[]): Map<string, NoteCard[]> {
  const out = new Map<string, NoteCard[]>();
  const last = lines[lines.length - 1]?.key;
  const sorted = [...cards].sort((a, b) => (cardMoment(a) ?? Infinity) - (cardMoment(b) ?? Infinity));
  for (const card of sorted) {
    const at = cardMoment(card);
    const key = at === null ? last : lineAt(lines, at);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), card]);
  }
  return out;
}

/** The line being played at `sec`, or null before playback starts. */
export function playingLine(lines: LineRef[], sec: number): string | null {
  if (sec <= 0) return null;
  let found: string | null = null;
  for (const l of lines) {
    if (l.at === null) continue;
    if (l.at <= sec) found = l.key;
    else break;
  }
  return found;
}
