import React from 'react';
import { cn } from '@/lib/utils';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useIsMac } from '../shared/useIsMac';
import { onboardingStepCount } from '../shared/stepCount';

const STEPS = [
  {
    number: 1,
    title: 'Transcription engine',
    description: 'Turns speech into text',
  },
  {
    number: 2,
    title: 'Summarization engine',
    description: 'Writes summaries & action plans · or connect your own AI later',
  },
];

export function SetupOverviewStep() {
  const { goNext } = useOnboarding();
  const isMac = useIsMac();

  return (
    <OnboardingContainer
      title="Setup overview"
      description="Two AI models power Miting: one to transcribe, one to summarize and reason. Download both, or use your ChatGPT or Claude plan for summaries."
      step={2}
      totalSteps={onboardingStepCount(isMac)}
    >
      <div className="mt-8 w-full max-w-[440px] rounded-xl border border-zinc-200 bg-white p-2">
        {STEPS.map((step, index) => (
          <div
            key={step.number}
            className={cn(
              'flex items-center gap-[13px] px-3.5 py-3.5',
              index < STEPS.length - 1 && 'border-b border-zinc-100'
            )}
          >
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
              {step.number}
            </span>
            <div>
              <strong className="text-[13.5px] font-semibold text-zinc-900">{step.title}</strong>
              <div className="text-[12.5px] text-zinc-500">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={goNext}
        className="mt-7 h-11 w-[280px] rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Let&apos;s go
      </button>

      <a
        href="https://github.com/mbigdeli/miting/issues"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3.5 text-xs text-zinc-500 hover:underline"
      >
        Report issues on GitHub
      </a>
    </OnboardingContainer>
  );
}
