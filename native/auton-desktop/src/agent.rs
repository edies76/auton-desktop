use crossbeam_channel::{Receiver, Sender, bounded, unbounded};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

enum CommandMessage {
    Connect(PathBuf),
    Send(String),
    SetModel(String, Value),
    RespondPermission(Value, bool),
    RespondUserInput(Value, Value),
    Stop,
}

#[derive(Clone, Debug)]
pub struct WorkerEvent {
    pub id: String,
    pub label: String,
    pub detail: String,
    pub active: bool,
}

#[derive(Clone, Debug)]
pub struct PendingPermission {
    pub id: Value,
    pub tool_name: String,
    pub reason: String,
    pub risk_level: String,
    pub input: Value,
}

#[derive(Clone, Debug)]
pub struct UserInputOption {
    pub label: String,
    pub description: String,
}

#[derive(Clone, Debug)]
pub struct UserInputQuestion {
    pub header: String,
    pub question: String,
    pub options: Vec<UserInputOption>,
    pub multi_select: bool,
}

#[derive(Clone, Debug)]
pub struct PendingUserInput {
    pub id: Value,
    pub prompt: String,
    pub tool_name: String,
    pub plan_approval: bool,
    pub questions: Vec<UserInputQuestion>,
}

#[derive(Clone, Debug)]
pub struct ModelChoice {
    pub selection: Value,
    pub key: String,
    pub label: String,
    pub provider: String,
    pub disabled_reason: Option<String>,
}

#[derive(Clone, Debug)]
pub enum AgentEvent {
    Connected { session_id: String, models: Vec<ModelChoice>, current_model: Option<Value> },
    ModelChanged(Value),
    AssistantDelta(String),
    AssistantMessage(String),
    Worker(WorkerEvent),
    Permission(PendingPermission),
    UserInput(PendingUserInput),
    TurnFinished,
    TurnFailed(String),
    Status(String),
    Error(String),
}

pub struct AgentBridge {
    commands: Sender<CommandMessage>,
    events: Receiver<AgentEvent>,
}

impl AgentBridge {
    pub fn start() -> Self {
        let (commands_tx, commands_rx) = unbounded();
        let (events_tx, events_rx) = unbounded();
        thread::Builder::new()
            .name("auton-agent-host".into())
            .spawn(move || run_host(commands_rx, events_tx))
            .expect("could not start the Auton agent host thread");
        Self { commands: commands_tx, events: events_rx }
    }

    pub fn connect(&self, workspace: PathBuf) {
        let _ = self.commands.send(CommandMessage::Connect(workspace));
    }

    pub fn send(&self, text: String) {
        let _ = self.commands.send(CommandMessage::Send(text));
    }

    pub fn set_model(&self, session_id: String, model: Value) {
        let _ = self.commands.send(CommandMessage::SetModel(session_id, model));
    }

    pub fn respond_permission(&self, id: Value, allow: bool) {
        let _ = self.commands.send(CommandMessage::RespondPermission(id, allow));
    }

    pub fn respond_user_input(&self, id: Value, result: Value) {
        let _ = self.commands.send(CommandMessage::RespondUserInput(id, result));
    }

    pub fn try_recv(&self) -> Result<AgentEvent, crossbeam_channel::TryRecvError> {
        self.events.try_recv()
    }
}

struct RpcClient {
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>,
    next_id: AtomicU64,
}

