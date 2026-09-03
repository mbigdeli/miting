// audio/transcription/active_model.rs
//
// Session-scoped record of the engine + model the transcription worker
// actually initialised. `api_save_transcript` stamps the meeting from this
// instead of re-reading settings at save time, which mis-attributed the
// meeting after a mid-session engine switch.

use std::sync::RwLock;

static ACTIVE: RwLock<Option<(String, String)>> = RwLock::new(None);

/// Map an engine's display name to the provider ids stored in
/// `transcript_settings` (`localWhisper` / `parakeet` / `shenava`).
fn config_provider(engine_name: &str) -> String {
    match engine_name {
        name if name.starts_with("Whisper") => "localWhisper".to_string(),
        name if name.starts_with("Parakeet") => "parakeet".to_string(),
        other => other.to_ascii_lowercase(),
    }
}

/// Forget the previous session's engine.
///
/// This is a process-global, and nothing used to clear it — so a companion
/// session, which runs no engine at all, inherited whatever recorded before it
/// and saved Meet captions stamped "Shenava". Cleared at every start, the
/// stamp can only ever describe the session that set it.
pub fn clear() {
    if let Ok(mut guard) = ACTIVE.write() {
        *guard = None;
    }
}

/// Record the engine + model the transcription worker initialised.
pub fn record(engine_name: &str, model: Option<String>) {
    let entry = model.map(|model| (config_provider(engine_name), model));
    if let Ok(mut guard) = ACTIVE.write() {
        *guard = entry;
    }
}

/// Engine + model used by the most recent transcription session, if any.
pub fn current() -> Option<(String, String)> {
    ACTIVE.read().ok().and_then(|guard| guard.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn engine_names_map_to_config_provider_ids() {
        assert_eq!(config_provider("Whisper (direct)"), "localWhisper");
        assert_eq!(config_provider("Parakeet (direct)"), "parakeet");
        assert_eq!(config_provider("Shenava"), "shenava");
    }

    #[test]
    fn clearing_stops_one_session_attributing_the_next() {
        record("Shenava", Some("koochik".to_string()));
        clear();
        assert_eq!(
            current(),
            None,
            "a companion session must not inherit this stamp"
        );
    }

    #[test]
    fn record_then_current_roundtrips_and_clears_on_none() {
        record("Shenava", Some("koochik".to_string()));
        assert_eq!(
            current(),
            Some(("shenava".to_string(), "koochik".to_string()))
        );
        record("Whisper (direct)", None);
        assert_eq!(current(), None);
    }
}
