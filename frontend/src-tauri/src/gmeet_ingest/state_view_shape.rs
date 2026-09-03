//! The shape the companion receives — kept beside the logic that fills it.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingPhase {
    Idle,
    Recording,
    Paused,
    /// The Meet was left; the session can still be resumed until it expires.
    Grace,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StateView {
    pub phase: RecordingPhase,
    /// `"local"`, `"companion"`, or absent when nothing is recording.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<&'static str>,
    /// The Meet this belongs to, for a companion session or a grace window.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meeting_code: Option<String>,
    /// Whether the companion should consider itself capturing for this Meet.
    pub companion_should_capture: bool,
    /// Seconds recorded so far (pauses excluded). The extension renders this
    /// verbatim; keeping its own counter is how the two timers drifted apart.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elapsed_seconds: Option<u64>,
    /// Why this session is recording no audio, when it is not.
    ///
    /// The session survives a microphone that will not open, because Meet's
    /// captions still arrive and the call is still worth transcribing. That
    /// makes this the only sign anything is wrong, and the user is usually
    /// looking at the Meet tab rather than the app when it happens.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_error: Option<String>,
}
