use super::*;
use crate::api::TranscriptSegment;
use sqlx::sqlite::SqlitePoolOptions;

async fn pool_with_rows(meeting: &str, rows: &[&str]) -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at) VALUES (?, 'T', 'n', 'n')",
    )
    .bind(meeting)
    .execute(&pool)
    .await
    .unwrap();
    for id in rows {
        sqlx::query("INSERT INTO transcripts (id, meeting_id, transcript, timestamp) VALUES (?, ?, 'x', '0')")
            .bind(id)
            .bind(meeting)
            .execute(&pool)
            .await
            .unwrap();
    }
    pool
}

fn seg(seq: Option<u64>) -> TranscriptSegment {
    TranscriptSegment {
        id: String::new(),
        text: "x".into(),
        timestamp: "0".into(),
        audio_start_time: None,
        audio_end_time: None,
        duration: None,
        sequence_id: seq,
    }
}

// The store is process-wide, so each test uses its own sequence ids and language.

#[tokio::test]
async fn finished_lines_are_written_when_the_transcript_is_saved() {
    record(None, "xa", "claude", "haiku", 7_001, "one".into()).await;
    record(None, "xa", "claude", "haiku", 7_002, "two".into()).await;
    assert!(has("xa", 7_001));
    assert_eq!(finished("xa").len(), 2);
    let pool = pool_with_rows("m1", &["r1", "r2", "r3"]).await;
    link_saved_transcript(
        &pool,
        "m1",
        &[seg(Some(7_001)), seg(Some(7_002)), seg(Some(7_003))],
    )
    .await;
    let mut rows = TranslationsRepository::list(&pool, "m1", "xa")
        .await
        .unwrap();
    rows.sort();
    assert_eq!(
        rows,
        vec![("r1".into(), "one".into()), ("r2".into(), "two".into())]
    );
}

#[tokio::test]
async fn lines_finished_after_the_save_are_written_through() {
    let pool = pool_with_rows("m2", &["r1", "r2"]).await;
    link_saved_transcript(&pool, "m2", &[seg(Some(7_101)), seg(Some(7_102))]).await;
    record(Some(&pool), "xb", "codex", "mini", 7_102, "late".into()).await;
    let rows = TranslationsRepository::list(&pool, "m2", "xb")
        .await
        .unwrap();
    assert_eq!(rows, vec![("r2".into(), "late".into())]);
}

#[tokio::test]
async fn mismatched_or_unnumbered_segments_link_nothing() {
    record(None, "xc", "claude", "haiku", 7_201, "one".into()).await;
    let pool = pool_with_rows("m3", &["r1", "r2"]).await;
    link_saved_transcript(&pool, "m3", &[seg(Some(7_201))]).await; // 1 segment, 2 rows
    link_saved_transcript(&pool, "m3", &[seg(None), seg(None)]).await;
    assert!(TranslationsRepository::list(&pool, "m3", "xc")
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn a_new_session_forgets_saved_links_so_reused_ids_cannot_leak() {
    // A recovered miting saved with ids from a previous run...
    let pool = pool_with_rows("m4", &["r1"]).await;
    link_saved_transcript(&pool, "m4", &[seg(Some(7_301))]).await;
    // ...then a new session starts and reuses that id for a new line.
    forget_saved_links();
    record(
        Some(&pool),
        "xd",
        "claude",
        "haiku",
        7_301,
        "new line".into(),
    )
    .await;
    assert!(TranslationsRepository::list(&pool, "m4", "xd")
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn saved_lines_leave_the_waiting_list() {
    record(None, "xe", "claude", "haiku", 7_401, "one".into()).await;
    let pool = pool_with_rows("m5", &["r1"]).await;
    link_saved_transcript(&pool, "m5", &[seg(Some(7_401))]).await;
    assert!(!has("xe", 7_401));
    assert_eq!(
        TranslationsRepository::list(&pool, "m5", "xe")
            .await
            .unwrap()
            .len(),
        1
    );
}
