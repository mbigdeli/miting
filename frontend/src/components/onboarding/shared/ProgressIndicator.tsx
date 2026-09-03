import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  onStepClick?: (step: number) => void;
}

/**
 * Onboarding step rail: small numbered dots joined by connectors.
 * Completed steps show a check and darken the connector that follows them.
 */
export function ProgressIndicator({ current, total, onStepClick }: ProgressIndicatorProps) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="mb-10 flex items-center gap-1.5">
      {steps.map((step, index) => {
        const isCompleted = step < current;
        const isActive = step === current;
        const isClickable = isCompleted && !!onStepClick;

        return (
          <React.Fragment key={step}>
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(step)}
              disabled={!isClickable}
              aria-label={`Step ${step}`}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold transition-colors',
                isCompleted || isActive
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-400',
                isClickable ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              {isCompleted ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : step}
            </button>

            {index < steps.length - 1 && (
              <span
                className={cn('h-0.5 w-[26px]', isCompleted ? 'bg-zinc-900' : 'bg-zinc-200')}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
