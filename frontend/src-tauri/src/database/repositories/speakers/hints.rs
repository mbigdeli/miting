//! AI hints that two voices are one person. Stored on the voice's row until
//! the user merges (the row goes away) or dismisses the hint.

use sqlx::SqlitePool;

/// One hint: voice `from` (label) is probably voice `into` (label).
#[derive(Debug, Clone, PartialEq)]
pub struct MergeHintRow {
    pub from: String,
    pub into: String,
    pub evidence: String,
}

pub async fn set(
    pool: &SqlitePool,
    meeting_id: &str,
    hints: &[MergeHintRow],
) -> Result<(), sqlx::Error> {
    for h in hints {
        sqlx::query(
            "UPDATE meeting_speakers SET ai_merge_into = ?, ai_merge_evidence = ?
             WHERE meeting_id = ? AND label = ?",
        )
        .bind(&h.into)
        .bind(&h.evidence)
        .bind(meeting_id)
        .bind(&h.from)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// The user said the two are different people: drop the hint on `name`.
pub async fn dismiss(pool: &SqlitePool, meeting_id: &str, name: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE meeting_speakers SET ai_merge_into = NULL, ai_merge_evidence = NULL
         WHERE meeting_id = ? AND name = ?",
    )
    .bind(meeting_id)
    .bind(name)
    .execute(pool)
    .await
    .map(|_| ())
}
