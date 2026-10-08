//! The picked translation model, remembered per provider and notes model.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::translation::provider::ResolvedProvider;

const CACHE_SECS: u64 = 24 * 60 * 60;
/// A fallback (no pick could be made) is retried sooner.
const FALLBACK_SECS: u64 = 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Pick {
    provider: String,
    user_model: String,
    model: String,
    at: u64,
    #[serde(default)]
    fallback: bool,
}

fn cache_path(dir: &Path) -> PathBuf {
    dir.join("model_catalog").join("translation_model.json")
}

pub(super) fn cached(dir: &Path, rp: &ResolvedProvider) -> Option<String> {
    let raw = std::fs::read_to_string(cache_path(dir)).ok()?;
    let pick: Pick = serde_json::from_str(&raw).ok()?;
    let ttl = if pick.fallback {
        FALLBACK_SECS
    } else {
        CACHE_SECS
    };
    let fresh = crate::summary::model_store::now_unix().saturating_sub(pick.at) < ttl;
    (fresh && pick.provider == rp.id && pick.user_model == rp.user_model).then_some(pick.model)
}

pub(super) fn remember(dir: &Path, rp: &ResolvedProvider, model: &str, fallback: bool) {
    let pick = Pick {
        provider: rp.id.clone(),
        user_model: rp.user_model.clone(),
        model: model.to_string(),
        at: crate::summary::model_store::now_unix(),
        fallback,
    };
    let path = cache_path(dir);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&pick) {
        let _ = std::fs::write(path, json);
    }
}
