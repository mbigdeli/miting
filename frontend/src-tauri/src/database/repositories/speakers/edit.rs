//! User edits: rename (or merge, when the new name is already taken),
//! confirm an AI suggestion, and move one line to another speaker.

use sqlx::SqlitePool;

/// Rename every line of `from` to `to`. If another voice is already called
/// `to`, the two become one speaker (merge). Works for Meet-diarized meetings
/// too, which have no `meeting_speakers` rows.
pub async fn rename(
    pool: &SqlitePool,
    meeting_id: &str,
    from: &str,
    to: &str,
) -> Result<(), sqlx::Error> {
    let to = to.trim();
    if to.is_empty() || to == from {
        return confirm(pool, meeting_id, from).await;
    }
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE meeting_diarized_segments SET speaker_name = ?
         WHERE meeting_id = ? AND TRIM(speaker_name) = ?",
    )
    .bind(to)
    .bind(meeting_id)
    .bind(from)
    .execute(&mut *tx)
    .await?;
    let target: Option<(String,)> =
        sqlx::query_as("SELECT label FROM meeting_speakers WHERE meeting_id = ? AND name = ?")
            .bind(meeting_id)
            .bind(to)
            .fetch_optional(&mut *tx)
            .await?;
    if let Some((label,)) = target {
        // Merge: fold talk time into the surviving voice, drop the other.
        sqlx::query(
            "UPDATE meeting_speakers SET name_source = 'user', speech_secs = speech_secs +
               COALESCE((SELECT speech_secs FROM meeting_speakers WHERE meeting_id = ?1 AND name = ?2), 0)
             WHERE meeting_id = ?1 AND label = ?3",
        )
        .bind(meeting_id)
        .bind(from)
        .bind(&label)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "DELETE FROM meeting_speakers WHERE meeting_id = ? AND name = ? AND label <> ?",
        )
        .bind(meeting_id)
        .bind(from)
        .bind(&label)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "UPDATE meeting_speakers SET name = ?, name_source = 'user', ai_evidence = NULL
             WHERE meeting_id = ? AND name = ?",
        )
        .bind(to)
        .bind(meeting_id)
        .bind(from)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await
}

/// Accept the current name (typically an AI suggestion) as the user's own.
pub async fn confirm(pool: &SqlitePool, meeting_id: &str, name: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE meeting_speakers SET name_source = 'user' WHERE meeting_id = ? AND name = ?",
    )
    .bind(meeting_id)
    .bind(name)
    .execute(pool)
    .await
    .map(|_| ())
}

/// Attribute the lines `seqs` to `speaker` (a misheard turn).
pub async fn reassign(
    pool: &SqlitePool,
    meeting_id: &str,
    seqs: &[i64],
    speaker: &str,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for seq in seqs {
        sqlx::query(
            "UPDATE meeting_diarized_segments SET speaker_name = ? WHERE meeting_id = ? AND seq = ?",
        )
        .bind(speaker.trim())
        .bind(meeting_id)
        .bind(seq)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await
}
