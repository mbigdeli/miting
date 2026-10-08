//! Stored translations of transcript lines (see the `transcript_translations`
//! migration). Keys are the transcript row id, or `diarized-{seq}` for the
//! speaker view. Reads only count rows whose line still exists, so a
//! retranscribed or re-diarized miting never shows stale translations.

use chrono::Utc;
use serde::Serialize;
use sqlx::{Result, SqlitePool};

/// Key used for a diarized segment, mirrored by the frontend.
pub fn diarized_key(seq: i64) -> String {
    format!("diarized-{seq}")
}

/// One translated line ready to store.
#[derive(Debug, Clone)]
pub struct NewTranslation {
    pub segment_key: String,
    pub text: String,
}

/// A language a miting has been translated into, with coverage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LanguageCoverage {
    pub language: String,
    pub translated: i64,
}

/// Matches a key against the lines the miting has right now.
const LIVE_KEY: &str = "(segment_key IN (SELECT id FROM transcripts WHERE meeting_id = ?1) \
     OR segment_key IN (SELECT 'diarized-' || seq FROM meeting_diarized_segments WHERE meeting_id = ?1))";

pub struct TranslationsRepository;

impl TranslationsRepository {
    /// Insert or replace translations for one language in one transaction.
    pub async fn upsert_many(
        pool: &SqlitePool,
        meeting_id: &str,
        language: &str,
        provider: Option<&str>,
        model: Option<&str>,
        rows: &[NewTranslation],
    ) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let now = Utc::now().to_rfc3339();
        let mut tx = pool.begin().await?;
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO transcript_translations \
                 (meeting_id, segment_key, language, text, provider, model, created_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(meeting_id)
            .bind(&row.segment_key)
            .bind(language)
            .bind(&row.text)
            .bind(provider)
            .bind(model)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }

    /// All current translations of a miting in one language: (key, text).
    pub async fn list(
        pool: &SqlitePool,
        meeting_id: &str,
        language: &str,
    ) -> Result<Vec<(String, String)>> {
        let sql = format!(
            "SELECT segment_key, text FROM transcript_translations \
             WHERE meeting_id = ?1 AND language = ?2 AND {LIVE_KEY}"
        );
        sqlx::query_as(&sql)
            .bind(meeting_id)
            .bind(language)
            .fetch_all(pool)
            .await
    }

    /// Languages with at least one current line, most covered first.
    pub async fn languages(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<LanguageCoverage>> {
        let sql = format!(
            "SELECT language, COUNT(*) FROM transcript_translations \
             WHERE meeting_id = ?1 AND {LIVE_KEY} GROUP BY language ORDER BY COUNT(*) DESC, language"
        );
        let rows: Vec<(String, i64)> = sqlx::query_as(&sql)
            .bind(meeting_id)
            .fetch_all(pool)
            .await?;
        Ok(rows
            .into_iter()
            .map(|(language, translated)| LanguageCoverage {
                language,
                translated,
            })
            .collect())
    }

    /// Drop every translation of the speaker view (it was rebuilt).
    pub async fn clear_diarized(pool: &SqlitePool, meeting_id: &str) -> Result<()> {
        sqlx::query(
            "DELETE FROM transcript_translations WHERE meeting_id = ? AND segment_key LIKE 'diarized-%'",
        )
        .bind(meeting_id)
        .execute(pool)
        .await
        .map(|_| ())
    }
}

#[cfg(test)]
#[path = "translation_tests.rs"]
mod tests;
