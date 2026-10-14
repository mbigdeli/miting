//! Turns a Markdown table of tasks into checklist items, so a model that
//! answers with `| Owner | Task | Due |` still gives clickable action items.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Role {
    Task,
    Owner,
    Due,
    Time,
    Drop,
    Other,
}

const TASK: &[&str] = &["task", "action", "item", "what", "کار", "اقدام", "وظیفه"];
const OWNER: &[&str] = &[
    "owner",
    "assignee",
    "who",
    "responsible",
    "مسئول",
    "مالک",
    "چه کسی",
];
const DUE: &[&str] = &["due", "deadline", "when", "date", "مهلت", "موعد", "تاریخ"];
const TIME: &[&str] = &["timestamp", "time", "زمان"];
const DROP: &[&str] = &[
    "reference",
    "ref",
    "quote",
    "snippet",
    "source",
    "منبع",
    "نقل",
];

fn role(header: &str) -> Role {
    let h = header.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|w| h.contains(w));
    if has(TIME) {
        Role::Time
    } else if has(OWNER) {
        Role::Owner
    } else if has(DUE) {
        Role::Due
    } else if has(TASK) {
        Role::Task
    } else if has(DROP) {
        Role::Drop
    } else {
        Role::Other
    }
}

/// Cells of one table row, outer pipes removed and markers like `**` kept.
pub fn cells(row: &str) -> Vec<String> {
    let inner = row.trim().trim_start_matches('|').trim_end_matches('|');
    inner.split('|').map(|c| c.trim().to_string()).collect()
}

/// `|---|:--:|` and similar.
pub fn is_separator(row: &str) -> bool {
    let t = row.trim();
    t.starts_with('|') && t.contains('-') && t.chars().all(|c| matches!(c, '|' | '-' | ':' | ' '))
}

fn is_blank(cell: &str) -> bool {
    let c = cell.trim_matches(|ch: char| ch == '*' || ch.is_whitespace());
    c.is_empty() || matches!(c, "-" | "—" | "–" | "n/a" | "N/A" | "None" | "none")
}

/// Column roles read from a header row.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Header(Vec<Role>);

impl Header {
    pub fn parse(row: &str) -> Self {
        Self(cells(row).iter().map(|c| role(c)).collect())
    }

    /// `- [ ] Task · Owner · Due [MM:SS]`, the same shape the built-in
    /// templates ask for. `None` when the row has nothing to do.
    pub fn item(&self, row: &str) -> Option<String> {
        let cells = cells(row);
        let pick = |r: Role| {
            self.0
                .iter()
                .zip(&cells)
                .filter(|(role, c)| **role == r && !is_blank(c))
                .map(|(_, c)| c.as_str())
                .collect::<Vec<_>>()
        };
        let mut parts = pick(Role::Task);
        let has_task = !parts.is_empty();
        parts.extend(pick(Role::Other));
        if !has_task && parts.is_empty() {
            return None;
        }
        parts.extend(pick(Role::Owner));
        parts.extend(pick(Role::Due));
        let mut line = format!("- [ ] {}", parts.join(" · "));
        if let Some(t) = pick(Role::Time).first() {
            let t = t.trim_matches(|c| c == '[' || c == ']');
            line.push_str(&format!(" [{t}]"));
        }
        Some(line)
    }
}
