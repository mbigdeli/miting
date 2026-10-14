'use client';

import { useState } from 'react';
import { TranscriptDecorProvider } from '@/components/notes/TranscriptDecor';
import { MeetingPlayerBar } from '@/components/player/MeetingPlayerBar';
import { usePlayingLine } from '@/components/player/usePlayingLine';
import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import SpeakerTranscript from './SpeakerTranscript';
import SpeakersCard from './SpeakersCard';
import TranscriptSearchRow from './TranscriptSearchRow';
import { RawSegmentList } from './RawSegmentList';
import { TranslateMenu } from './TranslateMenu';
import { useTranslatedSegments } from './useTranslatedSegments';
import { useTranscriptView } from './useTranscriptView';
import type { MeetingTranslationsState } from '@/hooks/meeting-details/useMeetingTranslations';
import type { MeetingSpeakers } from '@/hooks/meeting-details/useMeetingSpeakers';
import type { MeetingDetailViewProps } from './types';

type TranscriptTabProps = MeetingDetailViewProps & {
  diarized: DiarizedSegment[];
  translations?: MeetingTranslationsState;
  speakers: MeetingSpeakers;
};

/** Transcript tab: fixed search row, scrolling reading pane (mockups 2i / 2r). */
export default function TranscriptTab(props: TranscriptTabProps) {
  const { diarized, translations } = props;
  const { segments, translationFor, copyTranscript } = useTranslatedSegments(props);
  const { query, setQuery, q, hasDiarized, filteredDiarized, filteredRaw, lines, useVirtualized } =
    useTranscriptView(diarized, segments);
  // The virtualized list scrolls itself (scrollToId); the others by element id.
  const [followId, setFollowId] = useState<string | null>(null);
  const activeKey = usePlayingLine(lines, useVirtualized ? setFollowId : undefined);

  // Compact (empty or in progress) before speakers exist, so it sits above the
  // fixed-height virtualized list; afterwards it scrolls with the transcript.
  const speakersCard = <SpeakersCard folderPath={props.meeting.folder_path} speakers={props.speakers} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        {props.meeting.folder_path && (
          <div className="mb-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5">
            <MeetingPlayerBar fallbackDuration={lines.reduce((m, l) => Math.max(m, l.at ?? 0), 0)} />
          </div>
        )}
        {!hasDiarized && <div className="[&>section]:mb-3">{speakersCard}</div>}
        <TranscriptSearchRow
          query={query}
          onQueryChange={setQuery}
          canCopy={hasDiarized || segments.length > 0}
          onCopyTranscript={copyTranscript}
          translate={translations ? <TranslateMenu t={translations} /> : null}
          meetingId={props.meeting.id}
          meetingFolderPath={props.meeting.folder_path}
          onRefetchTranscripts={props.onRefetchTranscripts}
        />
        {q && !hasDiarized && props.hasMore && (
          <p className="mt-2 text-[11.5px] text-zinc-400">
            Searching the {props.loadedCount ?? segments.length} loaded segments. Scroll the full
            transcript to load more.
          </p>
        )}
      </div>
      <TranscriptDecorProvider lines={lines} activeKey={activeKey}>
      <div className={`mt-5 min-h-0 flex-1 ${useVirtualized ? 'overflow-hidden' : 'overflow-y-auto'} pb-8`}>
        {hasDiarized && !q && speakersCard}
        {useVirtualized ? (
          <VirtualizedTranscriptView
            segments={segments}
            isRecording={false}
            isPaused={false}
            isProcessing={false}
            isStopping={false}
            enableStreaming={false}
            showConfidence={true}
            disableAutoScroll={true}
            hasMore={props.hasMore}
            isLoadingMore={props.isLoadingMore}
            totalCount={props.totalCount}
            loadedCount={props.loadedCount}
            onLoadMore={props.onLoadMore}
            scrollToId={followId}
          />
        ) : hasDiarized ? (
          <SpeakerTranscript
            segments={filteredDiarized}
            translationFor={translationFor}
            speakerNames={props.speakers.speakers.map((s) => s.name)}
            onReassign={(seqs, to) => void props.speakers.reassign(seqs, to)}
          />
        ) : (
          <RawSegmentList segments={filteredRaw} />
        )}
      </div>
      </TranscriptDecorProvider>
    </div>
  );
}
