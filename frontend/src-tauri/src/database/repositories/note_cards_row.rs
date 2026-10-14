//! The database row behind a `NoteCard`; JSON columns are decoded here.

use sqlx::FromRow;

use super::NoteCard;

#[derive(FromRow)]
pub(super) struct Row {
    pub(super) id: String,
    pub(super) at_sec: Option<f64>,
    pub(super) body_html: String,
    pub(super) quotes_json: String,
    pub(super) source: String,
    pub(super) edited: i64,
}

impl From<Row> for NoteCard {
    fn from(r: Row) -> Self {
        Self {
            id: r.id,
            at_sec: r.at_sec,
            body_html: r.body_html,
            quotes: serde_json::from_str(&r.quotes_json).unwrap_or_default(),
            source: r.source,
            edited: r.edited != 0,
        }
    }
}
