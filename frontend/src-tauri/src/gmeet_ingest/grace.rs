//! The grace clock and the companion heartbeat — owned by Rust.
//!
//! The five-minute window used to be a `setInterval` inside the webview, so a
//! navigation, a lost event, or a parallel finalize desynced it from the
//! recorder, and sessions were photographed recording meetings that had ended.
//! The clock lives here now; the webview and the extension only render it.
//!
//! The heartbeat covers the message that never arrives: the extension polls
//! `/gmeet/state` every five seconds while it captures, so the poll IS the
//! liveness signal. Three missed beats mean Meet is gone without a goodbye,
//! and the pause that got lost is synthesized — same grace window, same UI,
//! same expiry — so no session can stay "recording" forever.

use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

pub const GRACE_SECS: u64 = 300;
const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(15);
const WATCHDOG_TICK: Duration = Duration::from_secs(5);

struct Grace {
    code: String,
    session_id: String,
    deadline: Instant,
}

static GRACE: Mutex<Option<Grace>> = Mutex::new(None);
/// Bumped on every begin/cancel; a ticker that reads a stale generation exits.
static GENERATION: AtomicU64 = AtomicU64::new(0);
static LAST_SEEN: Mutex<Option<Instant>> = Mutex::new(None);

/// The extension asked about, or sent captions for, the active session.
pub fn mark_seen() {
    *LAST_SEEN.lock().unwrap() = Some(Instant::now());
}

/// (meeting_code, seconds_left) while a grace window is open.
pub fn state() -> Option<(String, u64)> {
    GRACE.lock().unwrap().as_ref().map(|g| {
        (
            g.code.clone(),
            g.deadline.saturating_duration_since(Instant::now()).as_secs(),
        )
    })
}

/// Open the window and start the one ticker that renders it everywhere.
pub fn begin<R: Runtime>(app: &AppHandle<R>, code: String, session_id: String) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    *GRACE.lock().unwrap() = Some(Grace {
        code: code.clone(),
        session_id: session_id.clone(),
        deadline: Instant::now() + Duration::from_secs(GRACE_SECS),
    });
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            if GENERATION.load(Ordering::SeqCst) != generation {
                return; // superseded by a newer begin, or cancelled
            }
            // The window renders a paused session. When the session is gone —
            // Stop & summarize, the tray, anything that ends the recorder —
            // the window is over, whether or not that path knew a clock
            // existed. Without this the banner outlived every stop: the
            // finalize pipeline never called cancel, so the next tick put it
            // straight back on screen.
            if crate::audio::active_session::current().is_none() {
                *GRACE.lock().unwrap() = None;
                let _ = app.emit("gmeet-grace", json!({ "active": false }));
                return;
            }
            let Some((_, left)) = state() else { return };
            let _ = app.emit(
                "gmeet-grace",
                json!({ "active": true, "meeting_code": code, "gmeet_session_id": session_id, "seconds_left": left }),
            );
            if left == 0 {
                *GRACE.lock().unwrap() = None;
                let _ = app.emit("gmeet-grace", json!({ "active": false }));
                // Expiry finalizes through the same pipeline every stop uses.
                let _ = app.emit(
                    "gmeet-stop-recording",
                    json!({ "gmeet_session_id": session_id, "silent": false }),
                );
                return;
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    });
}

/// Resume, finalize, or handover ended the window.
pub fn cancel<R: Runtime>(app: &AppHandle<R>) {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    if GRACE.lock().unwrap().take().is_some() {
        let _ = app.emit("gmeet-grace", json!({ "active": false }));
    }
}

#[path = "grace_watchdog.rs"]
mod watchdog;
pub use watchdog::{heartbeat_lost, spawn_watchdog};

#[cfg(test)]
#[path = "grace_tests.rs"]
mod tests;
