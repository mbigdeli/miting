'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { languageName, TRANSLATION_LANGUAGES } from '@/lib/translation/languages';
import { loadRecents, pillLanguages } from '@/lib/translation/recents';

const PILL =
  'inline-flex h-[30px] items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors';

interface LanguagePillsProps {
  selected: string | null;
  onPick: (code: string) => void;
  /** Languages not to offer (e.g. already translated). */
  exclude?: string[];
}

/** Recent languages as pills, plus "More" to search every language. */
export function LanguagePills({ selected, onPick, exclude = [] }: LanguagePillsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pills = pillLanguages(loadRecents(), selected, exclude);
  const others = TRANSLATION_LANGUAGES.filter((o) => !exclude.includes(o.code));

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {pills.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => onPick(code)}
          className={`${PILL} ${
            code === selected
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          {languageName(code)}
        </button>
      ))}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`${PILL} border-dashed border-zinc-300 bg-white font-normal text-zinc-500 hover:bg-zinc-100`}>
            <Plus size={13} aria-hidden="true" />
            More
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search languages" />
            <CommandList className="max-h-64">
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {others.map((o) => (
                  <CommandItem
                    key={o.code}
                    value={`${o.label} ${languageName(o.code)} ${o.code}`}
                    onSelect={() => {
                      onPick(o.code);
                      setMoreOpen(false);
                    }}
                  >
                    <span className="flex-1">{o.label}</span>
                    <span lang={o.code} className="text-zinc-400">
                      {languageName(o.code)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
