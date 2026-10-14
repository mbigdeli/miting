use std::time::Duration;

use super::audio::{mute_echo, quiet_cut};
use super::chunk::{db, speech_secs};
use super::registry::{cosine, ChunkVoice, Registry};
use super::voiceprint::pieces;

fn voice(print: &[f32], secs: f64) -> ChunkVoice {
    ChunkVoice {
        print: Some(print.to_vec()),
        secs,
    }
}

const ALI: [f32; 3] = [1.0, 0.1, 0.0];
const MINA: [f32; 3] = [0.0, 1.0, 0.1];
const SARA: [f32; 3] = [0.1, 0.0, 1.0];

#[test]
fn a_voice_keeps_its_identity_across_chunks() {
    let mut r = Registry::default();
    assert_eq!(
        r.assign(&[voice(&ALI, 30.0), voice(&MINA, 20.0)]),
        vec![0, 1]
    );
    // Next chunk: the diarizer numbers them the other way round.
    assert_eq!(
        r.assign(&[voice(&MINA, 10.0), voice(&ALI, 40.0)]),
        vec![1, 0]
    );
    assert_eq!(r.assign(&[voice(&SARA, 15.0)]), vec![2]);
    assert_eq!(r.len(), 3);
}

#[test]
fn two_chunk_voices_never_collapse_into_one_known_voice() {
    let mut r = Registry::default();
    r.assign(&[voice(&ALI, 30.0)]);
    let near_ali = [0.9, 0.2, 0.0];
    let ids = r.assign(&[voice(&ALI, 30.0), voice(&near_ali, 5.0)]);
    assert_eq!(ids[0], 0);
    assert_ne!(ids[1], 0);
}

#[test]
fn a_voice_too_short_for_a_print_is_kept_apart() {
    let mut r = Registry::default();
    r.assign(&[voice(&ALI, 30.0)]);
    let ids = r.assign(&[ChunkVoice {
        print: None,
        secs: 0.6,
    }]);
    assert_eq!(ids, vec![1]);
}

#[test]
fn end_of_meeting_merge_folds_a_split_voice_back() {
    let mut r = Registry::default();
    r.assign(&[voice(&ALI, 30.0), voice(&MINA, 30.0)]);
    // A later chunk where the diarizer split Ali in two: the closer half keeps
    // his identity, the other is a new voice until the end-of-meeting merge.
    let ali_hoarse = [0.8, 0.0, 0.45];
    r.assign(&[voice(&ali_hoarse, 30.0), voice(&ALI, 1.0)]);
    let root = r.reconcile();
    assert_eq!(root[0], 0);
    assert_eq!(root[1], 1);
    assert_eq!(root[2], 0, "cosine {}", cosine(&ALI, &ali_hoarse));
}

#[test]
fn chunk_ends_at_the_quietest_moment_before_the_target() {
    let mut buf = vec![0.5f32; 16_000 * 20];
    let quiet = 16_000 * 15;
    buf[quiet..quiet + 1_600].fill(0.0);
    assert_eq!(quiet_cut(&buf, 16_000 * 20), quiet);
    assert_eq!(quiet_cut(&buf[..1_600], 1_600), 1_600);
}

#[test]
fn mic_is_muted_wherever_the_call_is_talking() {
    let mut mic = vec![0.3f32; 3_200];
    let mut sys = vec![0.0f32; 3_200];
    sys[1_600..].fill(0.3);
    mute_echo(&mut mic, &sys);
    assert!(mic[..1_600].iter().all(|&x| x == 0.3));
    assert!(mic[1_600..].iter().all(|&x| x == 0.0));
}

#[test]
fn prints_use_the_longest_turns_within_budget() {
    let turns = [
        (0.0, 0.5),
        (1.0, 11.0),
        (20.0, 23.0),
        (30.0, 40.0),
        (50.0, 60.0),
    ];
    let p = pieces(&turns);
    assert_eq!(p[0], (1.0, 5.0));
    assert!(p.iter().all(|(s, e)| e - s >= 1.0 && e - s <= 4.0));
    let used: f64 = p.iter().map(|(s, e)| e - s).sum();
    assert!(used <= 16.0 + 1e-9);
    assert!(pieces(&[(0.0, 0.5)]).is_empty());
}

#[test]
fn silence_has_no_speech_to_diarize() {
    assert_eq!(speech_secs(&vec![0.0; 16_000 * 5]), 0.0);
    assert!((speech_secs(&vec![0.2; 16_000 * 3]) - 3.0).abs() < 1e-9);
    assert_eq!(db(&[]), -100.0);
}

#[test]
fn no_live_pass_means_no_live_result() {
    let dir = std::env::temp_dir().join("miting-live-none");
    assert!(super::wait_for_result(&dir, Duration::from_millis(10)).is_none());
}
