//! The user's notes steer the summary (Granola's model): they go into the
//! user-context slot of the summary prompt, so the cache fingerprint changes
//! whenever a note does and the next regenerate really redoes the summary.

use sqlx::SqlitePool;

use super::prompt::plain;
use super::types::{clock, NoteCard};
use crate::database::repositories::note_cards::NoteCardsRepository;

const GUIDE: &str = "The person who recorded this meeting took the notes below (times are when each was written). \
Use them as the outline of the summary: keep their wording, let their headings shape the sections, expand each note \
from what was said around its time, and make sure every note is covered. Notes saved from Ask AI are marked (AI).";

/// `custom_prompt` with the miting's notes appended, if it has any.
pub async fn with_notes(pool: &SqlitePool, meeting_id: &str, custom_prompt: String) -> String {
    match NoteCardsRepository::list(pool, meeting_id).await {
        Ok(notes) => append(custom_prompt, &notes),
        Err(e) => {
            log::warn!("summary: could not read notes of {meeting_id}: {e}");
            custom_prompt
        }
    }
}

fn append(custom_prompt: String, notes: &[NoteCard]) -> String {
    let lines: Vec<String> = notes
        .iter()
        .filter_map(|n| {
            let text = plain(&n.body_html);
            if text.is_empty() {
                return None;
            }
            let at = n
                .at_sec
                .map(|a| format!("[{}] ", clock(a)))
                .unwrap_or_default();
            let ai = if n.source == "ask" { " (AI)" } else { "" };
            Some(format!("{at}{text}{ai}"))
        })
        .collect();
    if lines.is_empty() {
        return custom_prompt;
    }
    let block = format!("{GUIDE}\n<user_notes>\n{}\n</user_notes>", lines.join("\n"));
    if custom_prompt.trim().is_empty() {
        block
    } else {
        format!("{}\n\n{block}", custom_prompt.trim())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(at: Option<f64>, body: &str, source: &str) -> NoteCard {
        NoteCard {
            id: "n".into(),
            at_sec: at,
            body_html: body.into(),
            quotes: vec![],
            source: source.into(),
            edited: false,
        }
    }

    #[test]
    fn no_notes_leaves_the_prompt_alone() {
        assert_eq!(
            append("Focus on risks".into(), &[note(None, " ", "user")]),
            "Focus on risks"
        );
    }

    #[test]
    fn notes_follow_the_users_own_context() {
        let out = append(
            "Focus on risks".into(),
            &[
                note(Some(66.0), "<b>Sam</b> ships Thu", "user"),
                note(None, "Who owns QA?", "ask"),
            ],
        );
        assert!(out.starts_with("Focus on risks\n\nThe person who recorded"));
        assert!(
            out.ends_with("<user_notes>\n[01:06] Sam ships Thu\nWho owns QA? (AI)\n</user_notes>")
        );
    }
}
