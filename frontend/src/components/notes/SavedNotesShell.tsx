'use client';

import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { MeetingAudioProvider, useMeetingAudio } from '@/components/player/MeetingAudio';
import { AskPanel } from './AskPanel';
import { NotesProvider } from './NotesProvider';

/**
 * A saved miting's notes, Ask AI panel and shared player. A cited moment
 * (in an answer or a note) opens the Transcript tab and plays from there.
 */
export function SavedNotesShell({
  meetingId,
  folderPath,
  onShowTranscript,
  children,
}: {
  meetingId: string;
  folderPath?: string | null;
  onShowTranscript: () => void;
  children: ReactNode;
}) {
  return (
    <MeetingAudioProvider folderPath={folderPath}>
      <Inner meetingId={meetingId} onShowTranscript={onShowTranscript}>
        {children}
      </Inner>
    </MeetingAudioProvider>
  );
}

function Inner({
  meetingId,
  onShowTranscript,
  children,
}: {
  meetingId: string;
  onShowTranscript: () => void;
  children: ReactNode;
}) {
  const audio = useMeetingAudio();
  // The player re-renders four times a second while playing; notes only need
  // its controls, read through a ref so their context stays stable.
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const source = useMemo(() => ({ live: false as const, meetingId }), [meetingId]);
  const playerTime = useCallback(() => audioRef.current?.position() ?? null, []);
  const seek = useCallback(
    (sec: number) => {
      onShowTranscript();
      audioRef.current?.seek(sec);
    },
    [onShowTranscript]
  );

  return (
    <NotesProvider source={source} playerTime={playerTime} seek={seek}>
      <div className="relative flex h-full min-h-0">
        <div className="min-w-0 flex-1">{children}</div>
        <AskPanel />
      </div>
    </NotesProvider>
  );
}
