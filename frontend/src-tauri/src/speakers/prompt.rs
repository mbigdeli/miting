//! The prompt that asks the configured AI to name speakers from the
//! labelled transcript. The reply is checked in `naming`.

use crate::diarize_engine::DiarizedSegment;

/// Transcript budget sent to the model. Introductions cluster at the start
/// and goodbyes ("thanks Sara") at the end, so both ends are kept.
const HEAD_CHARS: usize = 16_000;
const TAIL_CHARS: usize = 4_000;

pub const SYSTEM_PROMPT: &str = r#"You identify the real names of speakers in a meeting transcript.
Lines look like "Speaker 2: text". Labels come from voice analysis; the people never said them.
Find a speaker's name ONLY from evidence in the text:
- self-introduction ("I'm Sara", "من علی هستم", "Sara here")
- being addressed by another speaker ("thanks Reza", "علی جان نظرت چیه؟"): the addressed person is usually the NEXT speaker to reply, not the one talking
- a participant list, when given, may help match, but still needs evidence in the text
Rules:
- Write each name exactly as it is spelled in the transcript, in the same script. Never translate or transliterate.
- Skip any speaker you are not confident about. Never guess. An empty list is a good answer.
- Never give two speakers the same name.
Reply with STRICT JSON only:
{"speakers":[{"label":"Speaker 1","name":"...","evidence":"short exact quote","confidence":0.0}]}"#;

/// User prompt: optional participant hint plus the labelled transcript.
#[must_use]
pub fn user_prompt(segments: &[DiarizedSegment], participants: &[String]) -> String {
    let lines: String = segments
        .iter()
        .map(|s| format!("{}: {}\n", s.speaker_name, s.text.trim()))
        .collect();
    let transcript = if lines.chars().count() <= HEAD_CHARS + TAIL_CHARS {
        lines
    } else {
        let head: String = lines.chars().take(HEAD_CHARS).collect();
        let tail: String = lines
            .chars()
            .skip(lines.chars().count() - TAIL_CHARS)
            .collect();
        format!("{head}\n[...]\n{tail}")
    };
    let roster = if participants.is_empty() {
        String::new()
    } else {
        format!("Participants: {}\n\n", participants.join(", "))
    };
    format!("{roster}Transcript:\n{transcript}")
}
