use super::*;
use sqlx::sqlite::SqlitePoolOptions;

async fn pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open in-memory sqlite");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrate");
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('m1', 'T', 'now', 'now')",
    )
    .execute(&pool)
    .await
    .unwrap();
    for (id, text) in [("t1", "Bonjour"), ("t2", "Merci")] {
        sqlx::query("INSERT INTO transcripts (id, meeting_id, transcript, timestamp) VALUES (?, 'm1', ?, '00:00')")
            .bind(id)
            .bind(text)
            .execute(&pool)
            .await
            .unwrap();
    }
    pool
}

fn row(key: &str, text: &str) -> NewTranslation {
    NewTranslation {
        segment_key: key.into(),
        text: text.into(),
    }
}

#[tokio::test]
async fn stores_and_lists_one_language() {
    let pool = pool().await;
    let rows = [row("t1", "Hello"), row("t2", "Thanks")];
    TranslationsRepository::upsert_many(&pool, "m1", "en", Some("claude"), Some("haiku"), &rows)
        .await
        .unwrap();
    let mut got = TranslationsRepository::list(&pool, "m1", "en")
        .await
        .unwrap();
    got.sort();
    assert_eq!(
        got,
        vec![
            ("t1".into(), "Hello".into()),
            ("t2".into(), "Thanks".into())
        ]
    );
    assert!(TranslationsRepository::list(&pool, "m1", "fa")
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn upsert_replaces_and_languages_report_coverage() {
    let pool = pool().await;
    TranslationsRepository::upsert_many(&pool, "m1", "en", None, None, &[row("t1", "Hi")])
        .await
        .unwrap();
    TranslationsRepository::upsert_many(
        &pool,
        "m1",
        "en",
        None,
        None,
        &[row("t1", "Hello"), row("t2", "Thanks")],
    )
    .await
    .unwrap();
    TranslationsRepository::upsert_many(&pool, "m1", "fa", None, None, &[row("t1", "سلام")])
        .await
        .unwrap();
    let langs = TranslationsRepository::languages(&pool, "m1")
        .await
        .unwrap();
    assert_eq!(
        langs,
        vec![
            LanguageCoverage {
                language: "en".into(),
                translated: 2
            },
            LanguageCoverage {
                language: "fa".into(),
                translated: 1
            },
        ]
    );
    let en = TranslationsRepository::list(&pool, "m1", "en")
        .await
        .unwrap();
    assert!(en.contains(&("t1".into(), "Hello".into())));
}

#[tokio::test]
async fn lines_that_no_longer_exist_are_ignored() {
    let pool = pool().await;
    TranslationsRepository::upsert_many(
        &pool,
        "m1",
        "en",
        None,
        None,
        &[row("t1", "Hello"), row("gone", "x")],
    )
    .await
    .unwrap();
    assert_eq!(
        TranslationsRepository::list(&pool, "m1", "en")
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        TranslationsRepository::languages(&pool, "m1")
            .await
            .unwrap()[0]
            .translated,
        1
    );
}

#[tokio::test]
async fn diarized_keys_match_and_clear() {
    let pool = pool().await;
    sqlx::query(
        "INSERT INTO meeting_diarized_segments (meeting_id, seq, text) VALUES ('m1', 0, 'Salut')",
    )
    .execute(&pool)
    .await
    .unwrap();
    let key = diarized_key(0);
    TranslationsRepository::upsert_many(
        &pool,
        "m1",
        "en",
        None,
        None,
        &[row(&key, "Hi"), row("t1", "Hello")],
    )
    .await
    .unwrap();
    assert_eq!(
        TranslationsRepository::list(&pool, "m1", "en")
            .await
            .unwrap()
            .len(),
        2
    );
    TranslationsRepository::clear_diarized(&pool, "m1")
        .await
        .unwrap();
    assert_eq!(
        TranslationsRepository::list(&pool, "m1", "en")
            .await
            .unwrap(),
        vec![("t1".into(), "Hello".into())]
    );
}

#[tokio::test]
async fn deleting_the_meeting_removes_its_translations() {
    let pool = pool().await;
    TranslationsRepository::upsert_many(&pool, "m1", "en", None, None, &[row("t1", "Hello")])
        .await
        .unwrap();
    sqlx::query("DELETE FROM transcripts WHERE meeting_id = 'm1'")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM meetings WHERE id = 'm1'")
        .execute(&pool)
        .await
        .unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transcript_translations")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 0);
}
