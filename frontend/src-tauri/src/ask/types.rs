//! Shapes shared by the Ask AI pieces and the frontend.

use serde::{Deserialize, Serialize};

pub use crate::database::repositories::ask_messages::AskMessage;
pub use crate::database::repositories::note_cards::{NoteCard, Quote};

/// One transcript line as the AI sees it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Line {
    /// Start second on the recording clock; `None` when unknown.
    pub at: Option<f64>,
    #[serde(default)]
    pub speaker: Option<String>,
    pub text: String,
}

/// Short summary of the lines before the live window, carried between
/// questions by the frontend so it is only ever extended, never redone.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EarlierSummary {
    pub text: String,
    /// Lines that start before this second are covered by `text`.
    pub until_sec: f64,
}

/// What the frontend sends while recording (there is no saved miting yet).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveContext {
    pub title: String,
    pub lines: Vec<Line>,
    pub now_sec: f64,
    #[serde(default)]
    pub notes: Vec<NoteCard>,
    #[serde(default)]
    pub history: Vec<AskMessage>,
    #[serde(default)]
    pub earlier_summary: Option<EarlierSummary>,
}

/// The answer, plus the updated earlier summary for the next live question.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskReply {
    pub message: AskMessage,
    pub earlier_summary: Option<EarlierSummary>,
}

/// Everything one question is built from.
#[derive(Debug, Clone, Default)]
pub struct Material {
    pub title: String,
    pub date: Option<String>,
    pub lines: Vec<Line>,
    /// Set while recording: the live clock.
    pub now_sec: Option<f64>,
    pub earlier: Option<EarlierSummary>,
    pub notes: Vec<NoteCard>,
    /// The AI summary of a saved miting, used only as a map.
    pub summary_md: Option<String>,
    pub history: Vec<AskMessage>,
    pub quotes: Vec<Quote>,
    pub question: String,
}

/// `mm:ss`, or `h:mm:ss` past the hour.
pub fn clock(sec: f64) -> String {
    let s = sec.max(0.0) as u64;
    let (h, m, s) = (s / 3600, (s % 3600) / 60, s % 60);
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m:02}:{s:02}")
    }
}
