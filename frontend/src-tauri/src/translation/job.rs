//! Translating a saved miting into one language, in the background, in small
//! batches. Lines already translated are skipped, so a stopped or interrupted
//! job simply continues where it left off next time.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use sqlx::SqlitePool;
use tauri::{AppHandle, Runtime};
use tokio_util::sync::CancellationToken;

use super::commands;
use super::events::{JobProgress, JobState, Notify};
use super::provider::ResolvedProvider;
use crate::database::repositories::translation_sources::missing_lines;

mod run;

type Key = (String, String);
static JOBS: Mutex<Option<HashMap<Key, (CancellationToken, JobProgress)>>> = Mutex::new(None);

fn jobs<T>(f: impl FnOnce(&mut HashMap<Key, (CancellationToken, JobProgress)>) -> T) -> T {
    let mut guard = JOBS.lock().unwrap_or_else(|p| p.into_inner());
    f(guard.get_or_insert_with(HashMap::new))
}

pub fn running() -> Vec<JobProgress> {
    jobs(|j| j.values().map(|(_, p)| p.clone()).collect())
}

pub fn cancel(meeting_id: &str, language: &str) {
    jobs(|j| {
        j.get(&(meeting_id.to_string(), language.to_string()))
            .map(|(c, _)| c.cancel())
    });
}

pub async fn start<R: Runtime>(
    app: AppHandle<R>,
    meeting_id: String,
    language: String,
) -> Result<JobProgress, String> {
    let key = (meeting_id.clone(), language.clone());
    if let Some(p) = jobs(|j| j.get(&key).map(|(_, p)| p.clone())) {
        return Ok(p);
    }
    let pool = commands::pool(&app)?;
    let dir = commands::data_dir(&app)?;
    let rp = ResolvedProvider::resolve(&pool, Some(dir.clone())).await?;
    begin(app, pool, dir, rp, meeting_id, language).await
}

/// Queue the lines still missing and run them in the background.
pub(super) async fn begin<N: Notify>(
    n: N,
    pool: SqlitePool,
    dir: PathBuf,
    rp: ResolvedProvider,
    meeting_id: String,
    language: String,
) -> Result<JobProgress, String> {
    let key = (meeting_id.clone(), language.clone());
    let cancel = CancellationToken::new();
    let mut progress = JobProgress {
        meeting_id,
        language,
        done: 0,
        total: 0,
        state: JobState::Running,
        error: None,
    };
    // Claim the slot before any await, so a second click joins this job.
    let existing = jobs(|j| match j.get(&key) {
        Some((_, p)) => Some(p.clone()),
        None => {
            j.insert(key.clone(), (cancel.clone(), progress.clone()));
            None
        }
    });
    if let Some(p) = existing {
        return Ok(p);
    }
    let todo = match missing_lines(&pool, &progress.meeting_id, &progress.language)
        .await
        .map_err(|e| e.to_string())
    {
        Ok((todo, total)) => {
            (progress.done, progress.total) = (total - todo.len(), total);
            todo
        }
        Err(e) => {
            jobs(|j| j.remove(&key));
            return Err(e);
        }
    };
    jobs(|j| j.get_mut(&key).map(|e| e.1 = progress.clone()));
    n.progress(&progress);
    tauri::async_runtime::spawn(run::run(n, pool, dir, rp, todo, progress.clone(), cancel));
    Ok(progress)
}

#[cfg(test)]
#[path = "job/job_tests.rs"]
mod tests;
