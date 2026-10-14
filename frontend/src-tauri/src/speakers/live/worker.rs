//! The live pass's background thread: buffer each channel, diarize it every
//! [`CHUNK_SECS`] on a couple of threads, and when the recording stops,
//! finish the tail, merge voices and save the result.

use std::path::{Path, PathBuf};
use std::sync::mpsc::Receiver;

use crate::diarize_engine::runner::{half_the_cores, limit_threads, Runner};
use crate::diarize_engine::TARGET_SAMPLE_RATE;

use super::audio::mute_echo;
use super::channel::Channel;
use super::chunk::ChunkTools;
use super::provisional::{labels, OnUpdate};
use super::result;
use super::voiceprint::Voiceprints;

/// Length of a live chunk. Shorter means a shorter wait after the meeting
/// but noisier voiceprints from people who spoke little in a chunk.
pub const CHUNK_SECS: usize = 300;
/// The first chunk is shorter so labels show up early in the meeting.
pub const FIRST_CHUNK_SECS: usize = 120;
/// Threads a chunk may use while the meeting is still going.
const LIVE_THREADS: usize = 2;

pub enum Msg {
    /// Aligned 16 kHz windows of the microphone and system channels.
    Audio {
        mic: Vec<f32>,
        sys: Vec<f32>,
    },
    Finish,
}

/// Runs until `Finish` (saves the result) or until the sender is dropped
/// (recording discarded: saves nothing).
pub fn run(rx: Receiver<Msg>, folder: &Path, models: PathBuf, on_update: Option<OnUpdate>) {
    let (runner, prints) = match (Runner::load(&models, 1), Voiceprints::load(&models)) {
        (Ok(r), Ok(p)) => (r, p),
        (Err(e), _) | (_, Err(e)) => {
            log::warn!("speakers live: models unavailable, using the full pass later: {e}");
            return;
        }
    };
    let tools = ChunkTools {
        runner: &runner,
        prints: &prints,
    };
    let (mut room, mut remote) = (Channel::default(), Channel::default());
    let rate = TARGET_SAMPLE_RATE as usize;
    let publish = |room: &Channel, remote: &Channel| {
        if let Some(f) = &on_update {
            f(labels(&[room.settle(false), remote.settle(true)].concat()));
        }
    };
    while let Ok(msg) = rx.recv() {
        match msg {
            Msg::Audio { mut mic, sys } => {
                mute_echo(&mut mic, &sys);
                room.buf.extend(mic);
                remote.buf.extend(sys);
                let secs = if room.offset == 0.0 {
                    FIRST_CHUNK_SECS
                } else {
                    CHUNK_SECS
                };
                let chunk = secs * rate;
                if room.buf.len() >= chunk {
                    limit_threads(LIVE_THREADS);
                    room.step(&tools, Some(chunk));
                    remote.step(&tools, Some(chunk));
                    publish(&room, &remote);
                }
            }
            Msg::Finish => {
                limit_threads(half_the_cores());
                room.step(&tools, None);
                remote.step(&tools, None);
                publish(&room, &remote);
                let turns = [room.settle(false), remote.settle(true)].concat();
                match result::save(folder, &turns) {
                    Ok(()) => log::info!("speakers live: {} turns saved", turns.len()),
                    Err(e) => log::warn!("speakers live: could not save result: {e}"),
                }
                return;
            }
        }
    }
}
