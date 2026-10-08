'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toastProblem } from '@/lib/translation/toastProblem';
import { rememberLanguage } from '@/lib/translation/recents';
import { loadView, saveView } from '@/lib/translation/viewPreference';
import {
  TRANSLATION_EVENTS,
  type AiStatus,
  type JobProgress,
  type MeetingTranslations,
  type MeetingTranslationsState,
} from '@/lib/translation/types';

export type { MeetingTranslationsState } from '@/lib/translation/types';

/** Translations of one saved miting, kept in step with background jobs. */
export function useMeetingTranslations(meetingId: string): MeetingTranslationsState {
  const [info, setInfo] = useState<MeetingTranslations>({ languages: [], total: 0 });
  const [view, setViewState] = useState<string | null | undefined>(() => loadView(meetingId));
  const [lines, setLines] = useState<Record<string, string>>({});
  const [job, setJob] = useState<JobProgress | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const meetingRef = useRef(meetingId);
  meetingRef.current = meetingId;
  // Last progress state per language, so a late start reply cannot revive a finished job.
  const finishedRef = useRef<Record<string, boolean>>({});

  const refreshInfo = useCallback(async () => {
    const next = await invoke<MeetingTranslations>('translation_meeting_languages', { meetingId }).catch(() => null);
    if (!next) return;
    setInfo(next);
    // First visit: show the language this miting was translated into.
    if (viewRef.current === undefined) setViewState(next.languages[0]?.language ?? undefined);
  }, [meetingId]);

  const loadLines = useCallback(
    async (language: string) => {
      const rows = await invoke<{ key: string; text: string }[]>('translation_meeting_lines', {
        meetingId,
        language,
      }).catch(() => []);
      if (viewRef.current === language && meetingRef.current === meetingId) setLines(Object.fromEntries(rows.map((r) => [r.key, r.text])));
    },
    [meetingId]
  );

  useEffect(() => {
    setViewState(loadView(meetingId));
    void refreshInfo();
    invoke<JobProgress[]>('translation_jobs')
      .then((jobs) => setJob(jobs.find((j) => j.meeting_id === meetingId) ?? null))
      .catch(() => undefined);
  }, [meetingId, refreshInfo]);

  useEffect(() => {
    setLines({});
    if (view) void loadLines(view);
  }, [view, loadLines]);

  useEffect(() => {
    const un = listen<JobProgress>(TRANSLATION_EVENTS.progress, (e) => {
      const p = e.payload;
      if (p.meeting_id !== meetingId) return;
      setJob(p.state === 'running' ? p : null);
      finishedRef.current[p.language] = p.state !== 'running';
      if (p.language === viewRef.current) void loadLines(p.language);
      if (p.state === 'running') return;
      void refreshInfo();
      if (p.state === 'failed') toastProblem(p.error);
    });
    return () => {
      un.then((f) => f());
    };
  }, [meetingId, loadLines, refreshInfo]);

  const setView = useCallback(
    (language: string | null) => {
      setViewState(language);
      saveView(meetingId, language);
    },
    [meetingId]
  );

  const refreshAi = useCallback(async () => {
    setAi(await invoke<AiStatus>('translation_ai_status').catch(() => null));
  }, []);

  const translate = useCallback(
    async (language: string) => {
      rememberLanguage(language);
      setView(language);
      finishedRef.current[language] = false;
      try {
        const p = await invoke<JobProgress>('translation_meeting_start', { meetingId, language });
        if (!finishedRef.current[language]) setJob(p.state === 'running' ? p : null);
      } catch (e) {
        toastProblem(e);
      }
    },
    [meetingId, setView]
  );

  const cancel = useCallback(() => {
    if (job) void invoke('translation_meeting_cancel', { meetingId, language: job.language });
  }, [job, meetingId]);

  return { ...info, view: view ?? null, setView, lines, job, ai, refreshAi, translate, cancel };
}
