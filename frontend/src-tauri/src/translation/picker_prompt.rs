//! The question we ask the user's own AI: "which of your models should do
//! live translation?". The model only chooses from the provider's real model
//! list (models do not reliably know their own family), and the answer is
//! checked against that list before it is used.

use super::prompt::extract_json_object;

/// One model the provider says this account can use right now.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Candidate {
    pub id: String,
    /// Price, size or display name when the provider tells us; may be empty.
    pub note: String,
}

pub const SYSTEM: &str = "You choose models for a meeting app. Answer with JSON only.";

pub fn user_prompt(current_model: &str, candidates: &[Candidate]) -> String {
    let list = candidates
        .iter()
        .map(|c| {
            if c.note.is_empty() {
                c.id.clone()
            } else {
                format!("{} | {}", c.id, c.note)
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "You are choosing a model for one job inside a meeting app.\n\n\
Job: live caption translation. Short transcript lines (5 to 40 words) arrive every few \
seconds and each must be translated into another language with the lowest possible \
latency. No reasoning, no creativity. Priorities, in order:\n\
1. time to first token and throughput (small, fast models)\n\
2. cost per token\n\
3. translation quality across common languages, including Persian, Arabic and English\n\n\
The user currently uses \"{current_model}\" for meeting notes. Pick the single best model \
for translation from the list below. The list is what this account can use right now; \
only an id from the list is valid.\n\n<models>\n{list}\n</models>\n\n\
Reply with exactly one JSON object and nothing else:\n\
{{\"model\": \"<id from the list>\", \"reason\": \"<one sentence>\"}}"
    )
}

/// The chosen id, only if it is on the list (exact, then case-insensitive).
pub fn parse(raw: &str, candidates: &[Candidate]) -> Option<String> {
    let value = extract_json_object(raw)?;
    let picked = value.get("model")?.as_str()?.trim();
    candidates
        .iter()
        .find(|c| c.id == picked)
        .or_else(|| {
            candidates
                .iter()
                .find(|c| c.id.eq_ignore_ascii_case(picked))
        })
        .map(|c| c.id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cands() -> Vec<Candidate> {
        vec![
            Candidate {
                id: "claude-opus-5-5".into(),
                note: String::new(),
            },
            Candidate {
                id: "claude-haiku-5-5".into(),
                note: "$0.10/$0.50 per 1M".into(),
            },
        ]
    }

    #[test]
    fn prompt_lists_every_candidate_with_notes() {
        let p = user_prompt("claude-opus-5-5", &cands());
        assert!(p.contains("claude-opus-5-5\n"));
        assert!(p.contains("claude-haiku-5-5 | $0.10/$0.50 per 1M"));
        assert!(p.contains("currently uses \"claude-opus-5-5\""));
    }

    #[test]
    fn accepts_only_listed_ids() {
        let c = cands();
        assert_eq!(
            parse(r#"{"model":"claude-haiku-5-5","reason":"fast"}"#, &c).as_deref(),
            Some("claude-haiku-5-5")
        );
        assert_eq!(
            parse("```json\n{\"model\":\"CLAUDE-HAIKU-5-5\"}\n```", &c).as_deref(),
            Some("claude-haiku-5-5")
        );
        assert_eq!(parse(r#"{"model":"claude-haiku-9"}"#, &c), None);
        assert_eq!(parse("haiku is best", &c), None);
    }
}
