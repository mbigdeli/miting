//! Google Meet captions as live-translation input. Meet re-sends an utterance
//! while it grows ("salam", "salam chetori", ...), always under the same row
//! id, so a caption is only translated once it is finished: when the next
//! caption starts, or when the recording stops.

use std::sync::{Arc, Mutex};

use tokio::sync::mpsc::UnboundedSender;

/// Caption ids are moved above every local sequence id, so the two never
/// collide in the translation store. Mirrored in `lib/translation/captionSeq.ts`.
pub const CAPTION_SEQ_BASE: u64 = 1 << 40;

#[derive(serde::Deserialize)]
struct Caption {
    id: u64,
    text: String,
}

/// The caption still growing. Shared by the caption and stop listeners.
#[derive(Clone, Default)]
pub struct Pending(Arc<Mutex<Option<(u64, String)>>>);

impl Pending {
    /// Handle one `gmeet-caption` payload; sends the previous caption when a
    /// new one begins.
    pub fn on_caption(&self, payload: &str, tx: &UnboundedSender<(u64, String)>) {
        let Ok(c) = serde_json::from_str::<Caption>(payload) else {
            return;
        };
        let text = c.text.trim().to_string();
        if text.is_empty() {
            return;
        }
        let Ok(mut slot) = self.0.lock() else { return };
        if let Some((id, done)) = slot.take().filter(|(id, _)| *id != c.id) {
            let _ = tx.send((CAPTION_SEQ_BASE + id, done));
        }
        *slot = Some((c.id, text));
    }

    /// The recording stopped: the last caption is final too.
    pub fn flush(&self, tx: &UnboundedSender<(u64, String)>) {
        if let Some((id, text)) = self.0.lock().ok().and_then(|mut s| s.take()) {
            let _ = tx.send((CAPTION_SEQ_BASE + id, text));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_caption_is_sent_once_finished_with_its_last_text() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let p = Pending::default();
        p.on_caption(r#"{"id":7,"text":"salam"}"#, &tx);
        p.on_caption(r#"{"id":7,"text":"salam chetori"}"#, &tx);
        assert!(rx.try_recv().is_err());
        p.on_caption(r#"{"id":8,"speaker":"Ali","text":"khubam"}"#, &tx);
        assert_eq!(
            rx.try_recv().unwrap(),
            (CAPTION_SEQ_BASE + 7, "salam chetori".into())
        );
        p.flush(&tx);
        assert_eq!(
            rx.try_recv().unwrap(),
            (CAPTION_SEQ_BASE + 8, "khubam".into())
        );
        p.flush(&tx);
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn empty_and_broken_captions_are_ignored() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let p = Pending::default();
        p.on_caption(r#"{"id":1,"text":"  "}"#, &tx);
        p.on_caption("not json", &tx);
        p.flush(&tx);
        assert!(rx.try_recv().is_err());
    }
}
