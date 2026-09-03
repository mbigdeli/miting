//! The one answer both sides read.
//!
//! Chrome only lets the extension open a channel, so the app cannot push a
//! stop. The companion therefore polls — and while it reconciled field by
//! field against its own flags it was a second owner of the state, which is
//! what every "the app stopped but Chrome kept recording" report came down to.
//! This renders the whole recording state in one shape so the companion can
//! mirror it instead of deciding anything.

#[path = "state_view_shape.rs"]
mod shape;
pub use self::shape::{RecordingPhase, StateView};

use crate::audio::active_session::ActiveSession;
use crate::audio::recording_policy::TranscriptSource;

/// What the app knows when the companion asks about a Meet.
pub struct Query<'a> {
    pub session: Option<ActiveSession>,
    pub paused: bool,
    /// The Meet held in a resumable grace window, if any.
    pub grace_code: Option<String>,
    /// The Meet whose five-minute countdown is actually ticking (the user
    /// LEFT that Meet). A user's own pause opens no countdown, and telling
    /// the two apart is what lets a refreshed tab resume by itself while an
    /// intentional pause stays paused.
    pub grace_window_code: Option<String>,
    /// The Meet the companion is asking about.
    pub asking_code: Option<&'a str>,
    pub elapsed_seconds: Option<u64>,
    /// Why the running session is recording no audio, if it is not.
    pub audio_error: Option<String>,
}

/// Build the view the asking companion should act on.
pub fn render(q: Query<'_>) -> StateView {
    let Query {
        session,
        paused,
        grace_code,
        grace_window_code,
        asking_code,
        elapsed_seconds,
        audio_error,
    } = q;
    match session {
        Some(session) => {
            let source = match session.source {
                TranscriptSource::Local => "local",
                TranscriptSource::Companion => "companion",
            };
            // A companion keeps capturing only for the Meet actually being
            // recorded — never for a local recording, and never for a session
            // that belongs to a different call.
            let mine = session.source == TranscriptSource::Companion
                && match (session.meeting_code(), asking_code) {
                    // The code is attached a moment after the recorder starts;
                    // until then a companion session can only be this one.
                    (None, _) => true,
                    (Some(active), Some(asking)) => active == asking,
                    (Some(_), None) => false,
                };
            // A pause with an open countdown is the user having LEFT the Meet
            // (F5, closed tab): rendered as Grace so a returning tab resumes
            // by itself. A pause without one is intentional and stays Paused —
            // nothing may resume it but the user.
            let leaving_pause = paused
                && session.meeting_code().is_some()
                && session.meeting_code().map(str::to_string) == grace_window_code;
            StateView {
                phase: if leaving_pause {
                    RecordingPhase::Grace
                } else if paused {
                    RecordingPhase::Paused
                } else {
                    RecordingPhase::Recording
                },
                source: Some(source),
                meeting_code: session.meeting_code().map(str::to_string),
                companion_should_capture: mine && !paused,
                elapsed_seconds,
                // Only the session that actually failed should show it: a
                // second Meet asking about its own call must not be told the
                // microphone is broken.
                audio_error: audio_error.filter(|_| mine),
            }
        }
        None => {
            let in_grace = matches!((&grace_code, asking_code), (Some(g), Some(a)) if g == a);
            StateView {
                phase: if in_grace {
                    RecordingPhase::Grace
                } else {
                    RecordingPhase::Idle
                },
                source: None,
                meeting_code: grace_code.filter(|_| in_grace),
                companion_should_capture: false,
                elapsed_seconds: None,
                audio_error: None,
            }
        }
    }
}

#[cfg(test)]
#[path = "state_view_starting_tests.rs"]
mod starting_tests;
#[cfg(test)]
#[path = "state_view_fixtures.rs"]
mod state_view_fixtures;
#[cfg(test)]
#[path = "state_view_tests.rs"]
mod tests;
