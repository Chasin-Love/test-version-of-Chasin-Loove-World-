# MY UNIVERSE — Windows local build toolchain setup
#
# Run this ONCE in a normal (non-sandboxed) PowerShell window:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows-toolchain.ps1
#
# It installs everything needed to build the desktop app locally:
#   - Visual Studio Build Tools 2022 (MSVC v143, Windows SDK, CMake)
#   - Rust toolchain (MSVC target) if rustup is missing
#
# Note: automated/sandboxed sessions cannot run the VS bootstrapper (.NET TLS
# initialization fails outside an interactive session), so this must be run
# manually. CI builds (GitHub Actions) do not need this script.

$ErrorActionPreference = 'Stop'

Write-Host '== MY UNIVERSE Windows toolchain setup ==' -ForegroundColor Cyan

# 1. Visual Studio Build Tools with the C++ workload
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVc = $false
if (Test-Path $vsWhere) {
    $hasVc = & $vsWhere -products * -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath | Any
}
if ($hasVc) {
    Write-Host '[ok] MSVC C++ workload already installed' -ForegroundColor Green
} else {
    Write-Host '[..] Downloading Visual Studio Build Tools (2-4 GB, be patient)...'
    $bootstrapper = Join-Path $env:TEMP 'vs_BuildTools_myu.exe'
    Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $bootstrapper
    $proc = Start-Process -FilePath $bootstrapper -ArgumentList @(
        '--quiet', '--wait', '--norestart',
        '--add', 'Microsoft.VisualStudio.Workload.VCTools',
        '--includeRecommended'
    ) -PassThru
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) {
        Write-Host "[!!] VS installer exited with code $($proc.ExitCode)" -ForegroundColor Red
        exit $proc.ExitCode
    }
    Write-Host '[ok] Visual Studio Build Tools installed' -ForegroundColor Green
}

# 2. Rust (MSVC target)
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Host '[ok] Rust already installed:' (cargo --version) -ForegroundColor Green
} else {
    Write-Host '[..] Installing rustup (MSVC toolchain)...'
    $rustupInit = Join-Path $env:TEMP 'rustup-init_myu.exe'
    Invoke-WebRequest -Uri 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile $rustupInit
    & $rustupInit -y --default-toolchain stable-x86_64-pc-windows-msvc --profile minimal
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host '[ok] Rust installed — open a NEW terminal so PATH reloads' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Done. Now run:' -ForegroundColor Cyan
Write-Host '  npm run desktop:dev    # launch MY UNIVERSE as a desktop app'
Write-Host '  npm run desktop:build  # produce installers (NSIS)'
