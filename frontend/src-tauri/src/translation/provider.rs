//! The AI the user connected for notes (Settings > AI notes), resolved once so
//! translation calls can run it with a different, faster model without ever
//! touching the saved settings.

use std::path::PathBuf;

use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

use crate::database::repositories::setting::SettingsRepository;
use crate::summary::configured::is_keyless;
use crate::summary::llm_client::{generate_summary, provider_name, LLMProvider};
use crate::summary::CustomOpenAIConfig;

/// Error codes the frontend maps to the "Connect an AI" state.
pub const NO_AI: &str = "no_ai_configured";
pub const NO_KEY: &str = "missing_api_key";

#[derive(Debug, Clone)]
pub struct ResolvedProvider {
    pub kind: LLMProvider,
    /// The stored provider id (e.g. `claude`, `claude-code`).
    pub id: String,
    /// The model the user picked for notes.
    pub user_model: String,
    api_key: String,
    ollama_endpoint: Option<String>,
    custom: Option<CustomOpenAIConfig>,
    app_data_dir: Option<PathBuf>,
    client: reqwest::Client,
}

impl ResolvedProvider {
    pub async fn resolve(pool: &SqlitePool, app_data_dir: Option<PathBuf>) -> Result<Self, String> {
        let cfg = SettingsRepository::get_model_config(pool)
            .await
            .map_err(|e| e.to_string())?
            .filter(|c| !c.provider.trim().is_empty())
            .ok_or(NO_AI)?;
        let kind = LLMProvider::from_str(&cfg.provider).map_err(|_| NO_AI.to_string())?;
        let mut user_model = cfg.model.clone();
        let mut api_key = String::new();
        let mut custom = None;
        if kind == LLMProvider::CustomOpenAI {
            let c = SettingsRepository::get_custom_openai_config(pool)
                .await
                .map_err(|e| e.to_string())?
                .ok_or(NO_AI)?;
            user_model = c.model.clone();
            api_key = c.api_key.clone().unwrap_or_default();
            custom = Some(c);
        } else if !is_keyless(&kind) {
            api_key = SettingsRepository::get_api_key(pool, &cfg.provider)
                .await
                .map_err(|e| e.to_string())?
                .unwrap_or_default();
            if api_key.trim().is_empty() {
                return Err(NO_KEY.into());
            }
        }
        Ok(Self {
            kind,
            id: cfg.provider,
            user_model,
            api_key,
            ollama_endpoint: cfg.ollama_endpoint,
            custom,
            app_data_dir,
            client: reqwest::Client::new(),
        })
    }

    /// Name shown to the user ("Uses Claude, the AI you picked for notes").
    pub fn label(&self) -> String {
        provider_name(&self.kind)
            .trim_end_matches(" (subscription)")
            .to_string()
    }

    /// Runs on this computer: no model switching, and background work waits
    /// for live lines so they share the machine politely.
    pub fn is_local(&self) -> bool {
        matches!(self.kind, LLMProvider::Ollama | LLMProvider::BuiltInAI)
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    /// One completion with `model` instead of the user's notes model.
    /// Not used for Claude Code, which runs through a persistent session.
    pub async fn complete(
        &self,
        model: &str,
        system: &str,
        user: &str,
        cancel: Option<&CancellationToken>,
    ) -> Result<String, String> {
        let custom = self.custom.as_ref();
        generate_summary(
            &self.client,
            &self.kind,
            model,
            &self.api_key,
            system,
            user,
            self.ollama_endpoint.as_deref(),
            custom.map(|c| c.endpoint.as_str()),
            custom.and_then(|c| c.max_tokens.map(|m| m as u32)),
            custom.and_then(|c| c.temperature),
            custom.and_then(|c| c.top_p),
            self.app_data_dir.as_ref(),
            cancel,
        )
        .await
    }
}
