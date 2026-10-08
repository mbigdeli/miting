//! The batch loop of a saved-miting translation job.

use sqlx::SqlitePool;
use tokio_util::sync::CancellationToken;

use super::jobs;
use crate::database::repositories::translation::{NewTranslation, TranslationsRepository};
use crate::translation::engine::Translator;
use crate::translation::events::{JobProgress, JobState, Notify};
use crate::translation::prompt::Pair;
use crate::translation::provider::ResolvedProvider;
use crate::translation::{picker, system_prompt_for, workdir, BATCH_LINES, CONTEXT_PAIRS};

pub(super) async fn run<N: Notify>(
    n: N,
    pool: SqlitePool,
    dir: std::path::PathBuf,
    rp: ResolvedProvider,
    todo: Vec<(String, String)>,
    mut p: JobProgress,
    cancel: CancellationToken,
) {
    let model = picker::choose(&rp, &dir, &cancel).await;
    let tr = Translator::new(
        rp,
        model,
        system_prompt_for(&p.language),
        workdir(&dir, &format!("job-{}", p.language)),
    );
    let mut context: Vec<Pair> = Vec::new();
    let (mut failures, mut saved_any, mut last_err) = (0, false, None);
    for chunk in todo.chunks(BATCH_LINES) {
        if cancel.is_cancelled() {
            return finish(&n, p, JobState::Cancelled, None);
        }
        let texts: Vec<String> = chunk.iter().map(|(_, t)| t.clone()).collect();
        let mut result = tr.translate(&context, &texts, &cancel).await;
        if result.is_err() && !cancel.is_cancelled() {
            result = tr.translate(&context, &texts, &cancel).await;
        }
        match result {
            Ok(slots) => {
                (failures, saved_any) = (0, true);
                let rows = save(&pool, &p, &tr, chunk, slots, &mut context).await;
                if let Err(e) = rows {
                    return finish(&n, p, JobState::Failed, Some(e));
                }
            }
            Err(_) if cancel.is_cancelled() => return finish(&n, p, JobState::Cancelled, None),
            Err(e) if failures >= 1 => return finish(&n, p, JobState::Failed, Some(e)),
            Err(e) => (failures, last_err) = (1, Some(e)),
        }
        p.done += chunk.len();
        jobs(|j| {
            j.get_mut(&(p.meeting_id.clone(), p.language.clone()))
                .map(|e| e.1 = p.clone())
        });
        n.progress(&p);
    }
    // Partly translated is still done (the menu shows what is missing);
    // nothing translated at all is a failure worth explaining.
    match last_err {
        Some(e) if !saved_any => finish(&n, p, JobState::Failed, Some(e)),
        _ => finish(&n, p, JobState::Completed, None),
    }
}

async fn save(
    pool: &SqlitePool,
    p: &JobProgress,
    tr: &Translator,
    chunk: &[(String, String)],
    slots: Vec<Option<String>>,
    context: &mut Vec<Pair>,
) -> Result<(), String> {
    let mut rows = Vec::new();
    context.clear();
    for ((key, source), slot) in chunk.iter().zip(slots) {
        let Some(text) = slot else { continue };
        context.push(Pair {
            source: source.clone(),
            translation: text.clone(),
        });
        rows.push(NewTranslation {
            segment_key: key.clone(),
            text,
        });
    }
    let keep = context.len().saturating_sub(CONTEXT_PAIRS);
    context.drain(..keep);
    let provider = Some(tr.provider().id.as_str());
    TranslationsRepository::upsert_many(
        pool,
        &p.meeting_id,
        &p.language,
        provider,
        Some(tr.model()),
        &rows,
    )
    .await
    .map_err(|e| e.to_string())
}

fn finish<N: Notify>(n: &N, mut p: JobProgress, state: JobState, error: Option<String>) {
    jobs(|j| j.remove(&(p.meeting_id.clone(), p.language.clone())));
    p.state = state;
    p.error = error;
    n.progress(&p);
}
