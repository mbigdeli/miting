/**
 * Onboarding order: 1 Welcome, 2 Overview, 3 Models, 4 Chrome extension,
 * 5 Permissions (macOS only). One place for the count so the step rail
 * cannot disagree with the flow.
 */
export const LAST_ONBOARDING_STEP = 5;

export const onboardingStepCount = (isMac: boolean): number =>
  isMac ? LAST_ONBOARDING_STEP : LAST_ONBOARDING_STEP - 1;
