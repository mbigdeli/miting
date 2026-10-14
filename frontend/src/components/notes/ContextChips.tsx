'use client';

import { X } from 'lucide-react';
import { clock } from '@/lib/notes/detect';
import type { Quote } from '@/lib/notes/types';

/** Selected transcript text attached to the next note or question. */
export function ContextChips({ chips, onRemove }: { chips: Quote[]; onRemove: (i: number) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="mb-2 ml-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-zinc-400">
      {chips.map((c, i) => (
        <span
          key={`${c.at}-${i}`}
          className="inline-flex max-w-[280px] items-center gap-1.5 rounded-lg border border-[#E6E8EF] bg-[#F7F8FB] py-0.5 pl-2 pr-1 text-[12px] text-[#4B5162]"
        >
          <span className="tabular-nums text-zinc-400">{clock(c.at)}</span>
          <span className="truncate" dir="auto">
            “{c.quote}”
          </span>
          <button
            type="button"
            aria-label="Remove selected text"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onRemove(i)}
            className="rounded px-0.5 text-zinc-400 hover:text-zinc-700"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <span>select more to add</span>
    </div>
  );
}
