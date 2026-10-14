//! AI name suggestions: parse and *verify* the model's reply (prompt in
//! `prompt`). A name is accepted only when it literally
//! occurs in the transcript, so the model cannot invent people.

use std::collections::HashMap;

use serde::Deserialize;

use crate::database::repositories::speakers::NameSuggestion;
use crate::diarize_engine::DiarizedSegment;

const MIN_CONFIDENCE: f64 = 0.6;
const MAX_NAME_CHARS: usize = 40;

#[derive(Deserialize)]
struct Reply {
    #[serde(default)]
    speakers: Vec<Item>,
}

#[derive(Deserialize)]
struct Item {
    label: String,
    name: String,
    #[serde(default)]
    evidence: String,
    #[serde(default)]
    confidence: f64,
}

/// Parse the model reply and keep only verified suggestions: known label,
/// confident, plausible, present in the transcript, one voice per name.
#[must_use]
pub fn parse_reply(raw: &str, segments: &[DiarizedSegment]) -> Vec<NameSuggestion> {
    let Some(json) = raw.find('{').zip(raw.rfind('}')).map(|(a, b)| &raw[a..=b]) else {
        return Vec::new();
    };
    let Ok(reply) = serde_json::from_str::<Reply>(json) else {
        return Vec::new();
    };
    let text: String = segments
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let labels: Vec<&str> = segments.iter().map(|s| s.speaker_name.as_str()).collect();

    let mut best: HashMap<String, Item> = HashMap::new();
    for item in reply.speakers {
        let name = item.name.trim();
        let plausible = !name.is_empty()
            && name.chars().count() <= MAX_NAME_CHARS
            && !name.to_lowercase().starts_with("speaker")
            && text.contains(name);
        if !plausible || item.confidence < MIN_CONFIDENCE || !labels.contains(&item.label.as_str())
        {
            continue;
        }
        let key = name.to_string();
        if best
            .get(&key)
            .map_or(true, |b| item.confidence > b.confidence)
        {
            best.insert(key, item);
        }
    }
    // One name per voice: the most confident one wins.
    let mut items: Vec<Item> = best.into_values().collect();
    items.sort_by(|a, b| {
        a.label
            .cmp(&b.label)
            .then(b.confidence.total_cmp(&a.confidence))
    });
    items.dedup_by(|a, b| a.label == b.label);
    items
        .into_iter()
        .map(|i| NameSuggestion {
            label: i.label,
            name: i.name.trim().to_string(),
            evidence: i.evidence.trim().to_string(),
        })
        .collect()
}

#[cfg(test)]
#[path = "naming_tests.rs"]
mod naming_tests;
