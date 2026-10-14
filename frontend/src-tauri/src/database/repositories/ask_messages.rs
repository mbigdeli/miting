//! The Ask AI conversation of a miting (see the `meeting_ask_messages`
//! migration): every question with its answer, in the order asked. The
//! conversation starts during recording and continues afterwards.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Result, SqlitePool};

use super::note_cards::Quote;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskMessage {
    pub id: String,
    /// Recording clock when asked live; `None` when asked afterwards.
    pub asked_at_sec: Option<f64>,
    pub question: String,
    #[serde(default)]
    pub quotes: Vec<Quote>,
    pub answer_md: Option<String>,
    /// Start seconds of the transcript lines the answer cites.
    #[serde(default)]
    pub citations: Vec<f64>,
    pub error: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub saved_note_id: Option<String>,
}

#[path = "ask_messages_row.rs"]
mod row;
use row::Row;

pub struct AskMessagesRepository;

impl AskMessagesRepository {
    pub async fn list(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<AskMessage>> {
        let rows: Vec<Row> = sqlx::query_as(
            "SELECT id, asked_at_sec, question, quotes_json, answer_md, citations_json, error, \
             provider, model, saved_note_id FROM meeting_ask_messages \
             WHERE meeting_id = ? ORDER BY created_at, rowid",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(AskMessage::from).collect())
    }

    /// Store messages in order (one answered question, or the questions asked
    /// while recording once the miting is saved). Existing ids are skipped.
    pub async fn insert_many(
        pool: &SqlitePool,
        meeting_id: &str,
        msgs: &[AskMessage],
    ) -> Result<()> {
        let mut tx = pool.begin().await?;
        for (i, m) in msgs.iter().enumerate() {
            // Keep the order of a batch even when it shares one timestamp.
            // Fixed-width fractions, so text order is time order.
            let now = format!("{}#{i:04}", Utc::now().format("%Y-%m-%dT%H:%M:%S%.6fZ"));
            sqlx::query(
                "INSERT OR IGNORE INTO meeting_ask_messages (id, meeting_id, asked_at_sec, question, \
                 quotes_json, answer_md, citations_json, error, provider, model, saved_note_id, created_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&m.id)
            .bind(meeting_id)
            .bind(m.asked_at_sec)
            .bind(&m.question)
            .bind(serde_json::to_string(&m.quotes).unwrap_or_else(|_| "[]".into()))
            .bind(&m.answer_md)
            .bind(serde_json::to_string(&m.citations).unwrap_or_else(|_| "[]".into()))
            .bind(&m.error)
            .bind(&m.provider)
            .bind(&m.model)
            .bind(&m.saved_note_id)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }

    /// Remember which note card an answer was saved as.
    pub async fn set_saved_note(
        pool: &SqlitePool,
        meeting_id: &str,
        id: &str,
        note_id: &str,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE meeting_ask_messages SET saved_note_id = ? WHERE meeting_id = ? AND id = ?",
        )
        .bind(note_id)
        .bind(meeting_id)
        .bind(id)
        .execute(pool)
        .await
        .map(|_| ())
    }
}

#[cfg(test)]
#[path = "ask_messages_tests.rs"]
mod tests;
