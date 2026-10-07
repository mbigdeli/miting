use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;
use log::{info, warn, error};
use anyhow::Result;

use crate::state::AppState;
use crate::database::repositories::setting::SettingsRepository;


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OnboardingStatus {
    pub version: String,
    pub completed: bool,
    pub current_step: u8,
    pub model_status: ModelStatus,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ModelStatus {
    pub parakeet: String,  // "downloaded" | "not_downloaded" | "downloading"
    pub summary: String,   // Generic field for summary model (Qwen 3.5 or legacy Gemma variants)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selected_summary_model: Option<String>,
}

impl Default for OnboardingStatus {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            completed: false,
            current_step: 1,
            model_status: ModelStatus {
                parakeet: "not_downloaded".to_string(),
                summary: "not_downloaded".to_string(),  // Changed from gemma
                selected_summary_model: None,
            },
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
}


/// Load onboarding status from store
pub async fn load_onboarding_status<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<OnboardingStatus> {
    // Try to load from Tauri store
    let store = match app.store("onboarding-status.json") {
        Ok(store) => store,
        Err(e) => {
            warn!("Failed to access onboarding store: {}, using defaults", e);
            return Ok(OnboardingStatus::default());
        }
    };

    // Try to get the status from store
    let status = if let Some(value) = store.get("status") {
        match serde_json::from_value::<OnboardingStatus>(value.clone()) {
            Ok(s) => {
                info!("Loaded onboarding status from store - Step: {}, Completed: {}",
                      s.current_step, s.completed);
                s
            }
            Err(e) => {
                warn!("Failed to deserialize onboarding status: {}, using defaults", e);
                OnboardingStatus::default()
            }
        }
    } else {
        info!("No stored onboarding status found, using defaults");
        OnboardingStatus::default()
    };

    Ok(status)
}

/// Save onboarding status to store
pub async fn save_onboarding_status<R: Runtime>(
    app: &AppHandle<R>,
    status: &OnboardingStatus,
) -> Result<()> {
    info!("Saving onboarding status: step={}, completed={}",
          status.current_step, status.completed);

    // Get or create store
    let store = app.store("onboarding-status.json")
        .map_err(|e| anyhow::anyhow!("Failed to access onboarding store: {}", e))?;

    // Update last_updated timestamp
    let mut status = status.clone();
    status.last_updated = chrono::Utc::now().to_rfc3339();

    // Serialize status to JSON value
    let status_value = serde_json::to_value(&status)
        .map_err(|e| anyhow::anyhow!("Failed to serialize onboarding status: {}", e))?;

    // Save to store
    store.set("status", status_value);

    // Persist to disk
    store.save()
        .map_err(|e| anyhow::anyhow!("Failed to save onboarding store to disk: {}", e))?;

    info!("Successfully persisted onboarding status to disk");
    Ok(())
}

/// Reset onboarding status (delete from store)
pub async fn reset_onboarding_status<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<()> {
    info!("Resetting onboarding status");

    let store = app.store("onboarding-status.json")
        .map_err(|e| anyhow::anyhow!("Failed to access onboarding store: {}", e))?;

    // Clear the status key
    store.delete("status");

    // Persist deletion to disk
    store.save()
        .map_err(|e| anyhow::anyhow!("Failed to save onboarding store after reset: {}", e))?;

    info!("Successfully reset onboarding status");
    Ok(())
}

/// Tauri commands for onboarding status
#[tauri::command]
pub async fn get_onboarding_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<OnboardingStatus>, String> {
    let status = load_onboarding_status(&app)
        .await
        .map_err(|e| format!("Failed to load onboarding status: {}", e))?;

    // Return None if it's the default (never saved before)
    // Check if we have any saved data by seeing if the store has the key
    let store = app.store("onboarding-status.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    if store.get("status").is_none() {
        Ok(None)
    } else {
        Ok(Some(status))
    }
}

#[tauri::command]
pub async fn save_onboarding_status_cmd<R: Runtime>(
    app: AppHandle<R>,
    status: OnboardingStatus,
) -> Result<(), String> {
    save_onboarding_status(&app, &status)
        .await
        .map_err(|e| format!("Failed to save onboarding status: {}", e))
}

#[tauri::command]
pub async fn reset_onboarding_status_cmd<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    reset_onboarding_status(&app)
        .await
        .map_err(|e| format!("Failed to reset onboarding status: {}", e))
}

