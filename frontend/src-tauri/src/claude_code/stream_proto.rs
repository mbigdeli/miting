//! Wire format for a long-lived `claude --print` session in stream-json mode
//! (verified against the installed CLI on 2026-10-08): one JSON user message
//! per stdin line in, newline-delimited events out, one `result` event per
//! turn. Pure, so the argument list and parsing are unit-tested.

use std::ffi::OsString;
use std::path::Path;

use serde_json::{json, Value};

/// A turn's outcome as reported by the CLI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamEvent {
    Result { ok: bool, text: String },
    Other,
}

/// Arguments for a text-only session: no tools, no MCP servers, no user or
/// project settings (so no hooks), thinking off, our own system prompt.
pub fn session_args(
    model: Option<&str>,
    system_file: &Path,
    settings_file: &Path,
) -> Vec<OsString> {
    let mut args: Vec<OsString> = [
        "--print",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    args.push("--settings".into());
    args.push(settings_file.into());
    args.push("--system-prompt-file".into());
    args.push(system_file.into());
    if let Some(m) = model {
        args.push("--model".into());
        args.push(m.into());
    }
    args
}

/// Settings for the session: thinking off keeps a short turn near two seconds.
pub const SESSION_SETTINGS: &str = r#"{"alwaysThinkingEnabled": false}"#;

/// One stdin line carrying a user turn.
pub fn user_message(text: &str) -> String {
    let msg = json!({ "type": "user", "message": { "role": "user", "content": text } });
    format!("{msg}\n")
}

/// Classify one stdout line; anything that is not a turn result is `Other`.
pub fn parse_line(line: &str) -> StreamEvent {
    let Ok(v) = serde_json::from_str::<Value>(line.trim()) else {
        return StreamEvent::Other;
    };
    if v.get("type").and_then(Value::as_str) != Some("result") {
        return StreamEvent::Other;
    }
    let is_error = v.get("is_error").and_then(Value::as_bool).unwrap_or(false);
    let subtype_ok = v.get("subtype").and_then(Value::as_str) == Some("success");
    let text = v
        .get("result")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    StreamEvent::Result {
        ok: subtype_ok && !is_error,
        text,
    }
}

/// Error text that means the CLI is installed but not signed in.
pub fn looks_logged_out(text: &str) -> bool {
    let t = text.to_ascii_lowercase();
    [
        "not logged in",
        "/login",
        "invalid api key",
        "unauthorized",
        "authenticate",
    ]
    .iter()
    .any(|needle| t.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_disable_tools_settings_and_pass_model() {
        let args = session_args(Some("haiku"), Path::new("s.txt"), Path::new("c.json"));
        let s: Vec<String> = args
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        let at = |flag: &str| s.iter().position(|a| a == flag).expect(flag);
        assert_eq!(s[at("--input-format") + 1], "stream-json");
        assert_eq!(s[at("--tools") + 1], "");
        assert_eq!(s[at("--setting-sources") + 1], "");
        assert_eq!(s[at("--system-prompt-file") + 1], "s.txt");
        assert_eq!(s[at("--model") + 1], "haiku");
        assert!(s.contains(&"--strict-mcp-config".to_string()));
        assert!(!session_args(None, Path::new("s"), Path::new("c"))
            .iter()
            .any(|a| a == "--model"));
    }

    #[test]
    fn user_message_is_one_json_line() {
        let line = user_message("Bonjour \"à\" tous\nMerci");
        assert!(line.ends_with('\n'));
        assert_eq!(line.matches('\n').count(), 1);
        let v: Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["message"]["content"], "Bonjour \"à\" tous\nMerci");
    }

    #[test]
    fn parses_result_events_only() {
        let ok =
            r#"{"type":"result","subtype":"success","is_error":false,"result":"{\"lines\":[]}"}"#;
        assert_eq!(
            parse_line(ok),
            StreamEvent::Result {
                ok: true,
                text: "{\"lines\":[]}".into()
            }
        );
        let err = r#"{"type":"result","subtype":"error_during_execution","is_error":true,"result":"boom"}"#;
        assert_eq!(
            parse_line(err),
            StreamEvent::Result {
                ok: false,
                text: "boom".into()
            }
        );
        assert_eq!(
            parse_line(r#"{"type":"assistant","message":{}}"#),
            StreamEvent::Other
        );
        assert_eq!(parse_line("not json"), StreamEvent::Other);
    }

    #[test]
    fn detects_logged_out_errors() {
        assert!(looks_logged_out("Invalid API key · Please run /login"));
        assert!(!looks_logged_out("rate limited"));
    }
}
