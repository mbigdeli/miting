//! Tauri commands for Ask AI. While recording there is no saved miting yet:
//! the frontend sends what is on screen and keeps the conversation, then hands
//! it over with `notes_import_live` once the miting is saved.

use tauri::{AppHandle, Runtime};

use super::types::{AskMessage, AskReply, LiveContext, Material, Quote};
use super::{load, service};
use crate::database::repositories::ask_messages::AskMessagesRepository;
use crate::translation::commands::{data_dir, pool};
use crate::translation::provider::ResolvedProvider;

#[tauri::command]
pub async fn ask_meeting<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: Option<String>,
    live: Option<LiveContext>,
    question: String,
    quotes: Vec<Quote>,
) -> Result<AskReply, String> {
    if question.trim().is_empty() {
        return Err("empty_question".into());
    }
    let pool = pool(&app)?;
    let ai = ResolvedProvider::resolve(&pool, data_dir(&app).ok()).await?;
    let mut material = match (&live, meeting_id.as_deref()) {
        (Some(l), _) => from_live(l.clone()),
        (None, Some(id)) => load::saved(&pool, id).await?,
        (None, None) => return Err("meeting not found".into()),
    };
    material.question = question;
    material.quotes = quotes;
    let reply = service::answer(&ai, material).await?;
    if let (None, Some(id)) = (&live, meeting_id.as_deref()) {
        AskMessagesRepository::insert_many(&pool, id, std::slice::from_ref(&reply.message))
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(reply)
}

fn from_live(l: LiveContext) -> Material {
    Material {
        title: l.title,
        lines: l.lines,
        now_sec: Some(l.now_sec),
        earlier: l.earlier_summary,
        notes: l.notes,
        history: l.history,
        ..Default::default()
    }
}

#[tauri::command]
pub async fn ask_list<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
) -> Result<Vec<AskMessage>, String> {
    AskMessagesRepository::list(&pool(&app)?, &meeting_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ask_mark_saved<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    ask_id: String,
    note_id: String,
) -> Result<(), String> {
    AskMessagesRepository::set_saved_note(&pool(&app)?, &meeting_id, &ask_id, &note_id)
        .await
        .map_err(|e| e.to_string())
}
