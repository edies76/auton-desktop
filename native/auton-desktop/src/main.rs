mod agent;

use agent::{AgentBridge, AgentEvent, ModelChoice, PendingPermission, PendingUserInput, WorkerEvent};
use eframe::egui::{self, Align, Color32, FontId, Layout, RichText, Stroke, Vec2};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::collections::VecDeque;
use std::time::{Duration, Instant};

const BG: Color32 = Color32::from_rgb(15, 16, 18);
const PANEL: Color32 = Color32::from_rgb(22, 23, 26);
const PANEL_HI: Color32 = Color32::from_rgb(29, 30, 34);
const LINE: Color32 = Color32::from_rgb(46, 47, 51);
const TEXT: Color32 = Color32::from_rgb(238, 237, 234);
const MUTED: Color32 = Color32::from_rgb(151, 151, 153);
const LIME: Color32 = Color32::from_rgb(190, 232, 122);
const ORANGE: Color32 = Color32::from_rgb(242, 164, 111);

#[derive(Clone)]
struct Message {
    role: Role,
    body: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Role {
    User,
    Orchestrator,
    Worker,
    System,
}

struct AutonApp {
    bridge: AgentBridge,
    workspace: String,
    session_id: Option<String>,
    connected: bool,
    connecting: bool,
    busy: bool,
    status: String,
    composer: String,
    messages: Vec<Message>,
    workers: Vec<WorkerEvent>,
    models: Vec<ModelChoice>,
    selected_model_key: Option<String>,
    selected_model_label: String,
    pending_model_key: Option<String>,
    pending_permissions: VecDeque<PendingPermission>,
    pending_user_inputs: VecDeque<PendingUserInput>,
    user_input_answers: HashMap<String, Vec<String>>,
    stream_target: Option<usize>,
    plan_summary: Option<(String, usize, usize)>,
    next_plan_check: Instant,
    selected_panel: Panel,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Panel {
    Plan,
    Evidence,
    Workers,
}

impl Default for AutonApp {
    fn default() -> Self {
        let workspace = std::env::var("AUTON_WORKSPACE")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default().display().to_string());
        Self {
            bridge: AgentBridge::start(),
            workspace,
            session_id: None,
            connected: false,
            connecting: false,
            busy: false,
            status: "Elige una carpeta de proyecto para conectar el orquestador".into(),
            composer: String::new(),
            messages: Vec::new(),
            workers: Vec::new(),
            models: Vec::new(),
            selected_model_key: None,
            selected_model_label: "Modelo del proyecto".into(),
            pending_model_key: None,
            pending_permissions: VecDeque::new(),
            pending_user_inputs: VecDeque::new(),
            user_input_answers: HashMap::new(),
            stream_target: None,
            plan_summary: None,
            next_plan_check: Instant::now(),
            selected_panel: Panel::Plan,
        }
    }
}

impl eframe::App for AutonApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        configure_theme(ctx);
        self.drain_agent_events();
        if Instant::now() >= self.next_plan_check {
            self.read_plan();
            self.next_plan_check = Instant::now() + Duration::from_secs(2);
        }
        ctx.request_repaint_after(Duration::from_millis(100));

