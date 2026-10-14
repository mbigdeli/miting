'use client';

import { MdMusicNote } from 'react-icons/md';
import { MeetingPlayerBar } from '@/components/player/MeetingPlayerBar';

/**
 * The miting's own recording on the Details tab. It drives the same audio as
 * the Transcript tab's player (MeetingAudioProvider), so the two never play
 * over each other and a position set in one shows in the other.
 */
export function RecordingPlayer({ folderPath }: { folderPath?: string | null }) {
  if (!folderPath) return null;
  return (
    <div className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-900">
        <MdMusicNote size={16} className="text-zinc-500" /> Recording
      </div>
      <MeetingPlayerBar />
    </div>
  );
}
