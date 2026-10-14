/**
 * Speaker labels while recording: the live speaker pass sends the current
 * picture after each chunk (`speakers-live`), and transcript lines read the
 * speaker for their moment from this small store.
 */
import { useSyncExternalStore } from 'react';
import { listen } from '@tauri-apps/api/event';
import { sideLabel, type SpeakerSide } from './speakers';

export interface LiveSpeakerTurn {
  start: number;
  end: number;
  speaker: string;
  side: SpeakerSide;
}

export const LIVE_SPEAKERS_EVENT = 'speakers-live';

/** A line this close to a turn still takes its speaker. */
const NEAR_SECS = 1.5;

/** Speaker with the most overlap with `[start, end)`, else the nearest turn. */
export function speakerAt(turns: LiveSpeakerTurn[], start: number, end: number): LiveSpeakerTurn | null {
  let best: LiveSpeakerTurn | null = null;
  let bestScore = -NEAR_SECS;
  for (const t of turns) {
    const overlap = Math.min(end, t.end) - Math.max(start, t.start);
    if (overlap > bestScore) {
      best = t;
      bestScore = overlap;
    }
  }
  return best;
}

/** "Speaker 2 · Remote" for a line, or null before the first chunk. */
export function liveTag(turns: LiveSpeakerTurn[], start: number, end: number): string | null {
  const t = speakerAt(turns, start, end);
  if (!t) return null;
  const side = sideLabel(t.side);
  return side ? `${t.speaker} · ${side}` : t.speaker;
}

let turns: LiveSpeakerTurn[] = [];
const subscribers = new Set<() => void>();
let started = false;

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  listen<LiveSpeakerTurn[]>(LIVE_SPEAKERS_EVENT, ({ payload }) => {
    turns = payload;
    subscribers.forEach((fn) => fn());
  }).catch(() => {
    started = false;
  });
}

function subscribe(fn: () => void) {
  start();
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Current live turns; re-renders when a new chunk is in. */
export function useLiveSpeakerTurns(): LiveSpeakerTurn[] {
  return useSyncExternalStore(subscribe, () => turns, () => turns);
}
