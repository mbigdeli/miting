//! Citations are checked, not trusted: a `[mm:ss]` in the answer stays only
//! if a transcript line starts within `TOLERANCE_SEC` of it, and is rewritten
//! to that line's exact start. Anything else is removed.

use super::types::clock;

pub const TOLERANCE_SEC: f64 = 15.0;

/// Seconds of a `mm:ss` or `h:mm:ss` marker body, if it is one.
fn parse_clock(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    if !(2..=3).contains(&parts.len())
        || parts
            .iter()
            .any(|p| p.is_empty() || p.len() > 2 || !p.chars().all(|c| c.is_ascii_digit()))
    {
        return None;
    }
    let n: Vec<f64> = parts.iter().filter_map(|p| p.parse().ok()).collect();
    let secs = match n.as_slice() {
        [m, s] if *s < 60.0 => m * 60.0 + s,
        [h, m, s] if *m < 60.0 && *s < 60.0 => h * 3600.0 + m * 60.0 + s,
        _ => return None,
    };
    Some(secs)
}

fn nearest(starts: &[f64], at: f64) -> Option<f64> {
    starts
        .iter()
        .copied()
        .filter(|s| (s - at).abs() <= TOLERANCE_SEC)
        .min_by(|a, b| (a - at).abs().total_cmp(&(b - at).abs()))
}

/// The answer with only real citations left, and the cited line starts.
pub fn verify(answer: &str, line_starts: &[f64]) -> (String, Vec<f64>) {
    let mut out = String::with_capacity(answer.len());
    let mut cited: Vec<f64> = Vec::new();
    let mut rest = answer;
    while let Some(open) = rest.find('[') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        let Some(close) = after.find(']') else {
            out.push_str(&rest[open..]);
            rest = "";
            break;
        };
        let body = &after[..close];
        // A Markdown link `[text](url)` is not a citation.
        let is_link = after[close + 1..].starts_with('(');
        match parse_clock(body.trim()) {
            Some(at) if !is_link => {
                if let Some(start) = nearest(line_starts, at) {
                    out.push_str(&format!("[{}]", clock(start)));
                    if !cited.contains(&start) {
                        cited.push(start);
                    }
                } else if out.ends_with(' ') {
                    out.pop(); // drop the space a removed marker leaves behind
                }
            }
            _ => out.push_str(&rest[open..open + close + 2]),
        }
        rest = &after[close + 1..];
    }
    out.push_str(rest);
    (out.trim().to_string(), cited)
}

#[cfg(test)]
mod tests {
    use super::*;

    const STARTS: &[f64] = &[21.0, 39.0, 66.0, 3725.0];

    #[test]
    fn keeps_and_snaps_real_citations() {
        let (text, cited) = verify("Drop-off rose [00:24] after a Safari bug [0:40].", STARTS);
        assert_eq!(text, "Drop-off rose [00:21] after a Safari bug [00:39].");
        assert_eq!(cited, vec![21.0, 39.0]);
    }

    #[test]
    fn removes_citations_with_no_line_nearby() {
        let (text, cited) = verify("Budget approved [10:00]. Hotfix Thursday [01:06].", STARTS);
        assert_eq!(text, "Budget approved. Hotfix Thursday [01:06].");
        assert_eq!(cited, vec![66.0]);
    }

    #[test]
    fn reads_hours_and_leaves_other_brackets_alone() {
        let (text, cited) = verify(
            "Late point [1:02:05]. See [the doc](http://x) and [note].",
            STARTS,
        );
        assert_eq!(
            text,
            "Late point [1:02:05]. See [the doc](http://x) and [note]."
        );
        assert_eq!(cited, vec![3725.0]);
    }

    #[test]
    fn unclosed_bracket_is_kept_as_text() {
        assert_eq!(verify("odd [01:06", STARTS).0, "odd [01:06");
    }
}
