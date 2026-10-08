'use client';

import { useMemo, useState } from 'react';
import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import type { TranscriptSegmentData } from '@/types';
import SpeakerTranscript from './SpeakerTranscript';
import { rtlTextProps } from '@/lib/rtl';
import TranscriptSearchRow from './TranscriptSearchRow';
import type { MeetingDetailViewProps } from './types';

type TranscriptTabProps = MeetingDetailViewProps & { diarized: DiarizedSegment[] };

function fmt(sec: number): string {
  const t = Math.floor(sec);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function RawSegmentList({ segments }: { segments: TranscriptSegmentData[] }) {
  if (segments.length === 0) {
    return <p className="py-10 text-center text-[13px] text-zinc-400">No matching transcript lines.</p>;
  }
  return (
    <div className="ph-no-capture grid gap-4">
      {segments.map((s) => {
        const rtl = rtlTextProps(s.text);
        return (
          <div key={s.id}>
            <span className="text-[11.5px] tabular-nums text-zinc-400">{fmt(s.timestamp)}</span>
            <p dir={rtl.dir} className={`mt-1 text-sm leading-7 text-zinc-700 ${rtl.className}`}>
              {s.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Transcript tab: fixed search row, scrolling reading pane (mockups 2i / 2r). */
export default function TranscriptTab(props: TranscriptTabProps) {
  const { diarized, segments = [] } = props;
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hasDiarized = diarized.length > 0;

  const filteredDiarized = useMemo(
    () =>
      q
        ? diarized.filter(
            (s) =>
              s.text.toLowerCase().includes(q) ||
              (s.speaker_name ?? '').toLowerCase().includes(q)
          )
        : diarized,
    [diarized, q]
  );
  const filteredRaw = useMemo(
    () => (q ? segments.filter((s) => s.text.toLowerCase().includes(q)) : segments),
    [segments, q]
  );

  // Raw + unfiltered keeps the virtualized, paginated view; everything else is a plain scroll list.
  const useVirtualized = !hasDiarized && !q;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <TranscriptSearchRow
          query={query}
          onQueryChange={setQuery}
          canCopy={hasDiarized || segments.length > 0}
          onCopyTranscript={props.onCopyTranscript}
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
      <div className={`mt-5 min-h-0 flex-1 ${useVirtualized ? 'overflow-hidden' : 'overflow-y-auto'} pb-8`}>
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
          />
        ) : hasDiarized ? (
          <SpeakerTranscript segments={filteredDiarized} />
        ) : (
          <RawSegmentList segments={filteredRaw} />
        )}
      </div>
    </div>
  );
}
