'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

/** Summarizing-in-progress banner + skeleton (mockup 2v "Summarizing"). */
export function SummaryLoadingState({
  message,
  onStop,
}: {
  message?: string;
  onStop: () => void;
}) {
  return (
    <div>
      <div className="mt-5 flex items-center gap-2.5 rounded-[10px] border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-[13px] font-medium text-teal-800">
        <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-300 border-t-brand" />
        {message || 'Summarizing this miting… drafting decisions and action items'}
        <button
          type="button"
          onClick={onStop}
          className="ml-auto shrink-0 text-[12.5px] font-semibold text-teal-700 hover:text-teal-900"
        >
          Stop
        </button>
      </div>
      <div className="mt-5 grid gap-2.5" aria-hidden>
        <div className="h-3 w-full rounded-md bg-zinc-200/70" />
        <div className="h-3 w-[92%] rounded-md bg-zinc-200/70" />
        <div className="h-3 w-[78%] rounded-md bg-zinc-200/70" />
      </div>
      <div className="mt-6 h-[11px] w-28 rounded-md bg-zinc-200" aria-hidden />
      <div className="mt-3 grid gap-2" aria-hidden>
        {[60, 52].map((w) => (
          <div key={w} className="flex items-center gap-2.5">
            <span className="h-3.5 w-3.5 shrink-0 rounded bg-zinc-200" />
            <div className="h-[11px] rounded-md bg-zinc-200/70" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-6 h-[11px] w-24 rounded-md bg-zinc-200" aria-hidden />
      <div className="mt-3 grid gap-2" aria-hidden>
        {[44, 38].map((w) => (
          <div
            key={w}
            className="flex items-center gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3"
          >
            <span className="h-6 w-6 shrink-0 rounded-full bg-zinc-100" />
            <div className="h-[11px] rounded-md bg-zinc-200/70" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Summary failed state (mockup 2v "Summary failed"). */
export function SummaryErrorState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-10 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-50">
        <AlertTriangle size={24} className="text-red-600" />
      </span>
      <h2 className="text-base font-semibold text-zinc-900">Couldn&apos;t generate summary</h2>
      <p className="mt-1.5 max-w-[340px] text-[13.5px] leading-relaxed text-zinc-500">
        Something went wrong. Your recording and transcript are safe.
      </p>
      {error && <p className="mt-2 max-w-md break-words text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
      >
        <RotateCcw size={14} />
        Try again
      </button>
    </div>
  );
}
