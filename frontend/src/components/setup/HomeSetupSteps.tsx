'use client';

/**
 * Home's version of the onboarding setup steps, shown under the record button
 * until both steps are done. It cannot be closed before transcription works;
 * a finished step shrinks to one line with Change. The facts come from
 * `useHomeSetup`, so nothing renders until they are loaded.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { STEP_COPY } from '@/components/setup-steps/options';
import { StepColumn } from '@/components/setup-steps/StepColumn';
import { aiDoneTitle, canDismissHomeSteps, transcriptionDoneTitle } from '@/lib/setupSteps';
import type { HomeSetup } from './useHomeSetup';

export function HomeSetupSteps({ setup, meet }: {
  setup: HomeSetup;
  /** The optional Google Meet step, under the finished transcription step. */
  meet?: React.ReactNode;
}) {
  const router = useRouter();
  const { transcription, ai, open } = setup;
  const settings = (tab: string) => () => router.push(`/settings?tab=${tab}`);
  const tr = STEP_COPY.transcription;
  const notes = STEP_COPY.ai;

  return (
    <div className="relative mt-6 flex max-w-full flex-wrap items-start justify-center gap-4">
      <StepColumn
        num={tr.num}
        title={tr.title}
        need={transcription.ready ? tr.need : tr.needHome}
        rows={transcription.rows}
        done={transcription.ready}
        variant="home"
        collapsed={
          transcription.ready && !open.transcription
            ? { title: transcriptionDoneTitle(setup.provider), onChange: () => setup.reopen('transcription') }
            : undefined
        }
        more={{ label: tr.moreLabel, onClick: settings(tr.settingsTab) }}
        footer={meet}
      />
      <StepColumn
        num={notes.num}
        title={notes.title}
        need={ai.ready ? notes.need : notes.needHome}
        rows={ai.rows}
        done={ai.ready}
        variant="home"
        collapsed={
          ai.ready && !open.ai
            ? { title: aiDoneTitle(ai.provider), onChange: () => setup.reopen('ai') }
            : undefined
        }
        more={{ label: notes.moreLabel, onClick: settings(notes.settingsTab) }}
      />
      {canDismissHomeSteps(transcription.ready) && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => void setup.dismiss()}
          className="absolute -right-1 -top-0.5 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
