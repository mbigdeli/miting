import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './shared/ProgressIndicator';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { OnboardingContainerProps } from '@/types/onboarding';

interface ContainerProps extends OnboardingContainerProps {
  /** Optional brand mark rendered between the step rail and the title (Welcome step). */
  logo?: React.ReactNode;
  /** Shows an X at the top right that leaves this step (optional steps). */
  onClose?: () => void;
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
  onClose,
}: ContainerProps) {
  const { goToStep } = useOnboarding();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-50 font-inter text-zinc-950">
      {onClose && (
        <button
          type="button"
          aria-label="Skip this step"
          onClick={onClose}
          className="absolute right-4 top-4 grid place-items-center rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
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
