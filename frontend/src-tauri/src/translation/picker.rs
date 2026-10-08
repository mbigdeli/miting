//! Chooses the translation model without asking the user: list the models the
//! account can use, ask the user's own AI which one fits fast caption
//! translation, prove the choice with one tiny translation, and remember it
//! for a day. Any failure falls back to the model the user picked for notes.

use std::path::Path;
use std::time::Duration;

use tokio_util::sync::CancellationToken;

use super::engine::Translator;
use super::picker_prompt;
use super::prompt;
use super::provider::ResolvedProvider;
use super::{candidates, workdir};

mod cache;
use cache::{cached, remember};

const STEP_TIMEOUT: Duration = Duration::from_secs(60);

/// The model to translate with. Never fails; worst case is the notes model.
/// Stops early (without caching anything) when `cancel` fires.
pub async fn choose(rp: &ResolvedProvider, dir: &Path, cancel: &CancellationToken) -> String {
    if let Some(model) = cached(dir, rp) {
        return model;
    }
    let picked = ask_and_verify(rp, dir, cancel).await;
    if cancel.is_cancelled() {
        return rp.user_model.clone();
    }
    let fallback = picked.is_none();
    let model = picked.unwrap_or_else(|| rp.user_model.clone());
    log::info!(
        "translation model for {}: {} (notes model {})",
        rp.id,
        model,
        rp.user_model
    );
    remember(dir, rp, &model, fallback);
    model
}

async fn ask_and_verify(
    rp: &ResolvedProvider,
    dir: &Path,
    cancel: &CancellationToken,
) -> Option<String> {
    if rp.is_local() {
        return None; // keep one model loaded on this computer
    }
    let list = candidates::list(rp, dir).await;
    if list.len() < 2 {
        return None;
    }
    let asker = Translator::new(
        rp.clone(),
        rp.user_model.clone(),
        picker_prompt::SYSTEM.to_string(),
        workdir(dir, "picker"),
    );
    let question = picker_prompt::user_prompt(&rp.user_model, &list);
    let reply = tokio::time::timeout(STEP_TIMEOUT, asker.ask(&question, cancel))
        .await
        .ok()?
        .ok()?;
    let picked = picker_prompt::parse(&reply, &list)?;
    if picked == rp.user_model {
        return Some(picked);
    }
    // Prove the pick works on this account before relying on it.
    let system = prompt::system_prompt("English", Some("French"));
    let probe = Translator::new(
        rp.clone(),
        picked.clone(),
        system,
        workdir(dir, "picker-check"),
    );
    let lines = ["Bonjour à tous.".to_string()];
    let ok = tokio::time::timeout(STEP_TIMEOUT, probe.translate(&[], &lines, cancel))
        .await
        .ok()?
        .ok()?
        .first()
        .is_some_and(Option::is_some);
    ok.then_some(picked)
}