impl RpcClient {
    fn with_streams(stdin: ChildStdin, stdout: std::process::ChildStdout, events: Sender<AgentEvent>) -> Self {
        let pending: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));
        let reader_pending = Arc::clone(&pending);
        let stdin = Arc::new(Mutex::new(stdin));
        let reader_stdin = Arc::clone(&stdin);
        thread::Builder::new()
            .name("auton-agent-protocol-reader".into())
            .spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    let Ok(line) = line else { break; };
                    let Ok(message) = serde_json::from_str::<Value>(&line) else {
                        let _ = events.send(AgentEvent::Error("El agente envió una línea de protocolo inválida".into()));
                        continue;
                    };
                    if let Some(id) = message.get("id") {
                        if let Some(method) = message.get("method").and_then(Value::as_str) {
                            if method == "interaction/requestPermission" {
                                let params = message.get("params").unwrap_or(&Value::Null);
                                let _ = events.send(AgentEvent::Permission(PendingPermission {
                                    id: id.clone(),
                                    tool_name: params.get("toolName").and_then(Value::as_str).unwrap_or("herramienta").to_owned(),
                                    reason: params.get("reason").and_then(Value::as_str).unwrap_or("El agente solicita autorización para continuar.").to_owned(),
                                    risk_level: params.get("riskLevel").and_then(Value::as_str).unwrap_or("unknown").to_owned(),
                                    input: params.get("input").cloned().unwrap_or(Value::Null),
                                }));
                                continue;
                            }
                            if method == "interaction/requestUserInput" {
                                let params = message.get("params").unwrap_or(&Value::Null);
                                let questions = params.get("questions").and_then(Value::as_array).into_iter().flatten().map(|question| {
                                    let options = question.get("options").and_then(Value::as_array).into_iter().flatten().map(|option| UserInputOption {
                                        label: option.get("label").and_then(Value::as_str).unwrap_or("Opción").to_owned(),
                                        description: option.get("description").and_then(Value::as_str).unwrap_or("").to_owned(),
                                    }).collect();
                                    UserInputQuestion {
                                        header: question.get("header").and_then(Value::as_str).unwrap_or("Pregunta").to_owned(),
                                        question: question.get("question").and_then(Value::as_str).unwrap_or("El orquestador necesita una respuesta.").to_owned(),
                                        options,
                                        multi_select: question.get("multiSelect").and_then(Value::as_bool).unwrap_or(false),
                                    }
                                }).collect();
                                let schema = params.get("schema").unwrap_or(&Value::Null);
                                let _ = events.send(AgentEvent::UserInput(PendingUserInput {
                                    id: id.clone(),
                                    prompt: params.get("prompt").and_then(Value::as_str).unwrap_or("").to_owned(),
                                    tool_name: params.get("toolName").and_then(Value::as_str).unwrap_or("AskUserQuestion").to_owned(),
                                    plan_approval: schema.get("interaction").and_then(Value::as_str) == Some("plan_approval"),
                                    questions,
                                }));
                                continue;
                            }
                            let reply = json!({"jsonrpc":"2.0", "id":id, "error":{"code":-32601, "message":format!("Auton Desktop nativo aún no implementa {method}")}});
                            let _ = write_message(&reader_stdin, reply);
                            continue;
                        }
                    }
                    if let Some(id) = message.get("id").and_then(Value::as_u64) {
                        let waiter = reader_pending.lock().ok().and_then(|mut map| map.remove(&id));
                        if let Some(waiter) = waiter {
                            let value = if let Some(error) = message.get("error") {
                                Err(error.get("message").and_then(Value::as_str).unwrap_or("Error del agente").to_owned())
                            } else {
                                Ok(message.get("result").cloned().unwrap_or(Value::Null))
                            };
                            let _ = waiter.send(value);
                        }
                        continue;
                    }
                    if message.get("method").and_then(Value::as_str) == Some("session/event") {
                        if let Some(params) = message.get("params") { forward_session_event(params, &events); }
                    }
                }
                let _ = events.send(AgentEvent::Error("Se cerró la conexión con el proceso del agente".into()));
            })
            .expect("could not start the protocol reader");
        Self { stdin, pending, next_id: AtomicU64::new(1) }
    }

    fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = bounded(1);
        self.pending.lock().map_err(|_| "Protocol wait map is poisoned".to_owned())?.insert(id, tx);
        let wire = json!({"jsonrpc":"2.0", "id":id, "method":method, "params":params});
        let write_result = write_message(&self.stdin, wire);
        if let Err(error) = write_result {
            self.pending.lock().ok().and_then(|mut map| map.remove(&id));
            return Err(format!("No pude enviar una orden al agente: {error}"));
        }
        match rx.recv_timeout(Duration::from_secs(30)) {
            Ok(result) => result,
            Err(_) => {
                self.pending.lock().ok().and_then(|mut map| map.remove(&id));
                Err(format!("El agente no respondió a `{method}` en 30 segundos"))
            }
        }
    }

    fn respond(&self, id: Value, allow: bool) -> Result<(), String> {
        let decision = if allow { "allow" } else { "deny" };
        write_message(&self.stdin, json!({"jsonrpc":"2.0", "id":id, "result":{"decision":decision}}))
    }

    fn respond_user_input(&self, id: Value, result: Value) -> Result<(), String> {
        write_message(&self.stdin, json!({"jsonrpc":"2.0", "id":id, "result":result}))
    }
}

fn write_message(stdin: &Arc<Mutex<ChildStdin>>, wire: Value) -> Result<(), String> {
    stdin.lock().map_err(|_| "Agent stdin is unavailable".to_owned()).and_then(|mut stdin| {
        serde_json::to_writer(&mut *stdin, &wire).map_err(|error| error.to_string())?;
        stdin.write_all(b"\n").map_err(|error| error.to_string())?;
        stdin.flush().map_err(|error| error.to_string())
    })
}

