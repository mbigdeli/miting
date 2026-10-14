use super::*;
use crate::ask::types::{AskMessage, EarlierSummary, NoteCard, Quote};
use crate::ask::window::Selection;

fn material() -> Material {
    Material {
        title: "Product sync".into(),
        lines: vec![
            Line {
                at: Some(21.0),
                speaker: Some("Leo".into()),
                text: "Drop-off went from 18 to 24 percent.".into(),
            },
            Line {
                at: Some(84.0),
                speaker: None,
                text: "Finance wants 96 dollars instead of 120.".into(),
            },
        ],
        notes: vec![NoteCard {
            id: "n1".into(),
            at_sec: Some(45.0),
            body_html: "<b>Safari bug</b>, hotfix?".into(),
            quotes: vec![],
            source: "user".into(),
            edited: false,
        }],
        quotes: vec![Quote {
            quote: "96 dollars".into(),
            at: 84.0,
        }],
        question: "Is this related to the drop-off?".into(),
        ..Default::default()
    }
}

fn all(m: &Material) -> Selection {
    Selection {
        lines: m.lines.clone(),
        recent_from: None,
        partial: false,
    }
}

#[test]
fn marks_the_selected_text_twice() {
    let m = material();
    let p = user_prompt(&m, &all(&m));
    assert!(p.contains("[01:24] Finance wants 96 dollars instead of 120. ⟦highlighted⟧"));
    assert!(p.contains("<user_highlight at=\"01:24\">96 dollars</user_highlight>"));
    assert!(!p.contains("18 to 24 percent. ⟦highlighted⟧"));
}

#[test]
fn includes_speakers_notes_and_the_question_last() {
    let m = material();
    let p = user_prompt(&m, &all(&m));
    assert!(p.contains("[00:21] Leo: Drop-off"));
    assert!(p.contains("<user_notes>\n[00:45] Safari bug, hotfix?\n</user_notes>"));
    assert!(p
        .trim_end()
        .ends_with("<question>Is this related to the drop-off?</question>"));
}

#[test]
fn live_prompt_says_where_the_window_starts_and_carries_the_earlier_summary() {
    let mut m = material();
    m.now_sec = Some(1900.0);
    m.earlier = Some(EarlierSummary {
        text: "- [00:21] drop-off discussed".into(),
        until_sec: 1000.0,
    });
    let sel = Selection {
        lines: m.lines.clone(),
        recent_from: Some(1000.0),
        partial: true,
    };
    let p = user_prompt(&m, &sel);
    assert!(p.contains("still recording, now at 31:40"));
    assert!(p.contains("<earlier_summary until=\"16:40\">"));
    assert!(p.contains("word for word from 16:40"));
}

#[test]
fn sends_only_the_last_answered_turns() {
    let mut m = material();
    m.history = (0..9)
        .map(|i| AskMessage {
            id: format!("a{i}"),
            asked_at_sec: None,
            question: format!("q{i}"),
            quotes: vec![],
            answer_md: Some(format!("a{i}")),
            citations: vec![],
            error: None,
            provider: None,
            model: None,
            saved_note_id: None,
        })
        .collect();
    let p = user_prompt(&m, &all(&m));
    assert!(!p.contains("Q: q2\n") && p.contains("Q: q3\n") && p.contains("Q: q8\n"));
}

#[test]
fn plain_strips_note_html() {
    assert_eq!(
        plain("<ul><li>one</li><li>two &amp; three</li></ul>"),
        "one; two & three;"
    );
}
