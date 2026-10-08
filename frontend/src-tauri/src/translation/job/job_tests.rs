//! Saved-miting jobs against the fake AI: batching, skipping what is already
//! translated, progress events, and failure.

use super::*;
use crate::database::repositories::translation::{NewTranslation, TranslationsRepository};
use crate::translation::events::JobState;
use crate::translation::fake_ai::{fake_ai, pool_with_ai, wait_for, Recorder};

async fn meeting(pool: &SqlitePool, id: &str, lines: usize) {
    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at) VALUES (?, 'T', 'n', 'n')",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
    for i in 1..=lines {
        sqlx::query(
            "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time) \
             VALUES (?, ?, ?, '0', ?)",
        )
        .bind(format!("{id}-t{i}"))
        .bind(id)
        .bind(format!("ligne {i}"))
        .bind(i as f64)
        .execute(pool)
        .await
        .unwrap();
    }
}

fn last_state(rec: &Recorder) -> Option<JobState> {
    rec.progress.lock().unwrap().last().map(|p| p.state)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn translates_every_missing_line_in_batches() {
    let pool = pool_with_ai(fake_ai(false).await).await;
    meeting(&pool, "jm1", 23).await;
    let pre = [NewTranslation {
        segment_key: "jm1-t1".into(),
        text: "kept".into(),
    }];
    TranslationsRepository::upsert_many(&pool, "jm1", "fa", None, None, &pre)
        .await
        .unwrap();
    let dir = tempfile::tempdir().unwrap();
    let rp = ResolvedProvider::resolve(&pool, Some(dir.path().into()))
        .await
        .unwrap();
    let rec = Recorder::default();

    let p = begin(
        rec.clone(),
        pool.clone(),
        dir.path().into(),
        rp,
        "jm1".into(),
        "fa".into(),
    )
    .await
    .unwrap();
    assert_eq!((p.done, p.total, p.state), (1, 23, JobState::Running));
    wait_for("completion", || {
        last_state(&rec) == Some(JobState::Completed)
    })
    .await;

    let done: Vec<usize> = rec
        .progress
        .lock()
        .unwrap()
        .iter()
        .map(|p| p.done)
        .collect();
    assert_eq!(
        done,
        vec![1, 11, 21, 23, 23],
        "one event per batch of 10, then completed"
    );
    let rows = TranslationsRepository::list(&pool, "jm1", "fa")
        .await
        .unwrap();
    assert_eq!(rows.len(), 23);
    let text = |k: &str| {
        rows.iter()
            .find(|(key, _)| key == k)
            .map(|(_, t)| t.clone())
    };
    assert_eq!(
        text("jm1-t1").as_deref(),
        Some("kept"),
        "already translated lines are skipped"
    );
    assert_eq!(text("jm1-t2").as_deref(), Some("fa:ligne 2"));
    assert_eq!(text("jm1-t23").as_deref(), Some("fa:ligne 23"));
    assert!(running().iter().all(|j| j.meeting_id != "jm1"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_failing_ai_ends_the_job_with_an_error() {
    let pool = pool_with_ai(fake_ai(true).await).await;
    meeting(&pool, "jm2", 3).await;
    let dir = tempfile::tempdir().unwrap();
    let rp = ResolvedProvider::resolve(&pool, Some(dir.path().into()))
        .await
        .unwrap();
    let rec = Recorder::default();
    begin(
        rec.clone(),
        pool.clone(),
        dir.path().into(),
        rp,
        "jm2".into(),
        "fa".into(),
    )
    .await
    .unwrap();
    wait_for("failure", || last_state(&rec) == Some(JobState::Failed)).await;
    assert!(rec.progress.lock().unwrap().last().unwrap().error.is_some());
    assert!(TranslationsRepository::list(&pool, "jm2", "fa")
        .await
        .unwrap()
        .is_empty());
    assert!(running().iter().all(|j| j.meeting_id != "jm2"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_second_start_joins_the_running_job() {
    let pool = pool_with_ai(fake_ai(false).await).await;
    meeting(&pool, "jm3", 25).await;
    let dir = tempfile::tempdir().unwrap();
    let rp = ResolvedProvider::resolve(&pool, Some(dir.path().into()))
        .await
        .unwrap();
    let rec = Recorder::default();
    let (a, b) = tokio::join!(
        begin(
            rec.clone(),
            pool.clone(),
            dir.path().into(),
            rp.clone(),
            "jm3".into(),
            "fa".into()
        ),
        begin(
            rec.clone(),
            pool.clone(),
            dir.path().into(),
            rp,
            "jm3".into(),
            "fa".into()
        ),
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(a.state, JobState::Running);
    assert_eq!(b.state, JobState::Running);
    wait_for("completion", || {
        last_state(&rec) == Some(JobState::Completed)
    })
    .await;
    let completed = rec
        .progress
        .lock()
        .unwrap()
        .iter()
        .filter(|p| p.state == JobState::Completed)
        .count();
    assert_eq!(completed, 1, "only one job ran");
    assert_eq!(
        TranslationsRepository::list(&pool, "jm3", "fa")
            .await
            .unwrap()
            .len(),
        25
    );
}
