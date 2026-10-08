//! Test doubles shared by the translation tests: a recording notifier, a tiny
//! fake OpenAI-compatible server, and a database configured to use it.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::database::repositories::setting::SettingsRepository;
use crate::summary::CustomOpenAIConfig;
use crate::translation::events::{JobProgress, LineTranslated, LiveState, LiveStatus, Notify};

#[derive(Clone, Default)]
pub struct Recorder {
    pub lines: Arc<Mutex<Vec<LineTranslated>>>,
    pub states: Arc<Mutex<Vec<LiveState>>>,
    pub progress: Arc<Mutex<Vec<JobProgress>>>,
}

impl Notify for Recorder {
    fn line(&self, line: &LineTranslated) {
        self.lines.lock().unwrap().push(line.clone());
    }
    fn status(&self, status: &LiveStatus) {
        self.states.lock().unwrap().push(status.state);
    }
    fn progress(&self, p: &JobProgress) {
        self.progress.lock().unwrap().push(p.clone());
    }
}

/// Answers each request by "translating" every CURRENT line to `fa:<line>`,
/// or with HTTP 500 when `fail` is set.
pub async fn fake_ai(fail: bool) -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        while let Ok((mut sock, _)) = listener.accept().await {
            tokio::spawn(async move {
                let Some(body) = read_body(&mut sock).await else {
                    return;
                };
                let (status, payload) = if fail {
                    ("500 Internal Server Error", json!({ "error": "boom" }))
                } else {
                    ("200 OK", reply_for(&body))
                };
                let payload = payload.to_string();
                let resp = format!(
                    "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
                    payload.len()
                );
                let _ = sock.write_all(resp.as_bytes()).await;
            });
        }
    });
    port
}

async fn read_body(sock: &mut tokio::net::TcpStream) -> Option<String> {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let n = sock.read(&mut chunk).await.ok()?;
        if n == 0 {
            return None;
        }
        buf.extend_from_slice(&chunk[..n]);
        let text = String::from_utf8_lossy(&buf).to_string();
        let Some(end) = text.find("\r\n\r\n") else {
            continue;
        };
        let len = text[..end]
            .lines()
            .find_map(|l| {
                let l = l.to_ascii_lowercase();
                l.strip_prefix("content-length:")
                    .map(|v| v.trim().parse::<usize>().unwrap_or(0))
            })
            .unwrap_or(0);
        if buf.len() >= end + 4 + len {
            return Some(String::from_utf8_lossy(&buf[end + 4..end + 4 + len]).to_string());
        }
    }
}

fn reply_for(body: &str) -> Value {
    let req: Value = serde_json::from_str(body).unwrap();
    let user = req["messages"][1]["content"].as_str().unwrap();
    let current = &user[user.find("CURRENT:\n").unwrap() + "CURRENT:\n".len()..];
    let lines: Vec<Value> = serde_json::from_str::<Vec<Value>>(current)
        .unwrap()
        .into_iter()
        .map(|l| json!({ "id": l["id"], "text": format!("fa:{}", l["text"].as_str().unwrap()) }))
        .collect();
    let content = json!({ "lines": lines }).to_string();
    json!({ "choices": [{ "message": { "role": "assistant", "content": content } }] })
}

pub async fn pool_with_ai(port: u16) -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    SettingsRepository::save_model_config(&pool, "custom-openai", "fake-model", "", None)
        .await
        .unwrap();
    let config = CustomOpenAIConfig {
        endpoint: format!("http://127.0.0.1:{port}"),
        api_key: None,
        model: "fake-model".into(),
        max_tokens: None,
        temperature: None,
        top_p: None,
    };
    SettingsRepository::save_custom_openai_config(&pool, &config)
        .await
        .unwrap();
    pool
}

pub async fn wait_for(what: &str, mut ok: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(20);
    while !ok() {
        assert!(Instant::now() < deadline, "timed out waiting for {what}");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
