//! Live translation while recording: new lines are translated as they arrive,
//! earlier lines in a slower background pass. When the recording stops, intake
//! closes, queued work finishes, and results wait in `store` for the save.

mod backlog;
mod deliver;
mod session;
mod state;
mod worker;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use sqlx::SqlitePool;
use tauri::{AppHandle, Listener, Runtime};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use super::events::LiveStatus;
use super::provider::ResolvedProvider;
use session::Launch;
pub use state::{current_status, stop};

#[derive(Clone)]
struct Ctx {
    id: u64,
    language: String,
    pool: Option<SqlitePool>,
    cancel: CancellationToken,
    /// Smallest sequence id seen live; earlier lines belong to the backlog.
    first_live: Arc<AtomicU64>,
}

#[derive(serde::Deserialize)]
struct Update {
    sequence_id: u64,
    text: String,
}

pub async fn start<R: Runtime>(app: AppHandle<R>, language: String) -> Result<LiveStatus, String> {
    stop(&app);
    let stops = state::stops();
    super::store::forget_saved_links();
    let pool = crate::translation::commands::pool(&app)?;
    let dir = crate::translation::commands::data_dir(&app)?;
    let rp = ResolvedProvider::resolve(&pool, Some(dir.clone())).await?;

    let (tx, rx) = mpsc::unbounded_channel::<(u64, String)>();
    let first_live = Arc::new(AtomicU64::new(u64::MAX));
    let seen = first_live.clone();
    let intake = app.listen("transcript-update", move |event| {
        if let Ok(u) = serde_json::from_str::<Update>(event.payload()) {
            seen.fetch_min(u.sequence_id, Ordering::SeqCst);
            if !u.text.trim().is_empty() {
                let _ = tx.send((u.sequence_id, u.text));
            }
        }
    });
    let stopped = app.listen("recording-stopped", |_| state::close_intake());
    let listener_app = app.clone();
    let close = Box::new(move || {
        listener_app.unlisten(intake);
        listener_app.unlisten(stopped);
    });

    // Lines spoken before now; ones that also reach the listener are skipped.
    let earlier: Vec<(u64, String)> = crate::audio::recording_commands::get_transcript_history()
        .await
        .unwrap_or_default()
        .into_iter()
        .filter(|s| !s.text.trim().is_empty())
        .map(|s| (s.sequence_id, s.text))
        .collect();
    if state::stops() != stops {
        close(); // turned off, or replaced, while getting ready
        return Ok(current_status());
    }
    let launch = Launch {
        rp,
        dir,
        pool: Some(pool),
        language,
        rx,
        first_live,
        earlier,
        close,
    };
    Ok(session::begin(app, launch))
}

/// Translations finished so far for `language` (after a page reload).
pub fn finished(language: &str) -> Vec<(u64, String)> {
    super::store::finished(language)
}

#[cfg(test)]
#[path = "live_tests.rs"]
mod tests;
