//! Translates a batch of lines with a chosen model. HTTP and Codex providers
//! go through the shared completion call; Claude Code keeps one persistent
//! CLI session per translator, restarted every `TURNS_PER_SESSION` turns so
//! its conversation never grows without bound.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio_util::sync::CancellationToken;

use super::prompt::{self, Pair};
use super::provider::ResolvedProvider;
use crate::claude_code::stream::ClaudeSession;
use crate::claude_code::ClaudeCliError;
use crate::summary::llm_client::LLMProvider;

const TURNS_PER_SESSION: u32 = 40;
const TURN_TIMEOUT: Duration = Duration::from_secs(90);

pub struct Translator {
    rp: ResolvedProvider,
    model: String,
    system: String,
    workdir: PathBuf,
    claude: Arc<Mutex<Option<ClaudeSession>>>,
}

impl Translator {
    pub fn new(rp: ResolvedProvider, model: String, system: String, workdir: PathBuf) -> Self {
        Self {
            rp,
            model,
            system,
            workdir,
            claude: Arc::new(Mutex::new(None)),
        }
    }

    pub fn provider(&self) -> &ResolvedProvider {
        &self.rp
    }

    pub fn model(&self) -> &str {
        &self.model
    }

    /// One slot per line. Retries once when the reply cannot be parsed.
    pub async fn translate(
        &self,
        context: &[Pair],
        lines: &[String],
        cancel: &CancellationToken,
    ) -> Result<Vec<Option<String>>, String> {
        let user = prompt::user_prompt(context, lines);
        let mut last_err = String::new();
        for _ in 0..2 {
            let raw = self.ask(&user, cancel).await?;
            match prompt::parse_reply(&raw, lines.len()) {
                Ok(slots) => return Ok(slots),
                Err(e) => last_err = e,
            }
        }
        Err(last_err)
    }

    /// Raw completion with this translator's system prompt.
    pub async fn ask(&self, user: &str, cancel: &CancellationToken) -> Result<String, String> {
        if cancel.is_cancelled() {
            return Err("cancelled".into());
        }
        if self.rp.kind != LLMProvider::ClaudeCodeCli {
            return self
                .rp
                .complete(&self.model, &self.system, user, Some(cancel))
                .await;
        }
        let slot = self.claude.clone();
        let (model, system, dir) = (
            self.model.clone(),
            self.system.clone(),
            self.workdir.clone(),
        );
        let (user, cancel) = (user.to_string(), cancel.clone());
        tokio::task::spawn_blocking(move || {
            let mut guard = slot
                .lock()
                .map_err(|_| "claude session lock poisoned".to_string())?;
            if guard
                .as_ref()
                .is_some_and(|s| s.turns() >= TURNS_PER_SESSION)
            {
                *guard = None;
            }
            if guard.is_none() {
                let flag = crate::claude_code::model_flag(&model);
                *guard =
                    Some(ClaudeSession::spawn(flag.as_deref(), &system, &dir).map_err(cli_error)?);
            }
            let session = guard.as_mut().ok_or("claude session missing")?;
            let result = session.ask(&user, TURN_TIMEOUT, Some(&cancel));
            if result.is_err() {
                *guard = None; // start fresh next time
            }
            result.map_err(cli_error)
        })
        .await
        .map_err(|e| format!("claude task join error: {e}"))?
    }
}

fn cli_error(e: ClaudeCliError) -> String {
    match e {
        ClaudeCliError::NotInstalled => "claude_code_not_installed".into(),
        ClaudeCliError::NotLoggedIn => "claude_code_not_logged_in".into(),
        ClaudeCliError::Cancelled => "cancelled".into(),
        other => other.to_string(),
    }
}
