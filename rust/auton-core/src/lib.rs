use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GoalState {
    Active,
    Waiting,
    Blocked,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SprintState {
    Ready,
    Running,
    Waiting,
    Blocked,
    Done,
    Dropped,
    NotEvaluable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statement: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub done: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub kind: String,
    pub label: String,
    #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub status: SprintState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
    #[serde(default)]
    pub evidence: Vec<Evidence>,
    #[serde(default)]
    pub questions: Vec<String>,
    #[serde(default)]
    pub attempts: u32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub needs_approval: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub version: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub goal: Option<Goal>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limits: Option<serde_json::Value>,
    #[serde(default)]
    pub limit_history: Vec<serde_json::Value>,
    #[serde(default)]
    pub limit_reports: Vec<serde_json::Value>,
    #[serde(default)]
    pub items: Vec<PlanItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl Default for Plan {
    fn default() -> Self {
        Self {
            version: 1,
            goal: None,
            limits: None,
            limit_history: vec![],
            limit_reports: vec![],
            items: vec![],
            updated_at: Some(Utc::now().to_rfc3339()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    Goal,
    Sprint,
    Dispatch,
    Report,
    Decision,
    Artifact,
    Change,
    Revert,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EventRecord {
    pub version: u32,
    pub id: String,
    pub at: DateTime<Utc>,
    pub kind: EventKind,
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub refs: Vec<String>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
}

pub struct AutonCore {
    root: PathBuf,
    plan: Plan,
}

impl AutonCore {
    pub fn open(project: impl AsRef<Path>) -> Result<Self> {
        let root = project.as_ref().join(".auton");
        fs::create_dir_all(&root).with_context(|| format!("create {}", root.display()))?;
        let plan_path = root.join("plan.json");
        let plan = match fs::read(&plan_path) {
            Ok(bytes) => {
                serde_json::from_slice(&bytes).context("parse compatible .auton/plan.json")?
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Plan::default(),
            Err(error) => return Err(error).context("read .auton/plan.json"),
        };
        Ok(Self { root, plan })
    }

    pub fn plan(&self) -> &Plan {
        &self.plan
    }

    pub fn set_goal(&mut self, title: impl Into<String>, constraints: Vec<String>) -> Result<()> {
        let title = title.into().trim().to_owned();
        if title.is_empty() {
            bail!("goal title cannot be empty");
        }
        self.plan.goal = Some(Goal {
            title: title.clone(),
            statement: None,
            constraints: Some(constraints),
            done: None,
        });
        self.commit(
            EventKind::Goal,
            title.clone(),
            format!("Goal set: {title}"),
            vec![],
            None,
            None,
        )?;
        Ok(())
    }

    pub fn open_sprint(
        &mut self,
        title: impl Into<String>,
        acceptance: Vec<String>,
    ) -> Result<String> {
        if self.plan.goal.is_none() {
            bail!("set a goal before opening a sprint");
        }
        let title = title.into().trim().to_owned();
        if title.is_empty() || acceptance.is_empty() {
            bail!("sprint needs a title and acceptance criteria");
        }
        let id = format!("s-{}", &Uuid::now_v7().simple().to_string()[..12]);
        self.plan.items.push(PlanItem {
            id: id.clone(),
            title: title.clone(),
            detail: Some(acceptance.join("; ")),
            status: SprintState::Ready,
            effort: Some("standard".into()),
            mode: Some("build".into()),
            engine: Some("zcode".into()),
            owner: Some("programmer".into()),
            strength: Some("explicit".into()),
            files: None,
            evidence: vec![],
            questions: vec![],
            attempts: 0,
            needs_approval: vec![],
        });
        self.commit(
            EventKind::Sprint,
            title.clone(),
            format!("Sprint opened: {title}"),
            vec![],
            Some("ready".into()),
            Some(id.clone()),
        )?;
        Ok(id)
    }

    pub fn assign_worker(
        &mut self,
        sprint_id: &str,
        worker_id: impl Into<String>,
        session_id: Option<String>,
    ) -> Result<()> {
        let worker_id = worker_id.into();
        let item = self.item_mut(sprint_id)?;
        if matches!(item.status, SprintState::Done | SprintState::Dropped) {
            bail!("cannot assign a worker to a closed sprint");
        }
        item.status = SprintState::Running;
        item.attempts += 1;
        let title = item.title.clone();
        let refs = session_id.into_iter().collect();
        self.commit(
            EventKind::Dispatch,
            format!("Dispatch: {title}"),
            format!("Worker {worker_id} assigned"),
            refs,
            Some("running".into()),
            Some(sprint_id.into()),
        )
    }

    pub fn report_worker(
        &mut self,
        sprint_id: &str,
        worker_id: &str,
        status: impl Into<String>,
        report: impl Into<String>,
    ) -> Result<()> {
        let status = status.into();
        let report = report.into();
        let item = self.item_mut(sprint_id)?;
        item.status = match status.as_str() {
            "done" | "completed" => SprintState::Done,
            "blocked" => SprintState::Blocked,
            "waiting" | "needs_context" => SprintState::Waiting,
            "not_evaluable" => SprintState::NotEvaluable,
            _ => SprintState::Running,
        };
        let title = item.title.clone();
        self.commit(
            EventKind::Report,
            format!("Report: {title}"),
            report,
            vec![],
            Some(status),
            Some(sprint_id.into()),
        )?;
        self.commit(
            EventKind::Decision,
            format!("Worker report received for {title}"),
            format!("Worker {worker_id} reported"),
            vec![],
            None,
            Some(sprint_id.into()),
        )
    }

    pub fn add_evidence(
        &mut self,
        sprint_id: &str,
        description: impl Into<String>,
        uri: impl Into<String>,
    ) -> Result<()> {
        let description = description.into();
        let uri = uri.into();
        let item = self.item_mut(sprint_id)?;
        item.evidence.push(Evidence {
            kind: "note".into(),
            label: description.clone(),
            reference: Some(uri.clone()),
        });
        self.commit(
            EventKind::Artifact,
            format!("Evidence: {description}"),
            description,
            vec![uri],
            None,
            Some(sprint_id.into()),
        )
    }

    pub fn close_sprint(&mut self, sprint_id: &str) -> Result<()> {
        let item = self.item_mut(sprint_id)?;
        if item.evidence.is_empty() {
            bail!("cannot close a sprint without evidence");
        }
        if item.status == SprintState::Running {
            bail!("cannot close a sprint while a worker is running");
        }
        item.status = SprintState::Done;
        let title = item.title.clone();
        self.commit(
            EventKind::Sprint,
            format!("Sprint closed: {title}"),
            "Closed with evidence".into(),
            vec![],
            Some("done".into()),
            Some(sprint_id.into()),
        )
    }

    pub fn event_log_path(&self) -> PathBuf {
        self.root.join("registry.jsonl")
    }

    fn item_mut(&mut self, sprint_id: &str) -> Result<&mut PlanItem> {
        self.plan
            .items
            .iter_mut()
            .find(|item| item.id == sprint_id)
            .context("sprint not found")
    }

    fn commit(
        &mut self,
        kind: EventKind,
        title: String,
        summary: String,
        refs: Vec<String>,
        status: Option<String>,
        item_id: Option<String>,
    ) -> Result<()> {
        let record = EventRecord {
            version: 1,
            id: Uuid::now_v7().to_string(),
            at: Utc::now(),
            kind,
            title: safe_text(&title, 200),
            summary: safe_text(&summary, 800),
            refs: refs
                .iter()
                .take(20)
                .map(|value| safe_text(value, 300))
                .collect(),
            source: "auton-rust-core".into(),
            status: status.map(|value| safe_text(&value, 64)),
            agent_id: None,
            item_id: item_id.map(|value| safe_text(&value, 160)),
        };
        let mut log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.event_log_path())?;
        serde_json::to_writer(&mut log, &record)?;
        log.write_all(b"\n")?;
        log.sync_data()?;
        self.plan.updated_at = Some(Utc::now().to_rfc3339());
        let mut temp = tempfile::NamedTempFile::new_in(&self.root)?;
        serde_json::to_writer_pretty(temp.as_file_mut(), &self.plan)?;
        temp.as_file().sync_all()?;
        temp.persist(self.root.join("plan.json"))
            .map_err(|error| error.error)
            .context("replace .auton/plan.json")?;
        Ok(())
    }
}

fn safe_text(input: &str, max_chars: usize) -> String {
    let mut value = input.to_owned();
    for pattern in [
        r"(?i)(authorization\s*[:=]\s*bearer\s+)[^\s,;]+",
        r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]{8,}",
        r"(?i)((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password)\s*[:=]\s*)[^\s,;]+",
    ] {
        if let Ok(regex) = Regex::new(pattern) {
            value = regex.replace_all(&value, "$1[REDACTED]").into_owned();
        }
    }
    let mut chars = value.chars();
    let bounded: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        bounded
            .chars()
            .take(max_chars.saturating_sub(1))
            .chain(std::iter::once('…'))
            .collect()
    } else if bounded.trim().is_empty() {
        "(empty)".chars().take(max_chars).collect()
    } else {
        bounded
    }
}
