/**
 * Wire contract for the summary lifecycle event emitted by
 * `src-tauri/src/summary/events.rs`. Keep both sides in sync.
 */

export const SUMMARY_STATUS_EVENT = 'summary-status-changed';

export interface SummaryStatusChanged {
  meeting_id: string;
  /** Lowercase: `pending` | `completed` | `failed` | `cancelled`. */
  status: string;
  /** Set only when the summary pass renamed the meeting. */
  meeting_name?: string | null;
}
