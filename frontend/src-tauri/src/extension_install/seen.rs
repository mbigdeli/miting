//! When the companion extension last talked to the app with a valid token.
//!
//! The extension polls `/gmeet/health` every minute while Chrome runs, so an
//! authorized request is proof it is installed and paired. The time is kept
//! on disk because Chrome is often closed when the app asks: Home and
//! onboarding only need to know the extension was ever set up.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, Runtime};

const FILE: &str = "extension_last_seen.txt";
/// The disk write and the event happen at most this often.
const WRITE_EVERY: Duration = Duration::from_secs(60);
/// Tells the webview to refetch `extension_connection_status`.
pub const SEEN_EVENT: &str = "extension-seen";

static LAST_WRITE: Mutex<Option<Instant>> = Mutex::new(None);

fn file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(FILE))
}

/// Unix seconds of the last authorized request, if one was ever recorded.
pub fn last_seen<R: Runtime>(app: &AppHandle<R>) -> Option<i64> {
    file(app).and_then(|path| read_at(&path))
}

/// Record an authorized request. Cheap enough for every ingest call: it only
/// touches the disk once a minute.
pub fn mark<R: Runtime>(app: &AppHandle<R>) {
    {
        let mut last = LAST_WRITE.lock().unwrap_or_else(|e| e.into_inner());
        if !due(*last, Instant::now()) {
            return;
        }
        *last = Some(Instant::now());
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default();
    if let Some(path) = file(app) {
        if let Err(e) = write_at(&path, now) {
            log::warn!("extension: could not record when it was last seen: {e}");
        }
    }
    let _ = app.emit(SEEN_EVENT, now);
}

fn due(last: Option<Instant>, now: Instant) -> bool {
    last.is_none_or(|at| now.saturating_duration_since(at) >= WRITE_EVERY)
}

fn read_at(path: &Path) -> Option<i64> {
    std::fs::read_to_string(path).ok()?.trim().parse().ok()
}

fn write_at(path: &Path, at: i64) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(path, at.to_string())
}

#[cfg(test)]
#[path = "seen_tests.rs"]
mod tests;
