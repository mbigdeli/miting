'use client';

import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { SPEAKERS_STATUS_EVENT, type SpeakerInfo, type SpeakerStage, type SpeakerStatus } from '@/lib/speakers';
import { speakersApi } from '@/lib/speakersApi';

/**
 * Speakers of one meeting plus the state of a background identification run.
 * `onChanged` fires whenever names or lines changed so the page can reload
 * the speaker-attributed transcript.
 */
export function useMeetingSpeakers(meetingId: string, onChanged: () => void) {
  const [speakers, setSpeakers] = useState<SpeakerInfo[]>([]);
  const [stage, setStage] = useState<SpeakerStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSpeakers(await speakersApi.list(meetingId));
    } catch (e) {
      console.warn('[speakers] list failed:', e);
    }
    onChanged();
  }, [meetingId, onChanged]);

  useEffect(() => {
    let active = true;
    setError(null);
    speakersApi.list(meetingId).then((s) => active && setSpeakers(s)).catch(() => {});
    speakersApi.stage(meetingId).then((s) => active && setStage(s)).catch(() => {});
    const unlisten = listen<SpeakerStatus>(SPEAKERS_STATUS_EVENT, ({ payload }) => {
      if (!active || payload.meeting_id !== meetingId) return;
      const running = payload.stage === 'listening' || payload.stage === 'naming';
      setStage(running ? payload.stage : null);
      setError(payload.stage === 'failed' ? payload.message ?? 'Speaker identification failed.' : null);
      // Voices are stored before naming starts, so show them right away.
      if (payload.stage !== 'listening') void reload();
    });
    return () => {
      active = false;
      void unlisten.then((fn) => fn());
    };
  }, [meetingId, reload]);

  const run = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
        await reload();
      } catch (e) {
        toast.error(label, { description: String(e) });
      }
    },
    [reload]
  );

  return {
    speakers,
    stage,
    error,
    identify: async () => {
      setError(null);
      setStage('listening');
      const started = await speakersApi.identify(meetingId).catch((e) => {
        setStage(null);
        setError(String(e));
        return false;
      });
      if (!started) void speakersApi.stage(meetingId).then(setStage);
    },
    rename: (from: string, to: string) => run('Could not rename', () => speakersApi.rename(meetingId, from, to)),
    confirm: (name: string) => run('Could not save the name', () => speakersApi.confirm(meetingId, name)),
    dismissMerge: (name: string) =>
      run('Could not save your choice', () => speakersApi.dismissMerge(meetingId, name)),
    reassign: (seqs: number[], to: string) =>
      run('Could not move the line', () => speakersApi.reassign(meetingId, seqs, to)),
  };
}

export type MeetingSpeakers = ReturnType<typeof useMeetingSpeakers>;
