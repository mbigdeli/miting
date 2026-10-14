import type { ComposerMode } from './types';

const QUESTION_START =
  /^(what|who|whom|whose|why|how|when|where|which|did|does|do|is|are|was|were|can|could|should|would|will|summari[sz]e|draft|list|explain|چه|چرا|کی|کجا|آیا|چطور|چگونه|چند|کدام)(\s|$)/i;

/** A question goes to Ask AI; anything else is a note. */
export function detectMode(text: string): ComposerMode {
  const t = text.trim();
  if (!t) return 'note';
  if (/[?؟]\s*$/.test(t)) return 'ask';
  return QUESTION_START.test(t) ? 'ask' : 'note';
}

/** `mm:ss`, or `h:mm:ss` past the hour (same as Rust `clock`). */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Seconds of a `mm:ss` / `h:mm:ss` text, or null. */
export function parseClock(text: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [h, mm, ss] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (ss >= 60 || (m[1] !== undefined && mm >= 60)) return null;
  return h * 3600 + mm * 60 + ss;
}

/** `[mm:ss]` citations as Markdown links (`#t=<sec>`) the answer view turns into chips. */
export function linkTimes(md: string): string {
  return md.replace(/\[(\d{1,2}(?::\d{2}){1,2})\](?!\()/g, (m, t: string) => {
    const sec = parseClock(t);
    return sec === null ? m : `[${t}](#t=${sec})`;
  });
}
