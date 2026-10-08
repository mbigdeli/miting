use super::*;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// A stand-in CLI: answers every stdin line with one result event, and
/// reports a sign-in error for a line containing "boom".
fn fake_install(dir: &Path) -> ClaudeInstall {
    let ps1 = dir.join("fake.ps1");
    std::fs::write(
        &ps1,
        "$i=[Console]::In\r\n\
         while(($l=$i.ReadLine()) -ne $null){\r\n\
           if($l -match 'boom'){ [Console]::Out.WriteLine('{\"type\":\"result\",\"subtype\":\"error_during_execution\",\"is_error\":true,\"result\":\"Please run /login\"}') }\r\n\
           else { [Console]::Out.WriteLine('{\"type\":\"assistant\"}'); [Console]::Out.WriteLine('{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":\"turn ok\"}') }\r\n\
           [Console]::Out.Flush()\r\n\
         }\r\n",
    )
    .unwrap();
    let cmd = dir.join("fake_claude.cmd");
    std::fs::write(
        &cmd,
        "@echo off\r\n\"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\" \
         -NoProfile -ExecutionPolicy Bypass -File \"%~dp0fake.ps1\"\r\n",
    )
    .unwrap();
    ClaudeInstall {
        path: cmd,
        version: None,
    }
}

#[test]
fn one_process_answers_many_turns_and_maps_login_errors() {
    let dir = tempfile::tempdir().unwrap();
    let install = fake_install(dir.path());
    let work = dir.path().join("work");
    let mut s = ClaudeSession::spawn_with(&install, Some("haiku"), "be brief", &work).unwrap();
    let t = Duration::from_secs(30);
    assert_eq!(s.ask("Bonjour", t, None).unwrap(), "turn ok");
    assert_eq!(s.ask("Merci", t, None).unwrap(), "turn ok");
    assert_eq!(s.turns(), 2);
    assert_eq!(
        std::fs::read_to_string(work.join("system-prompt.txt")).unwrap(),
        "be brief"
    );
    assert!(matches!(
        s.ask("boom", t, None),
        Err(ClaudeCliError::NotLoggedIn)
    ));
}

#[test]
fn cancelled_turn_returns_promptly() {
    let dir = tempfile::tempdir().unwrap();
    let install = fake_install(dir.path());
    let mut s = ClaudeSession::spawn_with(&install, None, "x", &dir.path().join("w")).unwrap();
    let cancel = CancellationToken::new();
    cancel.cancel();
    let r = s.ask("Bonjour", Duration::from_secs(30), Some(&cancel));
    assert!(matches!(r, Err(ClaudeCliError::Cancelled)));
}
