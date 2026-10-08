import type { JobProgress, LiveStatus, SegmentTranslation } from './types';

/**
 * What to show under a live line: its translation, a placeholder while the
 * live or background pass will still reach it, or nothing.
 */
export function liveTranslationFor(
  seq: number | undefined,
  lines: Record<number, string>,
  status: LiveStatus,
  newestDone: number
): SegmentTranslation | undefined {
  const language = status.language;
  if (!language || seq === undefined) return undefined;
  const text = lines[seq];
  if (text) return { language, text };
  if (status.state === 'preparing') return { language, pending: true };
  if (status.state !== 'running') return undefined;
  const backlogBusy = status.backlog_done < status.backlog_total;
  return seq > newestDone || backlogBusy ? { language, pending: true } : undefined;
}

/** Highest sequence id with a finished translation (or -1). */
export function newestTranslated(lines: Record<number, string>): number {
  let max = -1;
  for (const key of Object.keys(lines)) max = Math.max(max, Number(key));
  return max;
}

/** What to show under a saved line in the chosen view language. */
export function savedTranslationFor(
  key: string,
  view: string | null,
  lines: Record<string, string>,
  job: JobProgress | null
): SegmentTranslation | undefined {
  if (!view) return undefined;
  const text = lines[key];
  if (text) return { language: view, text };
  if (job && job.language === view && job.state === 'running') return { language: view, pending: true };
  return undefined;
}

/** Storage key of a speaker-view line; matches `diarized_key` in Rust. */
export function diarizedKey(seq: number): string {
  return `diarized-${seq}`;
}
