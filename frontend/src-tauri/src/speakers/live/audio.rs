//! Audio helpers of the live pass: where to end a chunk, and muting the
//! microphone where it only hears the call. Pure functions.

use crate::channels::side::SYS_ACTIVE_DB;
use crate::diarize_engine::TARGET_SAMPLE_RATE;

use super::chunk::db;

/// A chunk ends at the quietest 100 ms within this many seconds of its end.
const CUT_SEARCH_SECS: usize = 10;
const BLOCK: usize = (TARGET_SAMPLE_RATE / 10) as usize;

/// Start of the quietest 100 ms block in the last seconds before `target`.
#[must_use]
pub fn quiet_cut(buf: &[f32], target: usize) -> usize {
    let target = target.min(buf.len()) / BLOCK * BLOCK;
    let from = target.saturating_sub(CUT_SEARCH_SECS * TARGET_SAMPLE_RATE as usize);
    (from..target)
        .step_by(BLOCK)
        .min_by(|a, b| db(&buf[*a..*a + BLOCK]).total_cmp(&db(&buf[*b..*b + BLOCK])))
        .filter(|&c| c > 0)
        .unwrap_or(target)
}

/// Silence the microphone wherever the call is talking: without headphones
/// the mic hears the speakers, and that echo must not become a room voice.
pub fn mute_echo(mic: &mut [f32], sys: &[f32]) {
    for (m, s) in mic.chunks_mut(BLOCK).zip(sys.chunks(BLOCK)) {
        if db(s) >= SYS_ACTIVE_DB {
            m.fill(0.0);
        }
    }
}