fn run_host(commands: Receiver<CommandMessage>, events: Sender<AgentEvent>) {
    let mut child: Option<Child> = None;
    let mut rpc: Option<RpcClient> = None;
    let mut session_id: Option<String> = None;
    loop {
        match commands.recv() {
            Ok(CommandMessage::Connect(workspace)) => {
                if let Some(mut old) = child.take() {
                    let _ = old.kill();
                    let _ = old.wait();
                }
                rpc = None;
                session_id = None;
                match connect_agent(&workspace, events.clone()) {
                    Ok((process, client, session, models, current_model)) => {
                        child = Some(process);
                        session_id = Some(session.clone());
                        rpc = Some(client);
                        let _ = events.send(AgentEvent::Connected { session_id: session, models, current_model });
                    }
                    Err(error) => { let _ = events.send(AgentEvent::Error(error)); }
                }
            }
            Ok(CommandMessage::Send(text)) => {
                let (Some(client), Some(session)) = (&rpc, &session_id) else {
                    let _ = events.send(AgentEvent::Error("El orquestador todavía no está conectado".into()));
                    continue;
                };
                let _ = events.send(AgentEvent::Status("Enviando el objetivo al orquestador…".into()));
                match client.request("session/send", json!({"sessionId":session,"content":text})) {
                    Ok(_) => { let _ = events.send(AgentEvent::Status("El orquestador recibió tu mensaje".into())); }
                    Err(error) => { let _ = events.send(AgentEvent::Error(error)); }
                }
            }
            Ok(CommandMessage::RespondPermission(id, allow)) => {
                if let Some(client) = &rpc {
                    if let Err(error) = client.respond(id, allow) {
                        let _ = events.send(AgentEvent::Error(format!("No pude responder la autorización: {error}")));
                    }
                }
            }
            Ok(CommandMessage::RespondUserInput(id, result)) => {
                if let Some(client) = &rpc {
                    if let Err(error) = client.respond_user_input(id, result) {
                        let _ = events.send(AgentEvent::Error(format!("No pude responder la pregunta del orquestador: {error}")));
                    }
                }
            }
            Ok(CommandMessage::SetModel(session, model)) => {
                if let Some(client) = &rpc {
                    match client.request("session/setModel", json!({"sessionId":session,"model":model.clone(),"persistAsWorkspaceLastUsed":true})) {
                        Ok(_) => { let _ = events.send(AgentEvent::ModelChanged(model)); }
                        Err(error) => { let _ = events.send(AgentEvent::Error(format!("No pude cambiar el proveedor/modelo: {error}"))); }
                    }
                }
            }
            Ok(CommandMessage::Stop) | Err(_) => {
                if let Some(mut process) = child.take() {
                    let _ = process.kill();
                    let _ = process.wait();
                }
                break;
            }
        }
    }
}

