use super::parse::parse;
use super::prompt::user_prompt;
use super::uncertain::{find, Unsure};
use super::*;
use crate::channels::activity::SILENCE_DB;

fn turn(start: f64, end: f64, speaker: usize) -> SpeakerTurn {
    SpeakerTurn {
        start,
        end,
        speaker,
    }
}

fn line(start: f64, end: f64, speaker: &str, text: &str) -> DiarizedSegment {
    DiarizedSegment {
        start,
        end,
        speaker_name: speaker.into(),
        text: text.into(),
    }
}

/// 10 s of room speech, then 10 s of call speech, 100 ms frames.
fn levels() -> Vec<Levels> {
    (0..200)
        .map(|i| Levels {
            mic_db: if i < 100 { -20.0 } else { SILENCE_DB },
            sys_db: if i < 100 { SILENCE_DB } else { -20.0 },
        })
        .collect()
}

#[test]
fn a_line_outside_its_speakers_turns_is_unsure_and_limited_to_its_channel() {
    let turns = [turn(0.0, 4.0, 0), turn(10.0, 20.0, 1), turn(4.0, 6.0, 2)];
    let sides = [Some(Side::Room), Some(Side::Remote), Some(Side::Room)];
    let lines = [
        line(0.0, 4.0, "Speaker 1", "covered"),
        line(7.0, 9.0, "Speaker 1", "nearest-voice guess"),
        line(11.0, 15.0, "Speaker 2", "covered"),
    ];
    let unsure = find(&turns, &sides, &levels(), &lines);
    assert_eq!(unsure.len(), 1);
    assert_eq!(unsure[0].index, 1);
    assert_eq!(unsure[0].allowed, vec!["Speaker 1", "Speaker 3"]);
}

#[test]
fn one_speaker_has_nothing_to_review() {
    let lines = [line(7.0, 9.0, "Speaker 1", "x")];
    assert!(find(&[turn(0.0, 1.0, 0)], &[None], &[], &lines).is_empty());
}

#[test]
fn prompt_marks_unsure_lines_and_skips_far_away_ones() {
    let lines: Vec<DiarizedSegment> = (0..30)
        .map(|i| line(i as f64, i as f64 + 1.0, "Speaker 1", &format!("text {i}")))
        .collect();
    let unsure = [Unsure {
        index: 20,
        allowed: vec!["Speaker 1".into(), "Speaker 2".into()],
    }];
    let p = user_prompt(&lines, &unsure);
    assert!(p.contains("[20] Speaker 1: text 20  ?? allowed: Speaker 1, Speaker 2"));
    assert!(p.contains("[16] Speaker 1: text 16"));
    assert!(!p.contains("text 3\n"));
    assert!(p.contains("[...]"));
    assert!(user_prompt(&lines, &[]).contains("[3] Speaker 1: text 3"));
}

#[test]
fn only_allowed_confident_moves_and_quoted_same_channel_merges_survive() {
    let lines = [
        line(0.0, 1.0, "Speaker 1", "man Ali hastam"),
        line(1.0, 2.0, "Speaker 3", "baleh"),
    ];
    let unsure = [Unsure {
        index: 1,
        allowed: vec!["Speaker 1".into(), "Speaker 3".into()],
    }];
    let sides = [Some(Side::Room), Some(Side::Remote), Some(Side::Room)];
    let side_of = |l: &str| (0..3).find(|&i| speaker_name(i) == l).map(|i| sides[i]);
    let raw = r#"Sure: {"lines":[
        {"line":1,"speaker":"Speaker 1","confidence":0.9},
        {"line":1,"speaker":"Speaker 2","confidence":0.9},
        {"line":0,"speaker":"Speaker 3","confidence":0.9},
        {"line":1,"speaker":"Speaker 3","confidence":0.2}],
      "merges":[
        {"from":"Speaker 3","into":"Speaker 1","evidence":"man Ali hastam","confidence":0.8},
        {"from":"Speaker 2","into":"Speaker 1","evidence":"man Ali hastam","confidence":0.9},
        {"from":"Speaker 3","into":"Speaker 1","evidence":"invented quote","confidence":0.9}]}"#;
    let (moves, hints) = parse(raw, &lines, &unsure, side_of);
    assert_eq!(moves, vec![(1, "Speaker 1".to_string())]);
    assert_eq!(hints.len(), 1);
    assert_eq!(
        (hints[0].from.as_str(), hints[0].into.as_str()),
        ("Speaker 3", "Speaker 1")
    );
}

#[test]
fn garbage_replies_change_nothing() {
    let (moves, hints) = parse("no json here", &[], &[], |_| None);
    assert!(moves.is_empty() && hints.is_empty());
}

#[test]
fn merges_are_only_checked_when_two_voices_share_a_channel() {
    assert!(!has_same_side_pair(&[Some(Side::Room), Some(Side::Remote)]));
    assert!(has_same_side_pair(&[
        Some(Side::Room),
        Some(Side::Remote),
        Some(Side::Room)
    ]));
    assert!(has_same_side_pair(&[None, None]));
    assert!(!has_same_side_pair(&[None]));
}
