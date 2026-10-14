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

/** `mm:ss` from seconds; empty when unknown. */
export function formatTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
