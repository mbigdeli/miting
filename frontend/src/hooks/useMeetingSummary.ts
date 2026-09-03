import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Summary } from '@/types';
import {
  isTerminalSummaryStatus,
  parseSummaryResponse,
  SummaryResponseLike,
} from '@/lib/summaryPayload';
import {
  SUMMARY_STATUS_EVENT,
  SummaryStatusChanged,
} from '@/lib/summaryEvents';

interface UseMeetingSummaryReturn {
  summary: Summary | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

/**
 * Owns the saved summary for one meeting.
 *
 * The Rust side emits `summary-status-changed` the moment a generation pass
 * lands, so a finished summary appears without a poll tick and without the
 * manual page reload the old fetch-once-on-mount flow required.
 */
export function useMeetingSummary(meetingId: string | null): UseMeetingSummaryReturn {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!meetingId || meetingId === 'intro-call') {
      setSummary(null);
      return;
    }

    try {
      const response = await invoke<SummaryResponseLike>('api_get_summary', { meetingId });
      setSummary(parseSummaryResponse(response));
    } catch (error) {
      // A missing summary is the normal pre-generation state, not a page error.
      console.error('Failed to load meeting summary:', error);
      setSummary(null);
    }
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setIsLoading(true);

    reload().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Live refresh: only terminal transitions carry a payload worth re-reading.
  useEffect(() => {
    if (!meetingId) return;
    let unlisten: (() => void) | undefined;

    listen<SummaryStatusChanged>(SUMMARY_STATUS_EVENT, (event) => {
      if (event.payload.meeting_id !== meetingId) return;
      if (!isTerminalSummaryStatus(event.payload.status)) return;
      void reload();
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => unlisten?.();
  }, [meetingId, reload]);

  return { summary, isLoading, reload };
}
