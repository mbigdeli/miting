//! Keep room and call voices apart using the channel log (`channels.bin`).
//! The diarizer only hears the mixed recording, so it can fold the user and a
//! remote voice into one speaker. Cutting its turns by channel before the
//! speakers are numbered makes that impossible: a speaker is either in the
//! room or on the call, never both.

use crate::channels::{side_of_span, split_by_side, Levels, Side};

use super::cleanup::RawTurn;
use super::{label_transcript, DiarizedSegment, SpeakerTurn};

/// Split each raw turn where the speech moves between room and call, and tag
/// the engine label with the side so one cluster heard on both channels
/// becomes two speakers.
#[must_use]
pub fn split_raw(raw: &[RawTurn], levels: &[Levels]) -> Vec<RawTurn> {
    raw.iter()
        .flat_map(|(start, end, label)| {
            split_by_side(levels, *start, *end)
                .into_iter()
                .map(move |(s, e, side)| (s, e, tagged(label, side)))
        })
        .collect()
}

fn tagged(label: &str, side: Option<Side>) -> String {
    match side {
        Some(side) => format!("{label}@{}", side.as_str()),
        None => label.to_string(),
    }
}

/// Side of each numbered speaker (index = speaker), by majority of its speech.
#[must_use]
pub fn speaker_sides(turns: &[SpeakerTurn], levels: &[Levels]) -> Vec<Option<Side>> {
    let count = turns.iter().map(|t| t.speaker + 1).max().unwrap_or(0);
    (0..count)
        .map(|speaker| {
            let (mut room, mut remote) = (0.0, 0.0);
            for t in turns.iter().filter(|t| t.speaker == speaker) {
                match side_of_span(levels, t.start, t.end) {
                    Some(Side::Room) => room += t.end - t.start,
                    Some(Side::Remote) => remote += t.end - t.start,
                    None => {}
                }
            }
            match (room > 0.0, remote > 0.0) {
                (false, false) => None,
                _ if remote >= room => Some(Side::Remote),
                _ => Some(Side::Room),
            }
        })
        .collect()
}

/// Like [`label_transcript`], but a segment heard on one channel only goes to
/// a speaker from that channel (when there is one).
#[must_use]
pub fn label_with_sides(
    turns: &[SpeakerTurn],
    sides: &[Option<Side>],
    levels: &[Levels],
    segments: &[(f64, f64, String)],
) -> Vec<DiarizedSegment> {
    segments
        .iter()
        .flat_map(|seg| {
            let side = side_of_span(levels, seg.0, seg.1);
            let same: Vec<SpeakerTurn> = turns
                .iter()
                .filter(|t| side.is_some() && sides.get(t.speaker).copied().flatten() == side)
                .cloned()
                .collect();
            let pool = if same.is_empty() { turns } else { &same };
            label_transcript(pool, std::slice::from_ref(seg))
        })
        .collect()
}

#[cfg(test)]
#[path = "sides_tests.rs"]
mod sides_tests;
