//! The lines a saved miting shows, in reading order, keyed the way
//! translations are stored: the speaker view when the miting has one,
//! otherwise the plain transcript (the same choice the Transcript tab makes).

use sqlx::{Result, SqlitePool};

use super::translation::diarized_key;

pub async fn source_lines(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<(String, String)>> {
    let diarized: Vec<(i64, String)> = sqlx::query_as(
        "SELECT seq, text FROM meeting_diarized_segments WHERE meeting_id = ? ORDER BY seq",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await?;
    if !diarized.is_empty() {
        return Ok(diarized
            .into_iter()
            .map(|(seq, text)| (diarized_key(seq), text))
            .collect());
    }
    sqlx::query_as(
        "SELECT id, transcript FROM transcripts WHERE meeting_id = ? \
         ORDER BY COALESCE(audio_start_time, 0), rowid",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
}

/// Lines not yet translated into `language`, and how many lines there are.
pub async fn missing_lines(
    pool: &SqlitePool,
    meeting_id: &str,
    language: &str,
) -> Result<(Vec<(String, String)>, usize)> {
    let lines = source_lines(pool, meeting_id).await?;
    let have: std::collections::HashSet<String> =
        super::translation::TranslationsRepository::list(pool, meeting_id, language)
            .await?
            .into_iter()
            .map(|(k, _)| k)
            .collect();
    let total = lines.len();
    let todo = lines
        .into_iter()
        .filter(|(k, _)| !have.contains(k))
        .collect();
    Ok((todo, total))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('m', 'T', 'n', 'n')",
        )
        .execute(&pool)
        .await
        .unwrap();
        for (id, text, start) in [("b", "second", 5.0), ("a", "first", 1.0)] {
            sqlx::query(
                "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time) \
                 VALUES (?, 'm', ?, '0', ?)",
            )
            .bind(id)
            .bind(text)
            .bind(start)
            .execute(&pool)
            .await
            .unwrap();
        }
        pool
    }

    #[tokio::test]
    async fn plain_transcript_in_time_order() {
        let lines = source_lines(&pool().await, "m").await.unwrap();
        assert_eq!(
            lines,
            vec![("a".into(), "first".into()), ("b".into(), "second".into())]
        );
    }

    #[tokio::test]
    async fn speaker_view_wins_when_present() {
        let pool = pool().await;
        sqlx::query("INSERT INTO meeting_diarized_segments (meeting_id, seq, text) VALUES ('m', 1, 'Ana: hi')")
            .execute(&pool)
            .await
            .unwrap();
        let lines = source_lines(&pool, "m").await.unwrap();
        assert_eq!(lines, vec![("diarized-1".into(), "Ana: hi".into())]);
    }
}
