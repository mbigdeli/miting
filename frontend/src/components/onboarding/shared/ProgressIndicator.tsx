import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  onStepClick?: (step: number) => void;
}

/**
 * Onboarding step rail: plain dots joined by connectors. No numbers, so the
 * numbered steps inside the models screen (1 and 2) are the only ones.
 * Finished steps stay clickable.
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
                'h-2 w-2 rounded-full transition-colors',
                isCompleted || isActive ? 'bg-zinc-900' : 'border border-zinc-300 bg-white',
                isActive && 'ring-[3px] ring-zinc-900/15',
                isClickable ? 'cursor-pointer' : 'cursor-default',
              )}
            />

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
