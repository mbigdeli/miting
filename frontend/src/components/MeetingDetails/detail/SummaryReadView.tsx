'use client';

import type { RefObject } from 'react';
import Analytics from '@/lib/analytics';
import { BlockNoteSummaryView, BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import type { Summary } from '@/types';
import RegenerateSplitButton from './RegenerateSplitButton';
import type { MeetingInfo, SummaryStatus, TemplateOption } from './types';

interface SummaryReadViewProps {
  meeting: MeetingInfo;
  meetingTitle: string;
  aiSummary: Summary | null;
  summaryRef: RefObject<BlockNoteSummaryViewRef>;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  onSaveSummary: (summary: Summary | { markdown?: string; summary_json?: any[] }) => Promise<void>;
  onSummaryChange: (summary: Summary) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRegenerateSummary: () => Promise<void>;
  // Regenerate bar
  templateName: string;
  busy: boolean;
  onRegenerateClick: () => void;
  templates: TemplateOption[];
  selectedTemplate: string;
  onTemplateSelect: (id: string, name: string) => void;
  onOpenModelSettings: () => void;
}

/** Summary read view: template + Regenerate bar above the editable summary (mockup 2h). */
export default function SummaryReadView(props: SummaryReadViewProps) {
  const trackRegenerate = () => {
    Analytics.trackButtonClick('regenerate_summary', 'meeting_details');
    void props.onRegenerateSummary();
  };

  return (
    <div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">
          Summarization template:{' '}
          <span className="font-medium text-zinc-600">{props.templateName}</span>
        </span>
        <RegenerateSplitButton
          variant="outline"
          label="Regenerate"
          busy={props.busy}
          onPrimary={props.onRegenerateClick}
          templates={props.templates}
          selectedTemplate={props.selectedTemplate}
          onTemplateSelect={props.onTemplateSelect}
          onOpenModelSettings={props.onOpenModelSettings}
        />
      </div>
      {props.summaryStatus === 'error' && props.summaryError && (
        <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {props.summaryError}
        </div>
      )}
      <div className="mt-2">
        <BlockNoteSummaryView
          ref={props.summaryRef}
          summaryData={props.aiSummary}
          onSave={props.onSaveSummary}
          onSummaryChange={props.onSummaryChange}
          onDirtyChange={props.onDirtyChange}
          status={props.summaryStatus}
          error={props.summaryError}
          onRegenerateSummary={trackRegenerate}
          meeting={{
            id: props.meeting.id,
            title: props.meetingTitle,
            created_at: props.meeting.created_at,
          }}
        />
      </div>
    </div>
  );
}
