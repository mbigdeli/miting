//! Consumes VAD segments during an audio-only recording.
//!
//! The pipeline keeps producing speech segments regardless of whether anything
//! transcribes them. Dropping the receiver instead would leave every send in
//! `pipeline.rs` failing against a closed channel, so the segments are simply
//! discarded here and the task ends when recording stops and the sender drops.

use crate::audio::AudioChunk;

pub fn start_drain_task(
    mut transcription_receiver: tokio::sync::mpsc::UnboundedReceiver<AudioChunk>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        log::info!("🎙️ Audio-only recording: transcription is off, discarding speech segments");
        let mut discarded: u64 = 0;
        while transcription_receiver.recv().await.is_some() {
            discarded += 1;
        }
        log::info!("🎙️ Audio-only recording ended after {discarded} discarded segment(s)");
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn the_task_ends_when_the_sender_is_dropped() {
        let (sender, receiver) = tokio::sync::mpsc::unbounded_channel::<AudioChunk>();
        let handle = start_drain_task(receiver);

        drop(sender);

        tokio::time::timeout(std::time::Duration::from_secs(5), handle)
            .await
            .expect("drain task must finish once the pipeline stops")
            .expect("drain task must not panic");
    }
}
