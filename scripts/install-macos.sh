#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  New Order — macOS Installer
#  Installs prerequisites (Node.js via Homebrew), project
#  dependencies, creates an optional desktop shortcut, and
#  launches the game.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours & helpers ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════╗"
  echo "  ║           ⚔️  NEW ORDER  ⚔️                       ║"
  echo "  ║   Global Simulation Engine — macOS Installer     ║"
  echo "  ╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

info()    { echo -e "  ${CYAN}▸${RESET} $1"; }
success() { echo -e "  ${GREEN}✔${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()    { echo -e "  ${RED}✖${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}[$1/$TOTAL_STEPS] $2${RESET}"; }

TOTAL_STEPS=6

# ── Navigate to project root ────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

banner

# ── Parse arguments ──────────────────────────────────────────
MODE="dev"
SKIP_INSTALL=false
PORT=5173
OPEN_BROWSER=true
CREATE_SHORTCUT=true

usage() {
  echo -e "${BOLD}Usage:${RESET} ./scripts/install-macos.sh [OPTIONS]"
  echo ""
  echo "  --dev            Start in development mode with HMR (default)"
  echo "  --build          Build for production and preview"
  echo "  --preview        Preview an existing production build"
  echo "  --port PORT      Port to serve on (default: 5173)"
  echo "  --skip-install   Skip npm install step"
  echo "  --no-open        Don't auto-open the browser"
  echo "  --no-shortcut    Skip desktop shortcut creation"
  echo "  -h, --help       Show this help message"
  echo ""
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)          MODE="dev";          shift ;;
    --build)        MODE="build";        shift ;;
    --preview)      MODE="preview";      shift ;;
    --port)         PORT="$2";           shift 2 ;;
    --skip-install) SKIP_INSTALL=true;   shift ;;
    --no-open)      OPEN_BROWSER=false;  shift ;;
    --no-shortcut)  CREATE_SHORTCUT=false; shift ;;
    -h|--help)      usage ;;
    *)              warn "Unknown option: $1"; shift ;;
  esac
done

# ═════════════════════════════════════════════════════════════
# Step 1 — Xcode Command Line Tools
# ═════════════════════════════════════════════════════════════
step 1 "Checking Xcode Command Line Tools…"

if xcode-select -p &>/dev/null; then
  success "Xcode CLT installed"
else
  info "Installing Xcode Command Line Tools (may prompt for password)…"
  xcode-select --install 2>/dev/null || true
  # Wait for the user to finish the GUI install
  echo -e "  ${YELLOW}→ Complete the Xcode CLT install dialog, then press Enter to continue…${RESET}"
  read -r
  if xcode-select -p &>/dev/null; then
    success "Xcode CLT installed"
  else
    fail "Xcode Command Line Tools are required. Please install them and re-run."
  fi
fi

# ═════════════════════════════════════════════════════════════
# Step 2 — Homebrew & Node.js
# ═════════════════════════════════════════════════════════════
step 2 "Checking prerequisites (Homebrew, Node.js, npm)…"

# Homebrew
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Activate for Apple Silicon or Intel
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  success "Homebrew installed"
else
  success "Homebrew $(brew --version | head -1 | awk '{print $2}')"
fi

# Node.js
if ! command -v node &>/dev/null; then
  info "Installing Node.js 22 via Homebrew…"
  brew install node@22
  brew link --overwrite node@22 2>/dev/null || true
  success "Node.js installed"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 20 ]]; then
  warn "Node.js v${NODE_VERSION} detected — upgrading to 22…"
  brew install node@22
  brew link --overwrite --force node@22 2>/dev/null || true
fi
success "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm not found after Node.js install — please check your PATH."
fi
success "npm $(npm -v)"

# ═════════════════════════════════════════════════════════════
# Step 3 — Install project dependencies
# ═════════════════════════════════════════════════════════════
step 3 "Installing project dependencies…"

if [[ "$SKIP_INSTALL" == true ]]; then
  info "Skipped (--skip-install)"
