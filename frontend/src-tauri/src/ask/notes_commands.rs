//! Tauri commands for note cards. Each edit is saved as the user types, so
//! `notes_upsert` is called often with the whole card.

use tauri::{AppHandle, Runtime};

use super::types::{AskMessage, NoteCard};
use crate::database::repositories::ask_messages::AskMessagesRepository;
use crate::database::repositories::note_cards::NoteCardsRepository;
use crate::translation::commands::pool;

#[tauri::command]
pub async fn notes_list<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
) -> Result<Vec<NoteCard>, String> {
    NoteCardsRepository::list(&pool(&app)?, &meeting_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn notes_upsert<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    card: NoteCard,
) -> Result<(), String> {
    NoteCardsRepository::upsert(&pool(&app)?, &meeting_id, &card)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn notes_delete<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    id: String,
) -> Result<(), String> {
    NoteCardsRepository::delete(&pool(&app)?, &meeting_id, &id)
        .await
        .map_err(|e| e.to_string())
}

/// Notes and questions from a recording, stored once its miting exists.
#[tauri::command]
pub async fn notes_import_live<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    notes: Vec<NoteCard>,
    asks: Vec<AskMessage>,
) -> Result<(), String> {
    let pool = pool(&app)?;
    NoteCardsRepository::upsert_many(&pool, &meeting_id, &notes)
        .await
        .map_err(|e| e.to_string())?;
    let answered: Vec<AskMessage> = asks.into_iter().filter(|a| a.answer_md.is_some()).collect();
    AskMessagesRepository::insert_many(&pool, &meeting_id, &answered)
        .await
        .map_err(|e| e.to_string())
}
