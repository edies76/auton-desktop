#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project_dir="${1:-$PWD}"

export AUTON_REPO_ROOT="$repo_root"
exec cargo run --release --manifest-path "$repo_root/rust/Cargo.toml" -p auton-desktop -- "$project_dir"
