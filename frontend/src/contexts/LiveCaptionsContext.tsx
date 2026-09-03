'use client';

/**
 * Google Meet captions for the whole session, not just the current screen.
 *
 * A companion session runs no local engine, so `transcript-update` never fires
 * and the live view sat on "Listening for speech…" for the whole call while the
 * captions were being stored perfectly well. This listens to the ingest
 * server's own event instead.
 *
 * It lives in the root layout because the Record screen does not. Navigating to
 * Settings and back unmounts `TranscriptPanel`, and while this state sat inside
 * that component every line already on screen went with it — the captions were
 * still in `gmeet_captions` and still reached the saved transcript, but the
 * user watched the call empty itself out.
 *
 * The list resets when a recording starts, not when a component mounts, so one
 * meeting's lines never lead the next one.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';
import { mergeCaption, startsNewSession, type LiveCaption } from '@/lib/liveCaptions';
import { useRecordingState } from '@/contexts/RecordingStateContext';

const LiveCaptionsContext = createContext<LiveCaption[] | null>(null);

export function LiveCaptionsProvider({ children }: { children: ReactNode }) {
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const { isRecording } = useRecordingState();
  // Mount value, so a reload that lands mid-recording is not read as a start.
  const previousIsRecording = useRef(isRecording);

  useEffect(() => {
    if (startsNewSession(previousIsRecording.current, isRecording)) {
      setCaptions([]);
    }
    previousIsRecording.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const pending = listen<LiveCaption>('gmeet-caption', (event) => {
      const { id, speaker, text, at } = event.payload ?? ({} as LiveCaption);
      if (typeof id !== 'number' || typeof text !== 'string') return;
      setCaptions((current) =>
        mergeCaption(current, {
          id,
          speaker: speaker ?? null,
          text,
          at: typeof at === 'number' ? at : undefined,
        }),
      );
    });
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);

  return <LiveCaptionsContext.Provider value={captions}>{children}</LiveCaptionsContext.Provider>;
}

export function useLiveCaptions(): LiveCaption[] {
  const captions = useContext(LiveCaptionsContext);
  if (captions === null) {
    throw new Error('useLiveCaptions must be used within a LiveCaptionsProvider');
  }
  return captions;
}
