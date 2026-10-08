//! Translation prompts and reply parsing, shared by the live and saved-miting
//! paths. Pure functions: the model sees numbered lines as JSON and must answer
//! with the same ids, so a reply can be checked line by line.

use serde_json::{json, Value};

/// An earlier line with its translation, sent as context only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pair {
    pub source: String,
    pub translation: String,
}

/// System prompt. `source` is `None` when the spoken language is auto-detected.
pub fn system_prompt(target: &str, source: Option<&str>) -> String {
    let from = source.unwrap_or("whatever language is spoken");
    format!(
        "You translate live meeting captions into {target}. The source language is {from}.\n\
Translate ONLY the lines under CURRENT. Lines under CONTEXT are earlier lines with their \
translations: use them to keep names, terms and pronouns consistent; never translate or repeat them.\n\
Rules: keep the meaning exact; add nothing, drop nothing, explain nothing; keep names, numbers, \
dates, product and code terms as spoken; if a line is an unfinished fragment, translate the \
fragment literally without completing it; keep the speaker's register; write {target} script only. \
If a line is already in {target}, return it unchanged.\n\
Reply with exactly one JSON object and nothing else: \
{{\"lines\":[{{\"id\":<id>,\"text\":\"<translation>\"}}]}} with one entry per CURRENT line, same ids, same order."
    )
}

/// User prompt: optional context pairs, then the numbered lines (ids from 1).
pub fn user_prompt(context: &[Pair], lines: &[String]) -> String {
    let current: Vec<Value> = lines
        .iter()
        .enumerate()
        .map(|(i, text)| json!({ "id": i + 1, "text": text }))
        .collect();
    let mut out = String::new();
    if !context.is_empty() {
        let ctx: Vec<Value> = context
            .iter()
            .map(|p| json!({ "source": p.source, "translation": p.translation }))
            .collect();
        out.push_str("CONTEXT:\n");
        out.push_str(&Value::Array(ctx).to_string());
        out.push_str("\n\n");
    }
    out.push_str("CURRENT:\n");
    out.push_str(&Value::Array(current).to_string());
    out
}

/// The JSON object inside a reply, tolerating code fences and stray prose.
pub fn extract_json_object(raw: &str) -> Option<Value> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end < start {
        return None;
    }
    serde_json::from_str(&raw[start..=end]).ok()
}

/// Parse a reply into one slot per expected line (ids 1..=expected).
/// Errors when the reply is not the expected JSON or translates nothing.
pub fn parse_reply(raw: &str, expected: usize) -> Result<Vec<Option<String>>, String> {
    let value = extract_json_object(raw).ok_or("translation reply was not JSON")?;
    let items = value
        .get("lines")
        .and_then(Value::as_array)
        .ok_or("translation reply had no lines")?;
    let mut slots = vec![None; expected];
    for item in items {
        let id = match item.get("id") {
            Some(Value::Number(n)) => n.as_u64(),
            Some(Value::String(s)) => s.trim().parse().ok(),
            _ => None,
        };
        let text = item.get("text").and_then(Value::as_str).map(str::trim);
        if let (Some(id), Some(text)) = (id, text) {
            let idx = id as usize;
            if (1..=expected).contains(&idx) && !text.is_empty() {
                slots[idx - 1] = Some(text.to_string());
            }
        }
    }
    if slots.iter().all(Option::is_none) {
        return Err("translation reply matched no lines".into());
    }
    Ok(slots)
}

#[cfg(test)]
#[path = "prompt_tests.rs"]
mod tests;
