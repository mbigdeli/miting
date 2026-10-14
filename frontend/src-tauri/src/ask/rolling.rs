//! While recording, lines older than the live window are folded into a short
//! running summary with their times, so later questions can still cite them.
//! Only the lines added since the last summary are summarized.

use super::prompt::plain;
use super::types::{clock, EarlierSummary, Line};

pub const SYSTEM: &str = "Summarize these meeting transcript lines as short bullets (one per topic, decision, number or commitment). \
Start each bullet with the [mm:ss] of the first line it covers, copied from the lines. Keep names and numbers exact. \
Write in the language of the lines. Output only the bullets.";

/// Lines that start in `[covered until, window start)`.
pub fn pending(lines: &[Line], earlier: Option<&EarlierSummary>, window_from: f64) -> Vec<Line> {
    let from = earlier.map(|e| e.until_sec).unwrap_or(0.0);
    lines
        .iter()
        .filter(|l| l.at.is_some_and(|a| a >= from && a < window_from))
        .cloned()
        .collect()
}

pub fn user_prompt(lines: &[Line]) -> String {
    lines
        .iter()
        .map(|l| {
            let at = l.at.map(|a| format!("[{}] ", clock(a))).unwrap_or_default();
            let who = l
                .speaker
                .as_deref()
                .map(|s| format!("{s}: "))
                .unwrap_or_default();
            format!("{at}{who}{}", plain(&l.text))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// The old summary extended with the new bullets, now covering up to `until`.
pub fn extend(old: Option<&EarlierSummary>, bullets: &str, until: f64) -> EarlierSummary {
    let mut text = old.map(|o| o.text.trim().to_string()).unwrap_or_default();
    if !bullets.trim().is_empty() {
        if !text.is_empty() {
            text.push('\n');
        }
        text.push_str(bullets.trim());
    }
    EarlierSummary {
        text,
        until_sec: until,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn l(at: f64) -> Line {
        Line {
            at: Some(at),
            speaker: None,
            text: format!("line {at}"),
        }
    }

    #[test]
    fn only_lines_not_yet_summarized_and_before_the_window() {
        let lines = [l(10.0), l(500.0), l(1000.0), l(2000.0)];
        let old = EarlierSummary {
            text: "- [00:10] x".into(),
            until_sec: 400.0,
        };
        let got: Vec<f64> = pending(&lines, Some(&old), 1500.0)
            .iter()
            .filter_map(|l| l.at)
            .collect();
        assert_eq!(got, vec![500.0, 1000.0]);
    }

    #[test]
    fn extends_and_moves_the_boundary() {
        let old = EarlierSummary {
            text: "- [00:10] a".into(),
            until_sec: 400.0,
        };
        let e = extend(Some(&old), "- [08:20] b\n", 1500.0);
        assert_eq!(e.text, "- [00:10] a\n- [08:20] b");
        assert_eq!(e.until_sec, 1500.0);
    }

    #[test]
    fn prompt_lines_carry_their_times() {
        assert_eq!(user_prompt(&[l(65.0)]), "[01:05] line 65");
    }
}
