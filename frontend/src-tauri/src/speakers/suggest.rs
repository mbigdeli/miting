//! Ask the configured AI for speaker names and store the verified ones.

use std::path::Path;

use sqlx::SqlitePool;

use super::{naming, prompt};
use crate::database::repositories::speakers::write;
use crate::diarize_engine::DiarizedSegment;

/// Best effort: names are a bonus, so any AI failure leaves "Speaker N".
pub async fn suggest_names(
    pool: &SqlitePool,
    data_dir: &Path,
    meeting_id: &str,
    labelled: &[DiarizedSegment],
) {
    let participants: Vec<String> =
        sqlx::query_scalar("SELECT name FROM meeting_participants WHERE meeting_id = ?")
            .bind(meeting_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();
    let prompt = prompt::user_prompt(labelled, &participants);
    let dir = data_dir.to_path_buf();
    let raw = crate::summary::configured::generate_with_configured(
        pool,
        Some(&dir),
        prompt::SYSTEM_PROMPT,
        &prompt,
    )
    .await;
    let raw = match raw {
        Ok(raw) => raw,
        Err(e) => {
            log::info!("speakers: no AI names for {meeting_id}: {e}");
            return;
        }
    };
    let suggestions = naming::parse_reply(&raw, labelled);
    match write::apply_suggestions(pool, meeting_id, &suggestions).await {
        Ok(n) => log::info!("speakers: {meeting_id}: {n} AI name(s) applied"),
        Err(e) => log::warn!("speakers: AI names not saved: {e}"),
    }
}
