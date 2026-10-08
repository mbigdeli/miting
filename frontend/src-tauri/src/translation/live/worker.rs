//! New lines, translated as they arrive. While one request is in flight, new
//! lines queue up and go together in the next request, so a slow provider
//! adds delay but never falls further and further behind. A line that fails
//! or comes back empty is retried with the next request.

use std::collections::VecDeque;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::mpsc::UnboundedReceiver;

use super::deliver::deliver;
use super::state::{self, LIVE_BUSY};
use super::Ctx;
use crate::translation::engine::Translator;
use crate::translation::events::{LiveState, Notify};
use crate::translation::prompt::Pair;
use crate::translation::{store, CONTEXT_PAIRS};

const MAX_LINES_PER_TURN: usize = 8;
const MAX_FAILURES: u32 = 3;
/// Tries per line before it is left untranslated.
const MAX_TRIES: u8 = 2;

/// A line waiting to be translated, with the tries it has had.
type Pending = (u64, String, u8);

pub(super) async fn run<N: Notify>(
    n: N,
    ctx: Ctx,
    tr: Arc<Translator>,
    mut rx: UnboundedReceiver<(u64, String)>,
) {
    let mut context: VecDeque<Pair> = VecDeque::new();
    let mut waiting: Vec<Pending> = Vec::new();
    let mut failures = 0;
    loop {
        if waiting.is_empty() {
            let first = tokio::select! {
                _ = ctx.cancel.cancelled() => break,
                next = rx.recv() => match next { Some(line) => line, None => break },
            };
            waiting.push((first.0, first.1, 0));
        } else if ctx.cancel.is_cancelled() {
            break;
        }
        while waiting.len() < MAX_LINES_PER_TURN {
            match rx.try_recv() {
                Ok((seq, text)) => waiting.push((seq, text, 0)),
                Err(_) => break,
            }
        }
        let batch: Vec<Pending> = std::mem::take(&mut waiting)
            .into_iter()
            .filter(|(seq, _, _)| !store::has(&ctx.language, *seq))
            .collect();
        if batch.is_empty() {
            continue;
        }
        let texts: Vec<String> = batch.iter().map(|(_, t, _)| t.clone()).collect();
        let ctx_pairs: Vec<Pair> = context.iter().cloned().collect();
        LIVE_BUSY.store(true, Ordering::SeqCst);
        let result = tr.translate(&ctx_pairs, &texts, &ctx.cancel).await;
        LIVE_BUSY.store(false, Ordering::SeqCst);
        let retry = |line: Pending, out: &mut Vec<Pending>| {
            if line.2 + 1 < MAX_TRIES {
                out.push((line.0, line.1, line.2 + 1));
            }
        };
        match result {
            Ok(slots) => {
                failures = 0;
                for (line, slot) in batch.into_iter().zip(slots) {
                    let Some(text) = slot else {
                        retry(line, &mut waiting);
                        continue;
                    };
                    deliver(&n, &ctx, &tr, line.0, text.clone()).await;
                    context.push_back(Pair {
                        source: line.1,
                        translation: text,
                    });
                    while context.len() > CONTEXT_PAIRS {
                        context.pop_front();
                    }
                }
            }
            Err(_) if ctx.cancel.is_cancelled() => break,
            Err(e) => {
                failures += 1;
                log::warn!("live translation failed ({failures}/{MAX_FAILURES}): {e}");
                if failures >= MAX_FAILURES {
                    state::update(&n, ctx.id, |s| {
                        s.state = LiveState::Error;
                        s.error = Some(e);
                    });
                    break;
                }
                batch.into_iter().for_each(|line| retry(line, &mut waiting));
                let pause = Duration::from_millis(800 * u64::from(failures));
                tokio::select! {
                    _ = ctx.cancel.cancelled() => break,
                    _ = tokio::time::sleep(pause) => {}
                }
            }
        }
    }
}
