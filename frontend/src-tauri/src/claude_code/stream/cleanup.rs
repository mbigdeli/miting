//! Ending a session's process cleanly. The npm install runs `claude.cmd`,
//! so the direct child is `cmd.exe` and the real CLI is a node grandchild:
//! killing only the child would leave node running with our pipes open.

use std::process::Child;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// Kill the child and everything it started, then reap it.
pub(super) fn kill_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        let taskkill = std::env::var("SystemRoot")
            .map(|root| format!(r"{root}\System32\taskkill.exe"))
            .unwrap_or_else(|_| "taskkill.exe".to_string());
        let mut cmd = std::process::Command::new(taskkill);
        cmd.args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        crate::claude_code::process::creation_no_window(&mut cmd);
        let _ = cmd.status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Collect a reader thread's text if it finishes within `limit`; never hang.
pub(super) fn join_within(handle: JoinHandle<String>, limit: Duration) -> String {
    let deadline = Instant::now() + limit;
    while !handle.is_finished() {
        if Instant::now() >= deadline {
            return String::new();
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    handle.join().unwrap_or_default()
}