#[tauri::command]
pub async fn complete_onboarding<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    model: String,
    // Optional and defaulted so a payload from an older frontend still
    // deserializes. Absent means "not downloaded", which is now the honest
    // answer when the user skipped the downloads.
    parakeet_downloaded: Option<bool>,
    summary_downloaded: Option<bool>,
    // The setup steps save each pick the moment the user makes it (a model
    // that finished downloading, a connected Claude or ChatGPT plan). When
    // set, completing must leave those saved choices alone.
    keep_choices: Option<bool>,
) -> Result<(), String> {
    info!("Completing onboarding with builtin-ai model: {}", model);

    // Step 1: Save model configuration to SQLite database FIRST
    let pool = state.db_manager.pool();

    if writes_default_configs(keep_choices) {
        // Older frontends: onboarding always used builtin-ai (local LLM)
        if let Err(e) = SettingsRepository::save_model_config(
            pool,
            "builtin-ai",
            &model,
            "large-v3",
            None,
        ).await {
            error!("Failed to save builtin-ai model config: {}", e);
            return Err(format!("Failed to save builtin-ai model config: {}", e));
        }
        info!("Saved builtin-ai model config: model={}", model);

        // Save transcription model config (parakeet provider) - always parakeet
        if let Err(e) = SettingsRepository::save_transcript_config(
            pool,
            "parakeet",
            crate::config::DEFAULT_PARAKEET_MODEL,
        ).await {
            error!("Failed to save transcription model config: {}", e);
            return Err(format!("Failed to save transcription model config: {}", e));
        }
        info!("Saved transcription model config: provider=parakeet, model={}", crate::config::DEFAULT_PARAKEET_MODEL);
    } else {
        info!("Keeping the model choices made during setup");
    }

    // Step 2: Only NOW mark onboarding as complete (after DB operations succeed)
    let mut status = load_onboarding_status(&app)
        .await
        .map_err(|e| format!("Failed to load onboarding status: {}", e))?;

    status = completed_status(status, &model, parakeet_downloaded, summary_downloaded);

    save_onboarding_status(&app, &status)
        .await
        .map_err(|e| format!("Failed to save completed onboarding status: {}", e))?;

    info!("Onboarding completed successfully with model: {}", model);
    Ok(())
}

/// Whether completing onboarding should write the old fixed defaults
/// (builtin-ai summaries, Parakeet transcription). A frontend that omits the
/// flag predates the setup steps and still expects them.
fn writes_default_configs(keep_choices: Option<bool>) -> bool {
    !keep_choices.unwrap_or(false)
}

/// Stamp completion, recording what was actually downloaded.
///
/// This used to write "downloaded" for both engines unconditionally, which was
/// only ever true because the flow forced the downloads. Now that they are
/// optional, the stored status has to reflect reality or the app reports a
/// setup it does not have.
fn completed_status(
    mut status: OnboardingStatus,
    model: &str,
    parakeet_downloaded: Option<bool>,
    summary_downloaded: Option<bool>,
) -> OnboardingStatus {
    fn stamp(downloaded: Option<bool>) -> String {
        if downloaded.unwrap_or(false) {
            "downloaded".to_string()
        } else {
            "not_downloaded".to_string()
        }
    }

    status.completed = true;
    status.current_step = 4; // Max step (4 on macOS with permissions, 3 on other platforms)
    status.model_status.parakeet = stamp(parakeet_downloaded);
    status.model_status.summary = stamp(summary_downloaded);
    status.model_status.selected_summary_model = Some(model.to_string());
    status
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn onboarding_status_deserializes_without_selected_summary_model() {
        let status: OnboardingStatus = serde_json::from_str(
            r#"{
                "version": "1.0",
                "completed": true,
                "current_step": 4,
                "model_status": {
                    "parakeet": "downloaded",
                    "summary": "downloaded"
                },
                "last_updated": "2026-05-30T00:00:00Z"
            }"#,
        )
        .expect("old onboarding status should remain compatible");

        assert_eq!(status.model_status.selected_summary_model, None);
    }

    fn fresh_status() -> OnboardingStatus {
        serde_json::from_str(
            r#"{
                "version": "1.0",
                "completed": false,
                "current_step": 3,
                "model_status": { "parakeet": "not_downloaded", "summary": "not_downloaded" },
                "last_updated": "2026-08-14T00:00:00Z"
            }"#,
        )
        .expect("fixture parses")
    }

    #[test]
    fn completing_without_downloads_records_them_as_missing() {
        let status = completed_status(fresh_status(), "qwen3.5:2b", Some(false), Some(false));

        assert!(status.completed);
        assert_eq!(status.model_status.parakeet, "not_downloaded");
        assert_eq!(status.model_status.summary, "not_downloaded");
        assert_eq!(
            status.model_status.selected_summary_model.as_deref(),
            Some("qwen3.5:2b")
        );
    }

    #[test]
    fn completing_after_downloads_records_them_as_present() {
        let status = completed_status(fresh_status(), "qwen3.5:4b", Some(true), Some(true));
        assert_eq!(status.model_status.parakeet, "downloaded");
        assert_eq!(status.model_status.summary, "downloaded");
    }

    #[test]
    fn choices_made_in_the_setup_steps_are_kept() {
        assert!(!writes_default_configs(Some(true)));
    }

    #[test]
    fn an_older_frontend_still_gets_the_default_configs() {
        assert!(writes_default_configs(None));
        assert!(writes_default_configs(Some(false)));
    }

    #[test]
    fn an_older_frontend_omitting_the_flags_is_not_assumed_to_have_models() {
        let status = completed_status(fresh_status(), "qwen3.5:2b", None, None);
        assert_eq!(status.model_status.parakeet, "not_downloaded");
        assert_eq!(status.model_status.summary, "not_downloaded");
    }
}
