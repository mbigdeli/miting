//! Read side of speaker identification.

use sqlx::SqlitePool;

use super::SpeakerInfo;

/// Speakers of a meeting, loudest first. Built from the diarized segments so
/// Meet-diarized meetings (no `meeting_speakers` rows) list their names too,
/// and talk time follows the user's edits (merges, moved lines).
pub async fn list(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<SpeakerInfo>, sqlx::Error> {
    sqlx::query_as::<_, SpeakerInfo>(
        "SELECT TRIM(d.speaker_name) AS name, s.label,
                COALESCE(s.name_source, 'meet') AS name_source, s.ai_evidence,
                SUM(MAX(COALESCE(d.end_sec - d.start_sec, 0), 0)) AS speech_secs,
                COUNT(*) AS segment_count, s.sample_start_sec, s.sample_end_sec, s.side,
                (SELECT t.name FROM meeting_speakers t
                 WHERE t.meeting_id = s.meeting_id AND t.label = s.ai_merge_into
                       AND t.label <> s.label) AS merge_into,
                s.ai_merge_evidence AS merge_evidence
         FROM meeting_diarized_segments d
         LEFT JOIN meeting_speakers s
                ON s.meeting_id = d.meeting_id AND s.name = TRIM(d.speaker_name)
         WHERE d.meeting_id = ? AND TRIM(COALESCE(d.speaker_name, '')) <> ''
         GROUP BY TRIM(d.speaker_name)
         ORDER BY speech_secs DESC",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
}

/// Timed Whisper segments `(start, end, text)` in recording order.
pub async fn transcript_segments(
    pool: &SqlitePool,
    meeting_id: &str,
) -> Result<Vec<(f64, f64, String)>, sqlx::Error> {
    sqlx::query_as::<_, (f64, f64, String)>(
        "SELECT audio_start_time, audio_end_time, transcript FROM transcripts
         WHERE meeting_id = ? AND audio_start_time IS NOT NULL
               AND audio_end_time IS NOT NULL AND TRIM(transcript) <> ''
         ORDER BY audio_start_time ASC, rowid ASC",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
}

/// The meeting's recording folder, when it has one.
pub async fn folder_path(
    pool: &SqlitePool,
    meeting_id: &str,
) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT folder_path FROM meetings WHERE id = ?")
            .bind(meeting_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.and_then(|(p,)| p).filter(|p| !p.trim().is_empty()))
}

/// True when the meeting already has speaker names from another source
/// (Google Meet captions). Acoustic labels must never overwrite real names.
pub async fn has_named_diarization(
    pool: &SqlitePool,
    meeting_id: &str,
) -> Result<bool, sqlx::Error> {
    let (segments, voices): (i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM meeting_diarized_segments WHERE meeting_id = ?1),
                (SELECT COUNT(*) FROM meeting_speakers WHERE meeting_id = ?1)",
    )
    .bind(meeting_id)
    .fetch_one(pool)
    .await?;
    Ok(segments > 0 && voices == 0)
}
