'use client';

import { useState } from 'react';
import { ChevronDown, Languages, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConnectAiNotice } from '@/components/translation/ConnectAiNotice';
import type { MeetingTranslationsState } from '@/hooks/meeting-details/useMeetingTranslations';
import { languageName } from '@/lib/translation/languages';
import { TranslateMenuBody } from './TranslateMenuBody';

/**
 * "Translate" in the transcript search row: translate a saved miting into any
 * number of languages and choose which one shows under each line.
 */
export function TranslateMenu({ t }: { t: MeetingTranslationsState }) {
  const [open, setOpen] = useState(false);
  const active = !!t.view;

  return (
    <>
      {t.job && (
        <span className="inline-flex h-9 shrink-0 items-center gap-2 px-1 text-[12.5px] text-teal-800">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          <span lang={t.job.language}>{languageName(t.job.language)}</span>
          <span className="tabular-nums">
            {t.job.done}/{t.job.total}
          </span>
          <button type="button" onClick={t.cancel} className="font-medium text-zinc-500 hover:text-zinc-800">
            Stop
          </button>
        </span>
      )}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void t.refreshAi();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex h-9 shrink-0 items-center gap-[7px] rounded-lg border px-3 text-[13px] font-medium transition-colors ${
              active
                ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <Languages size={15} aria-hidden="true" />
            <span lang={t.view ?? undefined}>{t.view ? languageName(t.view) : 'Translate'}</span>
            <ChevronDown size={14} className="opacity-60" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[300px] rounded-[10px] border-zinc-200 bg-white p-1.5 font-inter text-zinc-950 shadow-[0_10px_30px_rgba(9,9,11,0.12)]"
        >
          {t.ai && !t.ai.ready ? (
            <div className="p-2.5">
              <ConnectAiNotice reason={t.ai.reason} onNavigate={() => setOpen(false)} />
            </div>
          ) : (
            <TranslateMenuBody t={t} onDone={() => setOpen(false)} />
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
