//! AI second opinion on the voice analysis, from the words alone: settle the
//! lines the voices left unsure, and flag speakers that look like one person
//! (as a suggestion the user accepts or rejects, never applied silently).
//! Best effort: any AI failure leaves the acoustic result as it is.

pub mod parse;
pub mod prompt;
pub mod uncertain;

#[cfg(test)]
#[path = "review_tests.rs"]
mod review_tests;

use std::path::Path;

use sqlx::SqlitePool;

use crate::channels::{Levels, Side};
use crate::diarize_engine::{speaker_name, DiarizedSegment, SpeakerTurn};

pub use parse::MergeHint;

/// What the voice analysis produced, for the review to check.
pub struct Acoustic<'a> {
    pub turns: &'a [SpeakerTurn],
    pub sides: &'a [Option<Side>],
    pub levels: &'a [Levels],
}

/// Move unsure lines in `lines` to the speaker the AI picks (within their
/// channel) and return merge suggestions to store.
pub async fn review(
    pool: &SqlitePool,
    data_dir: &Path,
    meeting_id: &str,
    acoustic: &Acoustic<'_>,
    lines: &mut [DiarizedSegment],
) -> Vec<MergeHint> {
    let unsure = uncertain::find(acoustic.turns, acoustic.sides, acoustic.levels, lines);
    if unsure.is_empty() && !has_same_side_pair(acoustic.sides) {
        return Vec::new();
    }
    let user = prompt::user_prompt(lines, &unsure);
    let dir = data_dir.to_path_buf();
    let raw = crate::summary::configured::generate_with_configured(
        pool,
        Some(&dir),
        prompt::SYSTEM_PROMPT,
        &user,
    )
    .await;
    let raw = match raw {
        Ok(raw) => raw,
        Err(e) => {
            log::info!("speakers: no AI review for {meeting_id}: {e}");
            return Vec::new();
        }
    };
    let side_of = |label: &str| {
        (0..acoustic.sides.len())
            .find(|&i| speaker_name(i) == label)
            .map(|i| acoustic.sides[i])
    };
    let (moves, hints) = parse::parse(&raw, lines, &unsure, side_of);
    for (index, speaker) in &moves {
        lines[*index].speaker_name = speaker.clone();
    }
    log::info!(
        "speakers: {meeting_id}: AI moved {}/{} unsure line(s), {} merge hint(s)",
        moves.len(),
        unsure.len(),
        hints.len()
    );
    hints
}

/// True when two speakers share a channel (or channels are unknown), so
/// they could be one person split in two.
#[must_use]
pub fn has_same_side_pair(sides: &[Option<Side>]) -> bool {
    sides
        .iter()
        .enumerate()
        .any(|(i, a)| sides[i + 1..].iter().any(|b| a == b))
}