        egui::TopBottomPanel::top("window-header")
            .exact_height(48.0)
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::symmetric(18, 8)))
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    mark(ui, 10.0);
                    ui.add_space(8.0);
                    ui.label(RichText::new("AUTON").size(13.0).strong().color(TEXT));
                    ui.add_space(12.0);
                    ui.label(RichText::new("/ ").color(MUTED));
                    ui.label(RichText::new("Espacio de trabajo").size(12.0).color(MUTED));
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        let active_workers = self.workers.iter().filter(|worker| worker.active).count();
                        let mut model_selection = None;
                        ui.add_enabled_ui(self.connected && self.pending_model_key.is_none(), |ui| {
                            egui::ComboBox::from_id_salt("provider-model")
                                .selected_text(if self.pending_model_key.is_some() { "Cambiando modelo…" } else { &self.selected_model_label })
                                .width(220.0)
                                .show_ui(ui, |ui| {
                                    if self.models.is_empty() {
                                        ui.label(RichText::new("Configura un proveedor en Auton/ZCode").size(10.0).color(MUTED));
                                    }
                                    for model in &self.models {
                                        let label = format!("{} · {}", model.provider, model.label);
                                        let selected = self.selected_model_key.as_deref() == Some(model.key.as_str());
                                        let enabled = model.disabled_reason.is_none();
                                        let mut clicked = false;
                                        ui.add_enabled_ui(enabled, |ui| {
                                            clicked = ui.selectable_label(selected, &label).clicked();
                                        });
                                        if clicked {
                                            model_selection = Some((model.key.clone(), model.selection.clone(), label));
                                        }
                                        if let Some(reason) = &model.disabled_reason {
                                            ui.label(RichText::new(reason).size(9.0).color(MUTED));
                                        }
                                    }
                                });
                        });
                        if let Some((key, selection, label)) = model_selection {
                            if let Some(session_id) = &self.session_id {
                                self.pending_model_key = Some(key);
                                self.status = format!("Cambiando al modelo {label}…");
                                self.bridge.set_model(session_id.clone(), selection);
                            }
                        }
                        if active_workers > 0 {
                            pill(ui, &format!("{active_workers} WORKERS"), true);
                        }
                        pill(ui, if self.connected { "ORQUESTADOR ACTIVO" } else { "SIN CONEXIÓN" }, self.connected);
                    });
                });
            });

        egui::SidePanel::left("projects")
            .exact_width(232.0)
            .resizable(false)
            .frame(egui::Frame::new().fill(PANEL).inner_margin(egui::Margin::same(14)))
            .show(ctx, |ui| self.project_sidebar(ui));

        egui::SidePanel::right("inspector")
            .exact_width(278.0)
            .resizable(false)
            .frame(egui::Frame::new().fill(PANEL).inner_margin(egui::Margin::same(16)))
            .show(ctx, |ui| self.inspector(ui));

        egui::CentralPanel::default()
            .frame(egui::Frame::new().fill(BG).inner_margin(egui::Margin::symmetric(28, 20)))
            .show(ctx, |ui| self.conversation(ui));

        self.permission_dialog(ctx);
        self.user_input_dialog(ctx);
    }
}

