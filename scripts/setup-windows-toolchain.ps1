# MY UNIVERSE — Windows local build toolchain setup
#
# Run this ONCE in a PowerShell 7+ window (you already have pwsh 7.6.6):
#   pwsh -ExecutionPolicy Bypass -File scripts\setup-windows-toolchain.ps1
# or simply:
#   .\scripts\setup-windows-toolchain.ps1
#
# It installs everything needed to build the desktop app locally:
#   - Visual Studio Build Tools 2022 (MSVC v143, Windows SDK, CMake)
#   - Rust toolchain (MSVC target) if rustup is missing
#
# NOTE: if Windows PowerShell 5.1 on this machine is broken (the
# "System.Net.ServicePointManager" initializer error), do NOT run this
# through `powershell.exe` — run it in pwsh 7, which uses its own modern .NET.
# CI builds (GitHub Actions) do not need this script at all.

$ErrorActionPreference = 'Stop'

Write-Host '== MY UNIVERSE Windows toolchain setup ==' -ForegroundColor Cyan

# 0. Refuse to run inside broken Windows PowerShell 5.1 with a clear message.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
    Write-Host ''
    Write-Host '[!] This is Windows PowerShell 5.1, whose .NET appears broken on this' -ForegroundColor Red
    Write-Host '    machine (System.Net.ServicePointManager init failure).' -ForegroundColor Red
    Write-Host '    Run this script in PowerShell 7 instead:' -ForegroundColor Yellow
    Write-Host '      pwsh -ExecutionPolicy Bypass -File scripts\setup-windows-toolchain.ps1' -ForegroundColor Yellow
    exit 1
}

# 1. Visual Studio Build Tools with the C++ workload
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVc = $false
if (Test-Path $vsWhere) {
    $inst = & $vsWhere -products * -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath 2>$null
    $hasVc = [bool]($inst | Where-Object { $_ })
}
if ($hasVc) {
    Write-Host '[ok] MSVC C++ workload already installed' -ForegroundColor Green
} else {
    # Preferred: winget (handles elevation & the installer for you)
    $installed = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host '[..] Installing Visual Studio Build Tools via winget (2-4 GB, be patient)...'
        try {
            winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --silent `
                --accept-source-agreements --accept-package-agreements `
                --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
            if ($LASTEXITCODE -eq 0) { $installed = $true }
            else { Write-Host "[!] winget installer exited with code $LASTEXITCODE — trying direct bootstrapper..." -ForegroundColor Yellow }
        } catch {
            Write-Host "[!] winget route failed: $($_.Exception.Message) — trying direct bootstrapper..." -ForegroundColor Yellow
        }
    }
    if (-not $installed) {
        Write-Host '[..] Downloading Visual Studio Build Tools bootstrapper...'
        $bootstrapper = Join-Path $env:TEMP 'vs_BuildTools_myu.exe'
        Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $bootstrapper
        $proc = Start-Process -FilePath $bootstrapper -ArgumentList @(
            '--quiet', '--wait', '--norestart',
            '--add', 'Microsoft.VisualStudio.Workload.VCTools',
            '--includeRecommended'
        ) -PassThru
        $proc.WaitForExit()
        if ($proc.ExitCode -ne 0) {
            Write-Host "[!!] VS installer exited with code $($proc.ExitCode)." -ForegroundColor Red
            Write-Host '     If this persists, your .NET Framework may need a repair:' -ForegroundColor Yellow
            Write-Host '     run the Microsoft .NET Framework Repair Tool, then retry.' -ForegroundColor Yellow
            Write-Host '     You can still get installers without any local setup: push to GitHub' -ForegroundColor Yellow
            Write-Host '     and download the artifacts from the Actions tab.' -ForegroundColor Yellow
            exit $proc.ExitCode
        }
        $installed = $true
    }
    if ($installed) { Write-Host '[ok] Visual Studio Build Tools installed' -ForegroundColor Green }
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
