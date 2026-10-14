//! Note cards on a miting (see the `meeting_note_cards` migration): what the
//! user wrote during or after the meeting, each card pinned to a moment or to
//! transcript text they selected.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Result, SqlitePool};

/// Transcript text a note or question is about, with its start second.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Quote {
    pub quote: String,
    pub at: f64,
}

/// One note card as the frontend sends and receives it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteCard {
    pub id: String,
    pub at_sec: Option<f64>,
    pub body_html: String,
    #[serde(default)]
    pub quotes: Vec<Quote>,
    /// `user` typed it; `ask` is a saved Ask AI answer.
    #[serde(default = "user_source")]
    pub source: String,
    #[serde(default)]
    pub edited: bool,
}

fn user_source() -> String {
    "user".into()
}

#[path = "note_cards_row.rs"]
mod row;
use row::Row;

pub struct NoteCardsRepository;

impl NoteCardsRepository {
    /// Cards of a miting in time order; cards with no moment come last.
    pub async fn list(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<NoteCard>> {
        let rows: Vec<Row> = sqlx::query_as(
            "SELECT id, at_sec, body_html, quotes_json, source, edited FROM meeting_note_cards \
             WHERE meeting_id = ? ORDER BY at_sec IS NULL, at_sec, created_at",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(NoteCard::from).collect())
    }

    /// Insert a card, or replace its text and quotes if it already exists.
    pub async fn upsert(pool: &SqlitePool, meeting_id: &str, card: &NoteCard) -> Result<()> {
        let mut tx = pool.begin().await?;
        upsert_in(&mut tx, meeting_id, card).await?;
        tx.commit().await
    }

    /// Store many cards at once (notes taken while recording, at save time).
    pub async fn upsert_many(
        pool: &SqlitePool,
        meeting_id: &str,
        cards: &[NoteCard],
    ) -> Result<()> {
        let mut tx = pool.begin().await?;
        for card in cards {
            upsert_in(&mut tx, meeting_id, card).await?;
        }
        tx.commit().await
    }

    pub async fn delete(pool: &SqlitePool, meeting_id: &str, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM meeting_note_cards WHERE meeting_id = ? AND id = ?")
            .bind(meeting_id)
            .bind(id)
            .execute(pool)
            .await
            .map(|_| ())
    }
}

async fn upsert_in(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    meeting_id: &str,
    card: &NoteCard,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let quotes = serde_json::to_string(&card.quotes).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO meeting_note_cards \
         (id, meeting_id, at_sec, body_html, quotes_json, source, edited, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) \
         ON CONFLICT(id) DO UPDATE SET body_html = ?4, quotes_json = ?5, edited = ?7, updated_at = ?8",
    )
    .bind(&card.id)
    .bind(meeting_id)
    .bind(card.at_sec)
    .bind(&card.body_html)
    .bind(quotes)
    .bind(&card.source)
    .bind(i64::from(card.edited))
    .bind(now)
    .execute(&mut **tx)
    .await
    .map(|_| ())
}

#[cfg(test)]
#[path = "note_cards_tests.rs"]
pub(crate) mod tests;
