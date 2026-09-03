use log::{info, warn};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::manager::DatabaseManager;
use super::recovery::{set_outcome, DbInitOutcome};
use crate::state::AppState;

/// Give the window time to paint and React listeners time to register before
/// firing startup events.
const EMIT_DELAY_MS: u64 = 500;
/// A locked database is usually transient (previous instance still closing, a
/// sync client holding the file), so retry once before declaring failure.
const LOCK_RETRY_DELAY_MS: u64 = 1000;

/// Initialize the database on app startup and record the outcome.
///
/// Never returns an error: a failure here must not stop the window from
/// opening. The recorded outcome drives the frontend recovery screen.
pub async fn initialize_database_on_startup(app: &AppHandle) {
    let outcome = match run_initialization(app).await {
        Ok(outcome) => outcome,
        Err(error) => {
            log::error!("Database initialization failed: {error}");
            emit_delayed(app, "database-init-failed", DbInitFailure { error: error.clone() });
            DbInitOutcome::Failed { error }
        }
    };
    set_outcome(app, outcome);
}

async fn run_initialization(app: &AppHandle) -> Result<DbInitOutcome, String> {
    let is_first_launch = DatabaseManager::is_first_launch(app)
        .await
        .map_err(|e| format!("Failed to check first launch status: {}", e))?;

    if is_first_launch {
        info!("First launch detected - will notify window when ready");
        emit_delayed(app, "first-launch-detected", ());
        return Ok(DbInitOutcome::FirstLaunch);
    }

    open_and_manage(app).await?;
    info!("Database initialized successfully");
    Ok(DbInitOutcome::Ready)
}

/// Open the database and publish it as `AppState`. Shared by startup and by
/// the recovery commands, which re-run initialization after repairing the file.
pub async fn open_and_manage(app: &AppHandle) -> Result<DatabaseManager, String> {
    let db_manager = match DatabaseManager::new_from_app_handle(app).await {
        Ok(db_manager) => db_manager,
        Err(e) if is_lock_error(&e) => {
            warn!("Database is locked ({e}); retrying once");
            tokio::time::sleep(std::time::Duration::from_millis(LOCK_RETRY_DELAY_MS)).await;
            DatabaseManager::new_from_app_handle(app)
                .await
                .map_err(|e| format!("Failed to initialize database manager: {}", e))?
        }
        Err(e) => return Err(format!("Failed to initialize database manager: {}", e)),
    };

    app.manage(AppState {
        db_manager: db_manager.clone(),
    });
    Ok(db_manager)
}

#[derive(Clone, Serialize)]
struct DbInitFailure {
    error: String,
}

fn is_lock_error(error: &sqlx::Error) -> bool {
    let message = error.to_string().to_lowercase();
    message.contains("locked") || message.contains("busy")
}

fn emit_delayed<P>(app: &AppHandle, event: &'static str, payload: P)
where
    P: Serialize + Clone + Send + 'static,
{
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(EMIT_DELAY_MS)).await;
        match app_handle.emit(event, payload) {
            Ok(()) => info!("Emitted {event} after delay"),
            Err(e) => warn!("Failed to emit {event}: {e}"),
        }
    });
}
