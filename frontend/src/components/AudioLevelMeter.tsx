'use client';

/**
 * Live input-level meter for the Test Mic check. Levels arrive as linear
 * amplitude and render on a dB scale (lib/audioLevel) so speech reads in
 * the middle of the bar instead of hugging one end.
 */

import { LEVEL_BAR_CLASS, levelColor, levelToPercent } from '@/lib/audioLevel';

interface AudioLevelMeterProps {
  rmsLevel: number; // linear 0..1
  peakLevel: number; // linear 0..1
  isActive: boolean;
  deviceName: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const HEIGHTS = { small: 'h-1.5', medium: 'h-2', large: 'h-3' } as const;

export function AudioLevelMeter({
  rmsLevel,
  peakLevel,
  isActive,
  deviceName,
  className = '',
  size = 'medium',
}: AudioLevelMeterProps) {
  const rmsPercent = levelToPercent(rmsLevel);
  const peakPercent = levelToPercent(peakLevel);
  const barClass = LEVEL_BAR_CLASS[levelColor(rmsPercent)];
  const peakClass = LEVEL_BAR_CLASS[levelColor(peakPercent)];

  return (
    <div className={`flex items-center gap-2 ${className}`} title={deviceName}>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isActive ? 'animate-pulse bg-green-500' : 'bg-zinc-300'
        }`}
        title={`${deviceName} — ${isActive ? 'signal detected' : 'no signal'}`}
      />
      <div className={`relative min-w-0 flex-1 ${HEIGHTS[size]}`}>
        <div className="h-full w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full rounded-full ${barClass} transition-all duration-150 ease-out`}
            style={{ width: `${rmsPercent}%` }}
          />
        </div>
        {peakPercent > rmsPercent && (
          <span
            className={`absolute bottom-0 top-0 w-0.5 ${peakClass} transition-all duration-75`}
            style={{ left: `${peakPercent}%` }}
            title="Peak"
          />
        )}
      </div>
      <span className="min-w-[2.5rem] text-right font-mono text-xs tabular-nums text-zinc-500">
        {rmsPercent}%
      </span>
    </div>
  );
}
