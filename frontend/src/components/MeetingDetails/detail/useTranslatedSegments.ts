'use client';

import { useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { TranscriptSegmentData } from '@/types';
import type { MeetingTranslationsState } from '@/hooks/meeting-details/useMeetingTranslations';
import { languageName } from '@/lib/translation/languages';
import { diarizedKey, savedTranslationFor } from '@/lib/translation/lineTranslation';

interface Input {
  meeting: { id: string };
  segments?: TranscriptSegmentData[];
  translations?: MeetingTranslationsState;
  onCopyTranscript: () => void | Promise<void>;
}

const NO_SEGMENTS: TranscriptSegmentData[] = [];

/**
 * The transcript tab's lines with the chosen translation attached, a lookup
 * for the speaker view, and Copy that includes the translation when one shows.
 */
export function useTranslatedSegments({ meeting, segments, translations: t, onCopyTranscript }: Input) {
  const raw = segments ?? NO_SEGMENTS;
  const view = t?.view ?? null;
  const lines = t?.lines;
  const job = t?.job ?? null;

  const translated = useMemo(
    () =>
      view && lines
        ? raw.map((s) => ({ ...s, translation: savedTranslationFor(s.id, view, lines, job) }))
        : raw,
    [raw, view, lines, job]
  );

  const translationFor = useCallback(
    (seq: number) => (lines ? savedTranslationFor(diarizedKey(seq), view, lines, job) : undefined),
    [view, lines, job]
  );

  const copyTranscript = useCallback(async () => {
    if (!view) return onCopyTranscript();
    try {
      const text = await invoke<string>('translation_meeting_text', { meetingId: meeting.id, language: view });
      await navigator.clipboard.writeText(text);
      toast.success(`Transcript copied with ${languageName(view)}`);
    } catch {
      toast.error('Could not copy the transcript');
    }
  }, [view, meeting.id, onCopyTranscript]);

  return { segments: translated, translationFor, copyTranscript };
}
