import React from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useIsMac } from './shared/useIsMac';
import {
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

  // 4-Step Onboarding Flow (System-Recommended Models):
  // Step 1: Welcome - Introduce Miting features
  // Step 2: Setup Overview - Database initialization + show recommended downloads
  // Step 3: Download Progress - Download Parakeet + Summary Model (auto-selected based on platform/RAM)
  // Step 4: Permissions - Request mic + system audio (macOS only)

  return (
    <div className="onboarding-flow">
      {currentStep === 1 && <WelcomeStep />}
      {currentStep === 2 && <SetupOverviewStep />}
      {currentStep === 3 && <SetupDownloadsStep />}
      {currentStep === 4 && isMac && <PermissionsStep />}
    </div>
  );
}
