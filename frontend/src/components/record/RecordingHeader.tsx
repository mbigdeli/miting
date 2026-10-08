'use client';

import { MdContentCopy, MdOutlineLanguage, MdPause, MdPlayArrow } from 'react-icons/md';

interface RecordingHeaderProps {
  title: string;
  durationSeconds: number | null;
  isPaused: boolean;
  /** Actively capturing audio (recording and not paused). */
  isActive: boolean;
  barHeights: string[];
  /** Show pause/stop controls (hidden while post-stop processing). */
  showControls: boolean;
  isStopping: boolean;
  isPausing: boolean;
  isResuming: boolean;
  onPauseResume: () => void;
  onStop: () => void;
  /** This session's transcript comes from Google Meet; stop lives there. */
  isCompanionSession: boolean;
  onCompanionStopBlocked: () => void;
  showCopy: boolean;
  onCopy: () => void;
  showLanguage: boolean;
  onLanguage: () => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const iconButtonClass =
  'grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400';

/** Live recording header (mockup 2f): dot, title, timer, VU meter, pause + stop. */
export function RecordingHeader({
  title,
  durationSeconds,
  isPaused,
  isActive,
  barHeights,
  showControls,
  isStopping,
  isPausing,
  isResuming,
  onPauseResume,
  onStop,
  isCompanionSession,
  onCompanionStopBlocked,
  showCopy,
  onCopy,
  showLanguage,
  onLanguage,
}: RecordingHeaderProps) {
  const busy = isStopping || isPausing || isResuming;

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-8 py-4">
      <span
        className={`h-[9px] w-[9px] shrink-0 rounded-full ${
          isPaused ? 'bg-amber-500' : 'bg-red-600'
        } ${isActive ? 'animate-pulse' : ''}`}
      />
      <span className="min-w-0 truncate text-[15px] font-semibold text-zinc-950">{title}</span>
      <span className="text-[13px] tabular-nums text-zinc-500">{formatDuration(durationSeconds)}</span>

      {/* VU / level meter (animated while actively capturing) */}
      <div className="flex h-[18px] items-end gap-[3px]" aria-hidden="true">
        {barHeights.map((height, index) => (
          <span
            key={index}
            className={`w-1 rounded-full transition-all duration-200 ${
              isPaused ? 'bg-amber-500 opacity-60' : 'bg-red-600'
            }`}
            style={{ height: isActive ? height : '4px' }}
          />
        ))}
      </div>

      <div className="flex-1" />

      {showCopy && (
        <button type="button" title="Copy transcript" onClick={onCopy} className={iconButtonClass}>
          <MdContentCopy size={15} />
        </button>
      )}
      {showLanguage && (
        <button type="button" title="Transcription language" onClick={onLanguage} className={iconButtonClass}>
          <MdOutlineLanguage size={15} />
        </button>
      )}

      {showControls && (
        <>
          <button
            type="button"
            title={isPaused ? 'Resume recording' : 'Pause recording'}
            onClick={onPauseResume}
            disabled={busy}
            className={iconButtonClass}
          >
            {isPaused ? <MdPlayArrow size={16} /> : <MdPause size={16} />}
          </button>
          <button
            type="button"
            onClick={isCompanionSession ? onCompanionStopBlocked : onStop}
            disabled={busy}
            aria-disabled={isCompanionSession}
            title={
              isCompanionSession
                ? 'This miting is recorded from Google Meet. Stop it from the Meet tab in Chrome.'
                : undefined
            }
            className={`inline-flex h-9 items-center gap-[7px] rounded-lg px-3.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400 ${
              isCompanionSession
                ? 'cursor-not-allowed bg-zinc-400'
                : 'bg-zinc-900 hover:bg-zinc-800'
            }`}
          >
            <span className="block h-[11px] w-[11px] rounded-[2px] bg-white" />
            {isStopping ? 'Stopping…' : 'Stop'}
          </button>
        </>
      )}
    </div>
  );
}
