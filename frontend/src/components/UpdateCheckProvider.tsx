'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { UpdateInfo } from '@/services/updateService';
import {
  trayCheckFailure,
  trayCheckResult,
  type TrayCheckOutcome,
} from '@/lib/trayUpdateCheck';
import { UpdateDialog } from './UpdateDialog';
import { setUpdateDialogCallback, showUpdateNotification } from './UpdateNotification';

interface UpdateCheckContextType {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  checkForUpdates: (force?: boolean) => Promise<UpdateInfo | null>;
  showUpdateDialog: () => void;
}

const UpdateCheckContext = createContext<UpdateCheckContextType | undefined>(undefined);

export function UpdateCheckProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false);

  const handleShowDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  const { updateInfo, isChecking, checkForUpdates } = useUpdateCheck({
    checkOnMount: true,
    showNotification: true,
    onUpdateAvailable: (info) => {
      // Show notification, dialog will be shown when user clicks notification
      showUpdateNotification(info, handleShowDialog);
    },
  });

  useEffect(() => {
    // Register the callback so UpdateNotification can trigger the dialog
    setUpdateDialogCallback(handleShowDialog);
    return () => {
      setUpdateDialogCallback(() => {});
    };
  }, [handleShowDialog]);

  // Listen for tray menu events. The dialog renders nothing without an
  // available update, so opening it unconditionally made the tray item look
  // dead — report the "nothing new" and failure cases as toasts instead.
  useEffect(() => {
    const handleTrayCheck = () => {
      const pending = toast.loading('Checking for updates…');
      const report = (outcome: TrayCheckOutcome) => {
        toast.dismiss(pending);
        if (outcome.kind === 'dialog') setShowDialog(true);
        else if (outcome.kind === 'up-to-date') toast.success("You're up to date");
        else if (outcome.kind === 'error') toast.error(outcome.message);
      };
      void checkForUpdates(true)
        .then((info) => report(trayCheckResult(info)))
        .catch((error) => {
          console.error('Tray update check failed:', error);
          report(trayCheckFailure(error));
        });
    };

    window.addEventListener('check-updates-from-tray', handleTrayCheck);
    return () => window.removeEventListener('check-updates-from-tray', handleTrayCheck);
  }, [checkForUpdates]);

  return (
    <UpdateCheckContext.Provider
      value={{
        updateInfo,
        isChecking,
        checkForUpdates,
        showUpdateDialog: handleShowDialog,
      }}
    >
      {children}
      <UpdateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        updateInfo={updateInfo}
      />
    </UpdateCheckContext.Provider>
  );
}

export function useUpdateCheckContext() {
  const context = useContext(UpdateCheckContext);
  if (context === undefined) {
    throw new Error('useUpdateCheckContext must be used within UpdateCheckProvider');
  }
  return context;
}
