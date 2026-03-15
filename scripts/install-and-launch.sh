#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  New Order — Install & Launch
#  Installs dependencies, builds the project, and launches the
#  game in your default browser.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours & helpers ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════╗"
  echo "  ║           ⚔️  CONFLICT 2026  ⚔️                  ║"
  echo "  ║        Global Simulation Engine  v0.1.0          ║"
  echo "  ╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

info()    { echo -e "  ${CYAN}▸${RESET} $1"; }
success() { echo -e "  ${GREEN}✔${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()    { echo -e "  ${RED}✖${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}[$1/$TOTAL_STEPS] $2${RESET}"; }

TOTAL_STEPS=5

# ── Navigate to project root (parent of /scripts) ───────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

banner

# ── Parse arguments ──────────────────────────────────────────
MODE="dev"          # dev | build | preview
SKIP_INSTALL=false
PORT=5173
OPEN_BROWSER=true

usage() {
  echo -e "${BOLD}Usage:${RESET} ./scripts/install-and-launch.sh [OPTIONS]"
  echo ""
  echo "  --dev          Start in development mode with HMR (default)"
  echo "  --build        Build for production and preview"
  echo "  --preview      Preview an existing production build"
  echo "  --port PORT    Port to serve on (default: 5173)"
  echo "  --skip-install Skip npm install step"
  echo "  --no-open      Don't auto-open the browser"
  echo "  -h, --help     Show this help message"
  echo ""
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)          MODE="dev";     shift ;;
    --build)        MODE="build";   shift ;;
    --preview)      MODE="preview"; shift ;;
    --port)         PORT="$2";      shift 2 ;;
    --skip-install) SKIP_INSTALL=true; shift ;;
    --no-open)      OPEN_BROWSER=false; shift ;;
    -h|--help)      usage ;;
    *)              warn "Unknown option: $1"; shift ;;
  esac
done

# ── Step 1: Check prerequisites ─────────────────────────────
step 1 "Checking prerequisites…"

# Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  fail "Node.js $NODE_VERSION detected — version 20+ required (22 recommended)."
fi
success "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm is not installed."
fi
success "npm $(npm -v)"

# ── Step 2: Install dependencies ─────────────────────────────
step 2 "Installing dependencies…"

if [[ "$SKIP_INSTALL" == true ]]; then
  info "Skipped (--skip-install)"
elif [[ -d "node_modules" && -f "package-lock.json" ]]; then
  # Fast path: only install if lockfile is newer than node_modules
  if [[ "package-lock.json" -nt "node_modules/.package-lock.json" ]]; then
    info "Lockfile changed — running npm ci…"
    npm ci --loglevel=warn
    success "Dependencies installed (clean install)"
  else
    success "Dependencies up to date"
  fi
else
  info "Running npm install…"
  npm install --loglevel=warn
  success "Dependencies installed"
fi

# ── Step 3: Type check ──────────────────────────────────────
step 3 "Running type check…"

if npm run typecheck --silent 2>/dev/null; then
  success "TypeScript compilation clean"
else
  warn "Type errors detected — continuing anyway (game may still work)"
fi

# ── Step 4: Build / prepare ──────────────────────────────────
step 4 "Preparing game ($MODE mode)…"

case $MODE in
  dev)
    info "Development server with hot-reload"
    ;;
  build)
    info "Building production bundle…"
    npm run build --silent
    success "Production build complete → dist/"
    MODE="preview"  # after building, we preview
    ;;
  preview)
    if [[ ! -d "dist" ]]; then
      warn "No dist/ folder found — building first…"
      npm run build --silent
      success "Production build complete → dist/"
    else
      success "Using existing production build"
    fi
    ;;
esac

# ── Step 5: Launch ───────────────────────────────────────────
step 5 "Launching New Order…"

# Determine the URL
if [[ "$MODE" == "dev" ]]; then
  URL="http://localhost:${PORT}"
  SERVE_CMD="npx vite --port $PORT"
else
  URL="http://localhost:${PORT}"
  SERVE_CMD="npx vite preview --port $PORT"
fi

info "Mode: ${BOLD}$MODE${RESET}"
info "URL:  ${BOLD}${CYAN}$URL${RESET}"
echo ""

# Open browser after a short delay (in background)
if [[ "$OPEN_BROWSER" == true ]]; then
  (
    sleep 2
    if command -v open &>/dev/null; then
      open "$URL"            # macOS
    elif command -v xdg-open &>/dev/null; then
      xdg-open "$URL"       # Linux
    elif command -v start &>/dev/null; then
      start "$URL"           # Windows (Git Bash)
    fi
  ) &
  BROWSER_PID=$!
fi

echo -e "${GREEN}${BOLD}  ⚔️  Game server starting — press Ctrl+C to stop${RESET}"
echo -e "${DIM}  ─────────────────────────────────────────────────${RESET}"
echo ""

# Run the server (foreground — Ctrl+C to stop)
$SERVE_CMD

# Cleanup browser-open background process if still running
if [[ "$OPEN_BROWSER" == true ]] && kill -0 "$BROWSER_PID" 2>/dev/null; then
  kill "$BROWSER_PID" 2>/dev/null || true
fi
