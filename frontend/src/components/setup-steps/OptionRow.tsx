import { useId } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rowSubtitle } from '@/lib/setupSteps';
import { OptionAction } from './OptionAction';
import { OptionMark } from './OptionMark';
import type { StepRow } from './types';

interface OptionRowProps {
  row: StepRow;
  /** Home packs rows a little tighter so both steps fit under the hero. */
  compact?: boolean;
  /** Draw the hairline under this row. */
  separated?: boolean;
  /** Open the explanation above the row instead of below it. */
  tipUp?: boolean;
}

export function OptionRow({ row, compact, separated, tipUp }: OptionRowProps) {
  const { state } = row;
  const tipId = useId();
  const failedText = row.action === 'connect' ? 'Could not connect' : 'Download failed';

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3',
        compact ? 'px-3 py-2.5' : 'p-3',
        separated && 'border-b border-zinc-100',
      )}
    >
      <OptionMark kind={row.mark} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <strong className="text-[13.5px] font-semibold text-zinc-900">{row.title}</strong>
          {row.tag && (
            <span className="whitespace-nowrap rounded-[5px] border border-teal-200 bg-teal-50 px-1.5 py-px text-[10px] font-bold text-brand">
              {row.tag}
            </span>
          )}
          <button
            type="button"
            aria-label={`About ${row.title}`}
            aria-describedby={tipId}
            onKeyDown={(event) => event.key === 'Escape' && event.currentTarget.blur()}
            className="peer grid cursor-help place-items-center text-zinc-300 group-hover:text-zinc-500 focus-visible:text-zinc-500"
          >
            <Info className="h-[13px] w-[13px]" aria-hidden="true" />
          </button>
          <div
            id={tipId}
            role="tooltip"
            className={cn(
              'pointer-events-none absolute left-[54px] z-30 hidden w-[180px] rounded-lg bg-zinc-900 px-2.5 py-2 text-xs leading-[17px] text-white/85 shadow-lg peer-hover:block peer-focus-visible:block',
              tipUp ? 'bottom-full' : 'top-full',
            )}
          >
            {row.tip}
          </div>
        </div>
        {state.kind === 'downloading' ? (
          <div className="flex h-[19px] items-center">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, state.progress))}%` }}
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'truncate text-[12.5px]',
              state.kind === 'error' ? 'text-red-600' : 'text-zinc-500',
            )}
          >
            {state.kind === 'error' ? failedText : rowSubtitle(row.lead, row.size)}
          </div>
        )}
      </div>
      <OptionAction row={row} />
    </div>
  );
}
