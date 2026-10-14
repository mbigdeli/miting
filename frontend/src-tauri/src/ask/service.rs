//! Answers one question: picks the transcript lines that fit the model,
//! extends the live earlier summary when needed, asks the AI, and keeps only
//! the citations that point at real lines.

use async_trait::async_trait;

use super::types::{AskMessage, AskReply, Material};
use super::{cite, prompt, rolling, window};
use crate::translation::provider::ResolvedProvider;

/// Characters of material per question: small for models on this computer.
const LOCAL_BUDGET: usize = 24_000;
const CLOUD_BUDGET: usize = 360_000;

#[async_trait]
pub trait Ai: Sync {
    fn is_local(&self) -> bool;
    fn names(&self) -> (String, String);
    async fn complete(&self, system: &str, user: &str) -> Result<String, String>;
}

#[async_trait]
impl Ai for ResolvedProvider {
    fn is_local(&self) -> bool {
        ResolvedProvider::is_local(self)
    }
    fn names(&self) -> (String, String) {
        (self.id.clone(), self.user_model.clone())
    }
    async fn complete(&self, system: &str, user: &str) -> Result<String, String> {
        ResolvedProvider::complete(self, &self.user_model, system, user, None).await
    }
}

pub async fn answer<A: Ai>(ai: &A, mut m: Material) -> Result<AskReply, String> {
    let budget = if ai.is_local() {
        LOCAL_BUDGET
    } else {
        CLOUD_BUDGET
    };
    let starts: Vec<f64> = m.lines.iter().filter_map(|l| l.at).collect();
    if let Some(now) = m.now_sec {
        if !window::fits(&m, budget) {
            let from = (now - window::LIVE_WINDOW_SEC).max(0.0);
            let todo = rolling::pending(&m.lines, m.earlier.as_ref(), from);
            if !todo.is_empty() {
                let raw = ai
                    .complete(rolling::SYSTEM, &rolling::user_prompt(&todo))
                    .await?;
                let (bullets, _) = cite::verify(&raw, &starts);
                m.earlier = Some(rolling::extend(m.earlier.as_ref(), &bullets, from));
            }
        }
    }
    let sel = window::select(&m, budget);
    let raw = ai
        .complete(prompt::SYSTEM, &prompt::user_prompt(&m, &sel))
        .await?;
    let (answer, citations) = cite::verify(&raw, &starts);
    if answer.is_empty() {
        return Err("empty_answer".into());
    }
    let (provider, model) = ai.names();
    let message = AskMessage {
        id: uuid::Uuid::new_v4().to_string(),
        asked_at_sec: m.now_sec,
        question: m.question.trim().to_string(),
        quotes: m.quotes.clone(),
        answer_md: Some(answer),
        citations,
        error: None,
        provider: Some(provider),
        model: Some(model),
        saved_note_id: None,
    };
    Ok(AskReply {
        message,
        earlier_summary: m.earlier,
    })
}

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;
