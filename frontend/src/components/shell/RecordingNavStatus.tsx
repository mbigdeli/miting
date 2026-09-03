'use client';

/**
 * Live-recording entry pinned above About in the nav rail: pulsing dot,
 * label and elapsed time. Clicking it returns to the record screen.
 */

import { useRouter } from 'next/navigation';
import { useRecordingState } from '@/contexts/RecordingStateContext';

const formatElapsed = (seconds: number | null) => {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function RecordingNavStatus({ collapsed }: { collapsed: boolean }) {
  const { isRecording, isPaused, activeDuration } = useRecordingState();
  const router = useRouter();

  if (!isRecording) return null;

  const label = isPaused ? 'Paused' : 'Recording';
  return (
    <button
      type="button"
      onClick={() => router.push('/')}
      title={collapsed ? `${label} · ${formatElapsed(activeDuration)}` : 'Go to recording'}
      className="mb-1 flex items-center gap-2.5 rounded-lg bg-red-50 px-2.5 py-2 text-left text-sm hover:bg-red-100"
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          isPaused ? 'bg-amber-500' : 'animate-pulse bg-red-500'
        }`}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate font-medium text-red-700">{label}</span>
          <span className="text-xs tabular-nums text-red-600/80">
            {formatElapsed(activeDuration)}
          </span>
        </>
      )}
    </button>
  );
}
