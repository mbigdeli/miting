'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { checkName, type SpeakerInfo } from '@/lib/speakers';
import { rtlTextProps } from '@/lib/rtl';

interface Props {
  speaker: SpeakerInfo;
  all: SpeakerInfo[];
  onSave: (to: string) => void;
  onCancel: () => void;
}

/** Inline name field. Typing another speaker's name merges the two, so say so. */
export default function SpeakerNameEditor({ speaker, all, onSave, onCancel }: Props) {
  const [value, setValue] = useState(speaker.name_source === 'auto' ? '' : speaker.name);
  const check = checkName(value, speaker.name, all);
  const rtl = rtlTextProps(value);
  const save = () => check.ok && onSave(check.name);

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          dir={rtl.dir}
          value={value}
          placeholder={`Name for ${speaker.name}`}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') onCancel();
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] text-zinc-950 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={!check.ok}
          aria-label="Save name"
          className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white disabled:opacity-40"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="grid h-8 w-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
        >
          <X size={15} />
        </button>
      </div>
      {check.ok && check.merges && (
        <p className="text-[11.5px] text-amber-700">
          {check.name} already exists. Saving merges both into one speaker.
        </p>
      )}
    </div>
  );
}