impl AutonApp {
    fn project_sidebar(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label(RichText::new("PROYECTO").size(10.0).strong().color(MUTED));
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.label(RichText::new("⌘ K").size(10.0).color(MUTED));
            });
        });
        ui.add_space(13.0);
        if ui.add(egui::Button::new(RichText::new("▱   Abrir proyecto…").size(11.0).color(TEXT)).fill(PANEL_HI).stroke(Stroke::new(1.0, LINE)).corner_radius(egui::CornerRadius::same(8))).clicked() {
            if let Some(folder) = rfd::FileDialog::new().set_title("Seleccionar carpeta del proyecto").pick_folder() {
                self.workspace = folder.display().to_string();
                self.connected = false;
                self.session_id = None;
                self.messages.clear();
                self.workers.clear();
                self.models.clear();
                self.selected_model_key = None;
                self.selected_model_label = "Modelo del proyecto".into();
                self.status = "Proyecto seleccionado. Conecta el orquestador para continuar.".into();
                self.read_plan();
            }
        }
        ui.add_space(8.0);
        ui.label(RichText::new("CARPETA LOCAL").size(9.0).strong().color(MUTED));
        ui.add_space(5.0);
        egui::TextEdit::singleline(&mut self.workspace)
            .hint_text("Ruta de la carpeta")
            .desired_width(f32::INFINITY)
            .show(ui);
        ui.add_space(7.0);
        let connect_label = if self.connected {
            "Reconectar agente"
        } else if self.connecting {
            "Conectando…"
        } else {
            "Conectar orquestador"
        };
        if ui.add_enabled(!self.connecting, primary_button(connect_label)).clicked() {
            let path = PathBuf::from(self.workspace.trim());
            self.connecting = true;
            self.connected = false;
            self.busy = false;
            self.session_id = None;
            self.models.clear();
            self.selected_model_key = None;
            self.selected_model_label = "Conectando…".into();
            self.pending_model_key = None;
            self.messages.clear();
            self.workers.clear();
            self.pending_permissions.clear();
            self.pending_user_inputs.clear();
            self.user_input_answers.clear();
            self.stream_target = None;
            self.status = "Iniciando el agente de Auton…".into();
            self.bridge.connect(path);
        }
        ui.add_space(15.0);
        ui.separator();
        ui.add_space(13.0);
        ui.label(RichText::new("VISTA").size(10.0).strong().color(MUTED));
        ui.add_space(8.0);
        section_button(ui, "◉", "Conversación", true);
        if section_button(ui, "▤", "Plan del orquestador", self.selected_panel == Panel::Plan) {
            self.selected_panel = Panel::Plan;
        }
        if section_button(ui, "◌", "Workers", self.selected_panel == Panel::Workers) {
            self.selected_panel = Panel::Workers;
        }
        ui.with_layout(Layout::bottom_up(Align::Min), |ui| {
            ui.separator();
            ui.add_space(12.0);
            ui.label(RichText::new("AUTON NATIVO · PREVIEW").size(9.0).color(MUTED));
            ui.add_space(5.0);
            ui.label(RichText::new("Los proveedores se leen desde la configuración local de Auton.").size(10.0).color(MUTED));
        });
    }

    fn conversation(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(RichText::new(project_name(&self.workspace)).size(20.0).strong().color(TEXT));
                ui.add_space(2.0);
                ui.label(RichText::new(short_path(&self.workspace)).size(11.0).color(MUTED));
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if !self.workers.is_empty() {
                    pill(ui, &format!("{} WORKERS", self.workers.len()), true);
                }
            });
        });
        ui.add_space(18.0);
        ui.separator();
        ui.add_space(13.0);
        ui.label(RichText::new(&self.status).size(11.0).color(MUTED));
        ui.add_space(8.0);

        egui::ScrollArea::vertical()
            .id_salt("conversation-scroll")
            .stick_to_bottom()
            .auto_shrink([false, false])
            .show(ui, |ui| {
                ui.set_width(ui.available_width());
                if self.messages.is_empty() {
                    self.empty_conversation(ui);
                }
                let mut remove_stream = false;
                for message in &self.messages {
                    render_message(ui, message);
                }
                if let Some(index) = self.stream_target {
                    if self.messages.get(index).is_some_and(|m| m.body.is_empty()) {
                        ui.label(RichText::new("  ◦  pensando").size(11.0).color(MUTED));
                    }
                    if !self.busy { remove_stream = true; }
                }
                if remove_stream { self.stream_target = None; }
            });

        ui.add_space(12.0);
        egui::Frame::new()
            .fill(PANEL)
            .stroke(Stroke::new(1.0, LINE))
            .corner_radius(egui::CornerRadius::same(14))
            .inner_margin(egui::Margin::symmetric(14, 10))
            .show(ui, |ui| {
                ui.add_enabled_ui(self.connected && !self.busy, |ui| {
                    let response = ui.add(
                        egui::TextEdit::multiline(&mut self.composer)
                            .desired_rows(2)
                            .hint_text(if self.connected { "Cuéntale al orquestador qué quieres lograr…" } else { "Conecta el orquestador para empezar" })
                            .frame(false)
                            .desired_width(f32::INFINITY),
                    );
                    let enter_send = response.has_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter) && !i.modifiers.shift);
                    ui.add_space(5.0);
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(if self.busy { "El orquestador está trabajando" } else { "Shift + Enter para nueva línea" }).size(10.0).color(MUTED));
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if ui.add_enabled(!self.composer.trim().is_empty() && self.connected && !self.busy, primary_button("Enviar  ↗")).clicked() || enter_send {
                                self.send_message();
                            }
                        });
                    });
                });
            });
    }

    fn empty_conversation(&mut self, ui: &mut egui::Ui) {
        ui.add_space(70.0);
        ui.vertical_centered(|ui| {
            mark(ui, 22.0);
            ui.add_space(17.0);
            ui.label(RichText::new("¿Qué quieres construir?").size(27.0).strong().color(TEXT));
            ui.add_space(8.0);
            ui.label(RichText::new("Habla con Auton. El orquestador define el trabajo y dirige a sus workers.").size(13.0).color(MUTED));
            ui.add_space(23.0);
            ui.horizontal_wrapped(|ui| {
                if suggestion(ui, "Revisa este proyecto y dime qué mejorarías") {
                    self.composer = "Revisa este proyecto y dime qué mejorarías".into();
                }
                if suggestion(ui, "Ayúdame a investigar un error") {
                    self.composer = "Ayúdame a investigar un error".into();
                }
            });
        });
    }

    fn inspector(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label(RichText::new("EN CURSO").size(10.0).strong().color(MUTED));
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                ui.label(RichText::new("●").size(9.0).color(if self.busy { ORANGE } else { MUTED }));
            });
        });
        ui.add_space(13.0);
        ui.label(RichText::new(if self.busy { "Trabajo activo" } else { "Sin trabajo activo" }).size(15.0).strong().color(TEXT));
        ui.add_space(6.0);
        ui.label(RichText::new(if self.connected { "El orquestador recibe tus objetivos." } else { "Conecta el agente para ver sesiones y workers." }).size(11.0).color(MUTED));
        ui.add_space(18.0);
        ui.separator();
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if tab(ui, "Plan", self.selected_panel == Panel::Plan) { self.selected_panel = Panel::Plan; }
            if tab(ui, "Evidencia", self.selected_panel == Panel::Evidence) { self.selected_panel = Panel::Evidence; }
            if tab(ui, "Workers", self.selected_panel == Panel::Workers) { self.selected_panel = Panel::Workers; }
        });
        ui.add_space(13.0);
        match self.selected_panel {
            Panel::Plan => self.render_plan(ui),
            Panel::Evidence => {
                info_card(ui, "Evidencia", "La evidencia aparecerá cuando el orquestador cierre o verifique trabajo.");
            }
            Panel::Workers => {
                if self.workers.is_empty() {
                    info_card(ui, "Workers", "Los encargos delegados aparecerán aquí cuando el orquestador los inicie.");
                } else {
                    for worker in self.workers.iter().rev() {
                        info_card(ui, &format!("{} · {}", worker.label, if worker.active { "Activo" } else { "Finalizado" }), &worker.detail);
                        ui.add_space(7.0);
                    }
                }
            }
        }
        if self.selected_panel != Panel::Workers && self.workers.iter().any(|worker| worker.active) {
            ui.add_space(18.0);
            ui.separator();
            ui.add_space(12.0);
            ui.label(RichText::new("WORKERS ACTIVOS").size(10.0).strong().color(MUTED));
            ui.add_space(8.0);
            for worker in self.workers.iter().filter(|worker| worker.active).rev().take(4) {
                info_card(ui, &format!("◌ {}", worker.label), &worker.detail);
                ui.add_space(7.0);
            }
        }
    }

    fn render_plan(&self, ui: &mut egui::Ui) {
        if let Some((goal, total, active)) = &self.plan_summary {
            info_card(ui, "OBJETIVO", goal);
            ui.add_space(9.0);
            ui.horizontal(|ui| {
                mini_stat(ui, "UNIDADES", &total.to_string());
                mini_stat(ui, "ACTIVAS", &active.to_string());
            });
        } else {
            info_card(ui, "PLAN", "Aún no hay un plan guardado en .auton/plan.json para este proyecto.");
        }
    }

    fn send_message(&mut self) {
        let text = self.composer.trim().to_owned();
        if text.is_empty() || !self.connected || self.busy { return; }
        self.messages.push(Message { role: Role::User, body: text.clone() });
        self.messages.push(Message { role: Role::Orchestrator, body: String::new() });
        self.stream_target = Some(self.messages.len() - 1);
        self.composer.clear();
        self.busy = true;
        self.status = "El orquestador está trabajando…".into();
        self.bridge.send(text);
    }

    fn permission_dialog(&mut self, ctx: &egui::Context) {
        if !self.pending_user_inputs.is_empty() { return; }
        let Some(permission) = self.pending_permissions.front() else { return; };
        let id = permission.id.clone();
        let mut decision = None;
        egui::Window::new("Autorización requerida")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
            .show(ctx, |ui| {
                ui.set_width(420.0);
                ui.label(RichText::new(&permission.tool_name).size(14.0).strong().color(TEXT));
                ui.add_space(4.0);
                ui.label(RichText::new(format!("Riesgo: {}", permission.risk_level)).size(10.0).strong().color(ORANGE));
                ui.add_space(8.0);
                ui.label(RichText::new(&permission.reason).size(12.0).color(TEXT));
                ui.add_space(8.0);
                let input = serde_json::to_string_pretty(&permission.input).unwrap_or_else(|_| "(sin detalles)".into());
                let input = if input.chars().count() > 900 { format!("{}…", input.chars().take(900).collect::<String>()) } else { input };
                egui::Frame::new().fill(PANEL_HI).corner_radius(egui::CornerRadius::same(8)).inner_margin(egui::Margin::same(9)).show(ui, |ui| {
                    ui.label(RichText::new("DETALLES DE LA ACCIÓN").size(9.0).strong().color(MUTED));
                    ui.add_space(4.0);
                    egui::ScrollArea::vertical().max_height(130.0).show(ui, |ui| {
                        ui.label(RichText::new(input).monospace().size(10.0).color(MUTED));
                    });
                });
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if ui.button("Denegar").clicked() { decision = Some(false); }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if ui.add(primary_button("Permitir una vez")).clicked() { decision = Some(true); }
                    });
                });
            });
        if let Some(allow) = decision {
            self.bridge.respond_permission(id, allow);
            self.pending_permissions.pop_front();
            self.status = if allow { "Autorización concedida para esta acción" } else { "Acción denegada" }.into();
        }
    }

    fn user_input_dialog(&mut self, ctx: &egui::Context) {
        if !self.pending_permissions.is_empty() { return; }
        let Some(request) = self.pending_user_inputs.front().cloned() else { return; };
        let mut decision = None;
        egui::Window::new(if request.plan_approval { "Revisión del plan" } else { "El orquestador necesita tu decisión" })
            .collapsible(false)
            .resizable(true)
            .default_width(500.0)
            .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
            .show(ctx, |ui| {
                ui.set_width(460.0);
                ui.label(RichText::new(&request.tool_name).size(10.0).strong().color(LIME));
                if !request.prompt.trim().is_empty() {
                    ui.add_space(5.0);
                    ui.label(RichText::new(&request.prompt).size(12.0).color(TEXT));
                }
                ui.add_space(10.0);
                egui::ScrollArea::vertical().max_height(360.0).show(ui, |ui| {
                    for question in &request.questions {
                        ui.label(RichText::new(&question.header).size(9.0).strong().color(MUTED));
                        ui.add_space(3.0);
                        ui.label(RichText::new(&question.question).size(13.0).strong().color(TEXT));
                        ui.add_space(6.0);
                        for option in &question.options {
                            let selected = self.user_input_answers.get(&question.question)
                                .is_some_and(|values| values.contains(&option.label));
                            if ui.selectable_label(selected, &option.label).clicked() {
                                let values = self.user_input_answers.entry(question.question.clone()).or_default();
                                if question.multi_select {
                                    if let Some(index) = values.iter().position(|value| value == &option.label) {
                                        values.remove(index);
                                    } else {
                                        values.push(option.label.clone());
                                    }
                                } else {
                                    values.clear();
                                    values.push(option.label.clone());
                                }
                            }
                            if !option.description.is_empty() {
                                ui.label(RichText::new(&option.description).size(10.0).color(MUTED));
                            }
                        }
                        ui.add_space(12.0);
                    }
                });
                ui.horizontal(|ui| {
                    if ui.button("Declinar").clicked() { decision = Some(false); }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        let has_answer = request.questions.iter().any(|question| self.user_input_answers.get(&question.question).is_some_and(|values| !values.is_empty()));
                        let can_accept = !request.plan_approval || has_answer;
                        if ui.add_enabled(can_accept, primary_button(if request.plan_approval { "Aprobar y continuar" } else { "Enviar respuesta" })).clicked() {
                            decision = Some(true);
                        }
                    });
                });
            });
        if let Some(accept) = decision { self.respond_current_user_input(accept); }
    }

    fn respond_current_user_input(&mut self, accept: bool) {
        let Some(request) = self.pending_user_inputs.pop_front() else { return; };
        let mut answers = serde_json::Map::new();
        for question in &request.questions {
            let Some(values) = self.user_input_answers.get(&question.question).filter(|values| !values.is_empty()) else { continue; };
            let mut answer = if question.multi_select {
                serde_json::Value::Array(values.iter().cloned().map(serde_json::Value::String).collect())
            } else {
                serde_json::Value::String(values[0].clone())
            };
            if request.plan_approval && answer.as_str().is_some_and(|text| text.eq_ignore_ascii_case("approve")) {
                answer = serde_json::Value::String("approve".into());
            }
            answers.insert(question.question.clone(), answer);
        }
        let mut content = serde_json::Map::new();
        content.insert("answers".into(), serde_json::Value::Object(answers.clone()));
        if request.questions.len() == 1 {
            if let Some(value) = answers.get(&request.questions[0].question) {
                let value = value.clone();
                content.insert("answer".into(), value.clone());
                content.insert("answer_0".into(), value);
            }
        }
        let result = if accept {
            serde_json::json!({"action":"accept", "content":serde_json::Value::Object(content)})
        } else {
            serde_json::json!({"action":"decline"})
        };
        self.bridge.respond_user_input(request.id, result);
        self.user_input_answers.clear();
        self.status = if accept { "Respuesta enviada al orquestador" } else { "Pregunta declinada" }.into();
    }

    fn drain_agent_events(&mut self) {
        while let Ok(event) = self.bridge.try_recv() {
            match event {
                AgentEvent::Connected { session_id, models, current_model } => {
                    self.session_id = Some(session_id);
                    self.models = models;
                    self.selected_model_key = current_model.as_ref().and_then(|model| serde_json::to_string(model).ok());
                    self.selected_model_label = self.selected_model_key.as_ref()
                        .and_then(|key| self.models.iter().find(|model| &model.key == key))
                        .map(|model| format!("{} · {}", model.provider, model.label))
                        .unwrap_or_else(|| if self.models.is_empty() { "Sin proveedor".into() } else { "Modelo del proyecto".into() });
                    self.pending_model_key = None;
                    self.connected = true;
                    self.connecting = false;
                    self.status = "Conectado al orquestador de Auton".into();
                }
                AgentEvent::ModelChanged(selection) => {
                    self.selected_model_key = serde_json::to_string(&selection).ok();
                    self.selected_model_label = self.selected_model_key.as_ref()
                        .and_then(|key| self.models.iter().find(|model| &model.key == key))
                        .map(|model| format!("{} · {}", model.provider, model.label))
                        .unwrap_or_else(|| "Modelo seleccionado".into());
                    self.pending_model_key = None;
                    self.status = format!("Modelo activo: {}", self.selected_model_label);
                }
                AgentEvent::AssistantDelta(delta) => {
                    if let Some(index) = self.stream_target {
                        if let Some(message) = self.messages.get_mut(index) { message.body.push_str(&delta); }
                    } else {
                        self.messages.push(Message { role: Role::Orchestrator, body: delta });
                    }
                }
                AgentEvent::AssistantMessage(text) => {
                    if let Some(index) = self.stream_target {
                        if let Some(message) = self.messages.get_mut(index) { message.body = text; }
                    } else {
                        self.messages.push(Message { role: Role::Orchestrator, body: text });
                    }
                }
                AgentEvent::Worker(worker) => {
                    if let Some(existing) = self.workers.iter_mut().find(|existing| existing.id == worker.id) {
                        *existing = worker;
                    } else {
                        self.workers.push(worker);
                    }
                }
                AgentEvent::Permission(permission) => self.pending_permissions.push_back(permission),
                AgentEvent::UserInput(request) => {
                    if self.pending_user_inputs.is_empty() { self.user_input_answers.clear(); }
                    self.pending_user_inputs.push_back(request);
                }
                AgentEvent::TurnFinished => {
                    self.busy = false;
                    self.status = "El orquestador terminó este tramo".into();
                }
                AgentEvent::TurnFailed(error) => {
                    self.busy = false;
                    self.status = error.clone();
                    self.messages.push(Message { role: Role::System, body: error });
                }
                AgentEvent::Status(status) => self.status = status,
                AgentEvent::Error(error) => {
                    self.status = error.clone();
                    self.connecting = false;
                    self.pending_model_key = None;
                    if self.stream_target.is_some() {
                        self.messages.push(Message { role: Role::System, body: error });
                        self.busy = false;
                    }
                }
            }
        }
    }

    fn read_plan(&mut self) {
        let path = Path::new(self.workspace.trim()).join(".auton").join("plan.json");
        let Ok(contents) = std::fs::read_to_string(path) else { self.plan_summary = None; return; };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) else { self.plan_summary = None; return; };
        let goal = value.get("goal").and_then(|v| v.as_str()).or_else(|| value.pointer("/contract/goal").and_then(|v| v.as_str())).unwrap_or("Objetivo de Auton").to_owned();
        let items = value.get("items").or_else(|| value.get("sprints")).and_then(|v| v.as_array());
        let total = items.map_or(0, Vec::len);
        let active = items.map_or(0, |rows| rows.iter().filter(|row| matches!(row.get("status").and_then(|s| s.as_str()), Some("active" | "running" | "in_progress"))).count());
        self.plan_summary = Some((goal, total, active));
    }
}

