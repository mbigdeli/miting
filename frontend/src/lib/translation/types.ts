/** Payloads of the translation commands and events (src-tauri/src/translation). */

/** A line's translation as shown under it, or a placeholder while in flight. */
export interface SegmentTranslation {
  language: string;
  text?: string;
  pending?: boolean;
}

export type LiveState = 'off' | 'preparing' | 'running' | 'error';

export interface LiveStatus {
  state: LiveState;
  language: string | null;
  /** Display name of the AI doing the work; the model is never shown. */
  provider: string | null;
  backlog_total: number;
  backlog_done: number;
  error: string | null;
}

export const LIVE_OFF: LiveStatus = {
  state: 'off',
  language: null,
  provider: null,
  backlog_total: 0,
  backlog_done: 0,
  error: null,
};

export interface LineTranslated {
  sequence_id: number;
  language: string;
  text: string;
}

export interface AiStatus {
  ready: boolean;
  provider: string | null;
  reason: string | null;
}

export type JobState = 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  meeting_id: string;
  language: string;
  done: number;
  total: number;
  state: JobState;
  error: string | null;
}

export interface LanguageCoverage {
  language: string;
  translated: number;
}

export interface MeetingTranslations {
  languages: LanguageCoverage[];
  total: number;
}

/** What the saved-miting translation hook hands to the transcript tab. */
export interface MeetingTranslationsState {
  languages: MeetingTranslations['languages'];
  total: number;
  /** Language shown under each line, or null for the original only. */
  view: string | null;
  setView: (language: string | null) => void;
  lines: Record<string, string>;
  job: JobProgress | null;
  ai: AiStatus | null;
  refreshAi: () => Promise<void>;
  translate: (language: string) => Promise<void>;
  cancel: () => void;
}

export const TRANSLATION_EVENTS = {
  line: 'transcript-translation',
  liveStatus: 'translation-live-status',
  progress: 'translation-progress',
} as const;
