'use client';

/**
 * Product funnel events for PostHog.
 *
 * These are the named steps we build funnels and experiments on, kept in one
 * place so event names never drift between call sites. The core funnel is:
 *
 *   onboarding_completed → recording_started → recording_stopped
 *   → summary_generated → meeting_opened
 *
 * Properties carry only interface/config facts (engine, provider, counts,
 * durations) — never meeting content.
 */

import { posthog } from './posthogClient';

export type ProductEvent =
  | 'onboarding_step_viewed'
  | 'onboarding_completed'
  | 'recording_started'
  | 'recording_stopped'
  | 'summary_generated'
  | 'summary_failed'
  | 'meeting_opened'
  | 'transcript_searched'
  | 'settings_section_viewed'
  | 'integration_connected'
  | 'model_downloaded'
  | 'app_update_checked';

export function captureProduct(
  event: ProductEvent,
  properties: Record<string, string | number | boolean> = {},
): void {
  try {
    posthog.capture(event, properties);
  } catch (error) {
    // Analytics must never break a user action.
    console.debug('[analytics] capture failed', event, error);
  }
}
