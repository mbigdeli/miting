use super::*;
use crate::channels::activity::SILENCE_DB;

const LOUD: f32 = -20.0;

/// One char per 100 ms frame: m = mic, s = system, . = silence.
fn levels(pattern: &str) -> Vec<Levels> {
    pattern
        .chars()
        .map(|c| Levels {
            mic_db: if c == 'm' { LOUD } else { SILENCE_DB },
            sys_db: if c == 's' { LOUD } else { SILENCE_DB },
        })
        .collect()
}

fn turn(start: f64, end: f64, speaker: usize) -> SpeakerTurn {
    SpeakerTurn {
        start,
        end,
        speaker,
    }
}

#[test]
fn one_cluster_heard_in_room_and_call_becomes_two_labels() {
    let l = levels("mmmmmmssssss");
    let raw = vec![(0.0, 1.2, "SPEAKER_00".to_string())];
    let split = split_raw(&raw, &l);
    let labels: Vec<&str> = split.iter().map(|r| r.2.as_str()).collect();
    assert_eq!(labels, ["SPEAKER_00@room", "SPEAKER_00@remote"]);
}

#[test]
fn speakers_take_the_side_they_mostly_spoke_on() {
    let l = levels("mmmmm.sssss");
    let turns = [turn(0.0, 0.5, 0), turn(0.6, 1.1, 1)];
    assert_eq!(
        speaker_sides(&turns, &l),
        vec![Some(Side::Room), Some(Side::Remote)]
    );
}

#[test]
fn a_call_segment_never_goes_to_a_room_speaker() {
    let l = levels("mmmmmmmmmmssss");
    // The diarizer's room turn wrongly covers the start of the remote reply.
    let turns = [turn(0.0, 1.3, 0), turn(1.3, 1.4, 1)];
    let sides = [Some(Side::Room), Some(Side::Remote)];
    let segs = [(1.0, 1.4, "remote reply".to_string())];
    let out = label_with_sides(&turns, &sides, &l, &segs);
    assert_eq!(out[0].speaker_name, "Speaker 2");
}

#[test]
fn without_a_same_side_speaker_any_speaker_is_used() {
    let l = levels("ssss");
    let out = label_with_sides(
        &[turn(0.0, 0.4, 0)],
        &[Some(Side::Room)],
        &l,
        &[(0.0, 0.4, "x".into())],
    );
    assert_eq!(out[0].speaker_name, "Speaker 1");
}