fn configure_theme(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();
    style.visuals = egui::Visuals::dark();
    style.visuals.override_text_color = Some(TEXT);
    style.visuals.panel_fill = BG;
    style.visuals.window_fill = PANEL;
    style.visuals.extreme_bg_color = PANEL;
    style.visuals.widgets.inactive.bg_fill = PANEL_HI;
    style.visuals.widgets.hovered.bg_fill = Color32::from_rgb(38, 40, 43);
    style.visuals.widgets.active.bg_fill = Color32::from_rgb(50, 52, 56);
    style.visuals.widgets.noninteractive.bg_fill = PANEL;
    style.visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, LINE);
    style.visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, Color32::from_rgb(75, 77, 80));
    style.spacing.item_spacing = Vec2::new(8.0, 8.0);
    style.spacing.button_padding = Vec2::new(11.0, 7.0);
    ctx.set_style(style);
}

fn mark(ui: &mut egui::Ui, radius: f32) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(radius * 2.2), egui::Sense::hover());
    ui.painter().circle_filled(rect.center(), radius, LIME);
    ui.painter().text(rect.center(), egui::Align2::CENTER_CENTER, "a", FontId::proportional(radius * 1.45), BG);
}

fn pill(ui: &mut egui::Ui, label: &str, active: bool) {
    let color = if active { LIME } else { MUTED };
    egui::Frame::new().fill(if active { Color32::from_rgb(38, 48, 30) } else { PANEL_HI }).corner_radius(egui::CornerRadius::same(20)).inner_margin(egui::Margin::symmetric(9, 5)).show(ui, |ui| {
        ui.label(RichText::new(label).size(9.0).strong().color(color));
    });
}

