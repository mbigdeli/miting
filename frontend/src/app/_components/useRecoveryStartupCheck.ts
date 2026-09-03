'use client';

import { useEffect } from 'react';
import { indexedDBService } from '@/services/indexedDBService';

/**
 * Startup housekeeping for transcript recovery: prune stale IndexedDB entries,
 * then look for meetings that never finished saving. Skipped entirely while a
 * recording (or its stop-processing) is in flight.
 */
export function useRecoveryStartupCheck(
  pauseChecks: boolean,
  checkForRecoverableTranscripts: () => Promise<unknown>,
): void {
  useEffect(() => {
    const performStartupChecks = async () => {
      try {
        if (pauseChecks) {
          console.log('Skipping recovery check - recording in progress or processing');
          return;
        }

        try {
          await indexedDBService.deleteOldMeetings(7);
        } catch (error) {
          console.warn('Failed to clean up old meetings:', error);
        }

        try {
          await indexedDBService.deleteSavedMeetings(24);
        } catch (error) {
          console.warn('Failed to clean up saved meetings:', error);
        }

        await checkForRecoverableTranscripts();
      } catch (error) {
        console.error('Failed to perform startup checks:', error);
      }
    };

    performStartupChecks();
  }, [checkForRecoverableTranscripts, pauseChecks]);
}
