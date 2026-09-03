//! The companion heartbeat — the half of `grace` that notices a Meet gone
//! without a goodbye. Split out to stay under the file-length gate.

use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::{begin, GRACE, HEARTBEAT_TIMEOUT, LAST_SEEN, WATCHDOG_TICK};

/// The decision, kept pure so it is testable: a live (unpaused, not already
/// in grace) companion session whose extension has been silent too long.
pub fn heartbeat_lost(elapsed: Duration, paused: bool, in_grace: bool) -> bool {
    !paused && !in_grace && elapsed >= HEARTBEAT_TIMEOUT
}

/// Watch the heartbeat for the life of the server.
pub fn spawn_watchdog<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(WATCHDOG_TICK).await;
            let Some(session) = crate::audio::active_session::current() else {
                *LAST_SEEN.lock().unwrap() = None;
                continue;
            };
            // Local recordings have no companion to lose.
            let Some(companion) = session.companion.clone() else { continue };
            if session.starting {
                continue;
            }
            let paused = crate::audio::recording_commands::is_recording_paused().await;
            let in_grace = GRACE.lock().unwrap().is_some();
            let elapsed = LAST_SEEN
                .lock()
                .unwrap()
                .map(|t| t.elapsed())
                .unwrap_or(Duration::ZERO);
            if !heartbeat_lost(elapsed, paused, in_grace) {
                continue;
            }
            log::warn!(
                "gmeet grace: companion heartbeat lost for {} — synthesizing the pause",
                companion.meeting_code
            );
            if let Err(e) =
                crate::audio::recording_commands::pause_recording(app.clone()).await
            {
                log::warn!("gmeet grace: synthesized pause failed: {e}");
                continue; // recorder still live; try again next tick
            }
            if let Some(rs) = app.try_state::<crate::gmeet_ingest::GmeetResumeState>() {
                rs.on_pause(&companion.session_id);
            }
            let _ = app.emit(
                "gmeet-pause-recording",
                json!({ "gmeet_session_id": companion.session_id, "synthesized": true }),
            );
            begin(&app, companion.meeting_code, companion.session_id);
        }
    });
}
