/**
 * Watches one meeting's summary process.
 *
 * The backend's `summary-status-changed` event is the fast path — it fires the
 * moment the process transitions, so the UI updates without waiting out a poll
 * interval. The timer underneath is only a safety net for a dropped event, so
 * it runs at a low cadence instead of the old 5s hammer.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SUMMARY_STATUS_EVENT, SummaryStatusChanged } from '@/lib/summaryEvents';

const FALLBACK_INTERVAL_MS = 15_000;
/** Slightly past the backend's own 15-minute cap, to avoid racing it. */
const MAX_WAIT_MS = 16 * 60 * 1000;

const TERMINAL = new Set(['completed', 'error', 'failed', 'cancelled']);

export interface SummaryWatcher {
  stop: () => void;
}

export function watchSummary(
  meetingId: string,
  onUpdate: (result: any) => void,
): SummaryWatcher {
  const startedAt = Date.now();
  let stopped = false;
  let inFlight = false;
  let ticks = 0;
  let unlisten: (() => void) | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    unlisten?.();
    unlisten = undefined;
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const result = await invoke('api_get_summary', { meetingId }) as any;
      if (stopped) return;

      ticks += 1;
      onUpdate(result);

      const status = (result?.status ?? '').toLowerCase();
      // 'idle' after the first read means the process row vanished.
      if (TERMINAL.has(status) || (status === 'idle' && ticks > 1)) stop();
    } catch (error) {
      if (stopped) return;
      onUpdate({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      stop();
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => {
    if (Date.now() - startedAt >= MAX_WAIT_MS) {
      onUpdate({
        status: 'error',
        error:
          'Summary generation timed out after 15 minutes. Please try again or check your model configuration.',
      });
      stop();
      return;
    }
    void tick();
  }, FALLBACK_INTERVAL_MS);

  listen<SummaryStatusChanged>(SUMMARY_STATUS_EVENT, (event) => {
    if (event.payload.meeting_id === meetingId) void tick();
  }).then((cleanup) => {
    // The watcher may have finished while the listener was registering.
    if (stopped) cleanup();
    else unlisten = cleanup;
  });

  return { stop };
}
