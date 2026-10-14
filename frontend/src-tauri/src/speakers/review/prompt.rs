//! The prompt asking the configured AI to settle unsure lines and spot
//! speakers that are one person. Checked in `parse`.

use std::fmt::Write as _;

use super::uncertain::Unsure;
use crate::diarize_engine::DiarizedSegment;

/// Lines of context sent around each unsure line.
const CONTEXT: usize = 4;
/// Transcript budget, so long meetings stay within the model's limits.
const MAX_CHARS: usize = 20_000;

pub const SYSTEM_PROMPT: &str = r#"You check speaker labels in a meeting transcript.
Labels ("Speaker 2") come from voice analysis, which is reliable except on lines marked "??".
Lines look like "[12] Speaker 2: text". Lines marked "??" list the only speakers allowed for them.
Tasks:
1. For each "??" line, pick the most likely speaker from its allowed list, using the flow of the
   conversation (who was asked, who answers, who continues a sentence). Skip the line if unsure.
2. If two speakers are clearly the same person (same self-introduction, one continues the other's
   thoughts as their own), report it with a short exact quote as evidence. Skip if unsure.
Never invent speakers. Keep the transcript's language in quotes.
Reply with STRICT JSON only:
{"lines":[{"line":12,"speaker":"Speaker 2","confidence":0.0}],
 "merges":[{"from":"Speaker 3","into":"Speaker 1","evidence":"short exact quote","confidence":0.0}]}"#;

/// Unsure lines with a few lines of context each (everything else is left
/// out), or the whole transcript when only merges are being checked.
#[must_use]
pub fn user_prompt(lines: &[DiarizedSegment], unsure: &[Unsure]) -> String {
    let mut keep = vec![unsure.is_empty(); lines.len()];
    for u in unsure {
        let from = u.index.saturating_sub(CONTEXT);
        let to = (u.index + CONTEXT + 1).min(lines.len());
        keep[from..to].iter_mut().for_each(|k| *k = true);
    }
    let mut out = String::from("Transcript excerpts:\n");
    let mut gap = false;
    for (i, line) in lines.iter().enumerate() {
        if out.len() >= MAX_CHARS {
            out.push_str("[...]\n");
            break;
        }
        if !keep[i] {
            if !gap {
                out.push_str("[...]\n");
                gap = true;
            }
            continue;
        }
        gap = false;
        let _ = write!(out, "[{i}] {}: {}", line.speaker_name, line.text.trim());
        if let Some(u) = unsure.iter().find(|u| u.index == i) {
            let _ = write!(out, "  ?? allowed: {}", u.allowed.join(", "));
        }
        out.push('\n');
    }
    out
}
