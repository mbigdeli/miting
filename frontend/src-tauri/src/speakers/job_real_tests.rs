//! Manual end-to-end check on a real meeting. Never runs in CI: it reads a
//! recording, downloads models and calls the AI provider configured in the DB.
//!
//! ```text
//! MITING_SPEAKERS_DB=<COPY of meeting_minutes.sqlite> MITING_SPEAKERS_MEETING=<meeting id> \
//!   cargo test --lib identify_real_meeting -- --ignored --nocapture
//! ```
//! Always point it at a copy: the run rewrites that meeting's speakers.

use std::time::Instant;

use super::job::identify;
use crate::database::repositories::speakers::query;

#[tokio::test(flavor = "multi_thread")]
#[ignore = "manual: needs a DB copy, a real recording and the configured AI"]
async fn identify_real_meeting() {
    let db = std::env::var("MITING_SPEAKERS_DB").expect("MITING_SPEAKERS_DB");
    let meeting = std::env::var("MITING_SPEAKERS_MEETING").expect("MITING_SPEAKERS_MEETING");
    let pool = sqlx::SqlitePool::connect(&format!("sqlite:{db}"))
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    let data_dir = std::env::temp_dir().join("miting-speakers-e2e");

    let started = Instant::now();
    identify(&pool, &data_dir, &meeting, |stage| {
        println!(
            "[{:>6.1}s] stage {stage:?}",
            started.elapsed().as_secs_f64()
        );
    })
    .await
    .unwrap();
    println!("[{:>6.1}s] done", started.elapsed().as_secs_f64());

    let speakers = query::list(&pool, &meeting).await.unwrap();
    for s in &speakers {
        println!(
            "{:<24} source={:<5} {:>6.0}s {:>4} lines  evidence={:?}",
            s.name, s.name_source, s.speech_secs, s.segment_count, s.ai_evidence
        );
    }
    assert!(!speakers.is_empty());
}
