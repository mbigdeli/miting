import { Fragment, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { OptionRow } from './OptionRow';
import type { StepRow } from './types';

interface StepColumnProps {
  num: number;
  title: string;
  need: string;
  rows: StepRow[];
  /** The step has what it needs: its number turns into a check. */
  done: boolean;
  variant: 'onboarding' | 'home';
  /** Home only: show one summary line with Change instead of the rows. */
  collapsed?: { title: string; onChange: () => void };
  /** Home only: link to the matching Settings tab. */
  more?: { label: string; onClick: () => void };
  /** Home only: extra content under the step (the optional Google Meet step). */
  footer?: ReactNode;
}

export function StepColumn({ num, title, need, rows, done, variant, collapsed, more, footer }: StepColumnProps) {
  const home = variant === 'home';

  return (
    <div className="w-[384px] max-w-full text-left">
      <div className="flex items-center gap-2">
        {done ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-100 text-green-600">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          </span>
        ) : (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
            {num}
          </span>
        )}
        <strong className="text-sm font-semibold text-zinc-900">{title}</strong>
      </div>

      {collapsed ? (
        <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-900">
            {collapsed.title}
          </span>
          <button
            type="button"
            onClick={collapsed.onChange}
            className="shrink-0 text-xs font-medium text-brand hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2.5 mt-1 text-xs text-zinc-500">{need}</p>
          <div className="rounded-xl border border-zinc-200 bg-white p-2">
            {rows.map((row, index) => (
              <Fragment key={row.key}>
                {row.orBefore && (
                  <div className="flex items-center gap-2.5 px-3 py-1" aria-hidden="true">
                    <span className="h-px flex-1 bg-zinc-200" />
                    <span className="text-[10.5px] font-bold tracking-[0.5px] text-zinc-400">OR</span>
                    <span className="h-px flex-1 bg-zinc-200" />
                  </div>
                )}
                <OptionRow
                  row={row}
                  compact={home}
                  separated={index < rows.length - 1 && !rows[index + 1].orBefore}
                  tipUp={home || index > 0}
                />
              </Fragment>
            ))}
          </div>
          {more && (
            <button
              type="button"
              onClick={more.onClick}
              className="mt-2 flex w-full items-center justify-between rounded-[10px] border border-dashed border-zinc-300 px-3 py-[7px] text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-800"
            >
              {more.label}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </>
      )}
      {footer}
    </div>
  );
}
