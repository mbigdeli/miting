use std::sync::Mutex;

use super::*;
use crate::ask::types::{EarlierSummary, Line};

/// Replies in order and records what it was asked.
struct FakeAi {
    replies: Mutex<Vec<String>>,
    asked: Mutex<Vec<(String, String)>>,
    local: bool,
}

impl FakeAi {
    fn new(replies: &[&str], local: bool) -> Self {
        Self {
            replies: Mutex::new(replies.iter().rev().map(|s| s.to_string()).collect()),
            asked: Mutex::new(vec![]),
            local,
        }
    }
}

#[async_trait]
impl Ai for FakeAi {
    fn is_local(&self) -> bool {
        self.local
    }
    fn names(&self) -> (String, String) {
        ("fake".into(), "fake-1".into())
    }
    async fn complete(&self, system: &str, user: &str) -> Result<String, String> {
        self.asked
            .lock()
            .unwrap()
            .push((system.into(), user.into()));
        self.replies
            .lock()
            .unwrap()
            .pop()
            .ok_or_else(|| "no reply".into())
    }
}

fn short_meeting() -> Material {
    Material {
        title: "Sync".into(),
        lines: vec![
            Line {
                at: Some(21.0),
                speaker: None,
                text: "Drop-off rose to 24 percent.".into(),
            },
            Line {
                at: Some(66.0),
                speaker: None,
                text: "Sam ships Thursday.".into(),
            },
        ],
        question: "Who ships the fix?".into(),
        ..Default::default()
    }
}

#[tokio::test]
async fn answers_with_checked_citations_and_names() {
    let ai = FakeAi::new(
        &["Sam ships it Thursday [01:05]. Budget approved [09:00]."],
        false,
    );
    let reply = answer(&ai, short_meeting()).await.unwrap();
    assert_eq!(
        reply.message.answer_md.as_deref(),
        Some("Sam ships it Thursday [01:06]. Budget approved.")
    );
    assert_eq!(reply.message.citations, vec![66.0]);
    assert_eq!(reply.message.provider.as_deref(), Some("fake"));
    assert_eq!(
        ai.asked.lock().unwrap().len(),
        1,
        "a short meeting needs one call"
    );
}

#[tokio::test]
async fn long_live_meeting_summarizes_older_lines_once_then_reuses_it() {
    let mut m = short_meeting();
    m.lines = (0..240)
        .map(|i| Line {
            at: Some(i as f64 * 15.0),
            speaker: None,
            text: format!("{i} {}", "words ".repeat(20)),
        })
        .collect();
    m.now_sec = Some(3600.0);
    let ai = FakeAi::new(&["- [00:00] intro", "Answer [59:45]."], true);
    let reply = answer(&ai, m.clone()).await.unwrap();
    let earlier = reply.earlier_summary.clone().unwrap();
    assert_eq!(earlier.until_sec, 2700.0);
    assert_eq!(earlier.text, "- [00:00] intro");
    let asked = ai.asked.lock().unwrap();
    assert_eq!(asked.len(), 2);
    assert!(
        asked[1].1.contains("<earlier_summary"),
        "the question carries the summary"
    );

    // Next question, same moment: nothing new to summarize.
    let ai2 = FakeAi::new(&["Again [59:45]."], true);
    m.earlier = Some(EarlierSummary {
        text: earlier.text,
        until_sec: 2700.0,
    });
    answer(&ai2, m).await.unwrap();
    assert_eq!(ai2.asked.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn an_empty_reply_is_an_error() {
    let ai = FakeAi::new(&["  [99:00] "], false);
    assert_eq!(
        answer(&ai, short_meeting()).await.unwrap_err(),
        "empty_answer"
    );
}
