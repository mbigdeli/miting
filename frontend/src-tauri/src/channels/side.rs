//! Decide, per frame and per diarizer turn, whether speech came from the room
//! (microphone) or the call (system output).
//!
//! Rule: any system speech wins the frame. When the user has no headphones the
//! microphone also picks up the call (echo), so "both loud" almost always means
//! a remote voice; the user talking over a remote voice is rarer and costs one
//! short misattributed stretch at worst.

use super::{Levels, FRAME_SECS};

/// System output louder than this counts as someone on the call talking.
pub const SYS_ACTIVE_DB: f32 = -45.0;
/// Microphone louder than this (after noise suppression) counts as speech.
pub const MIC_ACTIVE_DB: f32 = -40.0;
/// Stretches shorter than this fold into their neighbour (blips, clicks).
pub const MIN_RUN_SECS: f64 = 0.4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Side {
    Room,
    Remote,
}

impl Side {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Side::Room => "room",
            Side::Remote => "remote",
        }
    }
}

/// Side of one frame, or `None` when neither channel carries speech.
#[must_use]
pub fn frame_side(l: Levels) -> Option<Side> {
    if l.sys_db >= SYS_ACTIVE_DB {
        Some(Side::Remote)
    } else if l.mic_db >= MIC_ACTIVE_DB {
        Some(Side::Room)
    } else {
        None
    }
}

/// Majority side of the speech frames inside `[start, end)`.
#[must_use]
pub fn side_of_span(levels: &[Levels], start: f64, end: f64) -> Option<Side> {
    let (mut room, mut remote) = (0usize, 0usize);
    for l in frames(levels, start, end) {
        match frame_side(*l) {
            Some(Side::Room) => room += 1,
            Some(Side::Remote) => remote += 1,
            None => {}
        }
    }
    match (room, remote) {
        (0, 0) => None,
        (r, m) if m >= r => Some(Side::Remote),
        _ => Some(Side::Room),
    }
}

/// Cut `[start, end)` wherever the speech moves between room and call.
/// Silent frames stay with the stretch around them; stretches shorter than
/// [`MIN_RUN_SECS`] join the previous one. Returns `(start, end, side)`;
/// a span with no speech frames comes back whole with `None`.
#[must_use]
pub fn split_by_side(levels: &[Levels], start: f64, end: f64) -> Vec<(f64, f64, Option<Side>)> {
    let first = (start / FRAME_SECS).floor() as usize;
    let mut runs: Vec<(f64, f64, Option<Side>)> = Vec::new();
    for (offset, l) in frames(levels, start, end).iter().enumerate() {
        let Some(side) = frame_side(*l) else { continue };
        let at = ((first + offset) as f64 * FRAME_SECS).max(start);
        match runs.last_mut() {
            Some(run) if run.2 == Some(side) => {}
            Some(run) => {
                run.1 = at;
                runs.push((at, end, Some(side)));
            }
            None => runs.push((start, end, Some(side))),
        }
    }
    if runs.is_empty() {
        return vec![(start, end, None)];
    }
    fold_short_runs(runs)
}

fn fold_short_runs(runs: Vec<(f64, f64, Option<Side>)>) -> Vec<(f64, f64, Option<Side>)> {
    let mut out: Vec<(f64, f64, Option<Side>)> = Vec::new();
    for run in runs {
        match out.last_mut() {
            Some(prev) if prev.2 == run.2 || run.1 - run.0 < MIN_RUN_SECS => prev.1 = run.1,
            Some(prev) if prev.1 - prev.0 < MIN_RUN_SECS => *prev = (prev.0, run.1, run.2),
            _ => out.push(run),
        }
    }
    out
}

fn frames(levels: &[Levels], start: f64, end: f64) -> &[Levels] {
    let from = ((start / FRAME_SECS).floor().max(0.0) as usize).min(levels.len());
    let to = ((end / FRAME_SECS).ceil().max(0.0) as usize).clamp(from, levels.len());
    &levels[from..to]
}
