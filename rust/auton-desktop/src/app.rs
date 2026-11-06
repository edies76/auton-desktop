use crate::bridge::{EngineBridge, Response};
use anyhow::Result;
use auton_core::AutonCore;
use gpui::{
    App, Application, Bounds, Context, FocusHandle, KeyDownEvent, SharedString, Task, Window,
    WindowBounds, WindowOptions, div, prelude::*, px, rgb, size,
};
use serde_json::{Value, json};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

pub fn run() -> Result<()> {
    let project = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?);
    let bridge = EngineBridge::start()
        .ok()
        .map(|bridge| Arc::new(Mutex::new(bridge)));
    let project_path = project.display().to_string();
    Application::new().run(move |cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(1280.0), px(820.0)), cx);
        let project_path = project_path.clone();
        let engine = bridge.clone();
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            move |window, cx| {
                let view =
                    cx.new(|cx| AutonWindow::new(project_path.clone(), engine.clone(), window, cx));
                view.update(cx, |this, cx| this.start_polling(cx));
                view
            },
        )
        .expect("open Auton window");
        cx.activate(true);
    });
    Ok(())
}

struct AutonWindow {
    project: SharedString,
    focus_handle: FocusHandle,
    draft: String,
    engine: Option<Arc<Mutex<EngineBridge>>>,
    session_id: Option<String>,
    session_create_id: Option<u64>,
    session_file: PathBuf,
    events_request_id: Option<u64>,
    transcript: Vec<(String, String)>,
    active_workers: Vec<(String, String)>,
    status: SharedString,
    goal: SharedString,
    sprint_summary: SharedString,
    worker_summary: SharedString,
    evidence_summary: SharedString,
    poll_task: Option<Task<()>>,
    last_plan_refresh: Instant,
}

impl AutonWindow {
    fn new(
        project: String,
        engine: Option<Arc<Mutex<EngineBridge>>>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let (goal, sprint_summary, evidence_summary) = load_plan_summary(&project);
        let session_file = PathBuf::from(&project).join(".auton/native-session.json");
        let saved_session = fs::read_to_string(&session_file)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .and_then(|value| {
                value
                    .get("sessionId")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            });
        let status = if engine.is_some() {
            "Conectando con el runtime del agente…"
        } else {
            "Runtime no disponible: instala dependencias con pnpm install"
        };
        let mut this = Self {
            project: project.clone().into(),
            focus_handle: cx.focus_handle(),
            draft: String::new(),
            engine,
            session_id: None,
            session_create_id: None,
            session_file,
            events_request_id: None,
            transcript: vec![],
            active_workers: vec![],
            status: status.into(),
            goal: goal.into(),
            sprint_summary: sprint_summary.into(),
            worker_summary: "Esperando eventos del runtime".into(),
            evidence_summary: evidence_summary.into(),
            poll_task: None,
            last_plan_refresh: Instant::now(),
        };
        if let Some(engine) = &this.engine {
            match engine.lock() {
                Ok(mut engine) => {
                    let (method, params) = if let Some(session_id) = saved_session {
                        (
                            "session.resume",
                            json!({"workspacePath": project, "sessionId": session_id}),
                        )
                    } else {
                        ("session.create", json!({"workspacePath": project}))
                    };
                    match engine.request(method, params) {
                        Ok(id) => this.session_create_id = Some(id),
                        Err(error) => {
                            this.status = format!("No se pudo iniciar el agente: {error:#}").into()
                        }
                    }
                }
                Err(_) => this.status = "No se pudo abrir el puente al runtime".into(),
            }
        }
        this.focus_handle.focus(window);
        this
    }

