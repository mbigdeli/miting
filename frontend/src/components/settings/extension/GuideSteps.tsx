'use client';

import React from 'react';
import { GUIDE_STEPS } from '@/lib/extensionGuide';
import { StepImage } from './StepImage';

/** Numbered "add to Chrome by hand" walkthrough (mirrors onboarding style). */
export function GuideSteps() {
  return (
    <ol className="grid gap-5">
      {GUIDE_STEPS.map((step, i) => (
        <li key={step.title} className="grid gap-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand/10 text-[12px] font-semibold text-brand">
              {i + 1}
            </span>
            <div>
              <div className="font-medium text-zinc-900">{step.title}</div>
              <p className="mt-0.5 text-[13px] text-zinc-500">{step.detail}</p>
            </div>
          </div>
          <div className="pl-8">
            <StepImage src={step.image} alt={step.imageAlt} />
          </div>
        </li>
      ))}
    </ol>
  );
}
