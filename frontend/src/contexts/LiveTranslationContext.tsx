'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toastProblem } from '@/lib/translation/toastProblem';
import { rememberLanguage } from '@/lib/translation/recents';
import {
  LIVE_OFF,
  TRANSLATION_EVENTS,
  type AiStatus,
  type LineTranslated,
  type LiveStatus,
} from '@/lib/translation/types';

interface LiveTranslationValue {
  status: LiveStatus;
  /** Language of `lines`; stays set after translation is turned off. */
  shownLanguage: string | null;
  /** Finished translations for `shownLanguage`, by sequence id. */
  lines: Record<number, string>;
  ai: AiStatus | null;
  refreshAi: () => Promise<void>;
  start: (language: string) => Promise<void>;
  stop: () => Promise<void>;
}

const LiveTranslationContext = createContext<LiveTranslationValue | null>(null);

/**
 * Live translation state for the record screen. Rust owns the session, so a
 * remount (navigating away and back mid-meeting) just reads it back.
 */
export function LiveTranslationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>(LIVE_OFF);
  const [lines, setLines] = useState<Record<number, string>>({});
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  useEffect(() => {
    if (status.language) setLanguage(status.language);
  }, [status.language]);

  const sawEvent = useRef(false);
  useEffect(() => {
    // An event is newer than the snapshot, so a late snapshot must not win.
    const unStatus = listen<LiveStatus>(TRANSLATION_EVENTS.liveStatus, (e) => {
      sawEvent.current = true;
      setStatus(e.payload);
    });
    invoke<LiveStatus>('translation_live_status')
      .then((s) => !sawEvent.current && setStatus(s))
      .catch(() => undefined);
    return () => {
      unStatus.then((f) => f());
    };
  }, []);

  // Lines for the current language: listen first, then read what Rust has.
  useEffect(() => {
    if (!language) return;
    let active = true;
    setLines({});
    const add = (rows: { sequence_id: number; text: string }[]) =>
      active &&
      setLines((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.sequence_id] = r.text;
        return next;
      });
    const unLine = listen<LineTranslated>(TRANSLATION_EVENTS.line, (e) => {
      if (e.payload.language === language) add([e.payload]);
    });
    unLine
      .then(() => invoke<{ sequence_id: number; text: string }[]>('translation_live_lines', { language }))
      .then(add)
      .catch(() => undefined);
    return () => {
      active = false;
      unLine.then((f) => f());
    };
  }, [language]);

  useEffect(() => {
    if (status.state === 'error') toastProblem(status.error);
  }, [status.state, status.error]);

  const refreshAi = useCallback(async () => {
    setAi(await invoke<AiStatus>('translation_ai_status').catch(() => null));
  }, []);

  const start = useCallback(async (code: string) => {
    rememberLanguage(code);
    try {
      setStatus(await invoke<LiveStatus>('translation_live_start', { language: code }));
    } catch (e) {
      toastProblem(e);
    }
  }, []);

  const stop = useCallback(async () => {
    await invoke('translation_live_stop').catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ status, shownLanguage: language, lines, ai, refreshAi, start, stop }),
    [status, language, lines, ai, refreshAi, start, stop]
  );
  return <LiveTranslationContext.Provider value={value}>{children}</LiveTranslationContext.Provider>;
}

export function useLiveTranslation(): LiveTranslationValue {
  const ctx = useContext(LiveTranslationContext);
  if (!ctx) throw new Error('useLiveTranslation must be used inside LiveTranslationProvider');
  return ctx;
}
