'use client';

import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  autoSaveWasForced,
  unavailableReason,
  type LiveTranscriptionState,
} from '@/lib/transcriptionEvents';

export interface LiveTranscriptionStatus {
  state: LiveTranscriptionState;
  /** Why transcription is not running, shown in the in-meeting notice. */
  reason?: string;
  /** Audio saving was switched on for this session so nothing is lost. */
  autoSaveForced: boolean;
}

const ACTIVE: LiveTranscriptionStatus = { state: 'active', autoSaveForced: false };

/**
 * Whether the current recording is transcribing live.
 *
 * A meeting can legitimately record with no model at all, so this is a status
 * to display — not an error to act on. Resets at the start of each recording.
 */
export function useLiveTranscriptionState(): LiveTranscriptionStatus {
  const [status, setStatus] = useState<LiveTranscriptionStatus>(ACTIVE);

  useEffect(() => {
    const subscriptions = [
      listen('recording-started', () => setStatus(ACTIVE)),
      listen('transcription-unavailable', (event) =>
        setStatus({
          state: 'off',
          reason: unavailableReason(event.payload),
          autoSaveForced: autoSaveWasForced(event.payload),
        })
      ),
      // Non-fatal by contract (see lib/transcriptionEvents): the meeting keeps
      // recording, so this only downgrades the indicator.
      listen('transcription-error', () =>
        setStatus((current) =>
          current.state === 'off' ? current : { state: 'degraded', autoSaveForced: false }
        )
      ),
    ];

    return () => {
      subscriptions.forEach((pending) => {
        void pending.then((unlisten) => unlisten());
      });
    };
  }, []);

  return status;
}
