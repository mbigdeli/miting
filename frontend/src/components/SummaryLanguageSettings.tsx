'use client';

/**
 * Summary language pills (mockup 3d): the pinned default pill is dark, other
 * languages are white pills, and a dashed Add pill opens the picker. Same
 * useRecentLanguages wiring (pin/unpin, remove, max 5) as the legacy card.
 */

import { useState } from 'react';
import { Pin, Plus } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { LanguagePickerPopover } from '@/components/LanguagePickerPopover';
import { useRecentLanguages } from '@/hooks/useRecentLanguages';
import { labelForCode } from '@/lib/summary-languages';

export function SummaryLanguageSettings() {
  const { recents, pinned, addRecent, removeRecent, setPinned } = useRecentLanguages();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      {recents.map((code) => {
        const isPinned = pinned === code;
        return (
          <span
            key={code}
            className={`inline-flex items-center overflow-hidden rounded-full border text-[12.5px] font-medium ${
              isPinned
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700'
            }`}
          >
            <button
              type="button"
              aria-pressed={isPinned}
              aria-label={
                isPinned
                  ? `Unpin ${labelForCode(code)} as default`
                  : `Pin ${labelForCode(code)} as default`
              }
              title={isPinned ? 'Click to unset as default' : 'Click to set as default'}
              onClick={() => setPinned(isPinned ? null : code)}
              className="flex items-center gap-1.5 py-[5px] pl-[11px] pr-1"
            >
              <Pin
                size={11}
                className={isPinned ? 'text-white' : 'text-zinc-400'}
                fill={isPinned ? 'currentColor' : 'none'}
              />
              {labelForCode(code)}
              {isPinned && <span className="font-normal opacity-80">· default</span>}
            </button>
            <button
              type="button"
              aria-label={`Remove ${labelForCode(code)}`}
              onClick={() => removeRecent(code)}
              className={`py-[5px] pl-0.5 pr-2.5 leading-none ${
                isPinned ? 'text-zinc-400 hover:text-white' : 'text-zinc-400 hover:text-zinc-700'
              }`}
            >
              ×
            </button>
          </span>
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={recents.length >= 5}
            className="inline-flex items-center gap-[5px] rounded-full border border-dashed border-zinc-300 px-[11px] py-[5px] text-[12.5px] font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={12} strokeWidth={2.2} /> Add
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-0 bg-transparent p-0 shadow-none">
          <LanguagePickerPopover
            mode="settings"
            value={null}
            onChange={(code) => {
              if (code) addRecent(code);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <span className="ml-1 text-[11.5px] text-zinc-400">{recents.length} / 5</span>
    </div>
  );
}
