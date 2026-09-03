'use client';

import MeetingDetailView from './MeetingDetailView';
import type { DetailsBundle } from './adapterTypes';

/** Maps the PageContent hook bundle onto the redesigned tabbed detail view. */
export default function NewShellAdapter(p: DetailsBundle) {
  const { meetingData, summaryGeneration, templates, copyOperations, meetingOperations } = p;
  return (
    <MeetingDetailView
      meeting={p.meeting}
      meetingTitle={meetingData.meetingTitle}
      onTitleChange={meetingData.handleTitleChange}
      onSaveTitle={meetingData.handleSaveMeetingTitle}
      isTitleDirty={meetingData.isTitleDirty}
      aiSummary={meetingData.aiSummary}
      summaryRef={meetingData.blockNoteSummaryRef}
      summaryStatus={summaryGeneration.summaryStatus}
      summaryError={summaryGeneration.summaryError}
      onGenerateSummary={summaryGeneration.handleGenerateSummary}
      onRegenerateSummary={summaryGeneration.handleRegenerateSummary}
      onStopGeneration={summaryGeneration.handleStopGeneration}
      onSaveSummary={meetingData.handleSaveSummary}
      onSummaryChange={meetingData.handleSummaryChange}
      onDirtyChange={meetingData.setIsSummaryDirty}
      isSaving={meetingData.isSaving}
      onSaveAll={meetingData.saveAllChanges}
      modelConfig={p.modelConfig}
      setModelConfig={p.setModelConfig}
      onSaveModelConfig={p.onSaveModelConfig}
      onOpenModelSettings={p.onOpenModelSettings}
      availableTemplates={templates.availableTemplates}
      selectedTemplate={templates.selectedTemplate}
      onTemplateSelect={templates.handleTemplateSelection}
      customPrompt={p.customPrompt}
      onPromptChange={p.setCustomPrompt}
      onCopySummary={copyOperations.handleCopySummary}
      onCopyTranscript={copyOperations.handleCopyTranscript}
      onOpenMeetingFolder={meetingOperations.handleOpenMeetingFolder}
      segments={p.segments}
      hasMore={p.hasMore}
      isLoadingMore={p.isLoadingMore}
      totalCount={p.totalCount}
      loadedCount={p.loadedCount}
      onLoadMore={p.onLoadMore}
      onRefetchTranscripts={p.onRefetchTranscripts}
    />
  );
}
