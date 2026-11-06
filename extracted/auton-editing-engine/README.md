# Auton editing engine

A small, UI-independent extraction of ZCode's text-file workflow. It accepts the same injected filesystem-port shape used by ZCode and exposes four operations: read, write, contextual edit, and structured patch. It has no Electron, React, provider, session, or ZCode runtime dependency. It reuses ZCode's existing tolerant edit matcher as a small pure TypeScript source module; Node 24.14+ strips its type annotations at runtime.

## Boundary

The engine owns path normalization, read-before-write freshness, expected-revision writes, contextual replacement, structured-patch validation, and change summaries. The host supplies a `FileSystemPort` and remains responsible for permissions, process lifecycle, provider selection, session context, and UI. An optional `onFileChange` hook lets Auton connect its journal/revert storage without coupling that storage into the editing core. If the host implements `readBinaryFile` and returns revision IDs, the hook includes exact raw-byte snapshots as base64, preserving CRLF and other byte-level details for Auton's revert journal; hosts can adapt these strings with `Buffer.from(value, "base64")` when calling the existing `recordFileChange` API.

The filesystem port must implement `stat`, `readTextFile`, `readTextFileRange`, `writeTextFile`, and `removeFile` with the request/result shapes from `apps/zcode-cli/packages/contracts/src/interfaces/file-system.port.ts`. Revision IDs must be stable across reads and enforced by `writeTextFile.expectedRevision`. Exact journal snapshots require the optional `readBinaryFile` method and revision IDs on its results; without them, text edits still work but byte-exact rollback data is not emitted.

The default path policy confines lexical paths to the selected workspace. Hosts that intentionally support sibling repositories can pass `allowOutsideWorkspace: true`; the filesystem adapter must still enforce its own symlink and permission policy. This module does not open the host filesystem directly.

## API

```js
import { AutonEditingEngine } from "@auton/editing-engine";

const engine = new AutonEditingEngine({
  fileSystem,
  workspaceRoot: "/work/project",
  workingDirectory: "/work/project",
  onFileChange: async (change) => autonJournal.record(change),
});

const read = await engine.read({ file_path: "src/main.ts" });
const edit = await engine.edit({
  file_path: "src/main.ts",
  old_string: "before",
  new_string: "after",
});
```

Errors are `EditingEngineError` values with stable `code`, `path`, and optional `cause` fields. Write/Edit still require a full, fresh read for existing files. Patch execution validates all target files before its first mutation and uses revision checks for writes. If the optional journal hook fails after a file change commits, the tool result includes `journalWarning`; the host must show that warning because the change may no longer be exactly reversible.

## Run locally

```sh
node --check src/index.mjs
node --test test/*.test.mjs
```

## Intentionally outside this extraction

Image, video, PDF, and notebook rendering; provider-specific token/media projection; permission UI and approval policy; telemetry; memory-origin stamping; and Auton's durable change journal remain host adapters or optional modules. The ZCode source remains the behavior reference at `apps/zcode-cli/packages/core/src/tool/handlers/{read,read-text,write,edit,apply-patch}.ts`. This package is the clean integration boundary for those core text operations; it is not a full replacement for ZCode's complete multimodal tool catalog. The matcher is extracted from `apps/zcode-cli/packages/core/src/tool/edit-matchers.ts` without behavior changes; the repository's Apache-2.0 license applies.
