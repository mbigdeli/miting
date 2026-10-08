'use client';

import type { ReactNode } from 'react';
import { MdContentCopy, MdOutlineLanguage } from 'react-icons/md';
import { iconButtonClass } from './headerStyles';
import { RecordingControls } from './RecordingControls';

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
  /** Extra header control after the language button (live translation). */
  translation?: ReactNode;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Live recording header (mockup 2f): dot, title, timer, VU meter, pause + stop. */
export function RecordingHeader(props: RecordingHeaderProps) {
  const { isPaused, isActive, barHeights } = props;
  const busy = props.isStopping || props.isPausing || props.isResuming;

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-8 py-4">
      <span
        className={`h-[9px] w-[9px] shrink-0 rounded-full ${
          isPaused ? 'bg-amber-500' : 'bg-red-600'
        } ${isActive ? 'animate-pulse' : ''}`}
      />
      <span className="min-w-0 truncate text-[15px] font-semibold text-zinc-950">{props.title}</span>
      <span className="text-[13px] tabular-nums text-zinc-500">
        {formatDuration(props.durationSeconds)}
      </span>

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

      {props.showCopy && (
        <button type="button" title="Copy transcript" onClick={props.onCopy} className={iconButtonClass}>
          <MdContentCopy size={15} />
        </button>
      )}
      {props.showLanguage && (
        <button
          type="button"
          title="Transcription language"
          onClick={props.onLanguage}
          className={iconButtonClass}
        >
          <MdOutlineLanguage size={15} />
        </button>
      )}
      {props.translation}

      {props.showControls && (
        <RecordingControls
          isPaused={isPaused}
          isStopping={props.isStopping}
          busy={busy}
          onPauseResume={props.onPauseResume}
          onStop={props.onStop}
          isCompanionSession={props.isCompanionSession}
          onCompanionStopBlocked={props.onCompanionStopBlocked}
        />
      )}
    </div>
  );
}
