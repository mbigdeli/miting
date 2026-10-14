//! One identification run, in the background: decode the recording, separate
//! voices, label the transcript, store it, then ask the AI for names.

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};

use super::{claim, report, review, source, suggest, voices, Stage};
use crate::database::repositories::speakers::hints::{self, MergeHintRow};
use crate::database::repositories::speakers::{query, write};
use crate::diarize_engine::sides::{label_with_sides, speaker_sides};
use crate::state::AppState;

/// Start identifying speakers for `meeting_id` without blocking the caller.
/// Returns false when a run for that meeting is already in progress.
pub fn spawn<R: Runtime>(app: AppHandle<R>, meeting_id: String) -> bool {
    if !claim(&meeting_id) {
        return false;
    }
    tauri::async_runtime::spawn(async move {
        let outcome = match context(&app) {
            Ok((pool, data_dir)) => {
                let progress = |stage| report(&app, &meeting_id, stage, None);
                identify(&pool, &data_dir, &meeting_id, progress).await
            }
            Err(e) => Err(e),
        };
        match outcome {
            Ok(()) => report(&app, &meeting_id, Stage::Done, None),
            Err(e) => {
                log::warn!("speakers: {meeting_id}: {e}");
                report(&app, &meeting_id, Stage::Failed, Some(e));
            }
        }
    });
    true
}

fn context<R: Runtime>(app: &AppHandle<R>) -> Result<(SqlitePool, PathBuf), String> {
    let pool = app
        .try_state::<AppState>()
        .map(|s| s.db_manager.pool().clone())
        .ok_or("app state unavailable")?;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok((pool, data_dir))
}

/// The whole run, free of Tauri so it can be exercised directly.
/// `progress` hears `Naming` once voices are stored (the UI shows them early).
pub async fn identify(
    pool: &SqlitePool,
    data_dir: &Path,
    meeting_id: &str,
    progress: impl Fn(Stage),
) -> Result<(), String> {
    let db = |e: sqlx::Error| format!("database error: {e}");
    if query::has_named_diarization(pool, meeting_id)
        .await
        .map_err(db)?
    {
        return Err("This miting already has speaker names from Google Meet.".into());
    }
    let segments = query::transcript_segments(pool, meeting_id)
        .await
        .map_err(db)?;
    if segments.is_empty() {
        return Err("There is no transcript to attribute yet.".into());
    }
    let folder = query::folder_path(pool, meeting_id)
        .await
        .map_err(db)?
        .ok_or("No recording was saved for this miting.")?;
    let models = data_dir.join("models");

    let (turns, levels) = tauri::async_runtime::spawn_blocking(move || {
        source::find_turns(Path::new(&folder), &models)
    })
    .await
    .map_err(|e| format!("speaker identification stopped: {e}"))??;
    if turns.is_empty() {
        return Err("No speech was found in the recording.".into());
    }

    let sides = speaker_sides(&turns, &levels);
    let mut labelled = label_with_sides(&turns, &sides, &levels, &segments);
    let acoustic = review::Acoustic {
        turns: &turns,
        sides: &sides,
        levels: &levels,
    };
    let merge_hints = review::review(pool, data_dir, meeting_id, &acoustic, &mut labelled).await;
    let voices = voices::summarise(&turns, &sides);
    write::replace_acoustic(pool, meeting_id, &labelled, &voices)
        .await
        .map_err(db)?;
    store_hints(pool, meeting_id, merge_hints).await;
    progress(Stage::Naming);
    suggest::suggest_names(pool, data_dir, meeting_id, &labelled).await;
    Ok(())
}

/// Best effort: a lost hint only means the user merges by hand.
async fn store_hints(pool: &SqlitePool, meeting_id: &str, found: Vec<review::MergeHint>) {
    let rows: Vec<MergeHintRow> = found
        .into_iter()
        .map(|h| MergeHintRow {
            from: h.from,
            into: h.into,
            evidence: h.evidence,
        })
        .collect();
    if let Err(e) = hints::set(pool, meeting_id, &rows).await {
        log::warn!("speakers: merge hints not saved: {e}");
    }
}
