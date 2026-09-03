import React from 'react';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './shared/ProgressIndicator';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { OnboardingContainerProps } from '@/types/onboarding';

interface ContainerProps extends OnboardingContainerProps {
  /** Optional brand mark rendered between the step rail and the title (Welcome step). */
  logo?: React.ReactNode;
}

/**
 * Full-screen onboarding frame: zinc-50 canvas, centered column,
 * step rail on top, then title + description, then step content.
 */
export function OnboardingContainer({
  title,
  description,
  children,
  step,
  totalSteps = 4,
  stepOffset = 0,
  hideProgress = false,
  className,
  logo,
}: ContainerProps) {
  const { goToStep } = useOnboarding();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-50 font-inter text-zinc-950">
      <div
        className={cn(
          'flex min-h-full flex-col items-center px-10 py-14 text-sm leading-normal',
          className
        )}
      >
        {step != null && !hideProgress && (
          <ProgressIndicator
            current={step}
            total={totalSteps}
            onStepClick={(s) => goToStep(s + stepOffset)}
          />
        )}

        {logo}

        <h1
          className={cn(
            'text-center text-[32px] font-semibold leading-tight tracking-[-0.5px] text-zinc-950',
            logo ? 'mt-[22px]' : undefined
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[460px] text-center text-[15px] text-zinc-500">
            {description}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
