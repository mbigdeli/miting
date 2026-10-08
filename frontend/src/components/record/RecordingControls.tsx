'use client';

import { MdPause, MdPlayArrow } from 'react-icons/md';
import { iconButtonClass } from './headerStyles';

interface RecordingControlsProps {
  isPaused: boolean;
  isStopping: boolean;
  /** Pause, resume or stop is in progress. */
  busy: boolean;
  onPauseResume: () => void;
  onStop: () => void;
  /** This session's transcript comes from Google Meet; stop lives there. */
  isCompanionSession: boolean;
  onCompanionStopBlocked: () => void;
}

/** Pause/resume and Stop, the right end of the live recording header. */
export function RecordingControls({
  isPaused,
  isStopping,
  busy,
  onPauseResume,
  onStop,
  isCompanionSession,
  onCompanionStopBlocked,
}: RecordingControlsProps) {
  return (
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
          isCompanionSession ? 'cursor-not-allowed bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-800'
        }`}
      >
        <span className="block h-[11px] w-[11px] rounded-[2px] bg-white" />
        {isStopping ? 'Stopping…' : 'Stop'}
      </button>
    </>
  );
}