    fn start_polling(&mut self, cx: &mut Context<Self>) {
        self.poll_task = Some(cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor()
                    .timer(Duration::from_millis(700))
                    .await;
                if this.update(cx, |this, cx| this.poll_runtime(cx)).is_err() {
                    break;
                }
            }
        }));
    }

    fn poll_runtime(&mut self, cx: &mut Context<Self>) {
        let Some(engine) = &self.engine else {
            return;
        };
        let Ok(mut engine) = engine.lock() else {
            self.status = "Se perdió el puente al runtime".into();
            cx.notify();
            return;
        };
        let mut messages = Vec::new();
        while let Some(message) = engine.try_response() {
            messages.push(message);
        }
        if let Some(session_id) = &self.session_id {
            if self.events_request_id.is_none() {
                if let Ok(id) = engine.request("session.events", json!({"sessionId": session_id})) {
                    self.events_request_id = Some(id);
                }
            }
        }
        drop(engine);
        for message in messages {
            self.apply_response(message);
        }
        if self.last_plan_refresh.elapsed() >= Duration::from_secs(2) {
            let (goal, sprints, evidence) = load_plan_summary(&self.project);
            self.goal = goal.into();
            self.sprint_summary = sprints.into();
            self.evidence_summary = evidence.into();
            self.last_plan_refresh = Instant::now();
        }
        cx.notify();
    }

    fn apply_response(&mut self, message: Response) {
        if let Some(event) = message.event.as_deref() {
            match event {
                "turn.completed" => {
                    self.status =
                        "El runtime completó el turno; revisa los eventos y la evidencia".into()
                }
                "turn.failed" => {
                    let error = message
                        .payload
                        .and_then(|p| p.get("error").cloned())
                        .map(error_text)
                        .unwrap_or_else(|| "error desconocido".into());
                    self.status = format!("El runtime reportó un error: {error}").into();
                }
                "bridge.closed" => self.status = "El proceso del runtime terminó".into(),
                _ => {}
            }
            return;
        }
        let Some(method) = message.method.as_deref() else {
            return;
        };
        match method {
            "session.create" | "session.resume" => {
                if message.ok == Some(true) {
                    self.session_id = message
                        .result
                        .as_ref()
                        .and_then(|result| result.get("sessionId"))
                        .and_then(Value::as_str)
                        .map(str::to_owned);
                    self.status = if self.session_id.is_some() {
                        if let Some(session_id) = &self.session_id {
                            if let Some(parent) = self.session_file.parent() {
                                let _ = fs::create_dir_all(parent);
                            }
                            let _ = fs::write(
                                &self.session_file,
                                serde_json::to_vec(&json!({"sessionId": session_id}))
                                    .unwrap_or_default(),
                            );
                        }
                        "Sesión real conectada".into()
                    } else {
                        "El runtime respondió sin identificador de sesión".into()
                    };
                } else {
                    if method == "session.resume" {
                        if let Some(engine) = &self.engine {
                            if let Ok(mut engine) = engine.lock() {
                                let _ = engine.request(
                                    "session.create",
                                    json!({"workspacePath": self.project.to_string()}),
                                );
                                self.status =
                                    "La sesión anterior no está disponible; iniciando una nueva…"
                                        .into();
                            }
                        }
                    } else {
                        self.status = format!(
                            "No se pudo iniciar la sesión: {}",
                            message.error.unwrap_or_else(|| "sin detalle".into())
                        )
                        .into();
                    }
                }
            }
            "session.send" => {
                if message.ok == Some(true) {
                    self.status = "Mensaje entregado al agente; siguiendo eventos reales…".into();
                } else {
                    self.status = format!(
                        "No se pudo enviar el mensaje: {}",
                        message.error.unwrap_or_else(|| "sin detalle".into())
                    )
                    .into();
                }
            }
            "session.events" => {
                self.events_request_id = None;
                if let Some(events) = message.result.and_then(|result| result.as_array().cloned()) {
                    for event in events {
                        self.apply_session_event(&event);
                    }
                }
            }
            _ => {}
        }
    }

    fn apply_session_event(&mut self, event: &Value) {
        match event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default()
        {
            "message.upserted" => {
                let Some(payload) = event.get("payload") else {
                    return;
                };
                let speaker = match payload.get("type").and_then(Value::as_str) {
                    Some("user") => "Tú",
                    Some("assistant") => "Auton",
                    _ => return,
                };
                let Some(content) = payload.get("content").and_then(Value::as_str) else {
                    return;
                };
                if content.trim().is_empty()
                    || self
                        .transcript
                        .iter()
                        .any(|entry| entry.0 == speaker && entry.1 == content)
                {
                    return;
                }
                self.transcript.push((speaker.into(), content.into()));
                if self.transcript.len() > 200 {
                    self.transcript.remove(0);
                }
            }
            "turn.completed" => self.status = "Turno completado por el runtime".into(),
            "turn.failed" => {
                let error = event
                    .get("payload")
                    .and_then(|payload| payload.get("error"))
                    .cloned()
                    .map(error_text)
                    .unwrap_or_else(|| "error desconocido".into());
                self.status = format!("Turno fallido: {error}").into();
            }
            "tool.updated" => self.apply_worker_event(event),
            _ => {}
        }
    }

    fn apply_worker_event(&mut self, event: &Value) {
        let Some(payload) = event.get("payload") else {
            return;
        };
        let is_worker = payload.get("agentType").and_then(Value::as_str) == Some("auton-worker")
            || payload.get("source").and_then(Value::as_str) == Some("subagent");
        let (Some(tool_id), Some(kind)) = (
            payload.get("toolCallId").and_then(Value::as_str),
            payload.get("kind").and_then(Value::as_str),
        ) else {
            return;
        };
        let index = self
            .active_workers
            .iter()
            .position(|worker| worker.0 == tool_id);
        if matches!(kind, "result" | "error") {
            if let Some(index) = index {
                self.active_workers.remove(index);
            }
        } else if is_worker && matches!(kind, "scheduled" | "started" | "progress") {
            let label = payload
                .get("description")
                .and_then(Value::as_str)
                .or_else(|| payload.get("agentType").and_then(Value::as_str))
                .unwrap_or("Worker Auton")
                .to_owned();
            if let Some(index) = index {
                self.active_workers[index].1 = label;
            } else {
                self.active_workers.push((tool_id.to_owned(), label));
            }
        }
        self.worker_summary = if self.active_workers.is_empty() {
            "No hay workers activos reportados".into()
        } else {
            self.active_workers
                .iter()
                .map(|(_, label)| label.as_str())
                .collect::<Vec<_>>()
                .join("\n")
                .into()
        };
    }

    fn handle_key(&mut self, event: &KeyDownEvent, window: &mut Window, cx: &mut Context<Self>) {
        let key = event.keystroke.key.as_str();
        if key == "enter" && !event.keystroke.modifiers.shift {
            self.send_content(window, cx);
        } else if key == "backspace" {
            self.draft.pop();
            cx.notify();
        } else if key == "escape" {
            self.draft.clear();
            cx.notify();
        } else if let Some(character) = event.keystroke.key_char.as_deref() {
            self.draft.push_str(character);
            cx.notify();
        }
    }

    fn send(&mut self, _: &gpui::ClickEvent, window: &mut Window, cx: &mut Context<Self>) {
        self.send_content(window, cx);
    }

    fn send_content(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let content = self.draft.trim().to_owned();
        if content.is_empty() {
            return;
        }
        let Some(session_id) = self.session_id.clone() else {
            self.status =
                "El agente aún no está listo; comprueba la configuración de proveedores".into();
            cx.notify();
            return;
        };
        self.draft.clear();
        let Some(engine) = &self.engine else {
            return;
        };
        match engine.lock() {
            Ok(mut engine) => match engine.request(
                "session.send",
                json!({"sessionId": session_id, "content": content}),
            ) {
                Ok(_) => self.status = "Enviando al orquestador…".into(),
                Err(error) => self.status = format!("No se pudo enviar: {error:#}").into(),
            },
            Err(_) => self.status = "Se perdió el puente al runtime".into(),
        }
        self.focus_handle.focus(window);
        cx.notify();
    }
}

