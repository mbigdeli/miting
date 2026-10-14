//! Speaker identification while the meeting is still going. Each channel is
//! diarized in background chunks on a couple of threads, and voices are
//! carried from chunk to chunk by voiceprint, so when the recording stops only
//! the last few minutes are left to do. Without a live result (older builds,
//! imports, a failed live pass) identification falls back to one full pass.

pub mod audio;
pub mod channel;
pub mod chunk;
pub mod downsample;
pub mod provisional;
pub mod registry;
pub mod result;
pub mod voiceprint;
pub mod worker;

#[cfg(test)]
#[path = "live_tests.rs"]
mod live_tests;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

use downsample::Downsampler;
use result::LiveTurn;
use worker::Msg;

/// Feeds one recording's channels to its live worker thread.
pub struct LiveFeed {
    tx: Sender<Msg>,
    mic: Downsampler,
    sys: Downsampler,
}

impl LiveFeed {
    /// Start the worker for a recording saved into `folder`.
    #[must_use]
    pub fn start(
        folder: &Path,
        models_dir: PathBuf,
        on_update: Option<provisional::OnUpdate>,
    ) -> Option<Self> {
        let (tx, rx) = mpsc::channel();
        let folder = folder.to_path_buf();
        let pending_key = key(&folder);
        set_pending(&pending_key, true);
        let spawned = std::thread::Builder::new()
            .name("speakers-live".into())
            .spawn({
                let pending_key = pending_key.clone();
                move || {
                    if let Some(f) = &on_update {
                        f(Vec::new()); // a new recording starts with no speakers
                    }
                    worker::run(rx, &folder, models_dir, on_update);
                    set_pending(&pending_key, false);
                }
            });
        if let Err(e) = spawned {
            log::warn!("speakers live: could not start: {e}");
            set_pending(&pending_key, false);
            return None;
        }
        Some(Self {
            tx,
            mic: Downsampler::default(),
            sys: Downsampler::default(),
        })
    }

    /// Hand over one aligned pair of 48 kHz windows.
    pub fn push(&mut self, mic: &[f32], sys: &[f32]) {
        let (mut m, mut s) = (Vec::new(), Vec::new());
        self.mic.push(mic, &mut m);
        self.sys.push(sys, &mut s);
        let _ = self.tx.send(Msg::Audio { mic: m, sys: s });
    }

    /// The recording was saved: finish the tail and write the result.
    pub fn finish(self) {
        let _ = self.tx.send(Msg::Finish);
    }
}

fn pending() -> &'static (Mutex<HashSet<PathBuf>>, Condvar) {
    static PENDING: OnceLock<(Mutex<HashSet<PathBuf>>, Condvar)> = OnceLock::new();
    PENDING.get_or_init(Default::default)
}

/// The recorder's folder path and the one stored in the database may be
/// spelled differently; compare them in canonical form.
fn key(folder: &Path) -> PathBuf {
    std::fs::canonicalize(folder).unwrap_or_else(|_| folder.to_path_buf())
}

fn set_pending(folder_key: &Path, on: bool) {
    let (set, cv) = pending();
    if let Ok(mut set) = set.lock() {
        if on {
            set.insert(folder_key.to_path_buf());
        } else {
            set.remove(folder_key);
        }
    }
    cv.notify_all();
}

/// The live result for `folder`, waiting up to `timeout` while its worker is
/// still finishing. Blocking: call from `spawn_blocking`.
#[must_use]
pub fn wait_for_result(folder: &Path, timeout: Duration) -> Option<Vec<LiveTurn>> {
    let (set, cv) = pending();
    let deadline = Instant::now() + timeout;
    let folder_key = key(folder);
    let mut guard = set.lock().ok()?;
    while guard.contains(&folder_key) {
        let left = deadline.checked_duration_since(Instant::now())?;
        guard = cv.wait_timeout(guard, left).ok()?.0;
    }
    drop(guard);
    result::load(folder)
}

#[cfg(test)]
#[path = "live_real_tests.rs"]
mod live_real_tests;
