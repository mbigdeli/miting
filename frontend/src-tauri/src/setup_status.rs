//! What the user still has to set up, as a fact the UI can display.
//!
//! Nothing here gates anything: recording works with none of it. The point is
//! that a user who skipped the downloads should be able to see *why*
//! transcription and summaries are unavailable without first hitting a wall.

use serde::Serialize;
use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    /// At least one transcription engine has a usable model on disk.
    pub transcription_model_available: bool,
    /// A summary provider is selected in settings.
    pub summary_configured: bool,
    /// The selected summary provider can actually run right now.
    pub summary_model_ready: bool,
}

/// Kept pure so the truth table is testable without an app handle.
pub fn summarize(
    transcription_model_available: bool,
    summary_provider: Option<&str>,
    builtin_model_available: bool,
) -> SetupStatus {
    let summary_configured = summary_provider.is_some_and(|provider| !provider.trim().is_empty());
    // Only the built-in provider can be verified locally; for remote providers
    // a saved configuration is as much as we can honestly claim to know.
    let summary_model_ready = match summary_provider {
        Some("builtin-ai") => builtin_model_available,
        Some(provider) if !provider.trim().is_empty() => true,
        _ => false,
    };

    SetupStatus {
        transcription_model_available,
        summary_configured,
        summary_model_ready,
    }
}

/// Never fails: a database that cannot be read is reported as "not configured"
/// rather than an error, because the recovery screen owns that case and this
/// notice must not add noise on top of it.
#[tauri::command]
pub async fn get_setup_status<R: Runtime>(app: AppHandle<R>) -> SetupStatus {
    let transcription = any_transcription_model_available().await;
    let provider = crate::api::transcript_summary_provider(&app).await;
    let builtin_ready = builtin_summary_model_available(&app).await;

    summarize(transcription, provider.as_deref(), builtin_ready)
}

async fn any_transcription_model_available() -> bool {
    let parakeet = crate::parakeet_engine::commands::parakeet_has_available_models()
        .await
        .unwrap_or(false);
    if parakeet {
        return true;
    }
    if crate::whisper_engine::commands::whisper_has_available_models()
        .await
        .unwrap_or(false)
    {
        return true;
    }
    crate::shenava_engine::commands::shenava_has_available_models()
        .await
        .unwrap_or(false)
}

async fn builtin_summary_model_available<R: Runtime>(app: &AppHandle<R>) -> bool {
    crate::summary::summary_engine::commands::available_summary_model(app)
        .await
        .is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fresh_install_reports_everything_outstanding() {
        let status = summarize(false, None, false);
        assert!(!status.transcription_model_available);
        assert!(!status.summary_configured);
        assert!(!status.summary_model_ready);
    }

    #[test]
    fn builtin_ai_is_only_ready_once_its_model_is_on_disk() {
        assert!(!summarize(true, Some("builtin-ai"), false).summary_model_ready);
        assert!(summarize(true, Some("builtin-ai"), true).summary_model_ready);
    }

    #[test]
    fn a_remote_provider_counts_as_ready_once_configured() {
        let status = summarize(false, Some("ollama"), false);
        assert!(status.summary_configured);
        assert!(status.summary_model_ready);
    }

    #[test]
    fn a_blank_provider_is_not_configured() {
        let status = summarize(true, Some("   "), true);
        assert!(!status.summary_configured);
        assert!(!status.summary_model_ready);
    }
}
