/**
 * Turns the backend's setup status into the notice the user sees.
 *
 * Nothing here blocks anything — recording works with none of these installed.
 * The notice exists so a user who skipped the downloads can find out why
 * transcription or summaries are unavailable before they go looking.
 */

export interface SetupStatus {
  transcriptionModelAvailable: boolean;
  summaryConfigured: boolean;
  summaryModelReady: boolean;
}

export type SetupItemId = 'transcription' | 'summary';

export interface SetupItem {
  id: SetupItemId;
  title: string;
  description: string;
  actionLabel: string;
}

const TRANSCRIPTION_ITEM: SetupItem = {
  id: 'transcription',
  title: 'No transcription model',
  description:
    'Meetings record as audio only. Install a model to get live transcripts, or transcribe past recordings afterwards.',
  actionLabel: 'Choose a model',
};

const SUMMARY_ITEM: SetupItem = {
  id: 'summary',
  title: 'No summary model',
  description:
    'AI summaries are unavailable until a summary model is downloaded or an AI provider is connected.',
  actionLabel: 'Set up summaries',
};

export function missingSetupItems(status: SetupStatus): SetupItem[] {
  const items: SetupItem[] = [];
  if (!status.transcriptionModelAvailable) items.push(TRANSCRIPTION_ITEM);
  if (!status.summaryConfigured || !status.summaryModelReady) items.push(SUMMARY_ITEM);
  return items;
}

/**
 * Identifies *which* things are missing, so dismissing the notice hides only
 * that set. If setup later regresses differently — a model is deleted, a
 * provider is unconfigured — the fingerprint changes and the notice returns.
 */
export function setupFingerprint(items: SetupItem[]): string {
  return items
    .map((item) => item.id)
    .sort()
    .join(',');
}

export function shouldShowNotice(items: SetupItem[], dismissedFingerprint: string | null): boolean {
  if (items.length === 0) return false;
  return setupFingerprint(items) !== dismissedFingerprint;
}
