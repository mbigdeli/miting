//! What the live pass hands to speaker identification: who spoke when, per
//! channel, saved as `speakers_live.json` next to the recording.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::channels::Side;
use crate::diarize_engine::cleanup::RawTurn;

pub const FILE_NAME: &str = "speakers_live.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LiveTurn {
    pub start: f64,
    pub end: f64,
    /// Voice number within its side (after the end-of-meeting merge).
    pub voice: usize,
    pub remote: bool,
}

impl LiveTurn {
    #[must_use]
    pub fn side(&self) -> Side {
        if self.remote {
            Side::Remote
        } else {
            Side::Room
        }
    }
}

pub fn save(folder: &Path, turns: &[LiveTurn]) -> std::io::Result<()> {
    let json = serde_json::to_vec(turns)?;
    let tmp = folder.join(format!("{FILE_NAME}.tmp"));
    std::fs::write(&tmp, json)?;
    std::fs::rename(tmp, folder.join(FILE_NAME))
}

/// `None` when the recording has no live result (or it cannot be read).
#[must_use]
pub fn load(folder: &Path) -> Option<Vec<LiveTurn>> {
    let bytes = std::fs::read(folder.join(FILE_NAME)).ok()?;
    match serde_json::from_slice(&bytes) {
        Ok(turns) => Some(turns),
        Err(e) => {
            log::warn!("speakers: ignoring unreadable live result: {e}");
            None
        }
    }
}

/// Turns in the diarizer's raw shape, labelled so room and call voices stay
/// distinct, sorted by start for the cleanup step.
#[must_use]
pub fn to_raw(turns: &[LiveTurn]) -> Vec<RawTurn> {
    let mut raw: Vec<RawTurn> = turns
        .iter()
        .map(|t| {
            let side = t.side().as_str();
            (t.start, t.end, format!("{side}-{}@{side}", t.voice))
        })
        .collect();
    raw.sort_by(|a, b| a.0.total_cmp(&b.0));
    raw
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(start: f64, voice: usize, remote: bool) -> LiveTurn {
        LiveTurn {
            start,
            end: start + 1.0,
            voice,
            remote,
        }
    }

    #[test]
    fn same_voice_number_on_each_side_stays_two_people() {
        let raw = to_raw(&[turn(5.0, 0, true), turn(1.0, 0, false)]);
        assert_eq!(raw[0].2, "room-0@room");
        assert_eq!(raw[1].2, "remote-0@remote");
    }

    #[test]
    fn saves_and_loads_next_to_the_recording() {
        let dir = std::env::temp_dir().join(format!("miting-live-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let turns = vec![turn(0.0, 1, false)];
        save(&dir, &turns).unwrap();
        assert_eq!(load(&dir), Some(turns));
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(load(&dir), None);
    }
}
