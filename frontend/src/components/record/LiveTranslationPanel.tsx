'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useLiveTranslation } from '@/contexts/LiveTranslationContext';
import { Toggle } from '@/components/settings/primitives';
import { ConnectAiNotice } from '@/components/translation/ConnectAiNotice';
import { LanguagePills } from '@/components/translation/LanguagePills';
import { loadRecents } from '@/lib/translation/recents';

function Progress({ spin, children }: { spin: boolean; children: React.ReactNode }) {
  return (
    <p className="mt-2.5 flex items-center gap-2 text-[12px] text-zinc-600">
      {spin ? (
        <Loader2 size={12} className="animate-spin text-brand" aria-hidden="true" />
      ) : (
        <Check size={12} strokeWidth={3} className="text-brand" aria-hidden="true" />
      )}
      {children}
    </p>
  );
}

/** Popover body: on/off, target language, which AI does the work, progress. */
export function LiveTranslationPanel({ onNavigate }: { onNavigate: () => void }) {
  const { status, ai, start, stop } = useLiveTranslation();
  const [picked, setPicked] = useState<string>(() => status.language ?? loadRecents()[0]);
  const on = status.state === 'running' || status.state === 'preparing';
  const provider = status.provider ?? ai?.provider ?? 'your AI';

  if (ai && !ai.ready) {
    return (
      <div>
        <h4 className="text-[13.5px] font-semibold text-zinc-900">Live translation</h4>
        <ConnectAiNotice reason={ai.reason} onNavigate={onNavigate} />
      </div>
    );
  }

  const pick = (code: string) => {
    setPicked(code);
    if (on && code !== status.language) void start(code);
  };
  const backlog = status.backlog_total > 0;
  const backlogBusy = status.backlog_done < status.backlog_total;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[13.5px] font-semibold text-zinc-900">Live translation</h4>
        <Toggle
          checked={on}
          label="Live translation"
          onChange={(value) => void (value ? start(picked) : stop())}
        />
      </div>
      <p className="mt-3.5 text-[11.5px] font-semibold uppercase tracking-[0.3px] text-zinc-400">
        Translate to
      </p>
      <LanguagePills selected={on ? status.language : picked} onPick={pick} />
      <p className="mt-3.5 text-[12px] leading-[17px] text-zinc-500">
        Uses {provider}, the AI you picked for notes. Each line is sent as it is spoken.
      </p>
      {status.state === 'preparing' && <Progress spin>Getting ready</Progress>}
      {status.state === 'running' && backlog && (
        <Progress spin={backlogBusy}>
          {backlogBusy
            ? `Earlier lines: ${status.backlog_done} of ${status.backlog_total}, in the background`
            : 'Earlier lines translated'}
        </Progress>
      )}
      {status.state === 'error' && (
        <>
          <ConnectAiNotice reason={status.error} onNavigate={onNavigate} />
          <button
            type="button"
            onClick={() => void start(status.language ?? picked)}
            className="mt-2 text-[12.5px] font-medium text-teal-800 hover:text-brand"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
