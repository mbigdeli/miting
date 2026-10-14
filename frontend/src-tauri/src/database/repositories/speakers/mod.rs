//! Speaker identification storage: `meeting_speakers` (one row per voice) kept
//! in step with `meeting_diarized_segments.speaker_name`.

pub mod edit;
pub mod hints;
pub mod query;
pub mod write;

#[cfg(test)]
#[path = "speakers_tests.rs"]
mod speakers_tests;

use serde::Serialize;

/// One speaker as the UI sees it. Meet-diarized meetings have no stored row,
/// so `label`, `sample_*` and `ai_evidence` are empty and `name_source` is "meet".
#[derive(Debug, Clone, Serialize, PartialEq, sqlx::FromRow)]
pub struct SpeakerInfo {
    pub name: String,
    pub label: Option<String>,
    pub name_source: String,
    pub ai_evidence: Option<String>,
    pub speech_secs: f64,
    pub segment_count: i64,
    pub sample_start_sec: Option<f64>,
    pub sample_end_sec: Option<f64>,
    /// "room" or "remote" when the recording logged its channels.
    pub side: Option<String>,
    /// Current name of the speaker the AI thinks this one is, if any.
    pub merge_into: Option<String>,
    pub merge_evidence: Option<String>,
}

/// A voice found by the diarizer, ready to persist.
#[derive(Debug, Clone, PartialEq)]
pub struct NewSpeaker {
    pub label: String,
    pub speech_secs: f64,
    pub sample: Option<(f64, f64)>,
    pub side: Option<crate::channels::Side>,
}

/// An AI name suggestion for one diarizer label.
#[derive(Debug, Clone, PartialEq)]
pub struct NameSuggestion {
    pub label: String,
    pub name: String,
    pub evidence: String,
}
