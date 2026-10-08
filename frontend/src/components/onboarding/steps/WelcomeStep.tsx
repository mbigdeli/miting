import React from 'react';
import { Lock, Languages, Github } from 'lucide-react';
import { RiOpenaiFill, RiClaudeFill } from 'react-icons/ri';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useIsMac } from '../shared/useIsMac';
import { onboardingStepCount } from '../shared/stepCount';
import { SUMMARY_LANGUAGE_COUNT } from '@/lib/summary-languages';

// Brand marks from RemixIcon, sized to read clearly at list scale.
function ChatGptGlyph() {
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-zinc-900">
      <RiOpenaiFill size={13} color="#fff" />
    </span>
  );
}

function ClaudeGlyph() {
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-[#D97757]">
      <RiClaudeFill size={13} color="#fff" />
    </span>
  );
}

const TILE = 'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-zinc-100';

export function WelcomeStep() {
  const { goNext } = useOnboarding();
  const isMac = useIsMac();

  const features: { icon: React.ReactNode; key: string; label: React.ReactNode }[] = [
    {
      icon: (
        <span className={TILE}>
          <Lock className="h-[15px] w-[15px] text-zinc-600" />
        </span>
      ),
      key: 'private',
      label: 'Private by default · recordings stay on your device',
    },
    {
      icon: (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center gap-px rounded-lg bg-zinc-100">
          <ChatGptGlyph />
          <ClaudeGlyph />
        </span>
      ),
      key: 'plan',
      label: 'Free AI with your own ChatGPT or Claude plan',
    },
    {
      icon: (
        <span className={TILE}>
          <Languages className="h-[15px] w-[15px] text-brand" />
        </span>
      ),
      key: 'languages',
      label: (
        <>
          {/* `bdi` isolates the RTL word so the bidi algorithm cannot drag the
              closing paren to the wrong side, and nowrap keeps the pair from
              breaking across lines, both of which mangled this line before. */}
          <span className="whitespace-nowrap">
            Persian (<bdi className="font-vazir">فارسی</bdi>)
          </span>{' '}
          &amp; English transcription · notes in {SUMMARY_LANGUAGE_COUNT} languages
        </>
      ),
    },
    {
      icon: (
        <span className={TILE}>
          <Github className="h-[15px] w-[15px] text-zinc-600" />
        </span>
      ),
      key: 'open-source',
      label: 'Free and open source',
    },
  ];

  return (
    <OnboardingContainer
      title="Welcome to Miting"
      description="Record, transcribe and summarize your mitings, privately, on your own machine."
      step={1}
      totalSteps={onboardingStepCount(isMac)}
      logo={
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-xl font-extrabold text-white">
          M
        </span>
      }
    >
      <div className="mt-8 grid w-full max-w-[400px] gap-4 rounded-xl border border-zinc-200 bg-white p-[22px]">
        {features.map((feature) => (
          <div key={feature.key} className="flex items-center gap-3 text-[13.5px] text-zinc-700">
            {feature.icon}
            {feature.label}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={goNext}
        className="mt-7 h-11 w-[280px] rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Get started
      </button>
    </OnboardingContainer>
  );
}
