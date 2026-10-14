use super::*;
use crate::speakers::prompt::user_prompt;

fn seg(speaker: &str, text: &str) -> DiarizedSegment {
    DiarizedSegment {
        start: 0.0,
        end: 1.0,
        speaker_name: speaker.into(),
        text: text.into(),
    }
}

fn meeting() -> Vec<DiarizedSegment> {
    vec![
        seg("Speaker 1", "سلام علی جان، خوبی؟"),
        seg("Speaker 2", "مرسی، من خوبم. بریم سراغ گزارش"),
        seg("Speaker 1", "thanks, Sara will join later"),
    ]
}

#[test]
fn accepts_verified_persian_name_from_fenced_reply() {
    let raw = "```json\n{\"speakers\":[{\"label\":\"Speaker 2\",\"name\":\"علی\",\"evidence\":\"سلام علی جان\",\"confidence\":0.85}]}\n```";
    let out = parse_reply(raw, &meeting());
    assert_eq!(out.len(), 1);
    assert_eq!(out[0].label, "Speaker 2");
    assert_eq!(out[0].name, "علی");
}

#[test]
fn rejects_names_absent_from_transcript_and_low_confidence() {
    let raw = r#"{"speakers":[
        {"label":"Speaker 1","name":"Reza","evidence":"","confidence":0.9},
        {"label":"Speaker 2","name":"Sara","evidence":"Sara will join","confidence":0.4}
    ]}"#;
    assert!(parse_reply(raw, &meeting()).is_empty());
}

#[test]
fn rejects_unknown_labels_and_speaker_placeholders() {
    let raw = r#"{"speakers":[
        {"label":"Speaker 9","name":"Sara","confidence":0.9},
        {"label":"Speaker 1","name":"Speaker 1","confidence":0.9}
    ]}"#;
    assert!(parse_reply(raw, &meeting()).is_empty());
}

#[test]
fn one_voice_per_name_and_one_name_per_voice() {
    let raw = r#"{"speakers":[
        {"label":"Speaker 1","name":"Sara","confidence":0.7},
        {"label":"Speaker 2","name":"Sara","confidence":0.9},
        {"label":"Speaker 2","name":"علی","confidence":0.8}
    ]}"#;
    let out = parse_reply(raw, &meeting());
    assert_eq!(out.len(), 1, "{out:?}");
    assert_eq!(out[0].label, "Speaker 2");
}

#[test]
fn garbage_reply_yields_nothing() {
    assert!(parse_reply("I could not find names.", &meeting()).is_empty());
    assert!(parse_reply("{not json}", &meeting()).is_empty());
}

#[test]
fn prompt_keeps_both_ends_of_a_long_transcript() {
    let mut segs = vec![seg("Speaker 1", "my name is Nima")];
    segs.extend((0..3000).map(|_| seg("Speaker 2", "filler words here")));
    segs.push(seg("Speaker 1", "bye Sara"));
    let prompt = user_prompt(&segs, &["Nima".into()]);
    assert!(prompt.starts_with("Participants: Nima"));
    assert!(prompt.contains("my name is Nima"));
    assert!(prompt.contains("bye Sara"));
    assert!(prompt.contains("[...]"));
}
