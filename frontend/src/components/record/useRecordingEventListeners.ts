'use client';

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import Analytics from '@/lib/analytics';
import {
  isFatalTranscriptionError,
  transcriptionErrorMessage,
} from '@/lib/transcriptionEvents';

interface UseRecordingEventListenersArgs {
  onRecordingStop: (callApi?: boolean) => void;
  onTranscriptionError?: (message: string) => void;
}

/**
 * Backend transcription-failure + speech-detected listeners for the Record
 * screen.
 *
 * A transcription failure no longer ends the meeting: audio capture and saving
 * are independent of the model, so stopping here abandoned a session the
 * backend was still recording. Only an explicitly fatal event stops recording.
 */
export function useRecordingEventListeners({
  onRecordingStop,
  onTranscriptionError,
}: UseRecordingEventListenersArgs) {
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    const setupListeners = async () => {
      try {
        // Transcript error listener - plain string payloads. Never fatal: the
        // legacy event carries no severity and the recording keeps running.
        const transcriptErrorUnsubscribe = await listen('transcript-error', (event) => {
          console.error('Transcription error received:', event.payload);
          const errorMessage = event.payload as string;
          Analytics.trackTranscriptionError(errorMessage);
          onTranscriptionError?.(errorMessage);
        });

        // Transcription error listener - structured error objects
        const transcriptionErrorUnsubscribe = await listen('transcription-error', (event) => {
          console.error('Transcription error received:', event.payload);
          const errorMessage = transcriptionErrorMessage(event.payload);
          Analytics.trackTranscriptionError(errorMessage);
          if (isFatalTranscriptionError(event.payload)) {
            onRecordingStop(false);
          }
          // Non-fatal errors surface via the useModalState global listener
          // (toast / model selector) while the meeting keeps recording.
        });

        // Speech detected listener - VAD feedback event, kept subscribed so the
        // frontend contract with the backend pipeline is unchanged.
        const speechDetectedUnsubscribe = await listen('speech-detected', () => {});

        unsubscribes = [
          transcriptErrorUnsubscribe,
          transcriptionErrorUnsubscribe,
          speechDetectedUnsubscribe,
        ];
      } catch (error) {
        console.error('Failed to set up recording event listeners:', error);
      }
    };

    setupListeners();

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, [onRecordingStop, onTranscriptionError]);
}
