import { describe, expect, it } from 'vitest';
import { LAST_ONBOARDING_STEP, onboardingStepCount } from '@/components/onboarding/shared/stepCount';

describe('onboardingStepCount', () => {
  it('has the Chrome step everywhere and Permissions only on a Mac', () => {
    expect(onboardingStepCount(false)).toBe(4);
    expect(onboardingStepCount(true)).toBe(5);
    expect(LAST_ONBOARDING_STEP).toBe(onboardingStepCount(true));
  });
});
