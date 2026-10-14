//! Write side of an identification run: replace the acoustic result, then
//! apply AI name suggestions on top.

use chrono::Utc;
use sqlx::SqlitePool;

use super::{NameSuggestion, NewSpeaker};
use crate::diarize_engine::DiarizedSegment;

/// Atomically replace a meeting's diarized segments and voices with a fresh
/// acoustic run. User renames from an earlier run are lost (re-run warns).
pub async fn replace_acoustic(
    pool: &SqlitePool,
    meeting_id: &str,
    segments: &[DiarizedSegment],
    speakers: &[NewSpeaker],
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM meeting_diarized_segments WHERE meeting_id = ?")
        .bind(meeting_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM meeting_speakers WHERE meeting_id = ?")
        .bind(meeting_id)
        .execute(&mut *tx)
        .await?;
    for (seq, seg) in segments.iter().enumerate() {
        sqlx::query(
            "INSERT INTO meeting_diarized_segments
             (meeting_id, seq, start_sec, end_sec, speaker_name, text)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(meeting_id)
        .bind(seq as i64)
        .bind(seg.start)
        .bind(seg.end)
        .bind(&seg.speaker_name)
        .bind(&seg.text)
        .execute(&mut *tx)
        .await?;
    }
    for s in speakers {
        sqlx::query(
            "INSERT INTO meeting_speakers
             (meeting_id, label, name, speech_secs, sample_start_sec, sample_end_sec, side, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(meeting_id)
        .bind(&s.label)
        .bind(&s.label)
        .bind(s.speech_secs)
        .bind(s.sample.map(|x| x.0))
        .bind(s.sample.map(|x| x.1))
        .bind(s.side.map(crate::channels::Side::as_str))
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await
}

/// Apply AI suggestions to voices that still carry their automatic name.
/// A name the user typed is never replaced. Returns how many were applied.
pub async fn apply_suggestions(
    pool: &SqlitePool,
    meeting_id: &str,
    suggestions: &[NameSuggestion],
) -> Result<usize, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mut applied = 0;
    for s in suggestions {
        let taken: Option<(String,)> =
            sqlx::query_as("SELECT label FROM meeting_speakers WHERE meeting_id = ? AND name = ?")
                .bind(meeting_id)
                .bind(&s.name)
                .fetch_optional(&mut *tx)
                .await?;
        if taken.is_some() {
            continue; // never fold two voices together behind the user's back
        }
        let old: Option<(String,)> = sqlx::query_as(
            "UPDATE meeting_speakers SET name = ?, name_source = 'ai', ai_evidence = ?
             WHERE meeting_id = ? AND label = ? AND name_source = 'auto'
             RETURNING label",
        )
        .bind(&s.name)
        .bind(&s.evidence)
        .bind(meeting_id)
        .bind(&s.label)
        .fetch_optional(&mut *tx)
        .await?;
        if old.is_some() {
            sqlx::query(
                "UPDATE meeting_diarized_segments SET speaker_name = ?
                 WHERE meeting_id = ? AND speaker_name = ?",
            )
            .bind(&s.name)
            .bind(meeting_id)
            .bind(&s.label)
            .execute(&mut *tx)
            .await?;
            applied += 1;
        }
    }
    tx.commit().await?;
    Ok(applied)
}
