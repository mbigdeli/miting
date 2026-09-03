import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import type { TranscriptSegmentData } from '@/types';

/** "Jul 5, 2026 · 10:00" — matches the meta chips in the mockups. */
export function formatMeetingDate(createdAt: string): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

/**
 * Best-effort meeting duration from data already on the client. Uses the
 * diarized segments when present (always complete); otherwise the loaded raw
 * segments — but only when every page is loaded, so we never under-report.
 */
export function computeDurationSec(
  diarized: DiarizedSegment[],
  segments: TranscriptSegmentData[] | undefined,
  hasMore: boolean | undefined
): number | null {
  let max = 0;
  for (const s of diarized) {
    if (typeof s.end_sec === 'number') max = Math.max(max, s.end_sec);
    if (typeof s.start_sec === 'number') max = Math.max(max, s.start_sec);
  }
  if (max > 0) return max;
  if (hasMore || !segments) return null;
  for (const s of segments) {
    max = Math.max(max, s.endTime ?? s.timestamp ?? 0);
  }
  return max > 0 ? max : null;
}

/** "48m" / "1h 12m" / "45s" chip label. */
export function formatDurationShort(sec: number): string {
  const total = Math.round(sec);
  if (total < 60) return `${total}s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface SpeakerStat {
  name: string;
  initials: string;
  /** Share of talk time, 0..100 (integer). */
  share: number;
}

/** Talk-time share per speaker from the diarized transcript. */
export function speakerStats(diarized: DiarizedSegment[]): SpeakerStat[] {
  const weights = new Map<string, number>();
  for (const seg of diarized) {
    const name = seg.speaker_name?.trim() || 'Unknown';
    const spoken =
      typeof seg.end_sec === 'number' && typeof seg.start_sec === 'number'
        ? Math.max(seg.end_sec - seg.start_sec, 0)
        : Math.max(seg.text.length / 15, 1); // rough seconds fallback
    weights.set(name, (weights.get(name) ?? 0) + spoken);
  }
  const total = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  return Array.from(weights.entries())
    .map(([name, w]) => ({
      name,
      initials: initialsOf(name),
      share: total > 0 ? Math.round((w / total) * 100) : 0,
    }))
    .sort((a, b) => b.share - a.share);
}
