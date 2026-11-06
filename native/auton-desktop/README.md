# Auton Desktop (native preview)

This is the first native UI surface for Auton. It uses Rust + `egui`/`eframe` with the `glow` renderer. The window talks to the existing Auton/ZCode orchestration runtime through its newline-delimited JSON-RPC app-server protocol; it does not replace or simulate the agent.

## What works in this preview

- Choose a project folder and connect to a real ZCode app-server process.
- Send goals to the existing orchestrator and display streamed assistant output and tool activity.
- Read the project plan from `<project>/.auton/plan.json`.
- Choose among the providers and models already configured for Auton/ZCode.
- Review tool permission requests and allow one operation or deny it.
- Answer the orchestrator's clarification and plan approval questions.
- Keep the native UI independent from Electron and the React renderer.

Provider credentials are read from the existing Auton/ZCode storage directory (`~/.auton` on Unix-like systems and `%USERPROFILE%\.auton` on Windows). Provider setup and credential editing are still done through the existing ZCode configuration surface; this preview does not migrate or duplicate secrets.

## Quick start from this repository

Requirements: Node 24, pnpm 10, Rust stable with Cargo, and the Linux XDG desktop portal runtime when running on Linux. Install the repository's Node dependencies once with `pnpm install --frozen-lockfile` from the repository root. Then run the platform script below. It builds the current CLI app-server and starts the optimized native window with that local runtime.

Linux / macOS:

```sh
./native/auton-desktop/scripts/run-dev.sh [project-folder]
```

Windows PowerShell:

```powershell
./native/auton-desktop/scripts/run-dev.ps1 [project-folder]
```

If `project-folder` is omitted, the repository root is opened. To launch with an installed `zcode` CLI instead, run `cargo run --release --manifest-path native/auton-desktop/Cargo.toml` from the repository root; the app expects `zcode app-server --stdio` on `PATH` by default.

The executable and arguments can be overridden for another runtime:

- `AUTON_AGENT_BIN`: executable path (default `zcode`).
- `AUTON_AGENT_ARGS_JSON`: JSON array of arguments (default `app-server`, `--stdio`). This handles paths containing spaces.
- `AUTON_AGENT_ARGS`: legacy whitespace-separated arguments if the JSON variable is absent.
- `AUTON_WORKSPACE`: initial project folder.

## Current limits

This is an integration preview, not yet a replacement for the ZCode desktop client. Conversation history/session restore, provider credential management, attachments, terminal/editor panes, and the broader ZCode settings/plugin surfaces are not included. The app-server's permission and user-input requests are supported; other agent-initiated interaction RPCs return a clear unsupported-method error rather than being silently approved.
