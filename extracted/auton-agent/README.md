# Auton agent runtime: keep behind the protocol

## Decision

The first Auton desktop should reuse ZCode's actual agent process through `app-server --stdio`. This is the working integration boundary used by `feat/edi/auton-native-ui`; it is not a mock agent and it receives Auton's default orchestrator instructions.

The agent runtime is **not copied into this extraction branch as a standalone package**. `AgentRuntime` is assembled from the core, contracts, shared protocol, provider runtime, filesystem/process adapters, permission broker, subagent tools, and Auton context. Copying only the runtime class would produce a misleadingly small fork that does not run; copying the dependency graph would duplicate much of the monorepo and increase maintenance cost before the new client is proven.

## Current source and entry points

- Runtime and tool loop: `apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts`.
- Auton identity and operating procedure: `apps/zcode-cli/packages/core/src/auton/contextAuton.ts` and `contextOrchestrator.ts`.
- Context assembly: `apps/zcode-cli/packages/core/src/context/builder.ts`. When there is no custom system prompt or workflow actor, it adds both Auton sections to the normal interactive session.
- Process entry: package `@zcode/cli`, command `app-server --stdio`, launched from `apps/zcode-cli/packages/cli`.
- Protocol schemas and names: `packages/shared/src/zcode-protocol/index.ts`.
- Providers: `apps/zcode-cli/packages/provider`, `provider-node`, plus the relevant services and adapters.

## Minimum host contract used by the Rust client

1. Start the CLI process with the project folder as its working directory.
2. Use newline-delimited JSON-RPC on stdin/stdout; keep logs on stderr.
3. Call `runtime/capabilities`, `session/create`, then `session/subscribe`.
4. Send user goals through `session/send`; receive stream, turn, tool and worker updates through `session/event`.
5. Answer `interaction/requestPermission` and `interaction/requestUserInput` explicitly. Unknown requests fail closed with a protocol error.
6. Read `.auton/plan.json` for the plan projection. The project file remains the source of truth.

The native UI currently reads provider/model choices from the created session and switches models through `session/setModel`. Provider credentials and provider creation remain in the current local ZCode/Auton configuration; the native client does not copy secrets.

## Extraction gate

Only split the runtime after a dependency-graph pass identifies a smaller provider/tool/process/permission surface Auton actually needs. Require parity tests for a real provider call, tool execution, worker dispatch, permission and session recovery before replacing the existing process boundary. Until then, reuse the process; do not maintain a second agent loop.
