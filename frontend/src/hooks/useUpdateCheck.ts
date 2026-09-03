import { useEffect, useState } from 'react';
import { updateService, UpdateInfo } from '@/services/updateService';
import { showUpdateNotification } from '@/components/UpdateNotification';

interface UseUpdateCheckOptions {
  checkOnMount?: boolean;
  showNotification?: boolean;
  onUpdateAvailable?: (info: UpdateInfo) => void;
}

export function useUpdateCheck(options: UseUpdateCheckOptions = {}) {
  const {
    checkOnMount = true,
    showNotification = true,
    onUpdateAvailable,
  } = options;

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Resolves with the result (null = skipped because a check ran recently) and
   * *rejects* on failure. Callers that asked for the check — the tray menu, the
   * About panel — need to tell "nothing new" apart from "the check failed";
   * swallowing the error here is what made those actions look like no-ops.
   */
  const checkForUpdates = async (force = false): Promise<UpdateInfo | null> => {
    // Skip if checked recently (unless forced)
    if (!force && updateService.wasCheckedRecently()) {
      return null;
    }

    setIsChecking(true);
    try {
      const info = await updateService.checkForUpdates(force);
      setUpdateInfo(info);

      if (info.available) {
        if (onUpdateAvailable) {
          onUpdateAvailable(info);
        } else if (showNotification) {
          showUpdateNotification(info, () => {
            // This will be handled by the component that uses this hook
          });
        }
      }
      return info;
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (checkOnMount) {
      // Delay the check slightly to avoid blocking app startup
      const timer = setTimeout(() => {
        // Startup checks stay silent — the user did not ask for this one.
        checkForUpdates(false).catch((error) => {
          console.error('Failed to check for updates:', error);
        });
      }, 2000); // Check 2 seconds after mount

      return () => clearTimeout(timer);
    }
  }, [checkOnMount]);

  return {
    updateInfo,
    isChecking,
    checkForUpdates,
  };
}
