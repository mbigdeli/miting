'use client';

import { useCallback, useRef, useState } from 'react';
import Analytics from '@/lib/analytics';
import { hasRenderableSummary } from '@/lib/summary-content-state.mjs';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import { runGenerationGate } from '../generationGate';
import ModelSettingsDialog from './ModelSettingsDialog';
import SummaryEmptyState from './SummaryEmptyState';
import SummaryReadView from './SummaryReadView';
import { SummaryErrorState, SummaryLoadingState } from './SummaryStates';
import type { MeetingDetailViewProps } from './types';

type OverviewTabProps = MeetingDetailViewProps & { diarized: DiarizedSegment[] };

/** Overview tab: read the summary (mockup 2h) with generating/empty/failed variants (2v). */
export default function OverviewTab(props: OverviewTabProps) {
  const {
    meeting, aiSummary, summaryStatus, summaryError, onGenerateSummary,
    onRegenerateSummary, onStopGeneration, modelConfig, setModelConfig,
    onSaveModelConfig, onOpenModelSettings, availableTemplates, selectedTemplate,
    onTemplateSelect, customPrompt, onPromptChange, diarized,
  } = props;
  const [isChecking, setIsChecking] = useState(false);
  const openSettingsRef = useRef<() => void>(() => {});
  const registerOpen = useCallback(
    (openFn: () => void) => {
      openSettingsRef.current = openFn;
      onOpenModelSettings?.(openFn);
    },
    [onOpenModelSettings]
  );
  const hasSummary = hasRenderableSummary(aiSummary);
  const isGenerating =
    summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';
  const hasTranscripts =
    diarized.length > 0 ||
    (props.totalCount ?? props.segments?.length ?? meeting.transcripts?.length ?? 0) > 0;
  const runGenerate = async () => {
    Analytics.trackButtonClick(hasSummary ? 'regenerate_summary' : 'generate_summary', 'meeting_details');
    setIsChecking(true);
    try {
      await runGenerationGate({
        modelConfig,
        generate: () => onGenerateSummary(customPrompt),
        openSettings: () => openSettingsRef.current(),
      });
    } finally {
      setIsChecking(false);
    }
  };
  let body;
  if (isGenerating) {
    body = (
      <SummaryLoadingState
        message={summaryStatus === 'regenerating' ? 'Regenerating this summary…' : undefined}
        onStop={onStopGeneration}
      />
    );
  } else if (hasSummary) {
    body = (
      <SummaryReadView
        meeting={meeting}
        meetingTitle={props.meetingTitle}
        aiSummary={aiSummary}
        summaryRef={props.summaryRef}
        summaryStatus={summaryStatus}
        summaryError={summaryError}
        onSaveSummary={props.onSaveSummary}
        onSummaryChange={props.onSummaryChange}
        onDirtyChange={props.onDirtyChange}
        onRegenerateSummary={onRegenerateSummary}
        templateName={availableTemplates.find((t) => t.id === selectedTemplate)?.name ?? selectedTemplate}
        busy={isChecking}
        onRegenerateClick={() => void runGenerate()}
        templates={availableTemplates}
        selectedTemplate={selectedTemplate}
        onTemplateSelect={onTemplateSelect}
        onOpenModelSettings={() => openSettingsRef.current()}
      />
    );
  } else if (summaryStatus === 'error') {
    body = (
      <SummaryErrorState
        error={summaryError}
        onRetry={() => {
          Analytics.trackButtonClick('regenerate_summary', 'meeting_details');
          void onRegenerateSummary();
        }}
      />
    );
  } else {
    body = (
      <SummaryEmptyState
        hasTranscripts={hasTranscripts}
        busy={isChecking}
        onGenerate={() => void runGenerate()}
        templates={availableTemplates}
        selectedTemplate={selectedTemplate}
        onTemplateSelect={onTemplateSelect}
        onOpenModelSettings={() => openSettingsRef.current()}
        customPrompt={customPrompt}
        onPromptChange={onPromptChange}
      />
    );
  }
  return (
    <div>
      <ModelSettingsDialog
        modelConfig={modelConfig}
        setModelConfig={setModelConfig}
        onSave={onSaveModelConfig}
        registerOpen={registerOpen}
      />
      {body}
    </div>
  );
}