impl Render for AutonWindow {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let transcript = self
            .transcript
            .iter()
            .map(|(speaker, text)| {
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .rounded_lg()
                    .bg(rgb(0x17191f))
                    .p_4()
                    .child(
                        div()
                            .text_sm()
                            .text_color(rgb(0x9ea3ad))
                            .child(speaker.clone()),
                    )
                    .child(
                        div()
                            .text_base()
                            .text_color(rgb(0xe8eaf0))
                            .child(text.clone()),
                    )
            })
            .collect::<Vec<_>>();
        div().flex().size_full().bg(rgb(0x0f1116)).text_color(rgb(0xe8eaf0)).child(
            div().id("sidebar").flex().w(px(260.0)).flex_col().gap_6().overflow_y_scroll().border_r_1().border_color(rgb(0x242832)).bg(rgb(0x12141a)).p_6()
                .child(div().text_xl().font_weight(gpui::FontWeight::BOLD).child("auton"))
                .child(div().text_xs().text_color(rgb(0x777e8c)).child("PROYECTO ACTUAL"))
                .child(div().text_sm().child(self.project.clone()))
                .child(div().mt_8().text_xs().text_color(rgb(0x777e8c)).child("OBJETIVO"))
                .child(div().rounded_md().bg(rgb(0x1a1d25)).p_3().text_sm().child(self.goal.clone()))
                .child(div().mt_4().text_xs().text_color(rgb(0x777e8c)).child("PLAN"))
                .child(div().rounded_md().bg(rgb(0x1a1d25)).p_3().text_sm().child(self.sprint_summary.clone()))
                .child(div().mt_4().text_xs().text_color(rgb(0x777e8c)).child("WORKERS"))
                .child(div().rounded_md().bg(rgb(0x1a1d25)).p_3().text_sm().child(self.worker_summary.clone()))
                .child(div().mt_4().text_xs().text_color(rgb(0x777e8c)).child("EVIDENCIA"))
                .child(div().rounded_md().bg(rgb(0x1a1d25)).p_3().text_xs().child(self.evidence_summary.clone()))
        ).child(
            div().flex().flex_1().flex_col().p_8().child(
                div().flex().items_center().justify_between().border_b_1().border_color(rgb(0x242832)).pb_5()
                    .child(div().text_lg().child("Espacio de trabajo"))
                    .child(div().text_xs().text_color(rgb(0x9ea3ad)).child(self.status.clone()))
            ).child(
                div().id("transcript").flex().flex_1().flex_col().gap_4().overflow_y_scroll().py_6().children(if transcript.is_empty() {
                    vec![div().mt_12().text_center().text_color(rgb(0x777e8c)).child("Cuéntale a Auton qué resultado necesitas. Aquí verás el trabajo y sus eventos reales.")]
                } else { transcript })
            ).child(
                div().flex().items_end().gap_3().rounded_xl().border_1().border_color(rgb(0x343946)).bg(rgb(0x17191f)).p_3()
                    .child(div().id("composer").track_focus(&self.focus_handle).on_key_down(cx.listener(Self::handle_key)).flex_1().min_h(px(64.0)).rounded_lg().bg(rgb(0x12141a)).p_3().text_base().text_color(rgb(0xd7dae2)).child(if self.draft.is_empty() { "Describe el resultado que necesitas…".to_string() } else { format!("{}▍", self.draft) }))
                    .child(div().id("send-button").cursor_pointer().rounded_lg().bg(rgb(0xe84a36)).px_5().py_3().text_sm().font_weight(gpui::FontWeight::BOLD).child("Enviar").on_click(cx.listener(Self::send)))
            )
        )
    }
}

