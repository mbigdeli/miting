//! Live translations waiting for their miting to be saved.
//!
//! During recording there is no meeting row yet, so finished translations are
//! kept here by `sequence_id` (unique for the app's lifetime). When the
//! transcript is saved, `link_meeting` writes them to the database and
//! remembers where each line went, so translations that finish after the save
//! are written straight through.

use std::collections::HashMap;
use std::sync::Mutex;

use sqlx::SqlitePool;

use crate::database::repositories::translation::{NewTranslation, TranslationsRepository};

mod link;
pub use link::{link_meeting, link_saved_transcript};

#[derive(Default)]
struct Store {
    /// language -> sequence_id -> translation
    pending: HashMap<String, HashMap<u64, String>>,
    /// language -> (provider id, model) that produced it
    meta: HashMap<String, (String, String)>,
    /// sequence_id -> (meeting_id, segment_key) once saved
    links: HashMap<u64, (String, String)>,
}

static STORE: Mutex<Option<Store>> = Mutex::new(None);

fn with<T>(f: impl FnOnce(&mut Store) -> T) -> T {
    let mut guard = STORE.lock().unwrap_or_else(|p| p.into_inner());
    f(guard.get_or_insert_with(Store::default))
}

/// A new live session starts: links to earlier saved mitings are dropped, so
/// sequence ids reused after an app restart (a recovered miting saved with
/// the previous run's ids) can never send new lines into that miting.
pub fn forget_saved_links() {
    with(|s| s.links.clear());
}

/// Translations already finished for `language` (used after a page reload).
pub fn finished(language: &str) -> Vec<(u64, String)> {
    with(|s| {
        s.pending
            .get(language)
            .map(|m| m.iter().map(|(k, v)| (*k, v.clone())).collect())
            .unwrap_or_default()
    })
}

pub fn has(language: &str, seq: u64) -> bool {
    with(|s| {
        s.pending
            .get(language)
            .is_some_and(|m| m.contains_key(&seq))
    })
}

/// Record one finished line; writes through when its miting is already saved.
pub async fn record(
    pool: Option<&SqlitePool>,
    language: &str,
    provider: &str,
    model: &str,
    seq: u64,
    text: String,
) {
    let link = with(|s| {
        s.meta.insert(
            language.to_string(),
            (provider.to_string(), model.to_string()),
        );
        s.pending
            .entry(language.to_string())
            .or_default()
            .insert(seq, text.clone());
        s.links.get(&seq).cloned()
    });
    if let (Some(pool), Some((meeting_id, key))) = (pool, link) {
        let row = [NewTranslation {
            segment_key: key,
            text,
        }];
        if let Err(e) = TranslationsRepository::upsert_many(
            pool,
            &meeting_id,
            language,
            Some(provider),
            Some(model),
            &row,
        )
        .await
        {
            log::warn!("store late translation for {meeting_id}: {e}");
        }
    }
}

#[cfg(test)]
#[path = "store/store_tests.rs"]
mod tests;
