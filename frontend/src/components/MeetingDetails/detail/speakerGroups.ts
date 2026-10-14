import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';

// Speaker pill styles; a speaker's color is stable across the meeting (hash of name).
const CHIP_STYLES = [
  'bg-zinc-100 text-zinc-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
];

export function chipFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CHIP_STYLES[Math.abs(hash) % CHIP_STYLES.length];
}

export function formatTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export interface SpeakerGroup {
  name: string;
  startSec: number | null;
  lines: { seq: number; text: string; startSec: number | null }[];
}

/** Merge consecutive segments from the same speaker into one reading block. */
export function groupBySpeaker(segments: DiarizedSegment[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  for (const seg of segments) {
    const name = seg.speaker_name?.trim() || 'Unknown';
    const last = groups[groups.length - 1];
    if (last && last.name === name) {
      last.lines.push({ seq: seg.seq, text: seg.text, startSec: seg.start_sec ?? null });
    } else {
      groups.push({
        name,
        startSec: seg.start_sec ?? null,
        lines: [{ seq: seg.seq, text: seg.text, startSec: seg.start_sec ?? null }],
      });
    }
  }
  return groups;
}