fn load_plan_summary(project: &str) -> (String, String, String) {
    match AutonCore::open(project) {
        Ok(core) => {
            let goal = core
                .plan()
                .goal
                .as_ref()
                .map(|goal| goal.title.clone())
                .unwrap_or_else(|| "Aún no hay objetivo".into());
            let counts = core
                .plan()
                .items
                .iter()
                .fold([0usize; 6], |mut counts, item| {
                    let index = match item.status {
                        auton_core::SprintState::Ready => 0,
                        auton_core::SprintState::Running => 1,
                        auton_core::SprintState::Waiting => 2,
                        auton_core::SprintState::Blocked
                        | auton_core::SprintState::NotEvaluable => 3,
                        auton_core::SprintState::Done => 4,
                        auton_core::SprintState::Dropped => 5,
                    };
                    counts[index] += 1;
                    counts
                });
            let mut summary = format!(
                "{} encargos · {} listos · {} en curso · {} esperando · {} bloqueados · {} hechos · {} descartados",
                core.plan().items.len(),
                counts[0],
                counts[1],
                counts[2],
                counts[3],
                counts[4],
                counts[5]
            );
            for item in core.plan().items.iter().take(4) {
                summary.push_str(&format!(
                    "\n{} · {}",
                    status_label(&item.status),
                    item.title
                ));
            }
            let evidence = core
                .plan()
                .items
                .iter()
                .rev()
                .flat_map(|item| {
                    item.evidence
                        .iter()
                        .rev()
                        .map(move |proof| (item.title.as_str(), proof))
                })
                .take(3)
                .map(|(title, proof)| {
                    format!(
                        "{} · {}{}",
                        title,
                        proof.label,
                        proof
                            .reference
                            .as_deref()
                            .map(|reference| format!("\n{reference}"))
                            .unwrap_or_default()
                    )
                })
                .collect::<Vec<_>>()
                .join("\n\n");
            (
                goal,
                summary,
                if evidence.is_empty() {
                    "Todavía no hay evidencia registrada".into()
                } else {
                    evidence
                },
            )
        }
        Err(error) => (
            "No se pudo leer el plan".into(),
            format!("Error de plan: {error}"),
            format!("No se pudo leer la evidencia: {error}"),
        ),
    }
}

fn status_label(status: &auton_core::SprintState) -> &'static str {
    match status {
        auton_core::SprintState::Ready => "listo",
        auton_core::SprintState::Running => "en curso",
        auton_core::SprintState::Waiting => "espera",
        auton_core::SprintState::Blocked => "bloqueado",
        auton_core::SprintState::Done => "hecho",
        auton_core::SprintState::Dropped => "descartado",
        auton_core::SprintState::NotEvaluable => "requiere revisión",
    }
}

fn error_text(error: Value) -> String {
    error
        .as_str()
        .map(str::to_owned)
        .or_else(|| {
            error
                .get("message")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| error.to_string())
}
