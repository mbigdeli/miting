import type { RefObject } from 'react';
import type { Summary, Transcript, TranscriptSegmentData } from '@/types';
import type { ModelConfig } from '@/components/ModelSettingsModal';
import type { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';

export type SummaryStatus =
  | 'idle'
  | 'processing'
  | 'summarizing'
  | 'regenerating'
  | 'completed'
  | 'error';

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
}

export interface MeetingInfo {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  folder_path?: string | null;
  transcription_engine?: string | null;
  transcription_model?: string | null;
  summary_provider?: string | null;
  summary_model?: string | null;
  /** The Google Meet call this meeting came from; absent for local recordings. */
  meet_url?: string | null;
  transcripts: Transcript[];
}

/**
 * Everything the redesigned tabbed meeting-detail view needs. The values are
 * the exact hook outputs PageContent already wires into the legacy two-panel
 * layout — same logic, new layout.
 */
export interface MeetingDetailViewProps {
  meeting: MeetingInfo;
  // Title editing
  meetingTitle: string;
  onTitleChange: (title: string) => void;
  onSaveTitle: () => Promise<boolean>;
  isTitleDirty: boolean;
  // Summary state + generation
  aiSummary: Summary | null;
  summaryRef: RefObject<BlockNoteSummaryViewRef>;
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  onGenerateSummary: (customPrompt: string) => Promise<void>;
  onRegenerateSummary: () => Promise<void>;
  onStopGeneration: () => void;
  onSaveSummary: (summary: Summary | { markdown?: string; summary_json?: any[] }) => Promise<void>;
  onSummaryChange: (summary: Summary) => void;
  onDirtyChange: (dirty: boolean) => void;
  isSaving: boolean;
  onSaveAll: () => Promise<void>;
  // Model config
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
  /** Registration callback: hands the parent a function that opens model settings. */
  onOpenModelSettings?: (openFn: () => void) => void;
  // Templates
  availableTemplates: TemplateOption[];
  selectedTemplate: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;
  // Custom prompt (context for AI summary)
  customPrompt: string;
  onPromptChange: (value: string) => void;
  // Copy / export / folder operations
  onCopySummary: () => Promise<void>;
  onCopyTranscript: () => void | Promise<void>;
  onOpenMeetingFolder: () => Promise<void>;
  // Paginated transcript data
  segments?: TranscriptSegmentData[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
  onRefetchTranscripts?: () => Promise<void>;
}
