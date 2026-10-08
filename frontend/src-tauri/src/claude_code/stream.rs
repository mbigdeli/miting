//! A long-lived `claude --print` process for many short turns (live
//! translation). Spawning the CLI costs about 3.5s; a turn in an open session
//! costs about 2s. Blocking API: call it from `spawn_blocking`.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{self, Receiver};

use super::process::{creation_no_window, spawn_reader};
use super::stream_proto::{self, StreamEvent};
use super::{resolve, ClaudeCliError, ClaudeInstall};

mod cleanup;
mod turn;

pub struct ClaudeSession {
    child: Child,
    stdin: ChildStdin,
    events: Receiver<StreamEvent>,
    stderr: Option<std::thread::JoinHandle<String>>,
    turns: u32,
}

impl ClaudeSession {
    /// Start a session in `workdir` (an empty folder, so no project files are
    /// picked up). The system prompt and settings are written there as files.
    pub fn spawn(
        model: Option<&str>,
        system_prompt: &str,
        workdir: &Path,
    ) -> Result<Self, ClaudeCliError> {
        Self::spawn_with(
            &resolve::resolve_claude_binary()?,
            model,
            system_prompt,
            workdir,
        )
    }

    pub fn spawn_with(
        install: &ClaudeInstall,
        model: Option<&str>,
        system_prompt: &str,
        workdir: &Path,
    ) -> Result<Self, ClaudeCliError> {
        std::fs::create_dir_all(workdir).map_err(|e| ClaudeCliError::Spawn(e.to_string()))?;
        let system_file = workdir.join("system-prompt.txt");
        let settings_file = workdir.join("settings.json");
        std::fs::write(&system_file, system_prompt)
            .map_err(|e| ClaudeCliError::Spawn(e.to_string()))?;
        std::fs::write(&settings_file, stream_proto::SESSION_SETTINGS)
            .map_err(|e| ClaudeCliError::Spawn(e.to_string()))?;

        let mut cmd = Command::new(&install.path);
        cmd.args(stream_proto::session_args(
            model,
            &system_file,
            &settings_file,
        ))
        .current_dir(workdir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        creation_no_window(&mut cmd);
        crate::platform::ensure_node_on_path(&mut cmd);
        let mut child = cmd
            .spawn()
            .map_err(|e| ClaudeCliError::Spawn(e.to_string()))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| ClaudeCliError::Spawn("no stdin".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ClaudeCliError::Spawn("no stdout".into()))?;
        let stderr = child.stderr.take().map(spawn_reader);
        let events = event_reader(stdout);
        Ok(Self {
            child,
            stdin,
            events,
            stderr,
            turns: 0,
        })
    }

    pub fn turns(&self) -> u32 {
        self.turns
    }
}

/// Turn result events from stdout, read on their own thread.
fn event_reader(stdout: ChildStdout) -> Receiver<StreamEvent> {
    let (tx, events) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let ev = stream_proto::parse_line(&line);
            if ev != StreamEvent::Other && tx.send(ev).is_err() {
                break;
            }
        }
    });
    events
}

impl Drop for ClaudeSession {
    fn drop(&mut self) {
        cleanup::kill_tree(&mut self.child);
    }
}

#[cfg(test)]
#[cfg(windows)]
#[path = "stream/session_tests.rs"]
mod tests;