elif [[ -d "node_modules" && -f "package-lock.json" ]]; then
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

# ═════════════════════════════════════════════════════════════
# Step 4 — Type check
# ═════════════════════════════════════════════════════════════
step 4 "Running type check…"

if npm run typecheck --silent 2>/dev/null; then
  success "TypeScript compilation clean"
else
  warn "Type errors detected — continuing anyway (game may still work)"
fi

# ═════════════════════════════════════════════════════════════
# Step 5 — Desktop shortcut (macOS .app stub via Automator)
# ═════════════════════════════════════════════════════════════
step 5 "Creating desktop shortcut…"

if [[ "$CREATE_SHORTCUT" == true ]]; then
  APP_DIR="$HOME/Desktop/New Order.app"
  SCRIPT_TARGET="$PROJECT_ROOT/scripts/install-and-launch.sh"

  if [[ -d "$APP_DIR" ]]; then
    info "Desktop shortcut already exists — skipping"
  else
    # Create a minimal macOS .app bundle that runs the launch script
    mkdir -p "$APP_DIR/Contents/MacOS"
    mkdir -p "$APP_DIR/Contents/Resources"

    # Launcher executable
    cat > "$APP_DIR/Contents/MacOS/NewOrder" << LAUNCHER
#!/usr/bin/env bash
cd "$PROJECT_ROOT"
exec bash "$SCRIPT_TARGET" --dev --skip-install
LAUNCHER
    chmod +x "$APP_DIR/Contents/MacOS/NewOrder"

    # Info.plist
    cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>New Order</string>
  <key>CFBundleDisplayName</key>
  <string>New Order — Global Simulation Engine</string>
  <key>CFBundleIdentifier</key>
  <string>com.neworder.simulation</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleExecutable</key>
  <string>NewOrder</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
</dict>
</plist>
PLIST

    # If we have a PNG icon, convert it — otherwise skip
    if [[ -f "$PROJECT_ROOT/public/icon.png" ]] && command -v sips &>/dev/null; then
      ICONSET="$APP_DIR/Contents/Resources/AppIcon.iconset"
      mkdir -p "$ICONSET"
      for SIZE in 16 32 128 256 512; do
        sips -z $SIZE $SIZE "$PROJECT_ROOT/public/icon.png" --out "$ICONSET/icon_${SIZE}x${SIZE}.png" &>/dev/null || true
        DOUBLE=$((SIZE * 2))
        sips -z $DOUBLE $DOUBLE "$PROJECT_ROOT/public/icon.png" --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" &>/dev/null || true
      done
      iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/AppIcon.icns" 2>/dev/null || true
      rm -rf "$ICONSET"
    fi

    success "Created desktop app: ~/Desktop/New Order.app"
  fi
else
  info "Skipped (--no-shortcut)"
fi

# ═════════════════════════════════════════════════════════════
# Step 6 — Launch
# ═════════════════════════════════════════════════════════════
step 6 "Launching New Order…"

case $MODE in
  build)
    info "Building production bundle…"
    npm run build --silent
    success "Production build complete → dist/"
    MODE="preview"
    ;;
  preview)
    if [[ ! -d "dist" ]]; then
      warn "No dist/ folder — building first…"
      npm run build --silent
      success "Production build complete → dist/"
    else
      success "Using existing production build"
    fi
    ;;
esac

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

if [[ "$OPEN_BROWSER" == true ]]; then
  ( sleep 2 && open "$URL" ) &
  BROWSER_PID=$!
fi

echo -e "${GREEN}${BOLD}  ⚔️  Game server starting — press Ctrl+C to stop${RESET}"
echo -e "${DIM}  ─────────────────────────────────────────────────${RESET}"
echo ""

$SERVE_CMD

# Cleanup
if [[ "$OPEN_BROWSER" == true ]] && kill -0 "$BROWSER_PID" 2>/dev/null; then
  kill "$BROWSER_PID" 2>/dev/null || true
fi
