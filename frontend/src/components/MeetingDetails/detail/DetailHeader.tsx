'use client';

import { transcriptionLabel } from './transcriptionLabel';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import MetaChips from './MetaChips';
import ShareMenu from './ShareMenu';
import { computeDurationSec, speakerStats } from './meetingFacts';
import type { MeetingDetailViewProps } from './types';

type DetailHeaderProps = MeetingDetailViewProps & {
  diarized: DiarizedSegment[];
  isDirty: boolean;
};

/** Back link, editable title, meta chips and header actions (mockups 2h/2i/2w). */
export default function DetailHeader(props: DetailHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { diarized, segments } = props;

  const durationSec = computeDurationSec(diarized, segments, props.hasMore);
  const participantsCount = diarized.length > 0 ? speakerStats(diarized).length : null;
  const segmentsCount = diarized.length || props.totalCount || segments?.length || 0;

  const finishEdit = () => {
    setEditing(false);
    if (props.isTitleDirty) void props.onSaveTitle();
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push('/meetings')}
        className="inline-flex items-center gap-1 text-[12.5px] text-zinc-400 transition-colors hover:text-zinc-600"
      >
        <ChevronLeft size={13} />
        Mitings
      </button>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={props.meetingTitle}
              onChange={(e) => props.onTitleChange(e.target.value)}
              onBlur={finishEdit}
              onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[22px] font-semibold tracking-[-0.3px] text-zinc-950 focus:border-brand focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setEditing(true)}
              title="Click to rename"
              className="cursor-text truncate text-[22px] font-semibold tracking-[-0.3px] text-zinc-950"
            >
              {props.meetingTitle}
            </h1>
          )}
          <MetaChips
            createdAt={props.meeting.created_at}
            durationSec={durationSec}
            segmentsCount={segmentsCount}
            participantsCount={participantsCount}
            meetUrl={props.meeting.meet_url}
            transcription={transcriptionLabel(
              props.meeting.transcription_engine,
              props.meeting.transcription_model,
            )}
            translated={props.translatedLanguages}
          />
        </div>
        <div className="flex shrink-0 gap-2">
          {props.isDirty && (
            <button
              type="button"
              onClick={() => void props.onSaveAll()}
              disabled={props.isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {props.isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          )}
          <ShareMenu
            onCopySummary={props.onCopySummary}
            onCopyTranscript={props.onCopyTranscript}
            onOpenMeetingFolder={props.onOpenMeetingFolder}
          />
        </div>
      </div>
    </div>
  );
}
