//! Summarise cleaned turns into one record per voice: talk time and a clean
//! stretch to play back when the user wants to hear who "Speaker 2" is.

use crate::channels::Side;
use crate::database::repositories::speakers::NewSpeaker;
use crate::diarize_engine::{speaker_name, SpeakerTurn};

/// Longest sample played by "Listen".
const SAMPLE_SECS: f64 = 8.0;
/// Skip the first moment of a turn: it often overlaps the previous speaker.
const SAMPLE_LEAD_IN: f64 = 0.3;

/// `sides[i]` is where speaker `i` was heard (room or call), when known.
#[must_use]
pub fn summarise(turns: &[SpeakerTurn], sides: &[Option<Side>]) -> Vec<NewSpeaker> {
    let count = turns.iter().map(|t| t.speaker + 1).max().unwrap_or(0);
    (0..count)
        .map(|speaker| {
            let own = turns.iter().filter(|t| t.speaker == speaker);
            let speech_secs = own.clone().map(|t| (t.end - t.start).max(0.0)).sum();
            let sample = own
                .max_by(|a, b| (a.end - a.start).total_cmp(&(b.end - b.start)))
                .map(sample_of);
            NewSpeaker {
                label: speaker_name(speaker),
                speech_secs,
                sample,
                side: sides.get(speaker).copied().flatten(),
            }
        })
        .collect()
}

fn sample_of(turn: &SpeakerTurn) -> (f64, f64) {
    let length = turn.end - turn.start;
    let start = if length > SAMPLE_LEAD_IN * 4.0 {
        turn.start + SAMPLE_LEAD_IN
    } else {
        turn.start
    };
    (start, turn.end.min(start + SAMPLE_SECS))
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
    fn talk_time_and_sample_from_the_longest_turn() {
        let turns = [turn(0.0, 3.0, 0), turn(3.0, 4.0, 1), turn(10.0, 30.0, 0)];
        let voices = summarise(&turns, &[Some(Side::Room)]);
        assert_eq!(voices.len(), 2);
        assert_eq!(voices[0].label, "Speaker 1");
        assert_eq!(voices[0].speech_secs, 23.0);
        assert_eq!(voices[0].sample, Some((10.3, 18.3)));
        assert_eq!(voices[1].sample, Some((3.0, 4.0)));
        assert_eq!(voices[0].side, Some(Side::Room));
        assert_eq!(voices[1].side, None);
    }

    #[test]
    fn no_turns_no_voices() {
        assert!(summarise(&[], &[]).is_empty());
    }
}
