//! Keep, store and announce one translated line.

use super::Ctx;
use crate::translation::engine::Translator;
use crate::translation::events::{LineTranslated, Notify};
use crate::translation::store;

pub(super) async fn deliver<N: Notify>(n: &N, ctx: &Ctx, tr: &Translator, seq: u64, text: String) {
    let provider = tr.provider().id.clone();
    store::record(
        ctx.pool.as_ref(),
        &ctx.language,
        &provider,
        tr.model(),
        seq,
        text.clone(),
    )
    .await;
    let line = LineTranslated {
        sequence_id: seq,
        language: ctx.language.clone(),
        text,
    };
    n.line(&line);
}
