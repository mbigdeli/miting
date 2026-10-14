'use client';

import { Merge } from 'lucide-react';
import { mergeTargets, type SpeakerInfo } from '@/lib/speakers';

interface PickerProps {
  speaker: SpeakerInfo;
  all: SpeakerInfo[];
  onPick: (into: string) => void;
}

/** "This is the same person as…" picker. The row asks for confirmation. */
export function SpeakerMergePicker({ speaker, all, onPick }: PickerProps) {
  const targets = mergeTargets(speaker.name, all);
  if (targets.length === 0) return null;
  return (
    <label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-md text-zinc-500 hover:bg-zinc-100" title="Same person as…">
      <Merge size={15} />
      <select
        aria-label={`Merge ${speaker.name} into another speaker`}
        value=""
        onChange={(e) => e.target.value && onPick(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Same person as…
        </option>
        {targets.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ConfirmProps {
  from: string;
  into: string;
  onMerge: () => void;
  onCancel: () => void;
}

/** Merging cannot be undone (short of a re-run), so it takes a second click. */
export function SpeakerMergeConfirm({ from, into, onMerge, onCancel }: ConfirmProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-2.5 py-2 text-[12px] text-zinc-600">
      <span>
        Merge <b>{from}</b> into <b>{into}</b>? All of their lines move to {into}.
      </span>
      <button type="button" onClick={onMerge} className="rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white">
        Merge
      </button>
      <button type="button" onClick={onCancel} className="px-1 text-zinc-500 hover:text-zinc-800">
        Cancel
      </button>
    </div>
  );
}

interface HintProps {
  into: string;
  evidence: string | null;
  onMerge: () => void;
  onDismiss: () => void;
}

/** The AI thinks this voice is another speaker; the user decides. */
export function SpeakerMergeHint({ into, evidence, onMerge, onDismiss }: HintProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
      <span className="text-amber-800">Same person as {into}?</span>
      {evidence && (
        <span dir="auto" className="truncate">
          &ldquo;{evidence}&rdquo;
        </span>
      )}
      <button type="button" onClick={onMerge} className="font-medium text-brand hover:underline">
        Merge
      </button>
      <button type="button" onClick={onDismiss} className="text-zinc-500 hover:text-zinc-800">
        Keep apart
      </button>
    </div>
  );
}
