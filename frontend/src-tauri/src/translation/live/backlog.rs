//! Lines spoken before translation was turned on, translated in the
//! background in small batches. On a local model it waits for live batches,
//! so the newest lines always come first. Lines a batch misses get one more
//! try at the end.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use super::deliver::deliver;
use super::state::{self, LIVE_BUSY};
use super::Ctx;
use crate::translation::engine::Translator;
use crate::translation::events::Notify;
use crate::translation::prompt::Pair;
use crate::translation::{store, BATCH_LINES, CONTEXT_PAIRS};

type Line = (u64, String);

pub(super) async fn run<N: Notify>(n: N, ctx: Ctx, tr: Arc<Translator>, lines: Vec<Line>) {
    let todo: Vec<Line> = lines
        .into_iter()
        .filter(|(seq, _)| !store::has(&ctx.language, *seq))
        .collect();
    let total = todo.len();
    state::update(&n, ctx.id, |s| {
        s.backlog_total = total;
        s.backlog_done = 0;
    });
    let missed = pass(&n, &ctx, &tr, &todo, true).await;
    if !missed.is_empty() && !ctx.cancel.is_cancelled() {
        pass(&n, &ctx, &tr, &missed, false).await;
    }
}

/// Translate `todo` in batches; returns the lines that did not come back.
async fn pass<N: Notify>(
    n: &N,
    ctx: &Ctx,
    tr: &Translator,
    todo: &[Line],
    report: bool,
) -> Vec<Line> {
    let mut missed = Vec::new();
    let mut done = 0;
    let mut context: Vec<Pair> = Vec::new();
    for chunk in todo.chunks(BATCH_LINES) {
        if ctx.cancel.is_cancelled() {
            break;
        }
        if tr.provider().is_local() {
            while LIVE_BUSY.load(Ordering::SeqCst) && !ctx.cancel.is_cancelled() {
                tokio::time::sleep(Duration::from_millis(300)).await;
            }
        }
        // Lines that reached the live worker are its job, not ours.
        let first_live = ctx.first_live.load(Ordering::SeqCst);
        let lines: Vec<&Line> = chunk
            .iter()
            .filter(|(seq, _)| *seq < first_live && !store::has(&ctx.language, *seq))
            .collect();
        if !lines.is_empty() {
            let texts: Vec<String> = lines.iter().map(|(_, t)| t.clone()).collect();
            match tr.translate(&context, &texts, &ctx.cancel).await {
                Ok(slots) => {
                    context.clear();
                    for (line, slot) in lines.into_iter().zip(slots) {
                        let Some(text) = slot else {
                            missed.push(line.clone());
                            continue;
                        };
                        deliver(n, ctx, tr, line.0, text.clone()).await;
                        context.push(Pair {
                            source: line.1.clone(),
                            translation: text,
                        });
                    }
                    let keep = context.len().saturating_sub(CONTEXT_PAIRS);
                    context.drain(..keep);
                }
                Err(e) => {
                    log::warn!("background translation batch failed: {e}");
                    missed.extend(lines.into_iter().cloned());
                }
            }
        }
        done += chunk.len();
        if report {
            state::update(n, ctx.id, |s| s.backlog_done = done);
        }
    }
    missed
}
