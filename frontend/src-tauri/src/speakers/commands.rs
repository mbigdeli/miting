//! Tauri commands for the meeting page's Speakers card.

use tauri::{AppHandle, Runtime, State};

use super::{current_stage, job, Stage};
use crate::database::repositories::speakers::{edit, hints, query, SpeakerInfo};
use crate::state::AppState;

fn db(e: sqlx::Error) -> String {
    format!("database error: {e}")
}

/// Start identifying speakers in the background. Progress arrives on the
/// `speakers-status` event. Returns false if a run is already going.
#[tauri::command]
pub async fn speakers_identify<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
) -> Result<bool, String> {
    Ok(job::spawn(app, meeting_id))
}

/// Stage of a run in progress for this meeting (null when idle).
#[tauri::command]
pub async fn speakers_stage(meeting_id: String) -> Result<Option<Stage>, String> {
    Ok(current_stage(&meeting_id))
}

#[tauri::command]
pub async fn speakers_list(
    state: State<'_, AppState>,
    meeting_id: String,
) -> Result<Vec<SpeakerInfo>, String> {
    query::list(state.db_manager.pool(), &meeting_id)
        .await
        .map_err(db)
}

/// Rename a speaker everywhere. Using a name another speaker already has
/// merges the two.
#[tauri::command]
pub async fn speakers_rename(
    state: State<'_, AppState>,
    meeting_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    if to.trim().chars().count() > 80 {
        return Err("Names can be at most 80 characters.".into());
    }
    edit::rename(state.db_manager.pool(), &meeting_id, &from, &to)
        .await
        .map_err(db)
}

/// Keep the AI's suggested name.
#[tauri::command]
pub async fn speakers_confirm(
    state: State<'_, AppState>,
    meeting_id: String,
    name: String,
) -> Result<(), String> {
    edit::confirm(state.db_manager.pool(), &meeting_id, &name)
        .await
        .map_err(db)
}

/// The user says this voice is not the person the AI suggested.
#[tauri::command]
pub async fn speakers_dismiss_merge(
    state: State<'_, AppState>,
    meeting_id: String,
    name: String,
) -> Result<(), String> {
    hints::dismiss(state.db_manager.pool(), &meeting_id, &name)
        .await
        .map_err(db)
}

/// Move transcript lines (by `seq`) to another speaker.
#[tauri::command]
pub async fn speakers_reassign(
    state: State<'_, AppState>,
    meeting_id: String,
    seqs: Vec<i64>,
    speaker: String,
) -> Result<(), String> {
    if speaker.trim().is_empty() {
        return Err("Pick a speaker.".into());
    }
    edit::reassign(state.db_manager.pool(), &meeting_id, &seqs, &speaker)
        .await
        .map_err(db)
}
