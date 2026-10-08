import React from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useIsMac } from './shared/useIsMac';
import {
  ChromeExtensionStep,
  WelcomeStep,
  PermissionsStep,
  SetupDownloadsStep,
  SetupOverviewStep,
} from './steps';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { currentStep } = useOnboarding();
  const isMac = useIsMac();

  // Order lives in shared/stepCount.ts: Welcome, Overview, Models,
  // Chrome extension, then Permissions on macOS only.

  return (
    <div className="onboarding-flow">
      {currentStep === 1 && <WelcomeStep />}
      {currentStep === 2 && <SetupOverviewStep />}
      {currentStep === 3 && <SetupDownloadsStep />}
      {currentStep === 4 && <ChromeExtensionStep />}
      {currentStep === 5 && isMac && <PermissionsStep />}
    </div>
  );
}
