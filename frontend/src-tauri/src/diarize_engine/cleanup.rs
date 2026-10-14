//! Post-processing of raw diarizer turns: drop phantom speakers and number
//! the rest in order of first appearance. Pure logic, no models.

use std::collections::HashMap;

use super::SpeakerTurn;

/// A cluster is kept only when it holds at least this share of all speech...
pub const MIN_SPEECH_SHARE: f64 = 0.02;
/// ...or at least this many seconds (protects a quiet participant in a long call).
pub const MIN_SPEECH_SECS: f64 = 20.0;

/// Raw diarizer output: `(start, end, engine label)`.
pub type RawTurn = (f64, f64, String);

/// Drop clusters too small to be a real participant (noise, laughter, a
/// cough), then renumber survivors `0..n` by when they first speak, so
/// "Speaker 1" is always whoever talked first. Output is sorted by start.
#[must_use]
pub fn clean_turns(raw: &[RawTurn]) -> Vec<SpeakerTurn> {
    let mut speech: HashMap<&str, f64> = HashMap::new();
    for (start, end, label) in raw {
        *speech.entry(label.as_str()).or_default() += (end - start).max(0.0);
    }
    let total: f64 = speech.values().sum();
    let keep = |label: &str| {
        let secs = speech.get(label).copied().unwrap_or(0.0);
        secs >= MIN_SPEECH_SECS || (total > 0.0 && secs / total >= MIN_SPEECH_SHARE)
    };

    let mut sorted: Vec<&RawTurn> = raw.iter().filter(|(_, _, l)| keep(l)).collect();
    sorted.sort_by(|a, b| a.0.total_cmp(&b.0));

    let mut index: HashMap<&str, usize> = HashMap::new();
    sorted
        .into_iter()
        .map(|(start, end, label)| {
            let next = index.len();
            let speaker = *index.entry(label.as_str()).or_insert(next);
            SpeakerTurn {
                start: *start,
                end: *end,
                speaker,
            }
        })
        .collect()
}

/// Number of distinct speakers in cleaned turns.
#[must_use]
pub fn speaker_count(turns: &[SpeakerTurn]) -> usize {
    turns.iter().map(|t| t.speaker + 1).max().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(start: f64, end: f64, label: &str) -> RawTurn {
        (start, end, label.to_string())
    }

    #[test]
    fn drops_tiny_clusters_and_numbers_by_first_appearance() {
        let turns = clean_turns(&[
            raw(100.0, 400.0, "SPEAKER_03"),
            raw(0.0, 300.0, "SPEAKER_01"),
            raw(50.0, 51.0, "SPEAKER_07"), // 1 s of 601 s: phantom
        ]);
        assert_eq!(turns.len(), 2);
        assert_eq!(turns[0].speaker, 0); // SPEAKER_01 spoke first
        assert_eq!(turns[0].start, 0.0);
        assert_eq!(turns[1].speaker, 1);
        assert_eq!(speaker_count(&turns), 2);
    }

    #[test]
    fn keeps_quiet_participant_with_enough_absolute_speech() {
        // 25 s out of 3 h is under 2 % but over the 20 s floor.
        let turns = clean_turns(&[raw(0.0, 10_800.0, "A"), raw(5.0, 30.0, "B")]);
        assert_eq!(speaker_count(&turns), 2);
    }

    #[test]
    fn empty_input_gives_no_speakers() {
        assert!(clean_turns(&[]).is_empty());
        assert_eq!(speaker_count(&[]), 0);
    }
}
