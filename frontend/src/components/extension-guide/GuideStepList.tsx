import React from 'react';
import { Check, Copy, ExternalLink, Loader2, PlayCircle, Square } from 'lucide-react';
import { guideSteps } from '@/lib/extensionGuide';
import type { GuideStep } from '@/lib/extensionDemo';
import { cn } from '@/lib/utils';
import { Key } from './Callout';

const ACTION =
  'mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.06] px-[13px] py-[7px] text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand/10';

export interface StepListProps {
  isMac: boolean;
  step: GuideStep;
  opened: boolean;
  copied: boolean;
  connected: boolean;
  playing: boolean;
  onSelect: (step: GuideStep) => void;
  onOpenChrome: () => void;
  onCopyPath: () => void;
  onShowInFinder: () => void;
  onTogglePlay: () => void;
}

/** "⌘ ⇧ G" in the Mac copy renders as three keys. */
function Detail({ text }: { text: string }) {
  const [before, after] = text.split('⌘ ⇧ G');
  if (after === undefined) return <>{text}</>;
  return (
    <>
      {before}
      <span className="whitespace-nowrap">
        <Key>⌘</Key><Key>⇧</Key><Key>G</Key>
      </span>
      {after}
    </>
  );
}

export function GuideStepList(p: StepListProps) {
  const copy = guideSteps(p.isMac);
  const done = [p.opened || p.connected, p.connected, p.connected];
  const actions: React.ReactNode[] = [
    <button key="open" type="button" className={ACTION} onClick={p.onOpenChrome}>
      <ExternalLink className="h-3.5 w-3.5" />
      {p.opened ? 'Open again' : 'Open Chrome'}
    </button>,
    null,
    <span key="copy" className="flex flex-wrap items-baseline gap-x-3">
      <button type="button" className={ACTION} onClick={p.onCopyPath}>
        {p.copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {p.copied ? 'Copied' : 'Copy folder path'}
      </button>
      {p.isMac && (
        <button type="button" onClick={p.onShowInFinder} className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
          Show in Finder
        </button>
      )}
    </span>,
  ];

  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-1.5 text-left">
      {copy.map((s, i) => {
        const n = (i + 1) as GuideStep;
        const on = p.step === n;
        return (
          <div key={s.title} className={cn('rounded-xl border px-3.5 py-3', on ? 'border-zinc-900 bg-white' : 'border-zinc-200 hover:bg-zinc-100')}>
            <button type="button" onClick={() => p.onSelect(n)} className="flex w-full items-start gap-3 text-left">
              <span className={cn('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px] font-semibold', done[i] ? 'bg-green-100 text-green-600' : 'bg-zinc-900 text-white')}>
                {done[i] ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold leading-5 text-zinc-900">{s.title}</strong>
                <span className="mt-0.5 block text-[12.5px] leading-[17px] text-zinc-500">
                  <Detail text={s.detail} />
                </span>
              </span>
            </button>
            {on && actions[i] && <div className="pl-[34px]">{actions[i]}</div>}
          </div>
        );
      })}
      <div className="mt-auto flex items-center justify-between gap-3 px-0.5 pt-2.5 text-[12.5px] leading-[17px]">
        {p.connected ? (
          <span className="flex items-center gap-1.5 font-semibold text-green-600">
            <Check className="h-[15px] w-[15px] shrink-0" strokeWidth={2.5} />
            Connected. Ready for your next Meet call.
          </span>
        ) : (
          <span className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Miting connects by itself when you finish.
          </span>
        )}
        <button type="button" onClick={p.onTogglePlay} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-zinc-500 hover:text-zinc-700">
          {p.playing ? <Square className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {p.playing ? 'Stop' : 'Show me how'}
        </button>
      </div>
    </div>
  );
}
