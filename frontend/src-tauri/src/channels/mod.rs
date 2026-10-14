//! Which channel carried the speech: the microphone (people in the room) or
//! the system output (people on the call). The pipeline mixes both into one
//! recording, so before mixing it logs each channel's loudness every 100 ms.
//! Speaker identification uses that log so a voice heard through the speakers
//! is never merged with a voice in the room.

pub mod activity;
pub mod file;
pub mod side;

#[cfg(test)]
#[path = "channels_tests.rs"]
mod channels_tests;

use std::sync::{Arc, Mutex};

pub use activity::ChannelActivity;
pub use side::{side_of_span, split_by_side, Side};

use crate::speakers::live::LiveFeed;

/// One level frame covers this many seconds of recording.
pub const FRAME_SECS: f64 = 0.1;

/// File written next to `audio.mp4` with the per-frame levels.
pub const FILE_NAME: &str = "channels.bin";

/// Loudness of both channels for one frame, in dBFS (silence is -100).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Levels {
    pub mic_db: f32,
    pub sys_db: f32,
}

/// What the pipeline hands its aligned mic and system windows to before
/// mixing: the loudness log and, when running, the live speaker pass.
pub struct Tap {
    activity: Mutex<ChannelActivity>,
    live: Mutex<Option<LiveFeed>>,
}

/// Shared between the pipeline (writer) and the recording manager (saver).
pub type ChannelTap = Arc<Tap>;

/// A fresh tap for one recording at the pipeline's sample rate (48 kHz for
/// the live pass, which downsamples by three).
#[must_use]
pub fn new_tap(sample_rate: u32, live: Option<LiveFeed>) -> ChannelTap {
    Arc::new(Tap {
        activity: Mutex::new(ChannelActivity::new(sample_rate)),
        live: Mutex::new(live),
    })
}

impl Tap {
    pub fn push(&self, mic: &[f32], sys: &[f32]) {
        if let Ok(mut a) = self.activity.lock() {
            a.push(mic, sys);
        }
        if let Ok(mut live) = self.live.lock() {
            if let Some(feed) = live.as_mut() {
                feed.push(mic, sys);
            }
        }
    }
}

/// Write the tap's levels into the meeting folder and let the live pass
/// finish. Best effort: without them identification uses the mixed audio.
pub fn save_tap(tap: &ChannelTap, folder: &std::path::Path) {
    if let Some(feed) = tap.live.lock().ok().and_then(|mut l| l.take()) {
        feed.finish();
    }
    let levels = match tap.activity.lock() {
        Ok(mut a) => a.finish(),
        Err(_) => return,
    };
    if levels.is_empty() {
        return;
    }
    let path = folder.join(FILE_NAME);
    match file::save(&path, &levels) {
        Ok(()) => log::info!(
            "channels: saved {} frames to {}",
            levels.len(),
            path.display()
        ),
        Err(e) => log::warn!("channels: could not save {}: {e}", path.display()),
    }
}