fn section_button(ui: &mut egui::Ui, icon: &str, text: &str, selected: bool) -> bool {
    let fill = if selected { PANEL_HI } else { PANEL };
    ui.add(egui::Button::new(
        RichText::new(format!("{icon}   {text}")).size(11.0).color(if selected { TEXT } else { MUTED }),
    ).fill(fill).stroke(Stroke::new(1.0, if selected { LINE } else { PANEL })).corner_radius(egui::CornerRadius::same(8)))
        .clicked()
}

fn primary_button(text: &str) -> egui::Button<'_> {
    egui::Button::new(RichText::new(text).size(11.0).strong().color(Color32::from_rgb(24, 27, 20)))
        .fill(LIME)
        .stroke(Stroke::NONE)
        .corner_radius(egui::CornerRadius::same(8))
}

fn suggestion(ui: &mut egui::Ui, text: &str) -> bool {
    ui.add(egui::Button::new(RichText::new(text).size(11.0).color(MUTED)).fill(PANEL).stroke(Stroke::new(1.0, LINE)).corner_radius(egui::CornerRadius::same(10))).clicked()
}

fn render_message(ui: &mut egui::Ui, message: &Message) {
    ui.add_space(8.0);
    match message.role {
        Role::User => {
            ui.with_layout(Layout::right_to_left(Align::Min), |ui| {
                egui::Frame::new().fill(Color32::from_rgb(33, 35, 38)).corner_radius(egui::CornerRadius::same(13)).inner_margin(egui::Margin::symmetric(14, 11)).show(ui, |ui| {
                    ui.set_max_width(ui.available_width().min(580.0));
                    ui.label(RichText::new(&message.body).size(13.0).color(TEXT));
                });
            });
        }
        Role::Orchestrator => {
            ui.horizontal(|ui| {
                mark(ui, 8.0);
                ui.label(RichText::new("Auton").size(11.0).strong().color(LIME));
            });
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.add_space(23.0);
                ui.set_max_width(ui.available_width().min(730.0));
                ui.label(RichText::new(if message.body.is_empty() { "" } else { &message.body }).size(13.0).color(TEXT));
            });
        }
        Role::Worker | Role::System => {
            let (name, color) = if message.role == Role::Worker { ("Worker", ORANGE) } else { ("Sistema", MUTED) };
            ui.label(RichText::new(name).size(10.0).strong().color(color));
            ui.label(RichText::new(&message.body).size(11.0).color(MUTED));
        }
    }
    ui.add_space(9.0);
}

