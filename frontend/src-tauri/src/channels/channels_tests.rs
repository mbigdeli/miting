use super::activity::SILENCE_DB;
use super::*;

const LOUD: f32 = -20.0;
const QUIET: f32 = SILENCE_DB;

fn frame(mic_db: f32, sys_db: f32) -> Levels {
    Levels { mic_db, sys_db }
}

/// `pattern` is one char per 100 ms frame: m = mic, s = system, b = both, . = silence.
fn levels(pattern: &str) -> Vec<Levels> {
    pattern
        .chars()
        .map(|c| match c {
            'm' => frame(LOUD, QUIET),
            's' => frame(QUIET, LOUD),
            'b' => frame(LOUD, LOUD),
            _ => frame(QUIET, QUIET),
        })
        .collect()
}

#[test]
fn activity_logs_one_frame_per_100ms_with_partial_tail() {
    let mut a = ChannelActivity::new(1_000);
    a.push(&vec![0.5; 250], &[]);
    assert_eq!(a.len(), 2);
    let out = a.finish();
    assert_eq!(out.len(), 3);
    assert!((out[0].mic_db - (-6.02)).abs() < 0.05, "{:?}", out[0]);
    assert_eq!(out[0].sys_db, SILENCE_DB);
    assert!(a.finish().is_empty());
}

#[test]
fn file_round_trips_within_half_a_db() {
    let input = vec![frame(-23.4, -100.0), frame(0.0, -61.2)];
    let out = file::decode(&file::encode(&input)).unwrap();
    for (a, b) in input.iter().zip(&out) {
        assert!((a.mic_db - b.mic_db).abs() <= 0.25);
        assert!((a.sys_db - b.sys_db).abs() <= 0.25);
    }
}

#[test]
fn file_rejects_foreign_bytes_and_missing_file_is_none() {
    assert!(file::decode(b"RIFF....").is_err());
    let missing = std::env::temp_dir().join("miting-no-such-channels.bin");
    assert!(file::load(&missing).unwrap().is_none());
}

#[test]
fn system_speech_wins_a_frame_even_with_echo_on_the_mic() {
    assert_eq!(side::frame_side(frame(LOUD, LOUD)), Some(Side::Remote));
    assert_eq!(side::frame_side(frame(LOUD, QUIET)), Some(Side::Room));
    assert_eq!(side::frame_side(frame(QUIET, QUIET)), None);
}

#[test]
fn span_side_is_the_majority_of_speech_frames() {
    let l = levels("mmmm..ss");
    assert_eq!(side_of_span(&l, 0.0, 0.8), Some(Side::Room));
    assert_eq!(side_of_span(&l, 0.5, 0.8), Some(Side::Remote));
    assert_eq!(side_of_span(&l, 0.4, 0.6), None);
}

#[test]
fn a_turn_spanning_room_and_call_is_cut_at_the_change() {
    let l = levels("mmmmmm..ssssss");
    let parts = split_by_side(&l, 0.0, 1.4);
    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0].2, Some(Side::Room));
    assert!((parts[0].1 - 0.8).abs() < 1e-9 && (parts[1].0 - 0.8).abs() < 1e-9);
    assert_eq!(parts[1], (parts[1].0, 1.4, Some(Side::Remote)));
}

#[test]
fn short_blips_do_not_split_a_turn() {
    let l = levels("mmmmmsmmmmm");
    assert_eq!(
        split_by_side(&l, 0.0, 1.1),
        vec![(0.0, 1.1, Some(Side::Room))]
    );
}

#[test]
fn a_short_lead_in_takes_the_side_of_what_follows() {
    let l = levels("smmmmmm");
    assert_eq!(
        split_by_side(&l, 0.0, 0.7),
        vec![(0.0, 0.7, Some(Side::Room))]
    );
}

#[test]
fn a_silent_turn_stays_whole_without_a_side() {
    let l = levels("....");
    assert_eq!(split_by_side(&l, 0.0, 0.4), vec![(0.0, 0.4, None)]);
    assert_eq!(split_by_side(&[], 3.0, 4.0), vec![(3.0, 4.0, None)]);
}
