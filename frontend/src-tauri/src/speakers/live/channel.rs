//! One channel's state in the live pass: unprocessed audio, where it starts
//! in the recording, the voices met so far and the turns found so far.

use crate::diarize_engine::TARGET_SAMPLE_RATE;

use super::audio::quiet_cut;
use super::chunk::{process, ChunkTools, VoiceTurn};
use super::registry::Registry;
use super::result::LiveTurn;

#[derive(Default)]
pub struct Channel {
    pub buf: Vec<f32>,
    pub offset: f64,
    registry: Registry,
    turns: Vec<VoiceTurn>,
}

impl Channel {
    /// Diarize the buffered audio up to a quiet point near `target` samples
    /// (or all of it), then drop it from the buffer.
    pub fn step(&mut self, tools: &ChunkTools<'_>, target: Option<usize>) {
        let cut = target.map_or(self.buf.len(), |t| quiet_cut(&self.buf, t));
        match process(tools, &mut self.registry, &self.buf[..cut], self.offset) {
            Ok(turns) => self.turns.extend(turns),
            Err(e) => log::warn!("speakers live: chunk at {:.0}s failed: {e}", self.offset),
        }
        self.buf.drain(..cut);
        self.offset += cut as f64 / f64::from(TARGET_SAMPLE_RATE);
    }

    /// Turns so far, with voices that turned out to be one person folded.
    #[must_use]
    pub fn settle(&self, remote: bool) -> Vec<LiveTurn> {
        let root = self.registry.reconcile();
        self.turns
            .iter()
            .map(|&(start, end, v)| LiveTurn {
                start,
                end,
                voice: root[v],
                remote,
            })
            .collect()
    }
}
