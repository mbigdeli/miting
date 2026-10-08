//! Tauri commands for live translation and for translating saved mitings.

use std::path::PathBuf;

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};

use super::events::LiveStatus;
use super::live;
use super::provider::{ResolvedProvider, NO_AI};
use crate::state::AppState;
use crate::summary::llm_client::LLMProvider;

pub(crate) fn pool<R: Runtime>(app: &AppHandle<R>) -> Result<SqlitePool, String> {
    app.try_state::<AppState>()
        .map(|s| s.db_manager.pool().clone())
        .ok_or_else(|| "database is not ready".to_string())
}

pub(crate) fn data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))
}

/// Language codes as the UI sends them (`fa`, `en`, `zh-tw`).
pub(crate) fn check_language(code: &str) -> Result<(), String> {
    let ok = (2..=8).contains(&code.len())
        && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    ok.then_some(())
        .ok_or_else(|| format!("unsupported language code: {code}"))
}

/// Whether translation can run, and with which AI (by name, never model).
#[derive(Debug, Serialize)]
pub struct AiStatus {
    pub ready: bool,
    pub provider: Option<String>,
    /// `no_ai_configured`, `missing_api_key`, or another error text.
    pub reason: Option<String>,
}

#[tauri::command]
pub async fn translation_ai_status<R: Runtime>(app: AppHandle<R>) -> AiStatus {
    let resolved = match pool(&app) {
        Ok(pool) => ResolvedProvider::resolve(&pool, data_dir(&app).ok()).await,
        Err(e) => Err(e),
    };
    match resolved {
        Ok(rp)
            if rp.kind == LLMProvider::BuiltInAI
                && crate::summary::summary_engine::commands::available_summary_model(&app)
                    .await
                    .is_none() =>
        {
            AiStatus {
                ready: false,
                provider: Some(rp.label()),
                reason: Some(NO_AI.into()),
            }
        }
        Ok(rp) => AiStatus {
            ready: true,
            provider: Some(rp.label()),
            reason: None,
        },
        Err(e) => AiStatus {
            ready: false,
            provider: None,
            reason: Some(e),
        },
    }
}

#[tauri::command]
pub async fn translation_live_start<R: Runtime>(
    app: AppHandle<R>,
    language: String,
) -> Result<LiveStatus, String> {
    check_language(&language)?;
    live::start(app, language).await
}

#[tauri::command]
pub fn translation_live_stop<R: Runtime>(app: AppHandle<R>) {
    live::stop(&app);
}

#[tauri::command]
pub fn translation_live_status() -> LiveStatus {
    live::current_status()
}

#[derive(Debug, Serialize)]
pub struct LiveLine {
    pub sequence_id: u64,
    pub text: String,
}

#[tauri::command]
pub fn translation_live_lines(language: String) -> Vec<LiveLine> {
    live::finished(&language)
        .into_iter()
        .map(|(sequence_id, text)| LiveLine { sequence_id, text })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::check_language;

    #[test]
    fn accepts_language_codes_and_rejects_paths() {
        for ok in ["fa", "en", "zh-tw", "pt-BR"] {
            assert!(check_language(ok).is_ok(), "{ok}");
        }
        for bad in ["", "e", "../../x", "fa/..", "a b", "verylongcode"] {
            assert!(check_language(bad).is_err(), "{bad}");
        }
    }
}
