//! Frontend notifications for summary lifecycle transitions.
//!
//! Without these the UI can only learn that a summary finished by polling
//! `api_get_summary`, which costs a query per meeting every few seconds and
//! still lags the real completion by up to one poll interval. Emitting the
//! transition lets the detail view and the mitings list update on the spot.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};
use tracing::warn;

/// Event name shared with the frontend listeners.
pub const SUMMARY_STATUS_EVENT: &str = "summary-status-changed";

/// Lowercase status values, matching what `api_get_summary` reports so the
/// frontend can treat an event payload and a polled response identically.
pub mod status {
    pub const PENDING: &str = "pending";
    pub const COMPLETED: &str = "completed";
    pub const FAILED: &str = "failed";
    pub const CANCELLED: &str = "cancelled";
}

#[derive(Debug, Clone, Serialize)]
pub struct SummaryStatusChanged<'a> {
    pub meeting_id: &'a str,
    pub status: &'a str,
    /// Title the summary pass wrote back, when it renamed the meeting.
    pub meeting_name: Option<&'a str>,
}

/// Emits a summary transition. Never fails the caller: a missing webview is
/// not a reason to abandon a finished summary.
pub fn emit_summary_status<R: Runtime>(
    app: &AppHandle<R>,
    meeting_id: &str,
    status: &str,
    meeting_name: Option<&str>,
) {
    let payload = SummaryStatusChanged {
        meeting_id,
        status,
        meeting_name,
    };

    if let Err(e) = app.emit(SUMMARY_STATUS_EVENT, payload) {
        warn!(
            "Failed to emit {} for meeting {}: {}",
            SUMMARY_STATUS_EVENT, meeting_id, e
        );
    }
}
