'use client';

import { captureProduct } from '@/lib/productEvents';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import Analytics from '@/lib/analytics';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { DeviceError, parseDeviceError } from './deviceError';

interface UseRecordControlsArgs {
  isRecording: boolean;
  onRecordingStart: () => Promise<void>;
  onRecordingStop: (callApi?: boolean) => void;
  onStopInitiated?: () => void;
}

/**
 * Start / stop / pause / resume actions for the redesigned Record screen.
 * Ports the invoke logic previously hosted inside <RecordingControls /> so the
 * new hero + header UI reuses the exact same backend commands and guards.
 */
export function useRecordControls({
  isRecording,
  onRecordingStart,
  onRecordingStop,
  onStopInitiated,
}: UseRecordControlsArgs) {
  const { isPaused } = useRecordingState();
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [deviceError, setDeviceError] = useState<DeviceError | null>(null);

  // Verify the Tauri bridge is alive (same startup check as the legacy controls).
  useEffect(() => {
    invoke('is_recording').catch((error) => {
      console.error('Tauri initialization error:', error);
      alert('Failed to initialize recording. Please check the console for details.');
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (isStarting) return;
    Analytics.trackButtonClick('start_recording', 'recording_controls');
    captureProduct('recording_started');
    setIsStarting(true);
    setDeviceError(null);
    try {
      await onRecordingStart();
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDeviceError(parseDeviceError(errorMsg));
    } finally {
      setIsStarting(false);
    }
  }, [onRecordingStart, isStarting]);

  const handleStop = useCallback(async () => {
    if (!isRecording || isStarting || isStopping) return;
    Analytics.trackButtonClick('stop_recording', 'recording_controls');

    // Notify parent immediately (for UI state updates), then stop the recorder.
    onStopInitiated?.();
    setIsStopping(true);
    try {
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;
      await invoke('stop_recording', { args: { save_path: savePath } });
      Analytics.trackTranscriptionSuccess();
      onRecordingStop(true);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (!String(error).includes('No recording in progress')) {
        onRecordingStop(false);
      }
    } finally {
      setIsStopping(false);
    }
  }, [isRecording, isStarting, isStopping, onRecordingStop, onStopInitiated]);

  const handlePauseResume = useCallback(async () => {
    if (!isRecording || isPausing || isResuming || isStopping) return;
    const action = isPaused ? 'resume' : 'pause';
    const setBusy = isPaused ? setIsResuming : setIsPausing;
    Analytics.trackButtonClick(`${action}_recording`, 'recording_controls');
    setBusy(true);
    try {
      await invoke(`${action}_recording`);
    } catch (error) {
      console.error(`Failed to ${action} recording:`, error);
      alert(`Failed to ${action} recording. Please check the console for details.`);
    } finally {
      setBusy(false);
    }
  }, [isRecording, isPaused, isPausing, isResuming, isStopping]);

  return {
    isStarting,
    isStopping,
    isPausing,
    isResuming,
    deviceError,
    clearDeviceError: () => setDeviceError(null),
    handleStart,
    handleStop,
    handlePauseResume,
  };
}
