//! Keeps action items clickable whatever prompt wrote the summary. The editor
//! only shows a checkbox (and saves a tick) for a GFM `- [ ]` item, so every
//! bullet, numbered line or table row under a task heading becomes one.
//! Other sections are left exactly as the model wrote them.

use super::task_line::{heading, is_empty_note, is_task_title, list_body, task_item};
use super::task_table::{is_separator, Header};

/// Rewrites task sections of a summary as GFM task lists.
pub fn normalize(markdown: &str) -> String {
    let mut out = Vec::new();
    let mut task_level: Option<usize> = None;
    let mut header: Option<Header> = None;
    let mut in_fence = false;

    for line in markdown.lines() {
        let t = line.trim_start();
        if t.starts_with("```") {
            in_fence = !in_fence;
        }
        if in_fence || t.starts_with("```") {
            out.push(line.to_string());
            continue;
        }
        if let Some((level, title)) = heading(line) {
            if task_level.is_some_and(|tl| level <= tl) {
                task_level = None;
            }
            if is_task_title(title) {
                task_level = Some(level);
            }
            header = None;
            out.push(line.to_string());
            continue;
        }
        let top_level = line.len() - t.len() < 2;
        match (task_level, t.starts_with('|')) {
            (Some(_), true) if is_separator(t) => {}
            (Some(_), true) => match &header {
                None => header = Some(Header::parse(t)),
                Some(h) => out.extend(h.item(t)),
            },
            (Some(_), false) if top_level => {
                header = None;
                match list_body(t) {
                    Some(body) if !is_empty_note(body) => out.push(task_item(body)),
                    _ => out.push(line.to_string()),
                }
            }
            _ => {
                header = None;
                out.push(line.to_string());
            }
        }
    }
    let mut text = out.join("\n");
    if markdown.ends_with('\n') {
        text.push('\n');
    }
    text
}

#[cfg(test)]
#[path = "task_list_tests.rs"]
mod tests;
