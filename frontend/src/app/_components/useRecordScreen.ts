'use client';

/**
 * Wires the Record screen's state: recording lifecycle hooks, modals, event
 * listeners, the VU-meter animation, and the derived flags that decide between
 * the idle hero (mockup 2e) and the live transcript view (2f).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordControls } from '@/components/record/useRecordControls';
import { useRecordingEventListeners } from '@/components/record/useRecordingEventListeners';
import { useModalState } from '@/hooks/useModalState';
import { useRecordingStateSync } from '@/hooks/useRecordingStateSync';
import { useRecordingStart } from '@/hooks/useRecordingStart';
import { useRecordingStop } from '@/hooks/useRecordingStop';

export function useRecordScreen() {
  const [isRecording, setIsRecordingState] = useState(false);
  const [barHeights, setBarHeights] = useState(['58%', '76%', '58%']);

  const { transcriptModelConfig } = useConfig();
  const recordingState = useRecordingState();
  const { status, isStopping, isProcessing, isSaving, activeDuration } = recordingState;

  const permissions = usePermissionCheck();
  const { setIsMeetingActive, isCollapsed: sidebarCollapsed } = useSidebar();
  const { modals, messages, showModal, hideModal } = useModalState(transcriptModelConfig);
  const { isRecordingDisabled, setIsRecordingDisabled } = useRecordingStateSync(
    isRecording,
    setIsRecordingState,
    setIsMeetingActive
  );
  const { handleRecordingStart } = useRecordingStart(isRecording, setIsRecordingState, showModal);
  const { handleRecordingStop, setIsStopping } = useRecordingStop(
    setIsRecordingState,
    setIsRecordingDisabled
  );

  const onRecordingStop = useCallback(
    (callApi: boolean = true) => {
      void handleRecordingStop(callApi);
    },
    [handleRecordingStop]
  );
  const onTranscriptionError = useCallback(
    (message: string) => showModal('errorAlert', message),
    [showModal]
  );

  const controls = useRecordControls({
    isRecording: recordingState.isRecording,
    onRecordingStart: handleRecordingStart,
    onRecordingStop,
    onStopInitiated: () => setIsStopping(true),
  });
  useRecordingEventListeners({ onRecordingStop, onTranscriptionError });

  // VU meter animation while actively recording
  useEffect(() => {
    if (!recordingState.isRecording) return;
    const interval = setInterval(() => {
      setBarHeights([0, 1, 2].map(() => `${Math.random() * 20 + 10}px`));
    }, 300);
    return () => clearInterval(interval);
  }, [recordingState.isRecording]);

  // Keep the last known duration so the timer doesn't blank while stopping.
  // Active time, not wall-clock: the header used to count paused time while the
  // recording bar below it did not, so the same session showed two durations.
  const lastDurationRef = useRef<number | null>(null);
  if (activeDuration !== null) lastDurationRef.current = activeDuration;

  const isProcessingStop = status === RecordingStatus.PROCESSING_TRANSCRIPTS || isProcessing;
  const showLiveView =
    recordingState.isRecording ||
    isStopping ||
    isProcessingStop ||
    isSaving ||
    status === RecordingStatus.COMPLETED;

  return {
    recordingState,
    controls,
    modals,
    messages,
    showModal,
    hideModal,
    permissions,
    sidebarCollapsed,
    isRecordingDisabled,
    isProcessingStop,
    showLiveView,
    barHeights,
    displayDuration: activeDuration ?? lastDurationRef.current,
  };
}
