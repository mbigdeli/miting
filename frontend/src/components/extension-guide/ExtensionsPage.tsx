import React from 'react';
import { Check, Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DemoView } from '@/lib/extensionDemo';
import { MitingLogoTile } from '@/components/shell/MitingMark';
import { RING, Tag } from './Callout';

const PILL = 'relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full border bg-white px-4 py-[7px] text-[13px] font-medium text-[#0B57D0]';

/** Chrome's chrome://extensions page, light theme, drawn in HTML. */
export function ExtensionsPage({ view, callouts }: { view: DemoView; callouts: boolean }) {
  const point = (step: number) => callouts && view.step === step;
  return (
    <div className="px-5 text-[#1F1F1F]">
      <div className="flex h-14 items-center gap-4">
        <Menu className="h-5 w-5 text-[#444746]" />
        <span className="text-xl">Extensions</span>
        <span className="flex-1" />
        <Search className="h-[18px] w-[18px] text-[#444746]" />
        <span
          data-demo="dev"
          className={cn('relative inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px]', point(1) && RING)}
        >
          Developer mode
          <Toggle on={view.devOn} />
          {point(1) && <Tag side="right">Turn this on</Tag>}
        </span>
      </div>

      {view.devOn && (
        <div className="flex items-center gap-2 pb-[34px] pt-0.5">
          <span data-demo="load" className={cn(PILL, 'border-[#747775]', point(2) && RING)}>
            Load unpacked
            {point(2) && <Tag>Click here</Tag>}
          </span>
          <span className={cn(PILL, 'border-[#C4C7C5]')}>Pack extension</span>
          <span className={cn(PILL, 'border-[#C4C7C5]')}>Update</span>
        </div>
      )}

      <div className={cn('text-[15px]', view.devOn ? 'pt-1' : 'pt-9')}>All Extensions</div>
      <div data-demo="cards" className="mt-3 grid grid-cols-2 gap-3">
        {view.added ? <MitingCard /> : <PlaceholderCard widths={[60, 95, 70]} />}
        <PlaceholderCard widths={[50, 90, 60]} />
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  if (!on) {
    return (
      <span className="flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-[#747775] bg-white px-[3px]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#747775]" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-9 shrink-0 items-center justify-end rounded-full bg-[#0B57D0] px-0.5">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-white">
        <Check className="h-2.5 w-2.5 text-[#0B57D0]" strokeWidth={4} />
      </span>
    </span>
  );
}

function CardFoot() {
  const mini = 'rounded-full border border-[#C4C7C5] px-3 py-1 text-[11.5px] font-medium text-[#0B57D0]';
  return (
    <div className="mt-3.5 flex items-center gap-2">
      <span className={mini}>Details</span>
      <span className={mini}>Remove</span>
      <span className="ml-auto flex h-4 w-[30px] shrink-0 items-center justify-end rounded-full bg-[#0B57D0] px-0.5">
        <span className="h-3 w-3 rounded-full bg-white" />
      </span>
    </div>
  );
}

function PlaceholderCard({ widths }: { widths: [number, number, number] }) {
  return (
    <div className="rounded-[10px] border border-[#DADCE0] p-3.5">
      <div className="flex gap-3">
        <span className="h-8 w-8 shrink-0 rounded-lg bg-[#E8EAED]" />
        <span className="min-w-0 flex-1">
          <span className="block h-2.5 rounded bg-[#DADCE0]" style={{ width: `${widths[0]}%` }} />
          <span className="mt-2 block h-[7px] rounded bg-[#EDEEF0]" style={{ width: `${widths[1]}%` }} />
          <span className="mt-[5px] block h-[7px] rounded bg-[#EDEEF0]" style={{ width: `${widths[2]}%` }} />
        </span>
      </div>
      <CardFoot />
    </div>
  );
}

function MitingCard() {
  return (
    <div className="rounded-[10px] border border-[#DADCE0] p-3.5">
      <div className="flex gap-3">
        <MitingLogoTile size={32} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Miting Companion</span>
          <span className="mt-[3px] block text-[11px] leading-[15px] text-[#444746]">
            Captions and participants from Google Meet, kept on your computer.
          </span>
        </span>
      </div>
      <CardFoot />
    </div>
  );
}
