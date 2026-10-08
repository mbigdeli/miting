'use client';

/**
 * Translation settings tab: one switch for the translate controls, plus which
 * AI does the work (the one chosen for notes).
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRouter } from 'next/navigation';
import { aiProblem } from '@/lib/translation/aiProblem';
import { saveTranslationEnabled, useTranslationEnabled } from '@/lib/translation/enabled';
import type { AiStatus } from '@/lib/translation/types';
import { RowText, SectionLabel, SettingRow, Toggle } from './primitives';

export function TranslationTab() {
  const router = useRouter();
  const enabled = useTranslationEnabled();
  const [ai, setAi] = useState<AiStatus | null>(null);

  useEffect(() => {
    invoke<AiStatus>('translation_ai_status').then(setAi).catch(() => setAi(null));
  }, []);

  return (
    <div>
      <SettingRow>
        <RowText
          title="Translation"
          desc="Translate while recording, and translate saved mitings into other languages"
        />
        <Toggle checked={enabled} onChange={saveTranslationEnabled} label="Translation" />
      </SettingRow>

      <SectionLabel>AI</SectionLabel>
      <SettingRow>
        {ai?.ready ? (
          <RowText title={ai.provider ?? 'Your AI'} desc="The AI you picked for notes does the translating." />
        ) : (
          <RowText
            title={aiProblem(ai?.reason ?? 'no_ai_configured').title}
            desc={aiProblem(ai?.reason ?? 'no_ai_configured').body}
          />
        )}
        <button
          type="button"
          onClick={() => router.push('/settings?tab=summaryModels')}
          className="h-9 shrink-0 rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-900 hover:bg-zinc-50"
        >
          {ai?.ready ? 'Change' : 'Connect an AI'}
        </button>
      </SettingRow>
    </div>
  );
}
