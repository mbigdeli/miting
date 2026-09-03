import type { Summary, SummaryResponse, TranscriptSegmentData } from '@/types';
import type { ModelConfig } from '@/components/ModelSettingsModal';
import type { useMeetingData } from '@/hooks/meeting-details/useMeetingData';
import type { useSummaryGeneration } from '@/hooks/meeting-details/useSummaryGeneration';
import type { useTemplates } from '@/hooks/meeting-details/useTemplates';
import type { useCopyOperations } from '@/hooks/meeting-details/useCopyOperations';
import type { useMeetingOperations } from '@/hooks/meeting-details/useMeetingOperations';

/** Props of the meeting-details PageContent (unchanged from the legacy signature). */
export interface PageContentProps {
  meeting: any;
  summaryData: Summary | null;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  onMeetingUpdated?: () => Promise<void>;
  onRefetchTranscripts?: () => Promise<void>;
  // Pagination props for efficient transcript loading
  segments?: any[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
}

/**
 * Everything PageContent wires up for the meeting-details page, bundled once so
 * both layouts (legacy two-panel and the redesigned tabbed view) receive the
 * exact same hook outputs.
 */
export interface DetailsBundle {
  meeting: any;
  meetingData: ReturnType<typeof useMeetingData>;
  summaryGeneration: ReturnType<typeof useSummaryGeneration>;
  templates: ReturnType<typeof useTemplates>;
  copyOperations: ReturnType<typeof useCopyOperations>;
  meetingOperations: ReturnType<typeof useMeetingOperations>;
  // Model config (ConfigContext) + persistence + settings-dialog bridge
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
  onOpenModelSettings: (openFn: () => void) => void;
  // Custom prompt (context for AI summary)
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  // Legacy layout extras
  isRecording: boolean;
  summaryResponse: SummaryResponse | null;
  // Paginated transcript data
  segments?: TranscriptSegmentData[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
  onRefetchTranscripts?: () => Promise<void>;
}
