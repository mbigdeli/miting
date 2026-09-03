'use client';

/**
 * PostHog browser client: session replay, autocapture, and feature
 * flags / experiments. Runs alongside the Rust event pipeline (same
 * project, same distinct_id via Analytics.getPersistentUserId), which
 * keeps the existing event taxonomy while replay and flags live here.
 *
 * The token is a write-only public key (safe to ship in clients).
 * Meeting CONTENT stays private: inputs are masked and any element
 * carrying `ph-no-capture` (transcripts, summaries) is excluded from
 * recordings entirely.
 */

import posthog from 'posthog-js';

/**
 * Supplied at build time from `.env.local`, which is not committed. A build
 * without it simply has no analytics — the key identifies one project's
 * ingest endpoint, so hardcoding it would hand every fork the ability to
 * write into ours.
 */
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let started = false;

export function startPosthog(distinctId: string): void {
  if (started || !POSTHOG_KEY) return;
  started = true;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: 'history_change', // SPA-aware pageviews
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '.ph-mask-text',
    },
    persistence: 'localStorage',
    bootstrap: { distinctID: distinctId },
  });
  posthog.identify(distinctId);
}

/** Current variant of a PostHog experiment / feature flag ('control', 'test', …). */
export function getExperimentVariant(flag: string): string | boolean | undefined {
  return started ? posthog.getFeatureFlag(flag) : undefined;
}

/** Run `cb` once flags are loaded — the entry point for A/B gating. */
export function onFlagsReady(cb: () => void): void {
  if (started) posthog.onFeatureFlags(cb);
}

export { posthog };
