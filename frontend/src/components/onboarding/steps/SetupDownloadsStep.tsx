import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OnboardingContainer } from '../OnboardingContainer';
import { useIsMac } from '../shared/useIsMac';
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
  const { goNext, completeOnboarding } = useOnboarding();
  const isMac = useIsMac();
  const transcription = useTranscriptionStep({ selectOnStart: true });
  const ai = useAiStep();
  const [isCompleting, setIsCompleting] = useState(false);
  // A step is covered by a pick made here or by one that already works
  // (a model downloaded earlier, an API set up in Settings).
  const transcriptionCovered = transcription.chosen || transcription.ready;
  const aiCovered = ai.chosen || ai.ready;
  const ready = transcriptionCovered && aiCovered;

  const finish = async () => {
    if (transcription.downloading) {
      toast.info('Downloads will continue in the background', { duration: 5000 });
    }
    if (isMac) {
      goNext();
      return;
    }
    setIsCompleting(true);
    try {
      await completeOnboarding();
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete setup', { description: 'Please try again.' });
      setIsCompleting(false);
    }
  };

  return (
    <OnboardingContainer title="Set up text and notes" step={3} totalSteps={isMac ? 4 : 3}>
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
        onClick={() => void finish()}
        disabled={!ready || isCompleting}
        className="mt-7 flex h-11 min-w-[280px] items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          continueLabel(transcriptionCovered, aiCovered)
        )}
      </button>

      <button
        type="button"
        onClick={() => void finish()}
        disabled={isCompleting}
        className="mt-4 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
      >
        Skip for now
      </button>
    </OnboardingContainer>
  );
}
