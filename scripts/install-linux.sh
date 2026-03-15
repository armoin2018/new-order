#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  New Order — Linux Installer
#  Detects distro + package manager + desktop environment,
#  installs Node.js, project dependencies, creates a .desktop
#  entry for KDE / GNOME / XFCE, and launches the game.
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
  echo "  ║   Global Simulation Engine — Linux Installer     ║"
  echo "  ╚═══════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

info()    { echo -e "  ${CYAN}▸${RESET} $1"; }
success() { echo -e "  ${GREEN}✔${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()    { echo -e "  ${RED}✖${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}[$1/$TOTAL_STEPS] $2${RESET}"; }

TOTAL_STEPS=7

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
  echo -e "${BOLD}Usage:${RESET} ./scripts/install-linux.sh [OPTIONS]"
  echo ""
  echo "  --dev            Start in development mode with HMR (default)"
  echo "  --build          Build for production and preview"
  echo "  --preview        Preview an existing production build"
  echo "  --port PORT      Port to serve on (default: 5173)"
  echo "  --skip-install   Skip npm install step"
  echo "  --no-open        Don't auto-open the browser"
  echo "  --no-shortcut    Skip desktop entry creation"
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
# Step 1 — Detect distro & package manager
# ═════════════════════════════════════════════════════════════
step 1 "Detecting Linux distribution…"

DISTRO="unknown"
PKG_MANAGER="unknown"

if [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  DISTRO="${ID:-unknown}"
  info "Distro: ${BOLD}${PRETTY_NAME:-$DISTRO}${RESET}"
else
  warn "Could not detect distro — will attempt common package managers"
fi

# Resolve package manager
if command -v apt-get &>/dev/null; then
  PKG_MANAGER="apt"
elif command -v dnf &>/dev/null; then
  PKG_MANAGER="dnf"
elif command -v yum &>/dev/null; then
  PKG_MANAGER="yum"
elif command -v pacman &>/dev/null; then
  PKG_MANAGER="pacman"
elif command -v zypper &>/dev/null; then
  PKG_MANAGER="zypper"
elif command -v apk &>/dev/null; then
  PKG_MANAGER="apk"
else
  fail "No supported package manager found (apt, dnf, yum, pacman, zypper, apk)."
fi
success "Package manager: ${PKG_MANAGER}"

# ═════════════════════════════════════════════════════════════
# Step 2 — Detect desktop environment
# ═════════════════════════════════════════════════════════════
step 2 "Detecting desktop environment…"

DESKTOP_ENV="unknown"
if [[ -n "${XDG_CURRENT_DESKTOP:-}" ]]; then
  DESKTOP_ENV="$XDG_CURRENT_DESKTOP"
elif [[ -n "${DESKTOP_SESSION:-}" ]]; then
  DESKTOP_ENV="$DESKTOP_SESSION"
fi

# Normalise to lowercase
DESKTOP_ENV_LOWER=$(echo "$DESKTOP_ENV" | tr '[:upper:]' '[:lower:]')

DE_FRIENDLY="Unknown"
case "$DESKTOP_ENV_LOWER" in
  *kde*|*plasma*)   DE_FRIENDLY="KDE Plasma"   ;;
  *gnome*)          DE_FRIENDLY="GNOME"         ;;
  *xfce*)           DE_FRIENDLY="XFCE"          ;;
  *cinnamon*)       DE_FRIENDLY="Cinnamon"      ;;
  *mate*)           DE_FRIENDLY="MATE"          ;;
  *lxde*|*lxqt*)    DE_FRIENDLY="LXQt/LXDE"    ;;
  *budgie*)         DE_FRIENDLY="Budgie"        ;;
  *i3*|*sway*|*hyprland*) DE_FRIENDLY="Tiling WM ($DESKTOP_ENV)" ;;
  *)                DE_FRIENDLY="$DESKTOP_ENV"  ;;
esac
success "Desktop: ${DE_FRIENDLY}"

