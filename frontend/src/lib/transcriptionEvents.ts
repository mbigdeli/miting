/**
 * Interpretation of the backend's transcription events.
 *
 * A transcription failure does not stop audio capture — the pipeline saves
 * audio on a branch that never consults a model. The UI used to end the whole
 * meeting on any `transcription-error`, abandoning a session the backend was
 * still recording. Only an explicitly fatal event may stop a meeting now.
 */

export interface TranscriptionErrorPayload {
  error?: string;
  userMessage?: string;
  actionable?: boolean;
  /** Absent on legacy events, which were never actually fatal. */
  fatal?: boolean;
}

export interface TranscriptionUnavailablePayload {
  reason?: string;
  /** The backend forced audio saving on so the session is not lost entirely. */
  autoSaveForced?: boolean;
}

export type LiveTranscriptionState = 'active' | 'off' | 'degraded';

export function transcriptionErrorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const { userMessage, error } = payload as TranscriptionErrorPayload;
    return userMessage || error || 'Transcription failed';
  }
  return String(payload);
}

/**
 * Recording only stops when the backend says the failure is fatal. Nothing
 * emits `fatal: true` today; the field exists so a genuinely unrecoverable
 * case can stop a meeting without reviving the old behaviour for every
 * per-chunk hiccup.
 */
export function isFatalTranscriptionError(payload: unknown): boolean {
  if (typeof payload === 'object' && payload !== null) {
    return (payload as TranscriptionErrorPayload).fatal === true;
  }
  return false;
}

export function unavailableReason(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const { reason } = payload as TranscriptionUnavailablePayload;
    if (reason) return reason;
  }
  return 'No transcription model is available';
}

export function autoSaveWasForced(payload: unknown): boolean {
  if (typeof payload === 'object' && payload !== null) {
    return (payload as TranscriptionUnavailablePayload).autoSaveForced === true;
  }
  return false;
}
