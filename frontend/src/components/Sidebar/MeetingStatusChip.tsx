'use client';

import { Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import type { MeetingStatus } from './SidebarProvider';

/**
 * Miting: compact per-meeting status chip for the sidebar list.
 * Priority: enhancing > in-progress > summary failed > summarized > diarized.
 *
 * Every state here describes the *summary*, not the miting. A recording whose
 * audio and transcript saved perfectly was being labelled "Failed" because no
 * summary model was installed — so the chip names the step that failed and
 * says the transcript is safe.
 */
export function MeetingStatusChip({
  status,
  enhancing = false,
}: {
  status?: MeetingStatus;
  enhancing?: boolean;
}) {
  if (enhancing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
        <Loader2 className="h-3 w-3 animate-spin" /> Enhancing
      </span>
    );
  }
  if (!status) return null;

  const s = (status.summary_status || '').toLowerCase();
  const running = s === 'pending' || s === 'running' || s === 'processing';

  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
        <Loader2 className="h-3 w-3 animate-spin" /> Summarizing
      </span>
    );
  }
  if (s === 'failed' || s === 'error') {
    return (
      <span
        title="The recording and transcript are saved. Only the AI summary did not run. Open the miting to try again."
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
      >
        <AlertCircle className="h-3 w-3" /> No summary
      </span>
    );
  }
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Summarized
      </span>
    );
  }
  if (status.diarized) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
        <Users className="h-3 w-3" /> Diarized
      </span>
    );
  }
  return null;
}
