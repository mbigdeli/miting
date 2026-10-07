'use client';

import { MdOutlineUploadFile } from 'react-icons/md';

interface RecordHeroProps {
  onStart: () => void;
  onImport: () => void;
  startDisabled?: boolean;
  isStarting?: boolean;
  /** Alerts (permissions, device errors) rendered under the hero content. */
  children?: React.ReactNode;
  /** Wider content under the hero column, such as the setup steps. */
  below?: React.ReactNode;
}

/**
 * Idle Record screen hero (mockup 2e): one job - start a recording. The
 * column is centered; when the content outgrows the window it scrolls from
 * the top instead of being clipped on both ends.
 */
export function RecordHero({ onStart, onImport, startDisabled, isStarting, children, below }: RecordHeroProps) {
  const disabled = startDisabled || isStarting;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-10">
      <div className="m-auto flex flex-col items-center">
        <div className="w-[440px] max-w-full text-center">
          <button
            type="button"
            title="Start recording"
            onClick={onStart}
            disabled={disabled}
            className={`mx-auto grid h-[88px] w-[88px] place-items-center rounded-full text-white transition-colors ${
              disabled ? 'cursor-not-allowed bg-zinc-300' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isStarting ? (
              <span className="h-[26px] w-[26px] animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
            ) : (
              <span className="block h-[26px] w-[26px] rounded-full bg-white" />
            )}
          </button>

          <h1 className="mt-[22px] text-2xl font-semibold tracking-[-0.3px] text-zinc-950">
            Start recording
          </h1>

          <div className="mt-6 flex items-center gap-2.5">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-[10.5px] font-bold tracking-[0.5px] text-zinc-400">OR</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            onClick={onImport}
            className="mt-4 inline-flex h-[38px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-900 hover:bg-zinc-50"
          >
            <MdOutlineUploadFile size={15} />
            Import an audio file
          </button>

          <p className="mt-2.5 text-[11.5px] text-zinc-400">or drop a file anywhere</p>

          {children}
        </div>
        {below}
      </div>
    </div>
  );
}
