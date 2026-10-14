'use client';

import { type ReactElement, cloneElement, useCallback, useMemo, useRef } from 'react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useLiveCaptions } from '@/contexts/LiveCaptionsContext';
import { lineAt } from '@/lib/notes/anchor';
import { useNotesEnabled } from '@/lib/notes/enabled';
import type { AskLine, LineRef } from '@/lib/notes/types';
import { AskPanel } from './AskPanel';
import { Composer } from './Composer';
import { NotesProvider } from './NotesProvider';
import { TranscriptDecorProvider } from './TranscriptDecor';

/**
 * Notes and Ask AI around the live transcript: cards in the stream, the box
 * under it (passed to the panel as its `composer` slot), the panel on the right.
 */
export function LiveNotesArea({
  title,
  children,
}: {
  title: string;
  children: ReactElement<{ composer?: ReactElement }>;
}) {
  const enabled = useNotesEnabled();
  const { transcripts, currentMeetingId } = useTranscripts();
  const captions = useLiveCaptions();
  const { activeDuration } = useRecordingState();

  const clockRef = useRef(0);
  if (activeDuration !== null && activeDuration !== undefined) clockRef.current = activeDuration;
  const lines = useMemo<LineRef[]>(
    () => [
      ...transcripts.map((t) => ({ key: t.id, at: t.audio_start_time ?? null })),
      ...captions.map((c) => ({ key: `gmeet-${c.id}`, at: c.at ?? null })),
    ],
    [transcripts, captions]
  );
  const askLines = useRef<AskLine[]>([]);
  askLines.current = [
    ...transcripts.map((t) => ({ at: t.audio_start_time ?? null, speaker: null, text: t.text })),
    ...captions.map((c) => ({ at: c.at ?? null, speaker: c.speaker, text: c.text })),
  ];

  // After a reload mid-recording the context id is gone until the next start;
  // the same id is kept in session storage (TranscriptContext writes both).
  const session = currentMeetingId ?? storedSession() ?? 'live';
  const source = useMemo(
    () => ({
      live: true as const,
      session,
      title,
      lines: () => askLines.current,
      clock: () => clockRef.current,
    }),
    [session, title]
  );
  // Live, a cited moment scrolls the transcript to its line.
  const seek = useCallback(
    (sec: number) => {
      const key = lineAt(lines, sec);
      document.getElementById(`segment-${key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    [lines]
  );

  if (!enabled) return children;
  return (
    <NotesProvider key={session} source={source} seek={seek}>
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TranscriptDecorProvider lines={lines}>
            {cloneElement(children, { composer: <Composer /> })}
          </TranscriptDecorProvider>
        </div>
        <AskPanel />
      </div>
    </NotesProvider>
  );
}

function storedSession(): string | null {
  try {
    return window.sessionStorage.getItem('indexeddb_current_meeting_id');
  } catch {
    return null;
  }
}
