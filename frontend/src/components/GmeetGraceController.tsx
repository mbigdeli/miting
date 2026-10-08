'use client';

import { useEffect, useRef, useState } from 'react';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';

/** How long to give the recorder before reporting a start that never took. */

const GRACE_SECONDS = 300; // 5-minute resume window after a Meet closes/pauses.

/**
 * Miting: owns the Google Meet recording lifecycle events from the ingest
 * server and the post-meeting grace window.
 *
 * - gmeet-start-recording: start miting's live recording (or RESUME if the same
 *   Meet was rejoined within the grace window).
 * - gmeet-pause-recording (Meet closed/paused): pause the recording and start a
 *   5-minute countdown; auto-finalize on expiry. A "Finalize now" button skips
 *   the wait.
 * - gmeet-stop-recording: finalize immediately.
 */
export function GmeetGraceController({ showOnboarding }: { showOnboarding: boolean }) {
  const [graceActive, setGraceActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(GRACE_SECONDS);

  const router = useRouter();
  const pathname = usePathname();
  // The Tauri listeners below are registered once; a ref keeps them reading the
  // current route instead of the one captured when they were attached.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceActiveRef = useRef(false);
  // A gmeet recording is live (recording, or paused within the grace window).
  // Guards against spurious/duplicate pause/stop events finalizing stale state.
  const activeRef = useRef(false);
  const finalizingRef = useRef(false);
  const pendingStartRef = useRef<{ gmeet_session_id: string; title?: string } | null>(null);
  const onboardingRef = useRef(showOnboarding);
  onboardingRef.current = showOnboarding;

  const clearCountdown = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    graceActiveRef.current = false;
    setGraceActive(false);
  };

  const finalizeNow = async (opts?: { silent?: boolean; sessionId?: string | null }) => {
    // Ignore stray finalize when nothing is active (spurious/duplicate stop).
    if (!activeRef.current && !graceActiveRef.current) return;
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    activeRef.current = false;
    clearCountdown();
    const silent = opts?.silent === true;

    // Captured before anything below runs: a new Meet taking over during the
    // grace window rewrites sessionStorage the moment its start is applied,
    // and every read below must keep meaning the meeting being finalized.
    let finalizingSessionId: string | null = opts?.sessionId ?? null;
    if (!finalizingSessionId) {
      try {
        finalizingSessionId = sessionStorage.getItem('gmeet_session_id');
      } catch {}
    }

    // 1) Actually stop the Rust recorder. handleRecordingStop does NOT call
    //    stop_recording (it assumes the UI Stop button already did) — in the
    //    gmeet path nothing else does, so without this the mic is never
    //    released and no WAV is written. This mirrors RecordingControls.
    try {
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;
      await invoke('stop_recording', { args: { save_path: savePath } });
    } catch (err) {
      console.warn('[gmeet] stop_recording failed (may already be stopped):', err);
    }

    // Tell the ingest server this session is finalized so it stops being a
    // resume candidate — a rejoin of the same Meet now starts a fresh session
    // instead of reusing this (summarized) id. Miting is the single source of
    // truth for resumability; the companion extension only asks. Read (don't
    // remove) gmeet_session_id — the post-processing flow still needs it to run
    // diarization on the finalized transcript.
    try {
      if (finalizingSessionId) {
        await invoke('gmeet_clear_resumable', { sessionId: finalizingSessionId });
      }
    } catch (err) {
      console.warn('[gmeet] gmeet_clear_resumable failed:', err);
    }

    // 2) Drive post-processing (DB save → diarization → summary) via the
    //    always-mounted RecordingPostProcessingProvider, which listens for
    //    'recording-stop-complete'. Route-independent, unlike
    //    window.handleRecordingStop (deleted when the "/" route unmounts).
    try {
      await emit('recording-stop-complete', {
        callApi: true,
        gmeetSessionId: finalizingSessionId,
        silent,
      });
    } catch (err) {
      console.warn('[gmeet] emit recording-stop-complete failed; falling back:', err);
      const w = window as unknown as {
        handleRecordingStop?: (callApi: boolean, gmeetSessionId?: string | null, silent?: boolean) => void;
      };
      if (typeof w.handleRecordingStop === 'function') {
        w.handleRecordingStop(true, finalizingSessionId, silent);
      } else {
        toast.error('Could not finalize the miting', {
          description: 'Open Miting and stop the recording manually to save it.',
        });
      }
    } finally {
      finalizingRef.current = false;
      // A start that arrived mid-finalize was queued rather than applied —
      // applying it live would have re-pointed the ids above at the new Meet.
      const queued = pendingStartRef.current;
      if (queued) {
        pendingStartRef.current = null;
        try {
          sessionStorage.setItem('gmeet_session_id', queued.gmeet_session_id);
          if (queued.title) sessionStorage.setItem('gmeet_title', queued.title);
        } catch {}
        activeRef.current = true;
        if (pathnameRef.current !== '/') router.push('/');
      }
    }
  };


  useEffect(() => {
    let cancelled = false;
    let cleanups: UnlistenFn[] = [];

    const startL = listen<{ gmeet_session_id: string; title?: string; resume?: boolean }>(
      'gmeet-start-recording',
      (e) => {
        const { gmeet_session_id, title, resume } = e.payload || ({} as any);
        if (onboardingRef.current) {
          toast.error('Finish setup first', { description: 'Complete onboarding before recording a Meet.' });
          return;
        }
        // Mid-finalize, only queue: the pipeline finalizing the PREVIOUS
        // meeting still needs the ids this handler would overwrite.
        if (finalizingRef.current) {
          pendingStartRef.current = { gmeet_session_id, title };
          return;
        }
        // The ingest server has already launched (or resumed) the recorder in
        // Rust by the time this event arrives. This handler is a view: it
        // remembers the session id for the stop pipeline and brings the record
        // screen forward. It used to *be* the start — navigate, debounce a DOM
        // event, invoke the recorder — and every hop it could drop produced a
        // recording one side believed in and the other did not, including a
        // watchdog here that declared "Could not start recording" over a
        // recorder that was already running.
        clearCountdown();
        activeRef.current = true;
        try {
          sessionStorage.setItem('gmeet_session_id', gmeet_session_id);
          if (title) sessionStorage.setItem('gmeet_title', title);
        } catch {}
        if (resume) {
          toast.success('Resumed recording', { description: 'Continuing the same miting.' });
        }
        if (pathnameRef.current !== '/') {
          router.push('/');
        }
      },
    );

    // Rust pauses the recorder and runs the grace clock now; the events below
    // only render it. A second's worth of ticks going missing costs a second
    // of display, never the session — which is the whole point of the move.
    const graceL = listen<{ active: boolean; seconds_left?: number }>('gmeet-grace', (e) => {
      if (e.payload?.active) {
        graceActiveRef.current = true;
        setGraceActive(true);
        setSecondsLeft(Math.max(0, e.payload.seconds_left ?? 0));
      } else {
        graceActiveRef.current = false;
        setGraceActive(false);
      }
    });

    const pauseL = listen<{ gmeet_session_id: string }>('gmeet-pause-recording', () => {
      // View-only: Rust already paused the recorder and opened the window.
      // (This also covers the SYNTHESIZED pause when the extension's
      // heartbeat is lost — same event, same banner, same Stop button.)
      if (!activeRef.current) activeRef.current = true;
    });

    // Miting declined to start a Meet session — say why, where the user is.
    const refusedL = listen<{ reason?: string }>('gmeet-start-refused', (e) => {
      toast.error('Already recording', {
        description:
          e.payload?.reason ??
          'Miting is already recording. Stop the current recording to start a new Meet.',
        duration: 8000,
      });
    });

    // Tray "Stop Recording" on a companion session: the stop lives in Chrome.
    const trayBlockL = listen('companion-stop-blocked', () => {
      toast.info('Stop this miting from Google Meet', {
        description:
          'The transcript comes from the Meet tab. Press stop in the Meet toolbar, or close the tab.',
        duration: 8000,
      });
    });

    const stopL = listen<{ gmeet_session_id?: string; silent?: boolean }>(
      'gmeet-stop-recording',
      (e) => {
        void finalizeNow({
          silent: e.payload?.silent === true,
          sessionId: e.payload?.gmeet_session_id ?? null,
        });
      },
    );

    Promise.all([startL, graceL, pauseL, stopL, refusedL, trayBlockL]).then((fns) => {
      if (cancelled) fns.forEach((fn) => fn());
      else cleanups = fns;
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!graceActive) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800">Miting ended, paused</span>
        <span className="text-xs text-gray-500">
          Finalizing in {mm}:{ss} (rejoin to resume)
        </span>
      </div>
      <button
        type="button"
        onClick={() => void finalizeNow()}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
      >
        Stop &amp; summarize now
      </button>
    </div>
  );
}
