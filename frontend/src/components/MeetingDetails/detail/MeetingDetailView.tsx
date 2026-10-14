'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import DetailHeader from './DetailHeader';
import DetailTabs, { DetailTabId } from './DetailTabs';
import DetailsTab from './DetailsTab';
import OverviewTab from './OverviewTab';
import TranscriptTab from './TranscriptTab';
import type { MeetingDetailViewProps } from './types';
import { useTranslationEnabled } from '@/lib/translation/enabled';
import { useMeetingTranslations } from '@/hooks/meeting-details/useMeetingTranslations';
import { Composer } from '@/components/notes/Composer';
import { SavedNotesShell } from '@/components/notes/SavedNotesShell';
import { YourNotes } from '@/components/notes/YourNotes';
import { useMeetingSpeakers } from '@/hooks/meeting-details/useMeetingSpeakers';

/**
 * Redesigned meeting-detail page: fixed header (back link, title, chips, tabs)
 * with a scrolling tab pane below (mockups 2h/2i/2r/2w). Same hooks and
 * commands as the legacy two-panel layout — only the layout is new.
 */
export default function MeetingDetailView(props: MeetingDetailViewProps) {
  const [tab, setTab] = useState<DetailTabId>('overview');
  const [diarized, setDiarized] = useState<DiarizedSegment[]>([]);
  const [summaryDirty, setSummaryDirty] = useState(false);
  const translationEnabled = useTranslationEnabled();
  const translationState = useMeetingTranslations(props.meeting.id);
  const translations = translationEnabled ? translationState : undefined;
  const view = { ...props, translatedLanguages: translations?.languages.map((l) => l.language) };

  // Unified speaker-attributed transcript (Meet captions merged, or local
  // speaker identification). Reloaded whenever speakers change.
  const [diarizedVersion, setDiarizedVersion] = useState(0);
  const reloadDiarized = useCallback(() => setDiarizedVersion((v) => v + 1), []);
  const speakers = useMeetingSpeakers(props.meeting.id, reloadDiarized);
  useEffect(() => {
    let cancelled = false;
    invoke<DiarizedSegment[]>('api_get_diarized_segments', { meetingId: props.meeting.id })
      .then((rows) => {
        if (!cancelled) setDiarized(rows);
      })
      .catch(() => {
        if (!cancelled) setDiarized([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.meeting.id, diarizedVersion]);

  const showTranscript = useCallback(() => setTab('transcript'), []);

  const handleDirtyChange = (dirty: boolean) => {
    setSummaryDirty(dirty);
    props.onDirtyChange(dirty);
  };

  return (
    <SavedNotesShell meetingId={props.meeting.id} folderPath={props.meeting.folder_path} onShowTranscript={showTranscript}>
    <div className="selectable flex h-full min-h-0 flex-col bg-zinc-50 font-inter text-zinc-950">
      <div className="shrink-0 px-10 pt-6">
        <div className="mx-auto w-full max-w-[720px]">
          <DetailHeader
            {...view}
            diarized={diarized}
            isDirty={props.isTitleDirty || summaryDirty}
          />
          <DetailTabs active={tab} onSelect={setTab} />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'overview' && (
          <div className="h-full overflow-y-auto px-10 pb-10">
            <div className="mx-auto w-full max-w-[720px]">
              <OverviewTab {...view} diarized={diarized} onDirtyChange={handleDirtyChange} />
              <YourNotes />
            </div>
          </div>
        )}
        {tab === 'transcript' && (
          <div className="h-full px-10 pt-[18px]">
            <div className="mx-auto h-full w-full max-w-[720px]">
              <TranscriptTab {...view} diarized={diarized} translations={translations} speakers={speakers} />
            </div>
          </div>
        )}
        {tab === 'details' && (
          <div className="h-full overflow-y-auto px-10">
            <div className="mx-auto w-full max-w-[720px]">
              <DetailsTab {...view} diarized={diarized} />
            </div>
          </div>
        )}
      </div>
      {tab !== 'details' && (
        <div className="shrink-0 px-10 pb-4 pt-2">
          <div className="mx-auto w-full max-w-[720px]">
            <Composer onSummary={tab === 'overview'} />
          </div>
        </div>
      )}
    </div>
    </SavedNotesShell>
  );
}
