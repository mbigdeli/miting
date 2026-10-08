//! Translation of transcript lines with the AI the user connected for notes.
//!
//! * `live`: while recording, each new line is translated as it arrives;
//!   earlier lines go in a slower background pass.
//! * `job`: a saved miting translated on demand into any language.
//!
//! Both use a translation model chosen automatically by `picker` (fast and
//! cheap, from the provider's own model list) and store results through
//! `TranslationsRepository`.

pub mod candidates;
pub mod commands;
pub mod engine;
pub mod events;
pub mod job;
pub mod live;
pub mod meeting_commands;
pub mod picker;
pub mod picker_prompt;
pub mod prompt;
pub mod provider;
pub mod store;

#[cfg(test)]
#[path = "fake_ai_tests.rs"]
pub(crate) mod fake_ai;

use std::path::{Path, PathBuf};

/// Lines per request for background and saved-miting work. Small enough that
/// even a 2048-token reply cap fits a batch of Persian output.
pub const BATCH_LINES: usize = 10;
/// Earlier line pairs sent along for consistency of names and terms.
pub const CONTEXT_PAIRS: usize = 3;

/// An empty folder for a Claude Code session (keeps project files out).
pub fn workdir(app_data_dir: &Path, name: &str) -> PathBuf {
    app_data_dir.join("translation_work").join(name)
}

/// English name for a language code, used inside prompts.
pub fn language_name(code: &str) -> String {
    crate::summary::processor::language_name_from_code(code)
        .map(str::to_string)
        .unwrap_or_else(|| code.to_string())
}

/// The spoken language when the user pinned one; `None` for auto-detect.
pub fn spoken_language() -> Option<String> {
    let pref = crate::get_language_preference_internal()?;
    match pref.trim() {
        "" | "auto" | "auto-translate" => None,
        code => Some(language_name(code)),
    }
}

/// System prompt for translating into `target` (a language code).
pub fn system_prompt_for(target: &str) -> String {
    prompt::system_prompt(&language_name(target), spoken_language().as_deref())
}