# ═════════════════════════════════════════════════════════════
# Step 3 — Install system dependencies
# ═════════════════════════════════════════════════════════════
step 3 "Installing system dependencies…"

# Helper: install a package if not already present
pkg_install() {
  local pkg="$1"
  info "Installing ${pkg}…"
  case "$PKG_MANAGER" in
    apt)     sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg" ;;
    dnf)     sudo dnf install -y -q "$pkg" ;;
    yum)     sudo yum install -y -q "$pkg" ;;
    pacman)  sudo pacman -S --noconfirm --needed "$pkg" ;;
    zypper)  sudo zypper install -y "$pkg" ;;
    apk)     sudo apk add "$pkg" ;;
  esac
}

# Ensure curl & git are present
for tool in curl git; do
  if ! command -v "$tool" &>/dev/null; then
    pkg_install "$tool"
  fi
  success "$tool $(command -v "$tool")"
done

# ═════════════════════════════════════════════════════════════
# Step 4 — Install Node.js
# ═════════════════════════════════════════════════════════════
step 4 "Checking Node.js…"

install_node_via_nodesource() {
  info "Installing Node.js 22 via NodeSource…"
  if [[ "$PKG_MANAGER" == "apt" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
  elif [[ "$PKG_MANAGER" == "dnf" || "$PKG_MANAGER" == "yum" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
    sudo "$PKG_MANAGER" install -y nodejs
  elif [[ "$PKG_MANAGER" == "pacman" ]]; then
    sudo pacman -S --noconfirm --needed nodejs npm
  elif [[ "$PKG_MANAGER" == "zypper" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash -
    sudo zypper install -y nodejs
  elif [[ "$PKG_MANAGER" == "apk" ]]; then
    sudo apk add nodejs npm
  fi
}

install_node_via_nvm() {
  info "Installing Node.js 22 via nvm…"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -d "$NVM_DIR" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
}

NEED_NODE=false
if ! command -v node &>/dev/null; then
  NEED_NODE=true
else
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VERSION" -lt 20 ]]; then
    warn "Node.js v${NODE_VERSION} detected — version 20+ required."
    NEED_NODE=true
  fi
fi

if [[ "$NEED_NODE" == true ]]; then
  # Prefer NodeSource for system-wide install; fall back to nvm
  if install_node_via_nodesource 2>/dev/null; then
    success "Node.js installed via NodeSource"
  else
    warn "NodeSource failed — trying nvm…"
    install_node_via_nvm
    success "Node.js installed via nvm"
  fi
fi

success "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm not found after Node.js install — please check your PATH."
fi
success "npm $(npm -v)"

# ═════════════════════════════════════════════════════════════
# Step 5 — Install project dependencies
# ═════════════════════════════════════════════════════════════
step 5 "Installing project dependencies…"

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
# Step 6 — Desktop entry (KDE / GNOME / XFCE / freedesktop)
# ═════════════════════════════════════════════════════════════
step 6 "Creating desktop entry…"

if [[ "$CREATE_SHORTCUT" == true ]]; then
  DESKTOP_FILE="$HOME/.local/share/applications/new-order.desktop"
  DESKTOP_DIR="$HOME/Desktop"
  LAUNCHER_SCRIPT="$PROJECT_ROOT/scripts/new-order-launcher.sh"

  # Create a launcher shell script the .desktop file will call
  cat > "$LAUNCHER_SCRIPT" << LAUNCHER_EOF
#!/usr/bin/env bash
# Auto-generated launcher for New Order
cd "$PROJECT_ROOT"
exec bash "$PROJECT_ROOT/scripts/install-and-launch.sh" --dev --skip-install
LAUNCHER_EOF
  chmod +x "$LAUNCHER_SCRIPT"

  # Determine icon path
  ICON_PATH=""
  if [[ -f "$PROJECT_ROOT/public/icon.png" ]]; then
    ICON_PATH="$PROJECT_ROOT/public/icon.png"
  elif [[ -f "$PROJECT_ROOT/public/favicon.ico" ]]; then
    ICON_PATH="$PROJECT_ROOT/public/favicon.ico"
  fi

  # Create the .desktop file (freedesktop.org standard — works on KDE, GNOME, XFCE, etc.)
  mkdir -p "$(dirname "$DESKTOP_FILE")"
  cat > "$DESKTOP_FILE" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=New Order
GenericName=Geopolitical Simulation
Comment=New Order — Global Simulation Engine. A turn-based geopolitical strategy game.
Exec=bash "$LAUNCHER_SCRIPT"
Icon=${ICON_PATH:-applications-games}
Terminal=true
Categories=Game;Simulation;StrategyGame;
Keywords=geopolitics;simulation;strategy;wargame;
StartupNotify=true
StartupWMClass=new-order
DESKTOP_EOF
  chmod +x "$DESKTOP_FILE"
  success "Created application menu entry: ${DESKTOP_FILE}"

  # Also copy to ~/Desktop if the folder exists (visible on XFCE/KDE desktop)
  if [[ -d "$DESKTOP_DIR" ]]; then
    cp "$DESKTOP_FILE" "$DESKTOP_DIR/new-order.desktop"
    chmod +x "$DESKTOP_DIR/new-order.desktop"
    success "Copied shortcut to ~/Desktop"

    # KDE/GNOME may require marking as trusted
    case "$DESKTOP_ENV_LOWER" in
      *kde*|*plasma*)
        # KDE: trust via metadata
        if command -v kioclient5 &>/dev/null; then
          kioclient5 exec "$DESKTOP_DIR/new-order.desktop" --noninteractive 2>/dev/null || true
        fi
        info "KDE: Right-click the desktop icon → 'Allow Launching' if prompted"
        ;;
      *gnome*)
        # GNOME: mark trusted via gio
        if command -v gio &>/dev/null; then
          gio set "$DESKTOP_DIR/new-order.desktop" metadata::trusted true 2>/dev/null || true
        fi
        info "GNOME: You may need to right-click → 'Allow Launching'"
        ;;
      *xfce*)
        # XFCE: .desktop files on the desktop should just work
        info "XFCE: Desktop shortcut should appear automatically"
        ;;
      *)
        info "Desktop shortcut placed at ~/Desktop/new-order.desktop"
        ;;
    esac
  fi

  # Refresh desktop database so the entry shows in app launchers
  if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  fi
else
  info "Skipped (--no-shortcut)"
fi

# ═════════════════════════════════════════════════════════════
# Step 7 — Type check & Launch
# ═════════════════════════════════════════════════════════════
step 7 "Launching New Order…"

# Quick type check
if npm run typecheck --silent 2>/dev/null; then
  success "TypeScript compilation clean"
else
  warn "Type errors detected — continuing anyway"
fi

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
  (
    sleep 2
    if command -v xdg-open &>/dev/null; then
      xdg-open "$URL"
    elif command -v kde-open5 &>/dev/null; then
      kde-open5 "$URL"
    elif command -v gnome-open &>/dev/null; then
      gnome-open "$URL"
    elif command -v exo-open &>/dev/null; then
      exo-open "$URL"     # XFCE
    elif command -v sensible-browser &>/dev/null; then
      sensible-browser "$URL"
    fi
  ) &
  BROWSER_PID=$!
fi

echo -e "${GREEN}${BOLD}  ⚔️  Game server starting — press Ctrl+C to stop${RESET}"
echo -e "${DIM}  ─────────────────────────────────────────────────${RESET}"
echo ""

$SERVE_CMD

# Cleanup
if [[ "${OPEN_BROWSER}" == true ]] && [[ -n "${BROWSER_PID:-}" ]] && kill -0 "$BROWSER_PID" 2>/dev/null; then
  kill "$BROWSER_PID" 2>/dev/null || true
fi