fn connect_agent(workspace: &PathBuf, events: Sender<AgentEvent>) -> Result<(Child, RpcClient, String, Vec<ModelChoice>, Option<Value>), String> {
    if !workspace.is_dir() {
        return Err(format!("La carpeta de proyecto no existe: {}", workspace.display()));
    }
    let workspace = workspace.canonicalize().map_err(|error| format!("No pude abrir la carpeta: {error}"))?;
    let executable = std::env::var_os("AUTON_AGENT_BIN").unwrap_or_else(|| "zcode".into());
    let args = std::env::var("AUTON_AGENT_ARGS_JSON")
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<String>>(&raw).ok())
        .unwrap_or_else(|| std::env::var("AUTON_AGENT_ARGS").unwrap_or_else(|_| "app-server --stdio".into()).split_whitespace().map(str::to_owned).collect());
    let mut command = Command::new(&executable);
    command.args(args);
    command.current_dir(&workspace).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit());
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        let auton_dir = PathBuf::from(home).join(".auton");
        command.env("AUTON_STORAGE_DIR", auton_dir);
    }
    command.env("AUTON_DATA_DIR_NAME", ".auton");
    let mut process = command.spawn().map_err(|error| {
        format!("No pude iniciar `{}`. Instala/compila el agente ZCode y configura AUTON_AGENT_BIN si hace falta. Detalle: {error}", PathBuf::from(executable).display())
    })?;
    let stdin = match process.stdin.take() {
        Some(stdin) => stdin,
        None => {
            let _ = process.kill();
            let _ = process.wait();
            return Err("El agente no abrió stdin".into());
        }
    };
    let stdout = match process.stdout.take() {
        Some(stdout) => stdout,
        None => {
            let _ = process.kill();
            let _ = process.wait();
            return Err("El agente no abrió stdout".into());
        }
    };
    let client = RpcClient::with_streams(stdin, stdout, events.clone());
    let session = (|| {
        client.request("runtime/capabilities", json!({})).map_err(|error| format!("El agente arrancó, pero rechazó el protocolo: {error}"))?;
        let workspace_ref = workspace.to_string_lossy().into_owned();
        let create = client.request("session/create", json!({
            "workspace": {"workspacePath":workspace_ref,"workspaceKey":workspace_ref}
        })).map_err(|error| format!("No pude crear la sesión del orquestador: {error}"))?;
        let session = create.pointer("/session/sessionId").and_then(Value::as_str).ok_or("El agente no devolvió session.sessionId al crear la sesión")?.to_owned();
        let model_rows = create.pointer("/settings/model/available").and_then(Value::as_array).cloned().unwrap_or_default();
        let models = model_rows.into_iter().filter_map(|entry| {
            let selection = entry.get("ref")?.clone();
            let key = serde_json::to_string(&selection).ok()?;
            Some(ModelChoice {
                selection,
                key,
                label: entry.get("label").and_then(Value::as_str).unwrap_or("Modelo").to_owned(),
                provider: entry.get("providerLabel").and_then(Value::as_str).unwrap_or("Proveedor").to_owned(),
                disabled_reason: entry.get("disabledReason").and_then(Value::as_str).map(str::to_owned),
            })
        }).collect();
        let current_model = create.pointer("/settings/model/current").cloned();
        client.request("session/subscribe", json!({"sessionId":session,"deliveryKind":"desktop-continuous","afterSeq":0,"includeSnapshot":true}))
            .map_err(|error| format!("La sesión se creó, pero no pude escuchar sus eventos: {error}"))?;
        Ok((session, models, current_model))
    })();
    let session = match session {
        Ok(session) => session,
        Err(error) => {
            let _ = process.kill();
            let _ = process.wait();
            return Err(error);
        }
    };
    let (session, models, current_model) = session;
    Ok((process, client, session, models, current_model))
}

fn forward_session_event(event: &Value, events: &Sender<AgentEvent>) {
    let kind = event.get("type").and_then(Value::as_str).unwrap_or_default();
    let payload = event.get("payload").unwrap_or(&Value::Null);
    match kind {
        "part.delta" if payload.get("field").and_then(Value::as_str).unwrap_or("text") == "text" => {
            if let Some(delta) = payload.get("delta").and_then(Value::as_str) {
                let _ = events.send(AgentEvent::AssistantDelta(delta.to_owned()));
            }
        }
        "message.upserted" => {
            let role = payload.get("type").and_then(Value::as_str).unwrap_or_default();
            if role == "assistant" {
                if let Some(text) = payload.get("content").and_then(Value::as_str) {
                    let _ = events.send(AgentEvent::AssistantMessage(text.to_owned()));
                }
            }
        }
        "tool.updated" => {
            let name = payload.get("toolName").and_then(Value::as_str).unwrap_or("Worker");
            let state = payload.get("kind").and_then(Value::as_str).unwrap_or("actualizado");
            let is_worker = payload.get("source").and_then(Value::as_str) == Some("subagent")
                || payload.get("childSessionId").and_then(Value::as_str).is_some();
            if is_worker {
                let id = payload.get("toolCallId").and_then(Value::as_str).unwrap_or(name).to_owned();
                let active = !matches!(state, "result" | "error");
                let detail = match state {
                    "scheduled" => "En cola".to_owned(),
                    "started" => "Trabajando".to_owned(),
                    "progress" => "En progreso".to_owned(),
                    "result" => "Completado".to_owned(),
                    "error" => "Falló".to_owned(),
                    _ => state.to_owned(),
                };
                let _ = events.send(AgentEvent::Worker(WorkerEvent { id, label: name.to_owned(), detail, active }));
            }
        }
        "turn.completed" => { let _ = events.send(AgentEvent::TurnFinished); }
        "turn.failed" => {
            let message = payload.pointer("/error/message").and_then(Value::as_str).unwrap_or("El turno del orquestador falló");
            let _ = events.send(AgentEvent::TurnFailed(message.to_owned()));
        }
        "permission.requested" => {
            let tool = payload.get("toolName").and_then(Value::as_str).unwrap_or("una herramienta");
            let _ = events.send(AgentEvent::Status(format!("El orquestador solicita permiso para {tool}")));
        }
        _ => {}
    }
}

impl Drop for AgentBridge {
    fn drop(&mut self) { let _ = self.commands.send(CommandMessage::Stop); }
}
