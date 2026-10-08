//! Tauri commands for translating saved mitings.

use std::collections::HashMap;

use serde::Serialize;
use tauri::{AppHandle, Runtime};

use super::commands::{check_language, pool};
use super::events::JobProgress;
use super::job;
use crate::database::repositories::translation::{LanguageCoverage, TranslationsRepository};
use crate::database::repositories::translation_sources::source_lines;

#[derive(Debug, Serialize)]
pub struct MeetingTranslations {
    pub languages: Vec<LanguageCoverage>,
    /// Lines the miting shows, so coverage can be told apart from complete.
    pub total: usize,
}

#[tauri::command]
pub async fn translation_meeting_languages<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
) -> Result<MeetingTranslations, String> {
    let pool = pool(&app)?;
    let languages = TranslationsRepository::languages(&pool, &meeting_id)
        .await
        .map_err(|e| e.to_string())?;
    let total = source_lines(&pool, &meeting_id)
        .await
        .map_err(|e| e.to_string())?
        .len();
    Ok(MeetingTranslations { languages, total })
}

#[derive(Debug, Serialize)]
pub struct SavedLine {
    pub key: String,
    pub text: String,
}

#[tauri::command]
pub async fn translation_meeting_lines<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    language: String,
) -> Result<Vec<SavedLine>, String> {
    let rows = TranslationsRepository::list(&pool(&app)?, &meeting_id, &language)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|(key, text)| SavedLine { key, text })
        .collect())
}

#[tauri::command]
pub async fn translation_meeting_start<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    language: String,
) -> Result<JobProgress, String> {
    check_language(&language)?;
    job::start(app, meeting_id, language).await
}

#[tauri::command]
pub fn translation_meeting_cancel(meeting_id: String, language: String) {
    job::cancel(&meeting_id, &language);
}

#[tauri::command]
pub fn translation_jobs() -> Vec<JobProgress> {
    job::running()
}

/// The transcript as copy text, each line followed by its translation.
#[tauri::command]
pub async fn translation_meeting_text<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    language: String,
) -> Result<String, String> {
    let pool = pool(&app)?;
    let lines = source_lines(&pool, &meeting_id)
        .await
        .map_err(|e| e.to_string())?;
    let translated: HashMap<String, String> =
        TranslationsRepository::list(&pool, &meeting_id, &language)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .collect();
    Ok(bilingual(&lines, &translated))
}

fn bilingual(lines: &[(String, String)], translated: &HashMap<String, String>) -> String {
    lines
        .iter()
        .map(|(key, text)| match translated.get(key) {
            Some(t) => format!(
                "{text}
{t}"
            ),
            None => text.clone(),
        })
        .collect::<Vec<_>>()
        .join(
            "

",
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn puts_each_translation_under_its_line() {
        let lines = vec![
            ("a".to_string(), "Bonjour".to_string()),
            ("b".to_string(), "Merci".to_string()),
        ];
        let tr = HashMap::from([("a".to_string(), "Hello".to_string())]);
        assert_eq!(
            bilingual(&lines, &tr),
            "Bonjour
Hello

Merci"
        );
    }
}
