//! The words the AI receives for one question: fixed rules, then the meeting
//! in tagged blocks. Text the user selected is sent twice on purpose: as its
//! own block ("the user highlighted this") and marked inside the transcript.

pub use super::plain::plain;
use super::types::{clock, Line, Material};
use super::window::Selection;

/// History turns sent with each question; older ones are dropped.
const HISTORY_TURNS: usize = 6;

pub const SYSTEM: &str = "You answer questions about one meeting for the person who recorded it.\n\
Rules:\n\
- Use only the meeting material below. If the answer is not in it, say it was not discussed. Never guess.\n\
- After every claim, cite the transcript line it comes from as [mm:ss] (or [h:mm:ss]), copied from that line.\n\
- If the user asks something general (not about the meeting), answer briefly and say it is general knowledge, not from the meeting.\n\
- Text inside <user_highlight> was selected by the user in the transcript; the question is about it.\n\
- Lines marked ⟦highlighted⟧ are those same selections, in place.\n\
- Reply in the language of the question. Be short: a few sentences or bullets, plain Markdown, no headings.";

pub fn user_prompt(m: &Material, sel: &Selection) -> String {
    let mut out = String::new();
    let date = m
        .date
        .as_deref()
        .map(|d| format!(" · {d}"))
        .unwrap_or_default();
    let state = match m.now_sec {
        Some(now) => format!(" · still recording, now at {}", clock(now)),
        None => String::new(),
    };
    out.push_str(&format!(
        "<meeting>{}{date}{state}</meeting>\n\n",
        m.title.trim()
    ));
    if let Some(e) = m.earlier.as_ref().filter(|e| !e.text.trim().is_empty()) {
        out.push_str(&format!(
            "<earlier_summary until=\"{}\">\n{}\n</earlier_summary>\n\n",
            clock(e.until_sec),
            e.text.trim()
        ));
    }
    if let Some(s) = m
        .summary_md
        .as_ref()
        .filter(|s| sel.partial && !s.trim().is_empty())
    {
        out.push_str(&format!("<meeting_summary note=\"a map only; the transcript is the source\">\n{}\n</meeting_summary>\n\n", s.trim()));
    }
    let tag = match sel.recent_from {
        Some(from) => format!(
            "<transcript note=\"word for word from {}; some earlier lines added\">",
            clock(from)
        ),
        None if sel.partial => "<transcript note=\"selected lines only\">".to_string(),
        None => "<transcript>".to_string(),
    };
    out.push_str(&tag);
    out.push('\n');
    for l in &sel.lines {
        out.push_str(&render_line(l, m));
        out.push('\n');
    }
    out.push_str("</transcript>\n\n");
    if !m.notes.is_empty() {
        out.push_str("<user_notes>\n");
        for n in &m.notes {
            let at = n
                .at_sec
                .map(|a| format!("[{}] ", clock(a)))
                .unwrap_or_default();
            out.push_str(&format!("{at}{}\n", plain(&n.body_html)));
        }
        out.push_str("</user_notes>\n\n");
    }
    for q in &m.quotes {
        out.push_str(&format!(
            "<user_highlight at=\"{}\">{}</user_highlight>\n",
            clock(q.at),
            q.quote.trim()
        ));
    }
    let past: Vec<_> = m.history.iter().filter(|h| h.answer_md.is_some()).collect();
    if !past.is_empty() {
        out.push_str("\n<conversation_so_far>\n");
        for h in past.iter().skip(past.len().saturating_sub(HISTORY_TURNS)) {
            out.push_str(&format!(
                "Q: {}\nA: {}\n",
                h.question.trim(),
                h.answer_md.as_deref().unwrap_or("").trim()
            ));
        }
        out.push_str("</conversation_so_far>\n");
    }
    out.push_str(&format!("\n<question>{}</question>", m.question.trim()));
    out
}

fn render_line(l: &Line, m: &Material) -> String {
    let at = l.at.map(|a| format!("[{}] ", clock(a))).unwrap_or_default();
    let who = l
        .speaker
        .as_deref()
        .map(|s| format!("{}: ", s.trim()))
        .unwrap_or_default();
    let mark = if m
        .quotes
        .iter()
        .any(|q| !q.quote.trim().is_empty() && l.text.contains(q.quote.trim()))
    {
        " ⟦highlighted⟧"
    } else {
        ""
    };
    format!("{at}{who}{}{mark}", l.text.trim())
}

#[cfg(test)]
#[path = "prompt_tests.rs"]
mod tests;
