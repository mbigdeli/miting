//! One summary line at a time: is it a task heading, a list item, an
//! "nothing to do" note, and how it reads as a GFM task item.

const TASK_TITLES: &[&str] = &[
    "action",
    "task",
    "to-do",
    "todo",
    "to do",
    "next step",
    "follow-up",
    "follow up",
    "followup",
    "up next",
    "commitment",
    "اقدام",
    "کارها",
    "کار‌ها",
    "کارهای",
    "وظایف",
    "پیگیری",
    "گام‌های بعدی",
    "قدم‌های بعدی",
];

const EMPTY: &[&str] = &[
    "none",
    "no action items",
    "none noted",
    "nothing",
    "ندارد",
    "هیچ",
];

pub(super) fn is_task_title(title: &str) -> bool {
    let t = title.to_lowercase();
    TASK_TITLES.iter().any(|w| t.contains(w))
}

/// `## Title` gives (2, "Title"); a line that is only bold text such as
/// `**Action items:**` counts as a heading below every real one.
pub(super) fn heading(line: &str) -> Option<(usize, &str)> {
    let t = line.trim();
    let hashes = t.chars().take_while(|&c| c == '#').count();
    if (1..=6).contains(&hashes) && t[hashes..].starts_with(' ') {
        return Some((hashes, t[hashes..].trim()));
    }
    let bold = t
        .trim_end_matches(':')
        .strip_prefix("**")?
        .strip_suffix("**")?;
    (!bold.contains("**")).then_some((7, bold.trim_end_matches(':')))
}

/// Text after a list marker, with any existing checkbox kept.
pub(super) fn list_body(t: &str) -> Option<&str> {
    if let Some(rest) = t
        .strip_prefix("- ")
        .or(t.strip_prefix("* "))
        .or(t.strip_prefix("+ "))
    {
        return Some(rest);
    }
    if ["[ ]", "[x]", "[X]"].iter().any(|b| t.starts_with(b)) {
        return Some(t);
    }
    if let Some(rest) = t.strip_prefix("☐ ").or(t.strip_prefix("□ ")) {
        return Some(rest);
    }
    let digits = t.chars().take_while(char::is_ascii_digit).count();
    let rest = &t[digits..];
    (digits > 0).then(|| rest.strip_prefix(". ").or(rest.strip_prefix(") ")))?
}

pub(super) fn task_item(body: &str) -> String {
    let b = body.trim();
    for done in ["[x] ", "[X] "] {
        if let Some(rest) = b.strip_prefix(done) {
            return format!("- [x] {}", rest.trim());
        }
    }
    let rest = b
        .strip_prefix("[ ] ")
        .or(b.strip_prefix("[] "))
        .unwrap_or(b);
    format!("- [ ] {}", rest.trim())
}

pub(super) fn is_empty_note(body: &str) -> bool {
    let b = body.trim().trim_end_matches('.').to_lowercase();
    EMPTY.iter().any(|e| b.starts_with(e))
}
