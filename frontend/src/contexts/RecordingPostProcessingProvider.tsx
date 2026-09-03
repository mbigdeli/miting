'use client';

import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRecordingStop } from '@/hooks/useRecordingStop';

/**
 * RecordingPostProcessingProvider
 *
 * This provider handles post-processing when recording stops from any source:
 * - Tray menu stop
 * - Global keyboard shortcut
 * - Overlay stop button
 * - Main UI stop button
 *
 * It listens for the 'recording-stop-complete' event from Rust backend
 * and triggers the full post-processing flow (save to database, navigate, analytics)
 * regardless of which page the user is currently on.
 */
export function RecordingPostProcessingProvider({ children }: { children: React.ReactNode }) {
  // No-op functions since the global RecordingStateContext already handles state updates
  // These are only needed for the hook's local component state management
  const setIsRecording = () => { };
  const setIsRecordingDisabled = () => { };

  const {
    handleRecordingStop,
  } = useRecordingStop(setIsRecording, setIsRecordingDisabled);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        // Listen for recording-stop-complete event from Rust
        unlistenFn = await listen<
          boolean | { callApi: boolean; gmeetSessionId?: string | null; silent?: boolean }
        >('recording-stop-complete', (event) => {
          console.log('[RecordingPostProcessing] Received recording-stop-complete event:', event.payload);

          // The payload used to be the bare callApi boolean. The grace
          // handover also rides the Meet session id along, captured at the
          // moment the stop began — sessionStorage can already belong to the
          // NEXT meeting by the time this pipeline reads it.
          const payload = event.payload;
          const callApi = typeof payload === 'boolean' ? payload : payload?.callApi ?? true;
          const gmeetSessionId =
            typeof payload === 'object' && payload !== null ? payload.gmeetSessionId ?? null : null;
          const silent =
            typeof payload === 'object' && payload !== null && payload.silent === true;
          handleRecordingStop(callApi, gmeetSessionId, silent);
        });

        console.log('[RecordingPostProcessing] Event listener set up successfully');
      } catch (error) {
        console.error('[RecordingPostProcessing] Failed to set up event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        console.log('[RecordingPostProcessing] Cleaning up event listener');
        unlistenFn();
      }
    };
  }, [handleRecordingStop]);

  return <>{children}</>;
}
