/**
 * Speaker identification (doc 18): types and pure helpers for the meeting
 * page's Speakers card. Commands live in `speakersApi.ts`.
 */

/** Who chose a speaker's current name. `meet` = Google Meet captions. */
export type NameSource = 'auto' | 'ai' | 'user' | 'meet';

export interface SpeakerInfo {
  name: string;
  label: string | null;
  name_source: NameSource;
  ai_evidence: string | null;
  speech_secs: number;
  segment_count: number;
  sample_start_sec: number | null;
  sample_end_sec: number | null;
  /** Heard through the microphone or the call; null for older recordings. */
  side?: SpeakerSide | null;
  /** Name of the speaker the AI thinks this voice is, with its quote. */
  merge_into?: string | null;
  merge_evidence?: string | null;
}

export type SpeakerSide = 'room' | 'remote';

/** Tag for a voice heard on the call; room voices are the default and need none. */
export function sideLabel(side: SpeakerSide | null | undefined): string | null {
  return side === 'remote' ? 'Remote' : null;
}

export type SpeakerStage = 'listening' | 'naming' | 'done' | 'failed';

export interface SpeakerStatus {
  meeting_id: string;
  stage: SpeakerStage;
  message?: string;
}

export const SPEAKERS_STATUS_EVENT = 'speakers-status';

/** Progress line while a run is going, or null when idle. */
export function stageText(stage: SpeakerStage | null): string | null {
  if (stage === 'listening') return 'Telling voices apart on this computer…';
  if (stage === 'naming') return 'Looking for names in the transcript…';
  return null;
}

/** Names from Google Meet are real; acoustic re-runs must not replace them. */
export function hasMeetNames(speakers: SpeakerInfo[]): boolean {
  return speakers.some((s) => s.name_source === 'meet');
}

/** True when this meeting's speakers came from the local voice analysis. */
export function isAcoustic(speakers: SpeakerInfo[]): boolean {
  return speakers.length > 0 && !hasMeetNames(speakers);
}

/** Talk-time share per speaker, 0..100, rounded. */
export function talkShare(speaker: SpeakerInfo, all: SpeakerInfo[]): number {
  const total = all.reduce((sum, s) => sum + Math.max(s.speech_secs, 0), 0);
  return total > 0 ? Math.round((Math.max(speaker.speech_secs, 0) / total) * 100) : 0;
}

export type NameCheck = { ok: true; name: string; merges: boolean } | { ok: false; error: string };

/**
 * Validate a typed name. Reusing another speaker's name is allowed: it merges
 * the two (the backend folds them together), so the UI can say so first.
 */
export function checkName(input: string, current: string, all: SpeakerInfo[]): NameCheck {
  const name = input.trim();
  if (!name) return { ok: false, error: 'Type a name.' };
  if ([...name].length > 80) return { ok: false, error: 'Names can be at most 80 characters.' };
  const merges = name !== current && all.some((s) => s.name === name);
  return { ok: true, name, merges };
}

/** Speakers a given one can be merged into (everyone else). */
export function mergeTargets(current: string, all: SpeakerInfo[]): string[] {
  return all.filter((s) => s.name !== current).map((s) => s.name);
}

/** Short badge for a name's origin, or null for nothing to show. */
export function sourceBadge(source: NameSource): string | null {
  if (source === 'ai') return 'AI suggestion';
  if (source === 'meet') return 'From Google Meet';
  return null;
}
