//! The models this account can use right now, from each provider's own model
//! list (the same listings Settings shows). Nothing is hard-coded except the
//! Claude Code aliases, which the CLI itself guarantees.

use std::path::Path;

use super::picker_prompt::Candidate;
use super::provider::ResolvedProvider;
use crate::summary::llm_client::LLMProvider;

/// Keep the picker prompt short and cheap.
const MAX_CANDIDATES: usize = 60;

pub async fn list(rp: &ResolvedProvider, app_data_dir: &Path) -> Vec<Candidate> {
    let key = Some(rp.api_key().to_string());
    let mut out: Vec<Candidate> = match rp.kind {
        LLMProvider::Claude => crate::anthropic::anthropic::get_anthropic_models(key)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|m| cand(m.id, m.display_name.unwrap_or_default()))
            .collect(),
        LLMProvider::OpenAI => crate::openai::openai::get_openai_models(key)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|m| cand(m.id, String::new()))
            .collect(),
        LLMProvider::Groq => crate::groq::groq::get_groq_models(key)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|m| cand(m.id, String::new()))
            .collect(),
        LLMProvider::OpenRouter => openrouter(&rp.user_model).await,
        LLMProvider::CodexCli => cli_catalog(app_data_dir, false),
        LLMProvider::ClaudeCodeCli => cli_catalog(app_data_dir, true),
        // Local and custom endpoints keep the one model the user set up.
        _ => Vec::new(),
    };
    out.truncate(MAX_CANDIDATES);
    out
}

fn cand(id: String, note: String) -> Candidate {
    Candidate { id, note }
}

/// Cached CLI catalog (no CLI calls here), minus the "default" sentinel.
fn cli_catalog(dir: &Path, claude: bool) -> Vec<Candidate> {
    let listed = if claude {
        crate::claude_code::models::list_models(dir, false)
    } else {
        crate::codex::models::list_models(dir, false)
    };
    let mut ids: Vec<String> = listed
        .map(|p| p.models.into_iter().map(|m| m.id).collect())
        .unwrap_or_default();
    if claude {
        ids.extend(
            crate::claude_code::models::ALIAS_SEEDS
                .iter()
                .map(|s| s.to_string()),
        );
    }
    let mut seen = std::collections::HashSet::new();
    ids.into_iter()
        .filter(|id| !id.eq_ignore_ascii_case("default") && seen.insert(id.clone()))
        .map(|id| cand(id, String::new()))
        .collect()
}

/// OpenRouter lists hundreds of models: keep the user's vendor when it has a
/// few, otherwise the cheapest priced text models. Prices go in the note.
async fn openrouter(user_model: &str) -> Vec<Candidate> {
    let all = tokio::task::spawn_blocking(crate::openrouter::openrouter::get_openrouter_models)
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default();
    let vendor = user_model.split('/').next().unwrap_or_default().to_string();
    let price = |p: &Option<String>| p.as_deref().and_then(|s| s.parse::<f64>().ok());
    let mut priced: Vec<(f64, Candidate)> = all
        .into_iter()
        .filter_map(|m| {
            let (inp, out) = (price(&m.prompt_price)?, price(&m.completion_price)?);
            let note = format!("${:.2}/${:.2} per 1M tokens", inp * 1e6, out * 1e6);
            Some((inp + out, cand(m.id, note)))
        })
        .collect();
    priced.sort_by(|a, b| a.0.total_cmp(&b.0));
    let same_vendor: Vec<Candidate> = priced
        .iter()
        .filter(|(_, c)| !vendor.is_empty() && c.id.starts_with(&format!("{vendor}/")))
        .map(|(_, c)| c.clone())
        .collect();
    if same_vendor.len() >= 2 {
        return same_vendor;
    }
    priced
        .into_iter()
        .filter(|(p, _)| *p > 0.0)
        .map(|(_, c)| c)
        .take(40)
        .collect()
}
