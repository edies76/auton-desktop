#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
workspace="${1:-$repo_root}"

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust/Cargo is required. Install the stable Rust toolchain, then retry." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "Node 24 and pnpm 10 are required to build the local ZCode app-server." >&2
  exit 1
fi
if [[ ! -d "$repo_root/node_modules" ]]; then
  echo "Node dependencies are missing. Run 'pnpm install --frozen-lockfile' at the repository root first." >&2
  exit 1
fi

pnpm --dir "$repo_root" --filter '@zcode/cli...' build
cli_bundle="$repo_root/apps/zcode-cli/packages/cli/dist/zcode.cjs"
if [[ ! -f "$cli_bundle" ]]; then
  echo "The CLI build did not produce $cli_bundle" >&2
  exit 1
fi

export AUTON_AGENT_BIN="$(command -v node)"
export AUTON_AGENT_ARGS_JSON="$(node -e 'process.stdout.write(JSON.stringify([process.argv[1], "app-server", "--stdio"]))' "$cli_bundle")"
export AUTON_WORKSPACE="$workspace"

cargo run --release --manifest-path "$repo_root/native/auton-desktop/Cargo.toml"
