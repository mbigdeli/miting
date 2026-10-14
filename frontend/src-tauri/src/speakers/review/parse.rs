//! Parse and verify the review reply. Nothing the model says is trusted
//! unchecked: a line may only go to a speaker on its allowed list, and a
//! merge needs two real speakers on the same channel plus a quote that
//! actually occurs in the transcript.

use serde::Deserialize;

use super::uncertain::Unsure;
use crate::channels::Side;
use crate::diarize_engine::DiarizedSegment;

pub const MIN_CONFIDENCE: f64 = 0.7;

#[derive(Deserialize, Default)]
struct Reply {
    #[serde(default)]
    lines: Vec<LineItem>,
    #[serde(default)]
    merges: Vec<MergeItem>,
}

#[derive(Deserialize)]
struct LineItem {
    line: usize,
    speaker: String,
    #[serde(default)]
    confidence: f64,
}

#[derive(Deserialize)]
struct MergeItem {
    from: String,
    into: String,
    #[serde(default)]
    evidence: String,
    #[serde(default)]
    confidence: f64,
}

/// A suggestion, shown to the user, that `from` is the same person as `into`.
#[derive(Debug, Clone, PartialEq)]
pub struct MergeHint {
    pub from: String,
    pub into: String,
    pub evidence: String,
}

/// Verified `(line index, new speaker)` moves and merge hints.
#[must_use]
pub fn parse(
    raw: &str,
    lines: &[DiarizedSegment],
    unsure: &[Unsure],
    side_of: impl Fn(&str) -> Option<Option<Side>>,
) -> (Vec<(usize, String)>, Vec<MergeHint>) {
    let reply = raw
        .find('{')
        .zip(raw.rfind('}'))
        .and_then(|(a, b)| serde_json::from_str::<Reply>(&raw[a..=b]).ok())
        .unwrap_or_default();
    let moves = reply
        .lines
        .into_iter()
        .filter(|l| l.confidence >= MIN_CONFIDENCE)
        .filter(|l| {
            unsure
                .iter()
                .any(|u| u.index == l.line && u.allowed.contains(&l.speaker))
        })
        .map(|l| (l.line, l.speaker))
        .collect();
    let text: String = lines
        .iter()
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let mut hints: Vec<MergeHint> = Vec::new();
    for m in reply.merges {
        let quote = m.evidence.trim();
        let ok = m.confidence >= MIN_CONFIDENCE
            && m.from != m.into
            && !quote.is_empty()
            && text.contains(quote)
            && matches!((side_of(&m.from), side_of(&m.into)), (Some(a), Some(b)) if a == b)
            && !hints.iter().any(|h| h.from == m.from);
        if ok {
            hints.push(MergeHint {
                from: m.from,
                into: m.into,
                evidence: quote.to_string(),
            });
        }
    }
    (moves, hints)
}
