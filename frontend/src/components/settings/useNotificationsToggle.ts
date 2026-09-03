'use client';

/**
 * Notification-toggle state machine extracted unchanged from the legacy
 * PreferenceSettings component: lazy preference load, "preferences viewed"
 * analytics, initial-value sync, and persisted updates on manual toggles.
 */

import { useEffect, useRef, useState } from 'react';
import Analytics from '@/lib/analytics';
import { useConfig, NotificationSettings } from '@/contexts/ConfigContext';

export function useNotificationsToggle() {
  const {
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings,
  } = useConfig();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousEnabled, setPreviousEnabled] = useState<boolean | null>(null);
  const hasTrackedViewRef = useRef(false);

  // Lazy load preferences on mount (only loads if not already cached).
  useEffect(() => {
    loadPreferences();
    hasTrackedViewRef.current = false;
  }, [loadPreferences]);

  // Track preferences viewed analytics once per mount.
  useEffect(() => {
    if (hasTrackedViewRef.current) return;
    const trackPreferencesViewed = async () => {
      if (notificationSettings) {
        await Analytics.track('preferences_viewed', {
          notifications_enabled: notificationSettings.notification_preferences.show_recording_started
            ? 'true'
            : 'false',
        });
        hasTrackedViewRef.current = true;
      } else if (!isLoadingPreferences) {
        await Analytics.track('preferences_viewed', { notifications_enabled: 'false' });
        hasTrackedViewRef.current = true;
      }
    };
    trackPreferencesViewed();
  }, [notificationSettings, isLoadingPreferences]);

  // Sync local toggle state when settings load from global state.
  useEffect(() => {
    if (notificationSettings) {
      const enabled =
        notificationSettings.notification_preferences.show_recording_started &&
        notificationSettings.notification_preferences.show_recording_stopped;
      setNotificationsEnabled(enabled);
      if (isInitialLoad) {
        setPreviousEnabled(enabled);
        setIsInitialLoad(false);
      }
    } else if (!isLoadingPreferences) {
      setNotificationsEnabled(true);
      if (isInitialLoad) {
        setPreviousEnabled(true);
        setIsInitialLoad(false);
      }
    }
  }, [notificationSettings, isLoadingPreferences, isInitialLoad]);

  // Persist manual toggles (skips initial load / no-op changes).
  useEffect(() => {
    if (isInitialLoad || notificationsEnabled === null || notificationsEnabled === previousEnabled) return;
    if (!notificationSettings) return;

    const handleUpdate = async () => {
      try {
        const updatedSettings: NotificationSettings = {
          ...notificationSettings,
          notification_preferences: {
            ...notificationSettings.notification_preferences,
            show_recording_started: notificationsEnabled,
            show_recording_stopped: notificationsEnabled,
          },
        };
        await updateNotificationSettings(updatedSettings);
        setPreviousEnabled(notificationsEnabled);
        await Analytics.track('notification_settings_changed', {
          notifications_enabled: notificationsEnabled.toString(),
        });
      } catch (error) {
        console.error('Failed to update notification settings:', error);
      }
    };
    handleUpdate();
  }, [notificationsEnabled, notificationSettings, isInitialLoad, previousEnabled, updateNotificationSettings]);

  return {
    notificationsEnabled,
    setNotificationsEnabled,
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
  };
}
