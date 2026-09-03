//! State-safe readers for the transcript / summary model configuration.
//!
//! The commands themselves take `State<'_, AppState>`, and `app.state()`
//! *panics* when that state is unmanaged. Startup no longer aborts on a
//! database failure, so unmanaged `AppState` is now a state the app can
//! genuinely be in — every internal caller must go through these instead.

use tauri::{AppHandle, Manager, Runtime};

use crate::state::AppState;

use super::api::{api_get_model_config, api_get_transcript_config, ModelConfig, TranscriptConfig};

/// Read the transcript config, treating "database unavailable" the same as
/// "nothing configured" — callers already handle that by falling back to the
/// default engine.
pub async fn transcript_config_opt<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<TranscriptConfig>, String> {
    let Some(state) = app.try_state::<AppState>() else {
        log::warn!("Transcript config unavailable: database is not initialized");
        return Ok(None);
    };
    api_get_transcript_config(app.clone(), state, None).await
}

/// Same contract as [`transcript_config_opt`], for the summary model config.
pub async fn model_config_opt<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<ModelConfig>, String> {
    let Some(state) = app.try_state::<AppState>() else {
        log::warn!("Model config unavailable: database is not initialized");
        return Ok(None);
    };
    api_get_model_config(app.clone(), state, None).await
}

/// The configured summary provider, or `None` when nothing is set up (or the
/// database is unavailable, which the recovery screen reports separately).
pub async fn transcript_summary_provider<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    match model_config_opt(app).await {
        Ok(config) => config.map(|config| config.provider),
        Err(e) => {
            log::warn!("Could not read the summary provider: {e}");
            None
        }
    }
}
