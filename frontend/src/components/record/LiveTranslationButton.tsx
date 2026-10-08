'use client';

import { useEffect, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLiveTranslation } from '@/contexts/LiveTranslationContext';
import { languageName } from '@/lib/translation/languages';
import { LiveTranslationPanel } from './LiveTranslationPanel';

/**
 * Header control for live translation: an icon when off (greyed when no AI
 * is connected), a teal pill naming the language when on.
 */
export function LiveTranslationButton() {
  const { status, ai, refreshAi } = useLiveTranslation();
  const [open, setOpen] = useState(false);
  const on = status.state === 'running' || status.state === 'preparing';

  useEffect(() => {
    void refreshAi();
  }, [refreshAi]);

  const trigger =
    on && status.language ? (
      <button
        type="button"
        title="Live translation"
        className="inline-flex h-9 items-center gap-[7px] rounded-lg border border-teal-200 bg-teal-50 px-3 text-[13px] font-medium text-teal-800 hover:bg-teal-100"
      >
        {status.state === 'preparing' ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Languages size={15} aria-hidden="true" />
        )}
        <span lang={status.language}>{languageName(status.language)}</span>
      </button>
    ) : (
      <button
        type="button"
        title="Live translation"
        aria-label="Live translation"
        className={`grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 ${
          ai && !ai.ready ? 'text-zinc-400' : 'text-zinc-900'
        }`}
      >
        <Languages size={16} aria-hidden="true" />
      </button>
    );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refreshAi();
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-[10px] border-zinc-200 bg-white p-4 font-inter text-zinc-950 shadow-[0_10px_30px_rgba(9,9,11,0.12)]"
      >
        <LiveTranslationPanel onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
