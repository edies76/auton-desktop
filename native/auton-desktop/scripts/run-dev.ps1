param(
    [Parameter(Position = 0)]
    [string]$ProjectFolder = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (& git -C $ScriptDir rev-parse --show-toplevel).Trim()
if (-not $ProjectFolder) { $ProjectFolder = $RepoRoot }

foreach ($Tool in @("cargo", "node", "pnpm")) {
    if (-not (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        throw "$Tool is required. Install Rust stable/Cargo and Node 24 with pnpm 10, then retry."
    }
}
if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
    throw "Node dependencies are missing. Run 'pnpm install --frozen-lockfile' at the repository root first."
}

& pnpm --dir $RepoRoot --filter "@zcode/cli..." build
if ($LASTEXITCODE -ne 0) { throw "The ZCode app-server build failed." }
$CliBundle = Join-Path $RepoRoot "apps/zcode-cli/packages/cli/dist/zcode.cjs"
if (-not (Test-Path $CliBundle)) { throw "The CLI build did not produce $CliBundle" }

$env:AUTON_AGENT_BIN = (Get-Command node).Source
$env:AUTON_AGENT_ARGS_JSON = (& node -e 'process.stdout.write(JSON.stringify([process.argv[1], "app-server", "--stdio"]))' $CliBundle)
$env:AUTON_WORKSPACE = $ProjectFolder

& cargo run --release --manifest-path (Join-Path $RepoRoot "native/auton-desktop/Cargo.toml")
if ($LASTEXITCODE -ne 0) { throw "The native Auton Desktop app failed to start." }
