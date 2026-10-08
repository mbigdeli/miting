'use client';

import { RecordingPlayer } from './RecordingPlayer';

import { FileAudio, FolderOpen } from 'lucide-react';
import Analytics from '@/lib/analytics';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import DeleteMeetingButton from './DeleteMeetingButton';
import ParticipantsCard, { SECTION_HEADING } from './ParticipantsCard';
import ShareMenu from './ShareMenu';
import { computeDurationSec, formatDurationShort, formatMeetingDate, speakerStats } from './meetingFacts';
import { transcriptionLabel } from './transcriptionLabel';
import type { MeetingDetailViewProps } from './types';
import { languageList } from '@/lib/translation/languages';

type DetailsTabProps = MeetingDetailViewProps & { diarized: DiarizedSegment[] };

/** Details tab: the facts about this meeting (mockup 2w). Renders only data the frontend already has. */
export default function DetailsTab(props: DetailsTabProps) {
  const { meeting, diarized, segments = [] } = props;
  const stats = speakerStats(diarized);
  const duration = computeDurationSec(diarized, segments, props.hasMore);
  const segmentCount = diarized.length || props.totalCount || segments.length || 0;
  const folderName = meeting.folder_path
    ? meeting.folder_path.split(/[\\/]/).filter(Boolean).pop() ?? meeting.folder_path
    : null;

  const facts: Array<[string, string]> = [
    ['Created', formatMeetingDate(meeting.created_at)],
    ['Duration', duration !== null ? formatDurationShort(duration) : 'Unknown'],
    ['Transcript segments', segmentCount > 0 ? String(segmentCount) : 'None'],
    [
      'Transcription model',
      transcriptionLabel(meeting.transcription_engine, meeting.transcription_model) ?? 'Unknown',
    ],
    [
      'Summary model',
      meeting.summary_model
        ? [meeting.summary_provider, meeting.summary_model].filter(Boolean).join(' · ')
        : 'Not generated yet',
    ],
    ...(props.translatedLanguages
      ? [['Translations', languageList(props.translatedLanguages) || 'None'] as [string, string]]
      : []),
    ['Miting ID', meeting.id],
  ];

  return (
    <div className="pb-8">
      <RecordingPlayer folderPath={meeting.folder_path} />
      <ParticipantsCard stats={stats} />

      <h3 className={SECTION_HEADING}>About this miting</h3>
      <div className="overflow-hidden rounded-[10px] border border-zinc-200 bg-white">
        {facts.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-6 px-4 py-3 ${
              i < facts.length - 1 ? 'border-b border-zinc-100' : ''
            }`}
          >
            <span className="shrink-0 text-[13px] text-zinc-500">{label}</span>
            <span className="truncate text-[13px] font-medium text-zinc-900" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {folderName && (
        <>
          <h3 className={SECTION_HEADING}>Recording</h3>
          <div className="flex items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-zinc-900 text-white">
              <FileAudio size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-zinc-900" title={meeting.folder_path ?? ''}>
                {folderName}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400">Stored on this device</div>
            </div>
            <button
              type="button"
              title="Open in folder"
              onClick={() => {
                Analytics.trackButtonClick('open_recording_folder', 'meeting_details');
                void props.onOpenMeetingFolder();
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <FolderOpen size={15} />
            </button>
          </div>
        </>
      )}

      <div className="mt-7 flex gap-2">
        <ShareMenu
          label="Export"
          onCopySummary={props.onCopySummary}
          onCopyTranscript={props.onCopyTranscript}
          onOpenMeetingFolder={props.onOpenMeetingFolder}
        />
        <DeleteMeetingButton meetingId={meeting.id} />
      </div>
    </div>
  );
}
