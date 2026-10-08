//! One turn of a `ClaudeSession`: write the user line, wait for its result.

use std::io::Write;
use std::sync::mpsc::RecvTimeoutError;
use std::time::{Duration, Instant};

use tokio_util::sync::CancellationToken;

use super::super::stream_proto::{self, StreamEvent};
use super::super::ClaudeCliError;
use super::ClaudeSession;

impl ClaudeSession {
    /// Send one user turn and wait for its result.
    pub fn ask(
        &mut self,
        text: &str,
        timeout: Duration,
        cancel: Option<&CancellationToken>,
    ) -> Result<String, ClaudeCliError> {
        let line = stream_proto::user_message(text);
        self.stdin
            .write_all(line.as_bytes())
            .and_then(|_| self.stdin.flush())
            .map_err(|_| self.exit_error())?;
        self.turns += 1;
        let deadline = Instant::now() + timeout;
        loop {
            if cancel.is_some_and(CancellationToken::is_cancelled) {
                return Err(ClaudeCliError::Cancelled);
            }
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err(ClaudeCliError::Timeout(timeout.as_secs()));
            }
            match self
                .events
                .recv_timeout(left.min(Duration::from_millis(250)))
            {
                Ok(StreamEvent::Result { ok: true, text }) => return Ok(text),
                Ok(StreamEvent::Result { ok: false, text })
                    if stream_proto::looks_logged_out(&text) =>
                {
                    return Err(ClaudeCliError::NotLoggedIn)
                }
                Ok(StreamEvent::Result { text, .. }) => {
                    return Err(ClaudeCliError::BadOutput(text))
                }
                Ok(StreamEvent::Other) | Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return Err(self.exit_error()),
            }
        }
    }

    /// The process ended: report what it printed on stderr.
    fn exit_error(&mut self) -> ClaudeCliError {
        let code = self.child.try_wait().ok().flatten().and_then(|s| s.code());
        super::cleanup::kill_tree(&mut self.child);
        let stderr = self
            .stderr
            .take()
            .map(|h| super::cleanup::join_within(h, Duration::from_secs(2)))
            .unwrap_or_default();
        let code = code.unwrap_or(-1);
        if stream_proto::looks_logged_out(&stderr) {
            return ClaudeCliError::NotLoggedIn;
        }
        ClaudeCliError::NonZeroExit {
            code,
            stderr_tail: super::super::process::tail(&stderr, 2048),
        }
    }
}
