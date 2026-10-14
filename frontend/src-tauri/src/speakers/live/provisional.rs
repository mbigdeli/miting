//! Speaker labels shown during the recording, after each chunk: the same
//! cleanup and numbering the final result uses, so labels rarely change
//! when the meeting ends.

use serde::Serialize;

use crate::diarize_engine::cleanup::clean_turns;
use crate::diarize_engine::speaker_name;

use super::result::{to_raw, LiveTurn};

/// Event the live transcript listens to.
pub const EVENT: &str = "speakers-live";

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveSpeakerTurn {
    pub start: f64,
    pub end: f64,
    pub speaker: String,
    /// "room" or "remote".
    pub side: &'static str,
}

/// Called with the full current picture after every chunk.
pub type OnUpdate = std::sync::Arc<dyn Fn(Vec<LiveSpeakerTurn>) + Send + Sync>;

#[must_use]
pub fn labels(turns: &[LiveTurn]) -> Vec<LiveSpeakerTurn> {
    let raw = to_raw(turns);
    clean_turns(&raw)
        .into_iter()
        .map(|t| {
            let remote = raw
                .iter()
                .find(|r| r.0 == t.start && r.1 == t.end)
                .is_some_and(|r| r.2.ends_with("@remote"));
            LiveSpeakerTurn {
                start: t.start,
                end: t.end,
                speaker: speaker_name(t.speaker),
                side: if remote { "remote" } else { "room" },
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(start: f64, voice: usize, remote: bool) -> LiveTurn {
        LiveTurn {
            start,
            end: start + 30.0,
            voice,
            remote,
        }
    }

    #[test]
    fn numbered_by_first_speech_with_their_side() {
        let out = labels(&[turn(40.0, 0, false), turn(0.0, 3, true)]);
        assert_eq!(out[0].speaker, "Speaker 1");
        assert_eq!(out[0].side, "remote");
        assert_eq!(out[1].speaker, "Speaker 2");
        assert_eq!(out[1].side, "room");
    }
}
