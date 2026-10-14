//! Which transcript lines go to the AI. Everything, when it fits the model.
//! Otherwise: live, the last 15 minutes word for word plus the earlier
//! summary; afterwards, the lines around the selected text and the notes.
//! Both add the earlier lines that share the most words with the question.

use super::types::{Line, Material};

/// Seconds of transcript sent word for word while recording.
pub const LIVE_WINDOW_SEC: f64 = 900.0;
/// Lines either side of a selected quote or a note.
const AROUND_SEC: f64 = 30.0;
/// Earlier lines added because they share words with the question.
const MATCHES: usize = 12;

#[derive(Debug, Default, PartialEq)]
pub struct Selection {
    /// Lines to send, in time order.
    pub lines: Vec<Line>,
    /// Live only: where the word-for-word window starts.
    pub recent_from: Option<f64>,
    /// Some lines were left out (the summary or earlier summary covers them).
    pub partial: bool,
}

pub fn fits(m: &Material, budget_chars: usize) -> bool {
    m.lines.iter().map(|l| l.text.len() + 12).sum::<usize>() <= budget_chars
}

pub fn select(m: &Material, budget_chars: usize) -> Selection {
    if fits(m, budget_chars) {
        return Selection {
            lines: m.lines.clone(),
            recent_from: None,
            partial: false,
        };
    }
    let recent_from = m.now_sec.map(|now| (now - LIVE_WINDOW_SEC).max(0.0));
    let mut keep: Vec<bool> = m.lines.iter().map(|l| in_recent(l, recent_from)).collect();
    let anchors: Vec<f64> = m
        .quotes
        .iter()
        .map(|q| q.at)
        .chain(m.notes.iter().filter_map(|n| n.at_sec))
        .collect();
    for (i, l) in m.lines.iter().enumerate() {
        if let Some(at) = l.at {
            if anchors.iter().any(|a| (at - a).abs() <= AROUND_SEC) {
                keep[i] = true;
            }
        }
    }
    for i in best_matches(m, &keep) {
        keep[i] = true;
    }
    let mut lines: Vec<Line> = Vec::new();
    let mut used = 0;
    // Newest first when trimming, so the latest talk survives a tight budget.
    for (i, l) in m.lines.iter().enumerate().rev() {
        if keep[i] && used + l.text.len() + 12 <= budget_chars {
            used += l.text.len() + 12;
            lines.push(l.clone());
        }
    }
    lines.reverse();
    Selection {
        lines,
        recent_from,
        partial: true,
    }
}

fn in_recent(l: &Line, recent_from: Option<f64>) -> bool {
    match (recent_from, l.at) {
        (Some(from), Some(at)) => at >= from,
        (Some(_), None) => true,
        (None, _) => false,
    }
}

/// Lines not yet kept that share the most words with the question and quotes.
fn best_matches(m: &Material, keep: &[bool]) -> Vec<usize> {
    let mut wanted = words(&m.question);
    for q in &m.quotes {
        wanted.extend(words(&q.quote));
    }
    let mut scored: Vec<(usize, usize)> = m
        .lines
        .iter()
        .enumerate()
        .filter(|(i, _)| !keep[*i])
        .map(|(i, l)| {
            (
                words(&l.text).iter().filter(|w| wanted.contains(w)).count(),
                i,
            )
        })
        .filter(|(score, _)| *score > 0)
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    scored.into_iter().take(MATCHES).map(|(_, i)| i).collect()
}

/// Lowercase words of 3+ letters (works for Persian too: split on non-letters).
pub fn words(text: &str) -> Vec<String> {
    let mut out: Vec<String> = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.chars().count() >= 3)
        .map(str::to_lowercase)
        .collect();
    out.sort();
    out.dedup();
    out
}

#[cfg(test)]
#[path = "window_tests.rs"]
mod tests;
