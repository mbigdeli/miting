'use client';

/**
 * One-shot analytics bootstrap, extracted from AnalyticsProvider: starts both
 * pipelines (posthog-js for replay/autocapture/flags, the Rust client for the
 * existing event taxonomy) under one persistent distinct_id, records device
 * info, identifies the user, and opens the session.
 *
 * Returns the teardown that ends the session on unmount.
 */

import { getVersion } from '@tauri-apps/api/app';
import { load } from '@tauri-apps/plugin-store';
import Analytics from '@/lib/analytics';
import { startPosthog } from '@/lib/posthogClient';

export async function bootstrapAnalytics(): Promise<() => void> {
  // Persistent user ID first — both pipelines stitch to the same person.
  const userId = await Analytics.getPersistentUserId();
  startPosthog(userId);
  await Analytics.init();

  const deviceInfo = await Analytics.getDeviceInfo();

  // Cache platform info in analytics.json for quick access.
  const store = await load('analytics.json', { autoSave: false, defaults: {} });
  await store.set('platform', deviceInfo.platform);
  await store.set('os_version', deviceInfo.os_version);
  await store.set('architecture', deviceInfo.architecture);
  if (!(await store.has('first_launch_date'))) {
    await store.set('first_launch_date', new Date().toISOString());
  }
  await store.save();

  const appVersion = await getVersion().catch(() => 'unknown');
  await Analytics.identify(userId, {
    app_version: appVersion,
    platform: deviceInfo.platform,
    os_version: deviceInfo.os_version,
    architecture: deviceInfo.architecture,
    first_seen: new Date().toISOString(),
  });

  const sessionId = await Analytics.startSession(userId);
  if (sessionId) {
    await Analytics.trackSessionStarted(sessionId);
  }
  await Analytics.checkAndTrackFirstLaunch();
  await Analytics.trackAppStarted();
  await Analytics.checkAndTrackDailyUsage();

  const endSession = () => {
    if (sessionId) {
      void Analytics.trackSessionEnded(sessionId);
    }
    void Analytics.cleanup();
  };
  window.addEventListener('beforeunload', endSession);

  return () => {
    window.removeEventListener('beforeunload', endSession);
    endSession();
  };
}
