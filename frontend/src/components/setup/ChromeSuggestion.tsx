import React from 'react';
import { Plus, X } from 'lucide-react';
import { ChromeMark } from '@/components/extension-guide/Callout';

interface Props {
  onAdd: () => void;
  onDismiss: () => void;
}

const ADD =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.06] px-[13px] py-[7px] text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand/10';
const CLOSE = 'grid shrink-0 place-items-center rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700';

function AddButton({ onAdd }: { onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd} className={ADD}>
      <Plus className="h-3.5 w-3.5" />
      Add to Chrome
    </button>
  );
}

function Tile() {
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-zinc-100">
      <ChromeMark />
    </span>
  );
}

/** Under the finished transcription step, while the model steps are open. */
export function MeetStep({ onAdd, onDismiss }: Props) {
  return (
    <div className="mt-[22px]">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-100">
          <ChromeMark size={14} />
        </span>
        <strong className="text-sm font-semibold text-zinc-900">Google Meet</strong>
        <span className="rounded-[5px] bg-zinc-100 px-1.5 py-px text-[10px] font-semibold text-zinc-500">Optional</span>
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className={`ml-auto ${CLOSE}`}>
          <X size={14} />
        </button>
      </div>
      <p className="mb-2.5 mt-1 text-xs text-zinc-500">Shows who said what in Meet calls.</p>
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
        <Tile />
        <span className="min-w-0 flex-1">
          <strong className="block text-[13.5px] font-semibold text-zinc-900">Miting for Chrome</strong>
          <span className="block truncate text-[12.5px] text-zinc-500">About a minute to add</span>
        </span>
        <AddButton onAdd={onAdd} />
      </div>
    </div>
  );
}

/** On its own under the record button, once the model steps are gone. */
export function ChromeCard({ onAdd, onDismiss }: Props) {
  return (
    <div className="mt-8 flex w-[560px] max-w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white py-3 pl-3.5 pr-3 text-left">
      <Tile />
      <span className="min-w-0 flex-1">
        <strong className="block text-[13.5px] font-semibold text-zinc-900">Using Google Meet?</strong>
        <span className="block text-[12.5px] text-zinc-500">Add Miting to Chrome to see who said what.</span>
      </span>
      <AddButton onAdd={onAdd} />
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className={CLOSE}>
        <X size={14} />
      </button>
    </div>
  );
}

/** Some days after closing, if the extension still never connected. */
export function ChromeReminder({ onAdd, onDismiss }: Props) {
  return (
    <div className="mt-7 flex items-center justify-center gap-2 text-[12.5px] text-zinc-500">
      <ChromeMark />
      <span>Miting is still not in Chrome, so Meet notes won&apos;t say who spoke.</span>
      <button type="button" onClick={onAdd} className="font-semibold text-brand hover:underline">
        Add to Chrome
      </button>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className={CLOSE}>
        <X size={14} />
      </button>
    </div>
  );
}
