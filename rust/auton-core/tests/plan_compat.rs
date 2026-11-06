use auton_core::AutonCore;
use serde_json::Value;
use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

#[test]
fn reads_existing_auton_plan_v1_without_rewriting_it() {
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("auton-plan-compat-{id}"));
    let auton = root.join(".auton");
    fs::create_dir_all(&auton).unwrap();
    let input = serde_json::json!({
        "version": 1,
        "goal": { "title": "Existing objective", "statement": "User words", "constraints": ["Keep scope"], "done": ["Evidence exists"] },
        "limits": { "version": 1, "maxAttempts": 3, "approval": {}, "unknownHandling": "wait" },
        "limitHistory": [], "limitReports": [],
        "items": [{ "id": "s1", "title": "Investigate", "status": "ready", "effort": "standard", "mode": "research", "engine": "zcode", "owner": "programmer", "strength": "explicit", "files": ["src/main.rs"], "evidence": [{ "kind": "file", "label": "Relevant file", "ref": "src/main.rs" }], "questions": [], "attempts": 1, "needsApproval": [] }],
        "updatedAt": "2026-11-06T00:00:00Z"
    });
    let plan_path = auton.join("plan.json");
    let bytes = serde_json::to_vec_pretty(&input).unwrap();
    fs::write(&plan_path, &bytes).unwrap();
    let core = AutonCore::open(&root).unwrap();
    assert_eq!(core.plan().version, 1);
    assert_eq!(
        core.plan().goal.as_ref().unwrap().title,
        "Existing objective"
    );
    assert_eq!(
        core.plan().items[0].evidence[0].reference.as_deref(),
        Some("src/main.rs")
    );
    let output: Value = serde_json::from_slice(&fs::read(&plan_path).unwrap()).unwrap();
    assert_eq!(output, input);
    fs::remove_dir_all(root).unwrap();
}
