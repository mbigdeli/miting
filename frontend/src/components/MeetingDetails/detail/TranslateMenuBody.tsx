'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { LanguagePills } from '@/components/translation/LanguagePills';
import type { MeetingTranslationsState } from '@/hooks/meeting-details/useMeetingTranslations';
import { languageName } from '@/lib/translation/languages';

const SECTION = 'px-2.5 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.3px] text-zinc-400';

function ShowOption({ label, lang, selected, meta, onPick }: {
  label: string;
  lang?: string;
  selected: boolean;
  meta?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-zinc-900 hover:bg-zinc-100"
    >
      <span className="w-3.5 shrink-0 text-brand">{selected && <Check size={14} aria-hidden="true" />}</span>
      <span lang={lang}>{label}</span>
      {meta && <span className="ml-auto text-[11.5px] text-zinc-400">{meta}</span>}
    </button>
  );
}

/** Show: which language appears under the lines. Below: add a language. */
export function TranslateMenuBody({ t, onDone }: { t: MeetingTranslationsState; onDone: () => void }) {
  const complete = t.languages.filter((l) => l.translated >= t.total).map((l) => l.language);
  const busy = t.job?.language;
  const [pick, setPick] = useState<string | null>(null);
  const existing = t.languages.find((l) => l.language === pick);
  const remaining = t.total - (existing?.translated ?? 0);

  return (
    <div>
      {t.languages.length > 0 && (
        <>
          <p className={SECTION}>Show</p>
          <ShowOption label="Original only" selected={!t.view} onPick={() => (t.setView(null), onDone())} />
          {t.languages.map((l) => (
            <ShowOption
              key={l.language}
              label={languageName(l.language)}
              lang={l.language}
              selected={t.view === l.language}
              meta={l.translated >= t.total ? 'saved' : `${l.translated}/${t.total}`}
              onPick={() => (t.setView(l.language), onDone())}
            />
          ))}
          <hr className="my-1.5 border-zinc-100" />
        </>
      )}
      <p className={SECTION}>{t.languages.length ? 'Add a language' : 'Translate to'}</p>
      <div className="px-2.5 pb-2.5">
        <LanguagePills
          selected={pick}
          onPick={setPick}
          exclude={[...complete, ...(busy ? [busy] : [])]}
        />
        <button
          type="button"
          disabled={!pick || !!t.job || t.total === 0}
          onClick={() => {
            if (!pick) return;
            void t.translate(pick);
            onDone();
          }}
          className="mt-2.5 flex h-[34px] w-full items-center justify-center rounded-lg bg-zinc-900 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900"
        >
          {pick ? `Translate ${remaining} lines to ${languageName(pick)}` : 'Pick a language'}
        </button>
        <p className="mt-2 text-[12px] leading-[17px] text-zinc-500">
          Uses {t.ai?.provider ?? 'your AI'}, the AI you picked for notes.
        </p>
      </div>
    </div>
  );
}
