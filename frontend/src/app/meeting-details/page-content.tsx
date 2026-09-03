"use client";
import { useEffect, useState } from 'react';
import { SummaryResponse } from '@/types';
import Analytics from '@/lib/analytics';
import NewShellAdapter from '@/components/MeetingDetails/detail/NewShellAdapter';
import type { PageContentProps } from '@/components/MeetingDetails/detail/adapterTypes';
import { useAutoGenerateSummary } from '@/components/MeetingDetails/detail/useAutoGenerateSummary';
import { useModelSettingsBridge } from '@/components/MeetingDetails/detail/useModelSettingsBridge';

// Custom hooks
import { useMeetingData } from '@/hooks/meeting-details/useMeetingData';
import { useSummaryGeneration } from '@/hooks/meeting-details/useSummaryGeneration';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { useCopyOperations } from '@/hooks/meeting-details/useCopyOperations';
import { useMeetingOperations } from '@/hooks/meeting-details/useMeetingOperations';
import { useConfig } from '@/contexts/ConfigContext';

export default function PageContent({
  meeting,
  summaryData,
  shouldAutoGenerate = false,
  onAutoGenerateComplete,
  onMeetingUpdated,
  onRefetchTranscripts,
  // Pagination props for efficient transcript loading
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
}: PageContentProps) {
  // State
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isRecording] = useState(false);
  const [summaryResponse] = useState<SummaryResponse | null>(null);



  // Get model config from ConfigContext
  const { modelConfig, setModelConfig } = useConfig();

  // Model settings dialog bridge + config persistence
  const bridge = useModelSettingsBridge();

  // Custom hooks
  const meetingData = useMeetingData({ meeting, summaryData, onMeetingUpdated });
  const templates = useTemplates();

  const summaryGeneration = useSummaryGeneration({
    meeting,
    transcripts: meetingData.transcripts,
    modelConfig: modelConfig,
    isModelConfigLoading: false, // ConfigContext loads on mount
    selectedTemplate: templates.selectedTemplate,
    onMeetingUpdated,
    updateMeetingTitle: meetingData.updateMeetingTitle,
    setAiSummary: meetingData.setAiSummary,
    onOpenModelSettings: bridge.handleOpenModelSettings,
  });

  const copyOperations = useCopyOperations({
    meeting,
    transcripts: meetingData.transcripts,
    meetingTitle: meetingData.meetingTitle,
    aiSummary: meetingData.aiSummary,
    blockNoteSummaryRef: meetingData.blockNoteSummaryRef,
  });

  const meetingOperations = useMeetingOperations({ meeting });

  // Track page view
  useEffect(() => {
    Analytics.trackPageView('meeting_details');
  }, []);

  // Auto-generate summary when flag is set
  useAutoGenerateSummary({
    shouldAutoGenerate,
    meetingId: meeting.id,
    transcriptsCount: meetingData.transcripts.length,
    provider: modelConfig.provider,
    model: modelConfig.model,
    generate: summaryGeneration.handleGenerateSummary,
    onComplete: onAutoGenerateComplete,
  });


  const bundle = {
    meeting,
    meetingData,
    summaryGeneration,
    templates,
    copyOperations,
    meetingOperations,
    modelConfig,
    setModelConfig,
    onSaveModelConfig: bridge.handleSaveModelConfig,
    onOpenModelSettings: bridge.handleRegisterModalOpen,
    customPrompt,
    setCustomPrompt,
    isRecording,
    summaryResponse,
    segments,
    hasMore,
    isLoadingMore,
    totalCount,
    loadedCount,
    onLoadMore,
    onRefetchTranscripts,
  };

  return <NewShellAdapter {...bundle} />;
}
