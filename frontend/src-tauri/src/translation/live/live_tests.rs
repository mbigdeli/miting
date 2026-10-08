//! End to end without the UI: an in-memory database configured for a custom
//! OpenAI-compatible endpoint, a tiny fake server standing in for the AI, and
//! a recording notifier. Exercises the real worker, background pass, store,
//! status changes and the save link.

use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;
use tokio::sync::mpsc;

use super::session::{begin, Launch};
use super::*;
use crate::database::repositories::translation::TranslationsRepository;
use crate::translation::events::LiveState;
use crate::translation::fake_ai::{fake_ai, pool_with_ai, wait_for, Recorder};

/// Live sessions are process-wide; run these tests one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn launch(
    fail: bool,
    earlier: Vec<(u64, String)>,
    first_live: u64,
) -> (
    Recorder,
    mpsc::UnboundedSender<(u64, String)>,
    SqlitePool,
    tempfile::TempDir,
) {
    let pool = pool_with_ai(fake_ai(fail).await).await;
    let dir = tempfile::tempdir().unwrap();
    let rp = ResolvedProvider::resolve(&pool, Some(dir.path().to_path_buf()))
        .await
        .unwrap();
    let (tx, rx) = mpsc::unbounded_channel();
    let rec = Recorder::default();
    let l = Launch {
        rp,
        dir: dir.path().to_path_buf(),
        pool: Some(pool.clone()),
        language: "fa".into(),
        rx,
        first_live: Arc::new(AtomicU64::new(first_live)),
        earlier,
        close: Box::new(|| {}),
    };
    let status = begin(rec.clone(), l);
    assert_eq!(status.state, LiveState::Preparing);
    assert_eq!(status.provider.as_deref(), Some("Custom OpenAI"));
    (rec, tx, pool, dir)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn new_and_earlier_lines_are_translated_then_saved_with_the_miting() {
    let _guard = SERIAL.lock().await;
    let earlier = vec![
        (879_001, "Avant".to_string()),
        (880_001, "Bonjour".to_string()),
    ];
    let (rec, tx, pool, _dir) = launch(false, earlier, 880_001).await;
    tx.send((880_001, "Bonjour".into())).unwrap();
    tx.send((880_002, "Merci".into())).unwrap();
    drop(tx); // recording stopped: no more lines

    wait_for("session to end", || {
        current_status().state == LiveState::Off
    })
    .await;
    let lines = rec.lines.lock().unwrap().clone();
    let text = |seq| {
        lines
            .iter()
            .find(|l| l.sequence_id == seq)
            .map(|l| l.text.clone())
    };
    assert_eq!(
        text(879_001).as_deref(),
        Some("fa:Avant"),
        "earlier line via background pass"
    );
    assert_eq!(text(880_001).as_deref(), Some("fa:Bonjour"));
    assert_eq!(text(880_002).as_deref(), Some("fa:Merci"));
    assert_eq!(
        lines.iter().filter(|l| l.sequence_id == 880_001).count(),
        1,
        "no double work"
    );
    let states = rec.states.lock().unwrap().clone();
    assert_eq!(states.first(), Some(&LiveState::Preparing));
    assert!(states.contains(&LiveState::Running));

    sqlx::query(
        "INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('m1','T','n','n')",
    )
    .execute(&pool)
    .await
    .unwrap();
    for id in ["r1", "r2", "r3"] {
        sqlx::query("INSERT INTO transcripts (id, meeting_id, transcript, timestamp) VALUES (?, 'm1', 'x', '0')")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let seg = |seq| crate::api::TranscriptSegment {
        id: String::new(),
        text: "x".into(),
        timestamp: "0".into(),
        audio_start_time: None,
        audio_end_time: None,
        duration: None,
        sequence_id: Some(seq),
    };
    let segs = [seg(879_001), seg(880_001), seg(880_002)];
    crate::translation::store::link_saved_transcript(&pool, "m1", &segs).await;
    let mut rows = TranslationsRepository::list(&pool, "m1", "fa")
        .await
        .unwrap();
    rows.sort();
    let want = [("r1", "fa:Avant"), ("r2", "fa:Bonjour"), ("r3", "fa:Merci")];
    assert_eq!(
        rows,
        want.map(|(a, b)| (a.to_string(), b.to_string())).to_vec()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn repeated_failures_end_in_an_error_that_stop_clears() {
    let _guard = SERIAL.lock().await;
    let (rec, tx, _pool, _dir) = launch(true, Vec::new(), 0).await;
    wait_for("running", || current_status().state == LiveState::Running).await;
    for seq in 881_001..881_004 {
        tx.send((seq, format!("ligne {seq}"))).unwrap();
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    wait_for("error", || current_status().state == LiveState::Error).await;
    assert!(current_status().error.is_some());
    assert!(rec.lines.lock().unwrap().is_empty());
    stop(&rec);
    assert_eq!(current_status().state, LiveState::Off);
}
