use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

use super::{edit, query, write, NameSuggestion, NewSpeaker};
use crate::diarize_engine::DiarizedSegment;

async fn pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('m1', 't', 'x', 'x')",
    )
    .execute(&pool)
    .await
    .unwrap();
    pool
}

fn seg(start: f64, end: f64, speaker: &str, text: &str) -> DiarizedSegment {
    DiarizedSegment {
        start,
        end,
        speaker_name: speaker.into(),
        text: text.into(),
    }
}

fn voice(label: &str, secs: f64) -> NewSpeaker {
    NewSpeaker {
        label: label.into(),
        speech_secs: secs,
        sample: Some((1.0, 7.0)),
        side: None,
    }
}

async fn seeded() -> SqlitePool {
    let pool = pool().await;
    let segments = [
        seg(0.0, 4.0, "Speaker 1", "salam Ali jan"),
        seg(4.0, 9.0, "Speaker 2", "salam, khoobam"),
        seg(9.0, 12.0, "Speaker 1", "shoroo konim"),
    ];
    let voices = [voice("Speaker 1", 7.0), voice("Speaker 2", 5.0)];
    write::replace_acoustic(&pool, "m1", &segments, &voices)
        .await
        .unwrap();
    pool
}

fn names(list: &[super::SpeakerInfo]) -> Vec<String> {
    list.iter().map(|s| s.name.clone()).collect()
}

#[tokio::test]
async fn acoustic_run_lists_voices_loudest_first() {
    let pool = seeded().await;
    let list = query::list(&pool, "m1").await.unwrap();
    assert_eq!(names(&list), ["Speaker 1", "Speaker 2"]);
    assert_eq!(list[0].name_source, "auto");
    assert_eq!(list[0].segment_count, 2);
    assert_eq!(list[0].sample_start_sec, Some(1.0));
    assert!(!query::has_named_diarization(&pool, "m1").await.unwrap());
}

#[tokio::test]
async fn ai_suggestions_rename_lines_but_never_collide_or_override_user() {
    let pool = seeded().await;
    edit::rename(&pool, "m1", "Speaker 2", "Sara")
        .await
        .unwrap();
    let suggestions = [
        NameSuggestion {
            label: "Speaker 1".into(),
            name: "Ali".into(),
            evidence: "salam Ali jan".into(),
        },
        NameSuggestion {
            label: "Speaker 2".into(),
            name: "Reza".into(),
            evidence: "?".into(),
        },
    ];
    assert_eq!(
        write::apply_suggestions(&pool, "m1", &suggestions)
            .await
            .unwrap(),
        1
    );
    let list = query::list(&pool, "m1").await.unwrap();
    assert_eq!(names(&list), ["Ali", "Sara"]);
    assert_eq!(list[0].name_source, "ai");
    assert_eq!(list[0].ai_evidence.as_deref(), Some("salam Ali jan"));
    assert_eq!(list[1].name_source, "user");
}

#[tokio::test]
async fn renaming_onto_an_existing_name_merges_the_voices() {
    let pool = seeded().await;
    edit::rename(&pool, "m1", "Speaker 2", "Speaker 1")
        .await
        .unwrap();
    let list = query::list(&pool, "m1").await.unwrap();
    assert_eq!(names(&list), ["Speaker 1"]);
    assert_eq!(list[0].segment_count, 3);
    assert_eq!(list[0].speech_secs, 12.0);
}

#[tokio::test]
async fn confirm_and_reassign() {
    let pool = seeded().await;
    edit::reassign(&pool, "m1", &[2], "Speaker 2")
        .await
        .unwrap();
    edit::confirm(&pool, "m1", "Speaker 2").await.unwrap();
    let list = query::list(&pool, "m1").await.unwrap();
    let s2 = list.iter().find(|s| s.name == "Speaker 2").unwrap();
    assert_eq!(s2.segment_count, 2);
    assert_eq!(s2.name_source, "user");
}

#[tokio::test]
async fn meet_diarized_meeting_is_protected_and_still_listed() {
    let pool = pool().await;
    sqlx::query(
        "INSERT INTO meeting_diarized_segments (meeting_id, seq, start_sec, end_sec, speaker_name, text)
         VALUES ('m1', 0, 0, 3, 'Mina', 'hi')",
    )
    .execute(&pool)
    .await
    .unwrap();
    assert!(query::has_named_diarization(&pool, "m1").await.unwrap());
    let list = query::list(&pool, "m1").await.unwrap();
    assert_eq!(list[0].name_source, "meet");
    edit::rename(&pool, "m1", "Mina", "Mina R.").await.unwrap();
    assert_eq!(names(&query::list(&pool, "m1").await.unwrap()), ["Mina R."]);
}

#[tokio::test]
async fn transcript_segments_skip_untimed_rows() {
    let pool = pool().await;
    sqlx::query(
        "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time, audio_end_time)
         VALUES ('a', 'm1', 'one', 'x', 0, 2), ('b', 'm1', 'two', 'x', NULL, NULL)",
    )
    .execute(&pool)
    .await
    .unwrap();
    let rows = query::transcript_segments(&pool, "m1").await.unwrap();
    assert_eq!(rows, vec![(0.0, 2.0, "one".to_string())]);
}

#[tokio::test]
async fn side_is_stored_and_listed() {
    let pool = pool().await;
    let mut room = voice("Speaker 1", 4.0);
    room.side = Some(crate::channels::Side::Room);
    let mut remote = voice("Speaker 2", 5.0);
    remote.side = Some(crate::channels::Side::Remote);
    let segments = [
        seg(0.0, 4.0, "Speaker 1", "salam"),
        seg(4.0, 9.0, "Speaker 2", "salam, khoobam"),
    ];
    write::replace_acoustic(&pool, "m1", &segments, &[room, remote])
        .await
        .unwrap();
    let list = query::list(&pool, "m1").await.unwrap();
    assert_eq!(list[0].side.as_deref(), Some("remote"));
    assert_eq!(list[1].side.as_deref(), Some("room"));
}

#[tokio::test]
async fn merge_hint_follows_renames_and_can_be_dismissed() {
    use super::hints::{self, MergeHintRow};
    let pool = seeded().await;
    let hint = MergeHintRow {
        from: "Speaker 2".into(),
        into: "Speaker 1".into(),
        evidence: "salam".into(),
    };
    hints::set(&pool, "m1", &[hint]).await.unwrap();
    edit::rename(&pool, "m1", "Speaker 1", "Ali").await.unwrap();
    let list = query::list(&pool, "m1").await.unwrap();
    let two = list.iter().find(|s| s.name == "Speaker 2").unwrap();
    assert_eq!(two.merge_into.as_deref(), Some("Ali"));
    assert_eq!(two.merge_evidence.as_deref(), Some("salam"));

    hints::dismiss(&pool, "m1", "Speaker 2").await.unwrap();
    let list = query::list(&pool, "m1").await.unwrap();
    assert!(list.iter().all(|s| s.merge_into.is_none()));
}
