//! The database row behind a `AskMessage`; JSON columns are decoded here.

use sqlx::FromRow;

use super::AskMessage;

#[derive(FromRow)]
pub(super) struct Row {
    pub(super) id: String,
    pub(super) asked_at_sec: Option<f64>,
    pub(super) question: String,
    pub(super) quotes_json: String,
    pub(super) answer_md: Option<String>,
    pub(super) citations_json: String,
    pub(super) error: Option<String>,
    pub(super) provider: Option<String>,
    pub(super) model: Option<String>,
    pub(super) saved_note_id: Option<String>,
}

impl From<Row> for AskMessage {
    fn from(r: Row) -> Self {
        Self {
            id: r.id,
            asked_at_sec: r.asked_at_sec,
            question: r.question,
            quotes: serde_json::from_str(&r.quotes_json).unwrap_or_default(),
            answer_md: r.answer_md,
            citations: serde_json::from_str(&r.citations_json).unwrap_or_default(),
            error: r.error,
            provider: r.provider,
            model: r.model,
            saved_note_id: r.saved_note_id,
        }
    }
}
