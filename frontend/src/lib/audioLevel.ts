/**
 * Display mapping for microphone level meters. Raw levels are linear
 * amplitude (0..1); ears work in dB, so the bar maps dBFS [-60..0] onto
 * 0..100%. Normal speech lands around -30..-15 dBFS (50–75%).
 */

export function levelToPercent(linear: number): number {
  if (!Number.isFinite(linear) || linear <= 0) return 0;
  const db = 20 * Math.log10(Math.min(linear, 1));
  return Math.round(Math.max(0, Math.min(100, ((db + 60) / 60) * 100)));
}

/** Green = healthy, yellow = loud (≥ -18 dBFS), red = clipping risk (≥ -6 dBFS). */
export function levelColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent >= 90) return 'red';
  if (percent >= 70) return 'yellow';
  return 'green';
}

export const LEVEL_BAR_CLASS: Record<ReturnType<typeof levelColor>, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};
