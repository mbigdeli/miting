//! Gathers a saved miting for a question: its lines (speaker view first),
//! notes, earlier questions and the AI summary.

use sqlx::SqlitePool;

use super::types::{Line, Material};
use crate::database::repositories::ask_messages::AskMessagesRepository;
use crate::database::repositories::note_cards::NoteCardsRepository;

pub async fn saved(pool: &SqlitePool, meeting_id: &str) -> Result<Material, String> {
    let head: Option<(String, String)> =
        sqlx::query_as("SELECT title, created_at FROM meetings WHERE id = ?")
            .bind(meeting_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    let (title, created) = head.ok_or("meeting not found")?;
    let transcript = crate::api::preferred_transcript::load_preferred(pool, meeting_id)
        .await
        .map_err(|e| e.to_string())?;
    let lines = transcript
        .transcripts
        .into_iter()
        .map(|s| Line {
            at: s.audio_start_time,
            speaker: None,
            text: s.text,
        })
        .collect();
    let summary: Option<(Option<String>,)> =
        sqlx::query_as("SELECT result FROM summary_processes WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    let summary_md = summary
        .and_then(|(r,)| r)
        .and_then(|r| summary_markdown(&r));
    Ok(Material {
        title,
        date: created.get(..10).map(str::to_string),
        lines,
        notes: NoteCardsRepository::list(pool, meeting_id)
            .await
            .map_err(|e| e.to_string())?,
        history: AskMessagesRepository::list(pool, meeting_id)
            .await
            .map_err(|e| e.to_string())?,
        summary_md,
        ..Default::default()
    })
}

/// The `markdown` field of a stored summary result.
fn summary_markdown(result: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(result).ok()?;
    v.get("markdown")?
        .as_str()
        .map(str::to_string)
        .filter(|s| !s.trim().is_empty())
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_the_markdown_of_a_summary_result() {
        assert_eq!(
            super::summary_markdown(r##"{"markdown":"# Notes"}"##).as_deref(),
            Some("# Notes")
        );
        assert_eq!(super::summary_markdown("not json"), None);
    }
}
