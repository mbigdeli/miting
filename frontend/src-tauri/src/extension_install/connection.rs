//! Has the companion extension ever been set up? Home and onboarding hide
//! their "Add to Chrome" suggestions once it has.

use tauri::{AppHandle, Manager, Runtime};

use crate::database::repositories::gmeet_history::GmeetHistoryRepository;
use crate::state::AppState;

use super::seen;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionConnectionStatus {
    /// True when the extension ever reached the app, or any Meet captions
    /// exist (covers users who set it up before `last_seen_at` existed).
    pub ever_connected: bool,
    /// Unix seconds of the last authorized request from the extension.
    pub last_seen_at: Option<i64>,
}

pub fn status_from(last_seen_at: Option<i64>, has_meet_history: bool) -> ExtensionConnectionStatus {
    ExtensionConnectionStatus {
        ever_connected: last_seen_at.is_some() || has_meet_history,
        last_seen_at,
    }
}

/// Never fails: an unreadable file or database reads as "not seen yet", which
/// at worst shows a suggestion the user can dismiss.
#[tauri::command]
pub async fn extension_connection_status<R: Runtime>(
    app: AppHandle<R>,
) -> ExtensionConnectionStatus {
    let last_seen_at = seen::last_seen(&app);
    let has_history = match (last_seen_at, app.try_state::<AppState>()) {
        (Some(_), _) | (None, None) => false,
        (None, Some(state)) => GmeetHistoryRepository::has_captions(state.db_manager.pool()).await,
    };
    status_from(last_seen_at, has_history)
}

#[cfg(test)]
mod tests {
    use super::status_from;

    #[test]
    fn never_seen_without_history_is_not_connected() {
        assert!(!status_from(None, false).ever_connected);
    }

    #[test]
    fn a_recorded_request_or_old_captions_count() {
        assert!(status_from(Some(1), false).ever_connected);
        assert!(status_from(None, true).ever_connected);
    }
}
