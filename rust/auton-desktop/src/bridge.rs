use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver, Sender},
    time::{Duration, Instant},
};

#[derive(Debug, Serialize)]
struct Request<'a, T> {
    id: u64,
    method: &'a str,
    params: T,
}
#[derive(Debug, Deserialize)]
pub struct Response {
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub event: Option<String>,
    pub ok: Option<bool>,
    #[serde(default)]
    pub result: Option<serde_json::Value>,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    #[serde(default)]
    pub error: Option<String>,
}

pub struct EngineBridge {
    stdin: Option<ChildStdin>,
    responses: Receiver<Response>,
    next_id: u64,
    child: Child,
}

impl EngineBridge {
    pub fn start() -> Result<Self> {
        let repo_root = std::env::var_os("AUTON_REPO_ROOT")
            .map(PathBuf::from)
            .unwrap_or(std::env::current_dir()?);
        let mut command = if let Some(program) = std::env::var_os("AUTON_BRIDGE_COMMAND") {
            let mut command = Command::new(program);
            if let Some(script) = std::env::var_os("AUTON_BRIDGE_SCRIPT") {
                command.arg(PathBuf::from(script));
            }
            command
        } else {
            let mut command = Command::new("corepack");
            command.args([
                "pnpm@10.33.2",
                "exec",
                "tsx",
                "packages/auton-bridge/main.ts",
            ]);
            command.current_dir(&repo_root);
            command
        };
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .env("AUTON_REPO_ROOT", &repo_root)
            .env("AUTON_STORAGE_DIR", auton_home())
            .env("AUTON_DATA_DIR_NAME", ".auton")
            .spawn()
            .context("start Auton TypeScript engine bridge")?;
        let stdin = child.stdin.take().context("bridge stdin was not created")?;
        let stdout = child
            .stdout
            .take()
            .context("bridge stdout was not created")?;
        let (tx, rx): (Sender<Response>, Receiver<Response>) = mpsc::channel();
        std::thread::Builder::new()
            .name("auton-bridge-events".into())
            .spawn(move || {
                for line in BufReader::new(stdout).lines() {
                    let Ok(line) = line else { break };
                    if let Ok(response) = serde_json::from_str::<Response>(&line) {
                        let _ = tx.send(response);
                    }
                }
                let _ = tx.send(Response {
                    event: Some("bridge.closed".into()),
                    method: None,
                    ok: None,
                    result: None,
                    payload: None,
                    error: None,
                });
            })?;
        Ok(Self {
            stdin: Some(stdin),
            responses: rx,
            next_id: 0,
            child,
        })
    }

    pub fn request(&mut self, method: &str, params: serde_json::Value) -> Result<u64> {
        self.next_id += 1;
        let request = Request {
            id: self.next_id,
            method,
            params,
        };
        let stdin = self.stdin.as_mut().context("bridge is shutting down")?;
        serde_json::to_writer(&mut *stdin, &request)?;
        stdin.write_all(b"\n")?;
        stdin.flush()?;
        Ok(self.next_id)
    }

    pub fn try_response(&self) -> Option<Response> {
        self.responses.try_recv().ok()
    }
}

impl Drop for EngineBridge {
    fn drop(&mut self) {
        // Closing stdin lets the TypeScript host dispose its services and finish
        // normally. Escalate only if it does not exit within two seconds.
        self.stdin.take();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn auton_home() -> String {
    std::env::var("AUTON_STORAGE_DIR").unwrap_or_else(|_| {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".into());
        format!("{home}/.auton")
    })
}
