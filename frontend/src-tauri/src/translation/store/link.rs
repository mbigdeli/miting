//! Writing live translations once their miting exists.

use sqlx::SqlitePool;

use super::with;
use crate::database::repositories::translation::{NewTranslation, TranslationsRepository};

/// Rows for one language, with the provider and model that produced them.
type LanguageRows = (String, Option<(String, String)>, Vec<NewTranslation>);

/// The transcript was saved: write every finished translation of its lines.
pub async fn link_meeting(pool: &SqlitePool, meeting_id: &str, lines: &[(u64, String)]) {
    let batches = with(|s| {
        let mut by_lang: Vec<LanguageRows> = Vec::new();
        for (lang, done) in s.pending.iter_mut() {
            let rows: Vec<NewTranslation> = lines
                .iter()
                .filter_map(|(seq, key)| {
                    done.get(seq).map(|t| NewTranslation {
                        segment_key: key.clone(),
                        text: t.clone(),
                    })
                })
                .collect();
            // Written now; later lookups go through `links`.
            for (seq, _) in lines {
                done.remove(seq);
            }
            if !rows.is_empty() {
                by_lang.push((lang.clone(), s.meta.get(lang).cloned(), rows));
            }
        }
        for (seq, key) in lines {
            s.links.insert(*seq, (meeting_id.to_string(), key.clone()));
        }
        by_lang
    });
    for (lang, meta, rows) in batches {
        let (provider, model) = meta.unzip();
        if let Err(e) = TranslationsRepository::upsert_many(
            pool,
            meeting_id,
            &lang,
            provider.as_deref(),
            model.as_deref(),
            &rows,
        )
        .await
        {
            log::warn!("store live translations for {meeting_id}: {e}");
        }
    }
}

/// Called right after `api_save_transcript` stores a recording: rows were
/// inserted in segment order, so row order pairs each row with its live id.
pub async fn link_saved_transcript(
    pool: &SqlitePool,
    meeting_id: &str,
    segments: &[crate::api::TranscriptSegment],
) {
    if segments.iter().all(|s| s.sequence_id.is_none()) {
        return;
    }
    let ids: Vec<String> =
        match sqlx::query_scalar("SELECT id FROM transcripts WHERE meeting_id = ? ORDER BY rowid")
            .bind(meeting_id)
            .fetch_all(pool)
            .await
        {
            Ok(ids) if ids.len() == segments.len() => ids,
            _ => return,
        };
    let lines: Vec<(u64, String)> = segments
        .iter()
        .zip(ids)
        .filter_map(|(s, id)| s.sequence_id.map(|seq| (seq, id)))
        .collect();
    link_meeting(pool, meeting_id, &lines).await;
}
