//! Tauri commands backing the database recovery screen.
//!
//! Reachable when startup initialization failed, so none of them may assume
//! `AppState` exists — they are what puts it there.

use log::info;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::recovery::{current_outcome, set_outcome, DbInitOutcome};
use super::recovery_fs::{list_backups, quarantine_db, restore_backup, BackupInfo};

#[tauri::command]
pub async fn get_database_init_status(app: AppHandle) -> DbInitOutcome {
    current_outcome(&app)
}

/// Rolling pre-migration snapshots, newest first. May legitimately be empty:
/// snapshots are only written when a migration is pending, so a checksum
/// mismatch on already-applied migrations can leave nothing to restore.
#[tauri::command]
pub async fn list_database_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    Ok(list_backups(&app_data_dir(&app)?))
}

/// Move the broken database aside, copy the chosen snapshot into place, and
/// re-run initialization. The restored file keeps the user's own settings, so
/// no default configuration is written.
#[tauri::command]
pub async fn restore_database_backup(app: AppHandle, backup_file: String) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    info!("Restoring database from backup: {backup_file}");
    restore_backup(&dir, &backup_file, stamp()).map_err(|e| format!("Restore failed: {e}"))?;

    super::setup::open_and_manage(&app).await.inspect_err(|e| {
        set_outcome(&app, DbInitOutcome::Failed { error: e.clone() });
    })?;

    set_outcome(&app, DbInitOutcome::Ready);
    super::commands::announce_database_ready(&app)
}

/// Last resort: quarantine the unreadable database and start over with an
/// empty one. The broken file is kept alongside it for manual rescue.
#[tauri::command]
pub async fn discard_database_and_start_fresh(app: AppHandle) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    let moved = quarantine_db(&dir, stamp()).map_err(|e| format!("Could not move the broken database aside: {e}"))?;
    match moved {
        Some(path) => info!("Broken database kept at {}", path.display()),
        None => info!("No database file to quarantine; creating a fresh one"),
    }

    super::commands::open_fresh_and_announce(&app)
        .await
        .inspect_err(|e| {
            set_outcome(&app, DbInitOutcome::Failed { error: e.clone() });
        })?;

    set_outcome(&app, DbInitOutcome::Ready);
    Ok(())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))
}

/// Suffix for quarantined files. Seconds are enough to keep successive
/// attempts distinct without pulling in a clock abstraction.
fn stamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
