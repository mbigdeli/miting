//! Where an identification run gets its speaker turns: the live pass when the
//! recording had one (already done, or finishing its last chunk), otherwise a
//! full pass over the saved recording.

use std::path::Path;
use std::time::Duration;

use crate::channels::{file as channel_file, Levels, FILE_NAME as CHANNELS_FILE};
use crate::diarize_engine::cleanup::clean_turns;
use crate::diarize_engine::{audio::load_meeting_audio, engine::diarize, SpeakerTurn};

use super::live;

/// How long to wait for a live pass still finishing its last chunk.
const LIVE_WAIT: Duration = Duration::from_secs(10 * 60);

/// Turns plus the channel log (empty without one). Blocking: call from
/// `spawn_blocking`.
pub fn find_turns(folder: &Path, models: &Path) -> Result<(Vec<SpeakerTurn>, Vec<Levels>), String> {
    let levels = load_levels(folder);
    if let Some(live) = live::wait_for_result(folder, LIVE_WAIT) {
        let turns = clean_turns(&live::result::to_raw(&live));
        if !turns.is_empty() {
            log::info!("speakers: using the live result ({} turns)", turns.len());
            return Ok((turns, levels.unwrap_or_default()));
        }
    }
    let samples = load_meeting_audio(folder)?;
    let turns = diarize(&samples, models, levels.as_deref()).map_err(|e| e.to_string())?;
    Ok((turns, levels.unwrap_or_default()))
}

/// The recording's channel log, when it was recorded with one. Older
/// recordings and imports have none and are diarized from the mix alone.
fn load_levels(folder: &Path) -> Option<Vec<Levels>> {
    match channel_file::load(&folder.join(CHANNELS_FILE)) {
        Ok(levels) => levels.filter(|l| !l.is_empty()),
        Err(e) => {
            log::warn!("speakers: ignoring unreadable channel log: {e}");
            None
        }
    }
}
