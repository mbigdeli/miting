//! Which transcript lines the voice analysis is unsure about: lines mostly
//! outside any turn of the speaker they were given (attributed to the nearest
//! voice, or by a speaker too quiet to keep). Pure logic.

use crate::channels::{side_of_span, Levels, Side};
use crate::diarize_engine::{speaker_name, DiarizedSegment, SpeakerTurn};

/// A line is unsure when less than this share of it lies inside its
/// speaker's turns.
pub const MIN_COVERAGE: f64 = 0.5;
/// At most this many lines go to the AI, the least covered first.
pub const MAX_LINES: usize = 40;

#[derive(Debug, Clone, PartialEq)]
pub struct Unsure {
    /// Index into the labelled transcript.
    pub index: usize,
    /// Speakers the line may be given to: those of the same channel.
    pub allowed: Vec<String>,
}

#[must_use]
pub fn find(
    turns: &[SpeakerTurn],
    sides: &[Option<Side>],
    levels: &[Levels],
    lines: &[DiarizedSegment],
) -> Vec<Unsure> {
    let count = sides
        .len()
        .max(turns.iter().map(|t| t.speaker + 1).max().unwrap_or(0));
    if count < 2 {
        return Vec::new();
    }
    let names: Vec<String> = (0..count).map(speaker_name).collect();
    let mut unsure: Vec<(f64, Unsure)> = lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| {
            let speaker = names.iter().position(|n| *n == line.speaker_name)?;
            let cover = coverage(turns, speaker, line.start, line.end);
            if cover >= MIN_COVERAGE {
                return None;
            }
            let side = side_of_span(levels, line.start, line.end);
            let allowed: Vec<String> = (0..count)
                .filter(|&s| side.is_none() || sides.get(s).copied().flatten() == side)
                .map(|s| names[s].clone())
                .collect();
            (allowed.len() >= 2).then_some((cover, Unsure { index, allowed }))
        })
        .collect();
    unsure.sort_by(|a, b| a.0.total_cmp(&b.0));
    unsure.truncate(MAX_LINES);
    let mut out: Vec<Unsure> = unsure.into_iter().map(|(_, u)| u).collect();
    out.sort_by_key(|u| u.index);
    out
}

/// Share of `[start, end)` inside turns of `speaker`.
fn coverage(turns: &[SpeakerTurn], speaker: usize, start: f64, end: f64) -> f64 {
    let len = end - start;
    if len <= 0.0 {
        return 1.0;
    }
    let inside: f64 = turns
        .iter()
        .filter(|t| t.speaker == speaker)
        .map(|t| (end.min(t.end) - start.max(t.start)).max(0.0))
        .sum();
    (inside / len).min(1.0)
}
