'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { LiveTranscriptionStatus } from './useLiveTranscriptionState';

/**
 * In-meeting indicator, deliberately not a modal: the recording is working,
 * and interrupting it to report a missing model is what used to make people
 * lose meetings.
 */
export function TranscriptionOffNotice({ status }: { status: LiveTranscriptionStatus }) {
  if (status.state === 'active') return null;

  const isOff = status.state === 'off';

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900">
      <AlertTitle>
        {isOff ? 'Recording audio only' : 'Live transcription interrupted'}
      </AlertTitle>
      <AlertDescription className="text-[13px]">
        {isOff
          ? 'No transcription model is ready, so this miting is being captured as audio. You can transcribe it from the miting page once a model is installed.'
          : 'Transcription stopped responding. Audio is still being recorded and you can transcribe it afterwards.'}
        {status.reason && (
          <span className="mt-1 block text-[12px] text-amber-800/80">{status.reason}</span>
        )}
        {status.autoSaveForced && (
          <span className="mt-1 block text-[12px] text-amber-800/80">
            Audio saving was turned on for this meeting so the recording is not lost.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
