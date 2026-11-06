use auton_core::{AutonCore, SprintState};
use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

fn project() -> std::path::PathBuf {
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("auton-core-{id}"));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn requires_evidence_before_closing_and_persists_plan_and_history() {
    let root = project();
    let mut core = AutonCore::open(&root).unwrap();
    core.set_goal(
        "Repair startup",
        vec!["Keep existing provider setup".into()],
    )
    .unwrap();
    let sprint = core
        .open_sprint("Trace startup failure", vec!["Cause is documented".into()])
        .unwrap();
    core.assign_worker(&sprint, "worker-1", Some("session-1".into()))
        .unwrap();
    core.report_worker(&sprint, "worker-1", "done", "Found missing config guard")
        .unwrap();
    assert!(core.close_sprint(&sprint).is_err());
    core.add_evidence(&sprint, "Worker report and diff", "session://session-1")
        .unwrap();
    core.close_sprint(&sprint).unwrap();
    let reopened = AutonCore::open(&root).unwrap();
    assert_eq!(reopened.plan().items[0].status, SprintState::Done);
    assert!(
        fs::read_to_string(reopened.event_log_path())
            .unwrap()
            .lines()
            .count()
            >= 6
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn cannot_assign_worker_without_goal_or_to_closed_sprint() {
    let root = project();
    let mut core = AutonCore::open(&root).unwrap();
    assert!(core.open_sprint("Work", vec!["Done".into()]).is_err());
    core.set_goal("Goal", vec![]).unwrap();
    let sprint = core.open_sprint("Work", vec!["Done".into()]).unwrap();
    core.assign_worker(&sprint, "worker", None).unwrap();
    core.report_worker(&sprint, "worker", "done", "ok").unwrap();
    core.add_evidence(&sprint, "proof", "file://diff").unwrap();
    core.close_sprint(&sprint).unwrap();
    assert!(core.assign_worker(&sprint, "late-worker", None).is_err());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn registry_redacts_common_credentials_and_caps_text() {
    let root = project();
    let mut core = AutonCore::open(&root).unwrap();
    core.set_goal("Protect logs", vec![]).unwrap();
    let sprint = core
        .open_sprint("Redact report", vec!["report saved safely".into()])
        .unwrap();
    core.assign_worker(&sprint, "worker", None).unwrap();
    let raw = "authorization: Bearer abcd1234secret api_key=supersecret";
    core.report_worker(&sprint, "worker", "done", raw).unwrap();
    let log = fs::read_to_string(core.event_log_path()).unwrap();
    assert!(!log.contains(raw));
    assert!(!log.contains("abcd1234secret"));
    assert!(!log.contains("supersecret"));
    fs::remove_dir_all(root).unwrap();
}
