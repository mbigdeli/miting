//! Note bodies are HTML; the AI gets them as plain text.

/// Note HTML as plain text (bold, lists and line breaks dropped).
pub fn plain(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in html.replace("<br>", " ").replace("</li>", "; ").chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
