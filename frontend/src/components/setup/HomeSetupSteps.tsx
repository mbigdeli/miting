'use client';

/**
 * Home's version of the onboarding setup steps, shown under the record button
 * until both steps are done. It cannot be closed before transcription works;
 * a finished step shrinks to one line with Change. Nothing renders until the
 * facts are loaded, so a set up user never sees it flash.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { STEP_COPY } from '@/components/setup-steps/options';
import { StepColumn } from '@/components/setup-steps/StepColumn';
import { useAiStep } from '@/components/setup-steps/useAiStep';
import { useTranscriptionStep } from '@/components/setup-steps/useTranscriptionStep';
import {
  aiDoneTitle,
  canDismissHomeSteps,
  homeStepsVisible,
  transcriptionDoneTitle,
} from '@/lib/setupSteps';
import { useHomeStepsState } from './useHomeStepsState';

export function HomeSetupSteps() {
  const router = useRouter();
  const { transcriptModelConfig } = useConfig();
  const transcription = useTranscriptionStep();
  const ai = useAiStep();
  const home = useHomeStepsState();
  const [open, setOpen] = useState({ transcription: false, ai: false });

  // A step opened with Change folds up again once the new choice lands.
  const transcriptionChoice = `${transcriptModelConfig?.provider}:${transcriptModelConfig?.model}`;
  useEffect(() => setOpen((value) => ({ ...value, transcription: false })), [transcriptionChoice]);
  useEffect(() => setOpen((value) => ({ ...value, ai: false })), [ai.provider, ai.ready]);

  if (!transcription.loaded || !ai.loaded || !home.loaded) return null;
  const visible = homeStepsVisible({
    transcriptionDone: transcription.ready,
    aiDone: ai.ready,
    dismissed: home.dismissed,
  });
  if (!visible) return null;

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
            ? {
                title: transcriptionDoneTitle(transcriptModelConfig?.provider),
                onChange: () => setOpen((value) => ({ ...value, transcription: true })),
              }
            : undefined
        }
        more={{ label: tr.moreLabel, onClick: settings(tr.settingsTab) }}
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
            ? { title: aiDoneTitle(ai.provider), onChange: () => setOpen((value) => ({ ...value, ai: true })) }
            : undefined
        }
        more={{ label: notes.moreLabel, onClick: settings(notes.settingsTab) }}
      />
      {canDismissHomeSteps(transcription.ready) && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => void home.dismiss()}
          className="absolute -right-1 -top-0.5 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
