use super::*;
use crate::ask::types::Quote;

fn line(at: f64, text: &str) -> Line {
    Line {
        at: Some(at),
        speaker: None,
        text: text.into(),
    }
}

/// One line every 30 seconds for `minutes`, each mentioning its own minute.
fn meeting(minutes: usize) -> Vec<Line> {
    (0..minutes * 2)
        .map(|i| {
            line(
                i as f64 * 30.0,
                &format!("filler talk number {i} about nothing much at all"),
            )
        })
        .collect()
}

#[test]
fn sends_everything_when_it_fits() {
    let m = Material {
        lines: meeting(10),
        now_sec: Some(600.0),
        ..Default::default()
    };
    let s = select(&m, 1_000_000);
    assert_eq!(s.lines.len(), 20);
    assert!(!s.partial);
}

#[test]
fn live_keeps_the_last_fifteen_minutes_word_for_word() {
    let m = Material {
        lines: meeting(60),
        now_sec: Some(3600.0),
        ..Default::default()
    };
    let s = select(&m, 4_000);
    assert!(s.partial);
    assert_eq!(s.recent_from, Some(2700.0));
    assert!(
        s.lines.iter().all(|l| l.at.unwrap() >= 2700.0),
        "nothing older without a reason"
    );
    assert_eq!(
        s.lines.last().unwrap().at,
        Some(3570.0),
        "the newest line is always there"
    );
}

#[test]
fn adds_earlier_lines_that_match_the_question() {
    let mut lines = meeting(60);
    lines[10].text = "Finance wants the annual plan at 96 dollars".into();
    let m = Material {
        lines,
        now_sec: Some(3600.0),
        question: "What did finance say about the annual plan?".into(),
        ..Default::default()
    };
    let s = select(&m, 4_000);
    assert!(s.lines.iter().any(|l| l.text.contains("96 dollars")));
}

#[test]
fn keeps_lines_around_a_selected_quote() {
    let m = Material {
        lines: meeting(60),
        now_sec: Some(3600.0),
        // Words that appear in no line, so only the time brings lines in.
        quotes: vec![Quote {
            quote: "the moment".into(),
            at: 120.0,
        }],
        ..Default::default()
    };
    let s = select(&m, 4_000);
    let ats: Vec<f64> = s
        .lines
        .iter()
        .filter_map(|l| l.at)
        .filter(|a| *a < 2700.0)
        .collect();
    assert_eq!(ats, vec![90.0, 120.0, 150.0]);
}

#[test]
fn a_tight_budget_drops_the_oldest_kept_lines_first() {
    let m = Material {
        lines: meeting(60),
        now_sec: Some(3600.0),
        ..Default::default()
    };
    let s = select(&m, 300);
    assert!(!s.lines.is_empty());
    assert_eq!(s.lines.last().unwrap().at, Some(3570.0));
}

#[test]
fn words_split_persian_and_english_alike() {
    assert_eq!(
        words("از فایننس بپرسم چرا ۹۶"),
        vec!["بپرسم", "فایننس", "چرا"]
    );
    assert_eq!(words("The QA, the qa!"), vec!["the"]);
}
