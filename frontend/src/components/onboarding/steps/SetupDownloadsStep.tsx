import React from 'react';
import { toast } from 'sonner';
import { OnboardingContainer } from '../OnboardingContainer';
import { useIsMac } from '../shared/useIsMac';
import { onboardingStepCount } from '../shared/stepCount';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { continueLabel } from '@/lib/setupSteps';
import { STEP_COPY } from '@/components/setup-steps/options';
import { StepColumn } from '@/components/setup-steps/StepColumn';
import { useAiStep } from '@/components/setup-steps/useAiStep';
import { useTranscriptionStep } from '@/components/setup-steps/useTranscriptionStep';

/**
 * Setup step 3: pick at least one transcription model and one way to write
 * notes. Nothing downloads until the user asks, each pick is saved as soon
 * as it is made, and "Skip for now" leaves the same choices for Home.
 */
export function SetupDownloadsStep() {
  const { goNext } = useOnboarding();
  const isMac = useIsMac();
  const transcription = useTranscriptionStep({ selectOnStart: true });
  const ai = useAiStep();
  // A step is covered by a pick made here or by one that already works
  // (a model downloaded earlier, an API set up in Settings).
  const transcriptionCovered = transcription.chosen || transcription.ready;
  const aiCovered = ai.chosen || ai.ready;
  const ready = transcriptionCovered && aiCovered;

  // The Chrome extension step comes next; it finishes setup.
  const finish = () => {
    if (transcription.downloading) {
      toast.info('Downloads will continue in the background', { duration: 5000 });
    }
    goNext();
  };

  return (
    <OnboardingContainer title="Set up text and notes" step={3} totalSteps={onboardingStepCount(isMac)}>
      <div className="mt-8 flex items-start justify-center gap-4">
        <StepColumn
          {...STEP_COPY.transcription}
          rows={transcription.rows}
          done={transcription.ready}
          variant="onboarding"
        />
        <StepColumn
          {...STEP_COPY.ai}
          rows={ai.rows}
          done={ai.ready}
          variant="onboarding"
        />
      </div>

      <button
        type="button"
        onClick={finish}
        disabled={!ready}
        className="mt-7 flex h-11 min-w-[280px] items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        {continueLabel(transcriptionCovered, aiCovered)}
      </button>

      <button
        type="button"
        onClick={finish}
        className="mt-4 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
      >
        Skip for now
      </button>
    </OnboardingContainer>
  );
}
