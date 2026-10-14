//! Acoustic speaker diarization (local, CPU): labels *who spoke when* from the
//! recording audio alone, for meetings without Google Meet captions.
//! Engine: `polyvoice` (pure Rust, INT8 kernels, VBx clustering), chosen in a
//! spike on real Persian meetings. Design: `docs/product-plan/18-acoustic-diarization.md`.

pub mod audio;
pub mod cleanup;
pub mod engine;
pub mod runner;
pub mod sides;
pub mod turns;

pub use turns::{merge_turns, speaker_for, speaker_name, SpeakerTurn};

/// The models' native audio rate: 16 kHz mono.
pub const TARGET_SAMPLE_RATE: u32 = 16_000;

/// A transcript segment tagged with an acoustic speaker label: the unit
/// persisted into `meeting_diarized_segments`.
#[derive(Debug, Clone, PartialEq)]
pub struct DiarizedSegment {
    pub start: f64,
    pub end: f64,
    pub speaker_name: String,
    pub text: String,
}

/// Tag each `(start, end, text)` transcript segment with the speaker of the
/// turn it most overlaps. A segment that overlaps no turn (VAD trimmed it)
/// takes the nearest turn in time, so short interjections stay attributed.
#[must_use]
pub fn label_transcript(
    turns: &[SpeakerTurn],
    segments: &[(f64, f64, String)],
) -> Vec<DiarizedSegment> {
    segments
        .iter()
        .map(|(start, end, text)| {
            let speaker = speaker_for(turns, *start, *end)
                .or_else(|| nearest_speaker(turns, *start, *end))
                .unwrap_or(0);
            DiarizedSegment {
                start: *start,
                end: *end,
                speaker_name: speaker_name(speaker),
                text: text.clone(),
            }
        })
        .collect()
}

/// Speaker of the turn closest in time to `[start, end)`.
fn nearest_speaker(turns: &[SpeakerTurn], start: f64, end: f64) -> Option<usize> {
    turns
        .iter()
        .map(|t| {
            let gap = (t.start - end).max(start - t.end).max(0.0);
            (gap, t.speaker)
        })
        .min_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, s)| s)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(start: f64, end: f64, speaker: usize) -> SpeakerTurn {
        SpeakerTurn {
            start,
            end,
            speaker,
        }
    }

    #[test]
    fn labels_segments_by_overlapping_turn() {
        let turns = vec![turn(0.0, 2.0, 0), turn(2.0, 5.0, 1)];
        let segs = vec![
            (0.0, 1.8, "hello".to_string()),
            (2.1, 4.0, "world".to_string()),
        ];
        let out = label_transcript(&turns, &segs);
        assert_eq!(out[0].speaker_name, "Speaker 1");
        assert_eq!(out[1].speaker_name, "Speaker 2");
        assert_eq!(out[1].text, "world");
    }

    #[test]
    fn segment_without_overlap_takes_nearest_turn() {
        let turns = vec![turn(0.0, 2.0, 0), turn(10.0, 12.0, 1)];
        let out = label_transcript(&turns, &[(9.0, 9.5, "yes".to_string())]);
        assert_eq!(out[0].speaker_name, "Speaker 2");
    }

    #[test]
    fn no_turns_at_all_defaults_to_speaker_one() {
        let out = label_transcript(&[], &[(0.0, 1.0, "hi".to_string())]);
        assert_eq!(out[0].speaker_name, "Speaker 1");
    }
}