fn tab(ui: &mut egui::Ui, label: &str, selected: bool) -> bool {
    ui.selectable_label(selected, RichText::new(label).size(10.0).color(if selected { TEXT } else { MUTED })).clicked()
}

fn info_card(ui: &mut egui::Ui, label: &str, content: &str) {
    egui::Frame::new().fill(PANEL_HI).stroke(Stroke::new(1.0, LINE)).corner_radius(egui::CornerRadius::same(9)).inner_margin(egui::Margin::same(10)).show(ui, |ui| {
        ui.label(RichText::new(label).size(9.0).strong().color(MUTED));
        ui.add_space(5.0);
        ui.label(RichText::new(content).size(11.0).color(TEXT));
    });
}

fn mini_stat(ui: &mut egui::Ui, label: &str, value: &str) {
    egui::Frame::new().fill(PANEL_HI).corner_radius(egui::CornerRadius::same(8)).inner_margin(egui::Margin::same(9)).show(ui, |ui| {
        ui.label(RichText::new(label).size(8.0).color(MUTED));
        ui.label(RichText::new(value).size(16.0).strong().color(TEXT));
    });
}

fn project_name(path: &str) -> String {
    Path::new(path).file_name().and_then(|s| s.to_str()).filter(|s| !s.is_empty()).unwrap_or("Nuevo proyecto").to_owned()
}

fn short_path(path: &str) -> String {
    let path = Path::new(path);
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf()).display().to_string()
}

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Auton")
            .with_inner_size([1360.0, 860.0])
            .with_min_inner_size([1050.0, 680.0]),
        renderer: eframe::Renderer::Glow,
        ..Default::default()
    };
    eframe::run_native("Auton", options, Box::new(|_cc| Ok(Box::<AutonApp>::default())))
}
