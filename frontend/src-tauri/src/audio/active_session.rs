//! Who owns the recording that is running right now.
//!
//! The app and the Google Meet companion could each start a recording without
//! knowing about the other. This module is the single fact both sides consult,
//! and — since the rewrite — the single place a companion start is decided:
//! the ingest server admits a Meet, opens the session here as `starting`, and
//! launches the recorder itself. The webview only renders what happened.
//!
//! The old shape routed a start through seven hops: an HTTP handler, a pending
//! claim with a TTL, a Tauri event, sessionStorage, a route navigation, a
//! debounced DOM event, and finally an invoke back into Rust. Every sync bug
//! shipped in the last month lived on one of those hops.

use super::recording_policy::TranscriptSource;
use std::sync::Mutex;

/// The Meet a companion session belongs to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompanionSession {
    pub meeting_code: String,
    pub session_id: String,
    pub title: Option<String>,
}

/// The session in progress, if any.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveSession {
    pub source: TranscriptSource,
    /// The Meet this belongs to; `None` for a local recording.
    pub companion: Option<CompanionSession>,
    /// True from admission until the recorder is actually up. `/gmeet/state`
    /// reports a starting session as recording so the companion holds on —
    /// answering "idle" during device setup is what used to tear captures
    /// down at second twenty.
    pub starting: bool,
}

impl ActiveSession {
    pub fn meeting_code(&self) -> Option<&str> {
        self.companion.as_ref().map(|c| c.meeting_code.as_str())
    }
}

static ACTIVE: Mutex<Option<ActiveSession>> = Mutex::new(None);

/// The ingest server admitted this Meet and is about to launch the recorder.
/// From this moment the session exists and `/gmeet/state` answers for it.
pub fn begin_companion_start(companion: CompanionSession) {
    *ACTIVE.lock().unwrap() = Some(ActiveSession {
        source: TranscriptSource::Companion,
        companion: Some(companion),
        starting: true,
    });
}

/// The recorder is up. Keeps an already-attached Meet: replacing the session
/// here would throw away what the ingest server opened moments earlier.
pub fn begin(source: TranscriptSource) {
    let mut guard = ACTIVE.lock().unwrap();
    match guard.as_mut() {
        Some(session) => {
            session.source = source;
            session.starting = false;
        }
        None => {
            *guard = Some(ActiveSession {
                source,
                companion: None,
                starting: false,
            })
        }
    }
}

/// Name the Meet a session belongs to after the fact. A no-op when nothing is
/// running: a session here means "a recording is in progress" to everything
/// that reads it, and inventing one from an attach is how the app once
/// restarted a recording after the user had ended the call.
pub fn attach_companion(companion: CompanionSession) {
    if let Some(session) = ACTIVE.lock().unwrap().as_mut() {
        session.companion = Some(companion);
    }
}

/// The launch failed and nothing else will clear the `starting` session —
/// `end()` belongs to the stop path of a recorder that never came up.
pub fn abandon_start() {
    let mut guard = ACTIVE.lock().unwrap();
    if guard.as_ref().is_some_and(|s| s.starting) {
        *guard = None;
    }
}

pub fn end() {
    *ACTIVE.lock().unwrap() = None;
    // Cleared here so the next session cannot inherit the last one's fault.
    super::audio_error::set(None);
}

pub fn current() -> Option<ActiveSession> {
    ACTIVE.lock().unwrap().clone()
}

#[path = "active_session_admission.rs"]
mod admission;
pub use admission::{admit_companion, CompanionRefusal};

#[cfg(test)]
#[path = "active_session_tests.rs"]
mod tests;
