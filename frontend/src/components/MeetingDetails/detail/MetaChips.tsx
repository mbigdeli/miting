'use client';

import { invoke } from '@tauri-apps/api/core';
import { Calendar, Clock, Sparkles, Users, Video } from 'lucide-react';
import { formatDurationShort, formatMeetingDate } from './meetingFacts';

interface MetaChipsProps {
  createdAt: string;
  durationSec: number | null;
  segmentsCount: number;
  participantsCount: number | null;
  /** Engine · model that actually transcribed this miting (per-meeting, from DB). */
  transcription?: string | null;
  /** The Google Meet call this miting was recorded from, if it was one. */
  meetUrl?: string | null;
}

/** "https://meet.google.com/abc-defg-hij?x=1" → "abc-defg-hij" for the chip label. */
function meetCodeFromUrl(url: string): string {
  const match = /meet\.google\.com\/([a-z0-9-]+)/i.exec(url);
  return match?.[1] ?? 'Google Meet';
}

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-[3px] pl-2 pr-2.5 text-[11.5px] text-zinc-600';

/** Meta chip row under the meeting title (mockups 2h/2i/2w). */
export default function MetaChips({
  createdAt,
  durationSec,
  segmentsCount,
  participantsCount,
  transcription,
  meetUrl,
}: MetaChipsProps) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <span className={CHIP}>
        <Calendar size={13} className="text-zinc-500" />
        {formatMeetingDate(createdAt)}
      </span>
      {durationSec !== null && durationSec > 0 && (
        <span className={CHIP} title="Miting duration">
          <Clock size={13} className="text-zinc-500" />
          {formatDurationShort(durationSec)}
        </span>
      )}
      {participantsCount !== null && participantsCount > 0 && (
        <span className={CHIP} title="Speakers detected">
          <Users size={13} className="text-zinc-500" />
          {participantsCount}
        </span>
      )}
      {segmentsCount > 0 && (
        <span className={CHIP} title="Transcript segments">
          {segmentsCount} segments
        </span>
      )}
      {meetUrl && (
        <button
          type="button"
          onClick={() => void invoke('open_external_url', { url: meetUrl }).catch(console.error)}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-[3px] pl-2 pr-2.5 text-[11.5px] text-blue-700 transition-colors hover:bg-blue-100"
          title={`Open ${meetUrl}`}
        >
          <Video size={13} className="text-blue-600" />
          {meetCodeFromUrl(meetUrl)}
        </button>
      )}
      {transcription && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 py-[3px] pl-2 pr-2.5 text-[11.5px] text-teal-800"
          title="Transcribed with"
        >
          <Sparkles size={12} className="fill-brand text-brand" />
          {transcription}
        </span>
      )}
    </div>
  );
}
