# Arranca Auton nativo (GPUI) desde Windows sin configurar variables a mano.
# Uso:
#   .\scripts\run-native.ps1 -Project C:\ruta\al\proyecto
#   .\scripts\run-native.ps1 -Build   # compila release la primera vez
param(
  [string]$Project = (Get-Location).Path,
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path $cargoBin) { $env:PATH = "$cargoBin;$env:PATH" }
$env:AUTON_REPO_ROOT = $repo

$exe = Join-Path $repo 'rust\target\release\auton.exe'
if ($Build -or -not (Test-Path $exe)) {
  Push-Location (Join-Path $repo 'rust')
  try { cargo build --release -p auton-desktop } finally { Pop-Location }
}
if (-not (Test-Path $exe)) { throw "No se generó $exe" }

& $exe $Project
