import { Check, Download, ExternalLink, Link as LinkIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepRow } from './types';

const BUTTON =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-[13px] py-[7px] text-[12.5px] font-semibold transition-colors';
/** Same tinted style as Download in the Settings model cards. */
const GET = 'border-brand/25 bg-brand/[0.06] text-brand hover:bg-brand/10';
const SOLID = 'border-brand bg-brand text-white hover:bg-brand/90';

/** Right side of a row: the action, or what it is doing, or that it is done. */
export function OptionAction({ row }: { row: StepRow }) {
  const { state, action, act } = row;

  if (state.kind === 'downloading') {
    return (
      <span className="w-10 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-zinc-900">
        {Math.round(state.progress)}%
      </span>
    );
  }
  if (state.kind === 'connecting') {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 text-[12.5px] text-zinc-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        Connecting…
      </span>
    );
  }
  if (state.kind === 'done') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-green-600">
        <Check className="h-[15px] w-[15px]" strokeWidth={2.5} aria-hidden="true" />
        {action === 'connect' ? 'Connected' : 'Ready'}
      </span>
    );
  }
  if (state.kind === 'available') {
    return (
      <button type="button" onClick={act} className={cn(BUTTON, GET)}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        Use
      </button>
    );
  }
  if (state.kind === 'missingApp') {
    return (
      <button type="button" onClick={act} className={cn(BUTTON, GET)}>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Get the app
      </button>
    );
  }
  if (state.kind === 'error') {
    return (
      <button type="button" onClick={act} className={cn(BUTTON, GET)}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    );
  }

  const Icon = action === 'connect' ? LinkIcon : Download;
  return (
    <button type="button" onClick={act} className={cn(BUTTON, row.solid ? SOLID : GET)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {action === 'connect' ? 'Connect' : 'Download'}
    </button>
  );
}
