#Requires -Version 5.1
<#
.SYNOPSIS
  New Order — Windows Installer

.DESCRIPTION
  Installs Node.js (via winget, Chocolatey, or manual download),
  project dependencies, creates a desktop shortcut and Start Menu
  entry, then launches the game in your default browser.

.PARAMETER Mode
  dev (default) | build | preview

.PARAMETER Port
  Port to serve on (default: 5173)

.PARAMETER SkipInstall
  Skip npm install step

.PARAMETER NoOpen
  Don't auto-open the browser

.PARAMETER NoShortcut
  Skip desktop / Start Menu shortcut creation

.EXAMPLE
  .\scripts\install-windows.ps1
  .\scripts\install-windows.ps1 -Mode build -Port 3000
#>

[CmdletBinding()]
param(
  [ValidateSet('dev', 'build', 'preview')]
  [string]$Mode = 'dev',

  [int]$Port = 5173,

  [switch]$SkipInstall,
  [switch]$NoOpen,
  [switch]$NoShortcut,
  [switch]$Help
)

# ── Helpers ──────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'

function Write-Banner {
  Write-Host ""
  Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "  ║           ⚔️  NEW ORDER  ⚔️                       ║" -ForegroundColor Cyan
  Write-Host "  ║  Global Simulation Engine — Windows Installer    ║" -ForegroundColor Cyan
  Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

function Write-Step  { param([int]$n, [string]$msg) Write-Host "`n[$n/$TotalSteps] $msg" -ForegroundColor White }
function Write-Info  { param([string]$msg) Write-Host "  ▸ $msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn  { param([string]$msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$msg) Write-Host "  ✖ $msg" -ForegroundColor Red; exit 1 }

$TotalSteps = 6

# ── Help ─────────────────────────────────────────────────────
if ($Help) {
  Write-Host @"
Usage: .\scripts\install-windows.ps1 [OPTIONS]

  -Mode dev|build|preview   Start mode (default: dev)
  -Port PORT                Port to serve on (default: 5173)
  -SkipInstall              Skip npm install step
  -NoOpen                   Don't auto-open the browser
  -NoShortcut               Skip shortcut creation
  -Help                     Show this help message
"@
  exit 0
}

# ── Navigate to project root ────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Banner

# ═════════════════════════════════════════════════════════════
# Step 1 — Check / install Node.js
# ═════════════════════════════════════════════════════════════
Write-Step 1 "Checking Node.js…"

function Test-NodeInstalled {
  try {
    $v = & node -v 2>$null
    if ($v) { return $true }
  } catch {}
  return $false
}

function Get-NodeMajorVersion {
  $v = (& node -v) -replace '^v', ''
  return [int]($v.Split('.')[0])
}

$needNode = $false

if (Test-NodeInstalled) {
  $major = Get-NodeMajorVersion
  if ($major -lt 20) {
    Write-Warn "Node.js v$major detected — version 20+ required."
    $needNode = $true
  } else {
    Write-Ok "Node.js $(& node -v)"
  }
} else {
  $needNode = $true
}

if ($needNode) {
  $installed = $false

  # Try winget first (Windows 10 1809+ / Windows 11)
  if (-not $installed -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Info "Installing Node.js 22 via winget…"
    try {
      winget install OpenJS.NodeJS.LTS --version 22.* --accept-source-agreements --accept-package-agreements --silent 2>$null
      # Refresh PATH
      $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                   [System.Environment]::GetEnvironmentVariable('Path', 'User')
      if (Test-NodeInstalled) {
        Write-Ok "Node.js installed via winget"
        $installed = $true
      }
    } catch {
      Write-Warn "winget install failed — trying alternatives…"
    }
  }

  # Try Chocolatey
  if (-not $installed -and (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Info "Installing Node.js 22 via Chocolatey…"
    try {
      choco install nodejs-lts -y --no-progress 2>$null
      $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                   [System.Environment]::GetEnvironmentVariable('Path', 'User')
      if (Test-NodeInstalled) {
        Write-Ok "Node.js installed via Chocolatey"
        $installed = $true
      }
    } catch {
      Write-Warn "Chocolatey install failed — trying manual download…"
    }
  }

  # Manual MSI download
  if (-not $installed) {
    Write-Info "Downloading Node.js 22 installer…"
    $arch = if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
    $msiUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-$arch.msi"
    $msiPath = Join-Path $env:TEMP 'nodejs-install.msi'

    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
      Write-Info "Running Node.js installer (may require elevation)…"
      Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /passive /norestart" -Wait -Verb RunAs
      $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                   [System.Environment]::GetEnvironmentVariable('Path', 'User')
      Remove-Item $msiPath -ErrorAction SilentlyContinue
      if (Test-NodeInstalled) {
        Write-Ok "Node.js installed via MSI"
        $installed = $true
      }
    } catch {
      Write-Fail "Failed to install Node.js. Please install manually from https://nodejs.org and re-run."
    }
  }

  if (-not $installed) {
    Write-Fail "Could not install Node.js. Please install Node.js 22+ from https://nodejs.org and re-run."
  }
}

# Verify npm
try {
  $npmVer = & npm -v 2>$null
  Write-Ok "npm $npmVer"
} catch {
  Write-Fail "npm not found. Please ensure Node.js is installed correctly."
}

# ═════════════════════════════════════════════════════════════
# Step 2 — Install project dependencies
# ═════════════════════════════════════════════════════════════
Write-Step 2 "Installing project dependencies…"

if ($SkipInstall) {
  Write-Info "Skipped (-SkipInstall)"
} elseif ((Test-Path 'node_modules') -and (Test-Path 'package-lock.json')) {
  $lockAge = (Get-Item 'package-lock.json').LastWriteTime
  $nmAge   = if (Test-Path 'node_modules\.package-lock.json') {
    (Get-Item 'node_modules\.package-lock.json').LastWriteTime
  } else {
    [datetime]::MinValue
  }
  if ($lockAge -gt $nmAge) {
    Write-Info "Lockfile changed — running npm ci…"
    & npm ci --loglevel=warn
    Write-Ok "Dependencies installed (clean install)"
  } else {
    Write-Ok "Dependencies up to date"
  }
} else {
  Write-Info "Running npm install…"
  & npm install --loglevel=warn
  Write-Ok "Dependencies installed"
}

# ═════════════════════════════════════════════════════════════
# Step 3 — Type check
# ═════════════════════════════════════════════════════════════
Write-Step 3 "Running type check…"

try {
  & npm run typecheck --silent 2>$null
  Write-Ok "TypeScript compilation clean"
} catch {
  Write-Warn "Type errors detected — continuing anyway"
}

# ═════════════════════════════════════════════════════════════
# Step 4 — Create desktop & Start Menu shortcuts
# ═════════════════════════════════════════════════════════════
Write-Step 4 "Creating shortcuts…"

if (-not $NoShortcut) {
  # Create a .bat launcher
  $batPath = Join-Path $ProjectRoot 'scripts\new-order-launcher.bat'
  @"
@echo off
title New Order — Global Simulation Engine
cd /d "$ProjectRoot"
echo.
echo   Starting New Order...
echo.
call npm run dev
pause
"@ | Out-File -Encoding ASCII -FilePath $batPath
  Write-Ok "Created launcher: scripts\new-order-launcher.bat"

  # PowerShell shortcut helper
  function New-Shortcut {
    param([string]$ShortcutPath, [string]$TargetPath, [string]$Arguments, [string]$WorkDir, [string]$Description, [string]$IconPath)
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    if ($Arguments) { $shortcut.Arguments = $Arguments }
    $shortcut.WorkingDirectory = $WorkDir
    $shortcut.Description = $Description
    if ($IconPath -and (Test-Path $IconPath)) {
      $shortcut.IconLocation = "$IconPath,0"
    }
    $shortcut.Save()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null
  }

  # Look for an icon
  $iconFile = $null
  if (Test-Path (Join-Path $ProjectRoot 'public\icon.ico')) {
    $iconFile = Join-Path $ProjectRoot 'public\icon.ico'
  } elseif (Test-Path (Join-Path $ProjectRoot 'public\favicon.ico')) {
    $iconFile = Join-Path $ProjectRoot 'public\favicon.ico'
  }

  # Desktop shortcut
  $desktopPath = [System.Environment]::GetFolderPath('Desktop')
  $desktopLnk  = Join-Path $desktopPath 'New Order.lnk'
  if (-not (Test-Path $desktopLnk)) {
    New-Shortcut `
      -ShortcutPath $desktopLnk `
      -TargetPath   (Join-Path $env:SystemRoot 'System32\cmd.exe') `
      -Arguments    "/c `"$batPath`"" `
      -WorkDir      $ProjectRoot `
      -Description  'New Order — Global Simulation Engine' `
      -IconPath     $iconFile
    Write-Ok "Desktop shortcut: $desktopLnk"
  } else {
    Write-Info "Desktop shortcut already exists"
  }

  # Start Menu shortcut
  $startMenuDir = Join-Path ([System.Environment]::GetFolderPath('StartMenu')) 'Programs\New Order'
  if (-not (Test-Path $startMenuDir)) { New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null }
  $startMenuLnk = Join-Path $startMenuDir 'New Order.lnk'
  if (-not (Test-Path $startMenuLnk)) {
    New-Shortcut `
      -ShortcutPath $startMenuLnk `
      -TargetPath   (Join-Path $env:SystemRoot 'System32\cmd.exe') `
      -Arguments    "/c `"$batPath`"" `
      -WorkDir      $ProjectRoot `
      -Description  'New Order — Global Simulation Engine' `
      -IconPath     $iconFile
    Write-Ok "Start Menu shortcut: $startMenuLnk"
  } else {
    Write-Info "Start Menu shortcut already exists"
  }
} else {
  Write-Info "Skipped (-NoShortcut)"
}

# ═════════════════════════════════════════════════════════════
# Step 5 — Build (if needed)
# ═════════════════════════════════════════════════════════════
Write-Step 5 "Preparing game ($Mode mode)…"

switch ($Mode) {
  'build' {
    Write-Info "Building production bundle…"
    & npm run build --silent
    Write-Ok "Production build complete → dist/"
    $Mode = 'preview'
  }
  'preview' {
    if (-not (Test-Path 'dist')) {
      Write-Warn "No dist/ folder — building first…"
      & npm run build --silent
      Write-Ok "Production build complete → dist/"
    } else {
      Write-Ok "Using existing production build"
    }
  }
}

# ═════════════════════════════════════════════════════════════
# Step 6 — Launch
# ═════════════════════════════════════════════════════════════
Write-Step 6 "Launching New Order…"

$Url = "http://localhost:$Port"

if ($Mode -eq 'dev') {
  $serveCmd = "npx vite --port $Port"
} else {
  $serveCmd = "npx vite preview --port $Port"
}

Write-Info "Mode: $Mode"
Write-Host "  ▸ URL:  $Url" -ForegroundColor Cyan
Write-Host ""

# Open browser after a delay
if (-not $NoOpen) {
  Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 3
    Start-Process $url
  } -ArgumentList $Url | Out-Null
}

Write-Host "  ⚔️  Game server starting — press Ctrl+C to stop" -ForegroundColor Green
Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Run the dev/preview server (foreground)
Invoke-Expression $serveCmd
