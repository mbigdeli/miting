//! Whether the companion may start or adopt a session right now.
//!
//! Split from `active_session` to stay under the file-length gate; the rule
//! itself is unchanged. `super` is the session module, so this file reads the
//! same state the answers are about.

use super::{current, TranscriptSource};

/// Why the companion may not start a recording right now.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompanionRefusal {
    /// The user is recording something of their own in the app.
    AppIsRecording,
    /// A different Meet is already being recorded.
    OtherMeeting { meeting_code: String },
}

impl CompanionRefusal {
    /// User-facing text; the extension shows this verbatim.
    pub fn message(&self) -> String {
        match self {
            Self::AppIsRecording => {
                "Miting is already recording something else. Stop it first.".to_string()
            }
            Self::OtherMeeting { meeting_code } => {
                format!("Miting is already recording another Meet ({meeting_code}).")
            }
        }
    }
}

/// Decide whether the companion may start/adopt a session for `meeting_code`.
///
/// Adopting the same meeting is normal — the extension's service worker can
/// restart mid-call and lose its id — so only a *different* recording is a
/// conflict.
pub fn admit_companion(code: &str) -> Result<(), CompanionRefusal> {
    match current() {
        None => Ok(()),
        Some(session) => match session.source {
            TranscriptSource::Local => Err(CompanionRefusal::AppIsRecording),
            TranscriptSource::Companion => match session.meeting_code() {
                Some(active) if active == code => Ok(()),
                Some(active) => Err(CompanionRefusal::OtherMeeting {
                    meeting_code: active.to_string(),
                }),
                None => Ok(()),
            },
        },
    }
}
