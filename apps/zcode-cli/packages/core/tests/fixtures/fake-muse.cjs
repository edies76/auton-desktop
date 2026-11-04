#!/usr/bin/env node
// Motor de contrato para las pruebas del adaptador de Muse Code.
// Implementa lo que el adaptador espera de `muse exec --json`: versión,
// prompt-file, workspace, JSONL de progreso y un terminal con REPORTE.

const fs = require("node:fs");

const argv = process.argv.slice(2);

if (argv.includes("--version")) {
  process.stdout.write("Muse Code 9.9.9 (fake)\n");
  process.exit(0);
}

function flag(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const promptFile = flag("--prompt-file");
const workspace = flag("--workspace");
const prompt = promptFile ? fs.readFileSync(promptFile, "utf8") : "";

process.stderr.write("muse: fake engine\n");

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

emit({
  schema_version: 1,
  payload_type: "fake.probe",
  payload: { argv, cwd: process.cwd(), prompt },
});
emit({
  schema_version: 1,
  payload_type: "task.lifecycle.started",
  payload: { kind: "task_lifecycle", task_kind: "fake.work", event: { kind: "started" } },
});

const sleepMs = Number(process.env.FAKE_MUSE_SLEEP_MS ?? "0");
const finish = () => {
  if (process.env.FAKE_MUSE_FAIL === "1") {
    emit({
      schema_version: 1,
      payload_type: "run.terminal.failed",
      payload: {
        kind: "run_terminal",
        terminal: "failed",
        text: "",
        reason: process.env.FAKE_MUSE_REASON ?? "fallo simulado",
      },
    });
    process.exit(1);
  }
  emit({
    schema_version: 1,
    payload_type: "run.terminal.completed",
    payload: {
      kind: "run_terminal",
      terminal: "completed",
      text:
        process.env.FAKE_MUSE_TEXT ??
        `REPORTE\nSTATUS: DONE\nARCHIVOS: ninguno\nEVIDENCIA: fake ${workspace ?? ""}\nDUDAS: ninguna\n`,
      reason: null,
    },
  });
  process.exit(0);
};

if (sleepMs > 0) {
  setTimeout(finish, sleepMs);
} else {
  finish();
}
