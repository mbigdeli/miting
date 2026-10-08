use super::*;

#[test]
fn system_prompt_names_both_languages_or_auto() {
    let p = system_prompt("Persian", Some("French"));
    assert!(p.contains("into Persian"));
    assert!(p.contains("source language is French"));
    let auto = system_prompt("English", None);
    assert!(auto.contains("whatever language is spoken"));
}

#[test]
fn user_prompt_numbers_lines_and_escapes_json() {
    let p = user_prompt(&[], &["Bonjour \"à\" tous".into(), "Merci".into()]);
    assert!(p.starts_with("CURRENT:\n"));
    assert!(!p.contains("CONTEXT"));
    let arr: Value = serde_json::from_str(p.trim_start_matches("CURRENT:\n")).unwrap();
    assert_eq!(arr[0]["id"], 1);
    assert_eq!(arr[0]["text"], "Bonjour \"à\" tous");
    assert_eq!(arr[1]["id"], 2);
}

#[test]
fn user_prompt_puts_context_first() {
    let ctx = [Pair {
        source: "Salut".into(),
        translation: "Hi".into(),
    }];
    let p = user_prompt(&ctx, &["Merci".into()]);
    let c = p.find("CONTEXT:").unwrap();
    let cur = p.find("CURRENT:").unwrap();
    assert!(c < cur);
    assert!(p.contains("\"translation\":\"Hi\""));
}

#[test]
fn parses_plain_and_fenced_replies() {
    let plain = r#"{"lines":[{"id":1,"text":"Hello"},{"id":2,"text":"Thanks"}]}"#;
    assert_eq!(
        parse_reply(plain, 2).unwrap(),
        vec![Some("Hello".into()), Some("Thanks".into())]
    );
    let fenced = "```json\n{\"lines\":[{\"id\":\"1\",\"text\":\" سلام \"}]}\n```";
    assert_eq!(parse_reply(fenced, 1).unwrap(), vec![Some("سلام".into())]);
}

#[test]
fn missing_and_out_of_range_ids_leave_gaps() {
    let raw = r#"{"lines":[{"id":2,"text":"B"},{"id":9,"text":"X"},{"id":1,"text":""}]}"#;
    assert_eq!(
        parse_reply(raw, 3).unwrap(),
        vec![None, Some("B".into()), None]
    );
}

#[test]
fn rejects_non_json_and_empty_replies() {
    assert!(parse_reply("Sorry, I cannot help.", 1).is_err());
    assert!(parse_reply(r#"{"lines":[]}"#, 1).is_err());
    assert!(parse_reply(r#"{"other":1}"#, 1).is_err());
}
