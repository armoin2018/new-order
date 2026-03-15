# ⚔️ New Order: Global Simulation Engine

A turn-based geopolitical simulation built with **React 19**, **TypeScript** (strict mode), **Vite 6**, and **Zustand 5**. Unlike traditional wargames, *New Order* prioritizes **political survival**, **diplomatic leverage**, and **economic stability** over direct combat.

> **Design Philosophy:** A player must be able to lose the game without a single shot being fired — through government collapse caused by high inflation, low prestige, and foreign-funded insurgency.

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Game Systems](#-game-systems)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Testing](#-testing)
- [Scripts](#-scripts)
- [Configuration](#-configuration)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **8 Playable Factions** — USA, China, Russia, Iran, DPRK, EU, Japan, Syria
- **60-Turn Campaigns** — Monthly geopolitical simulation from March 2026
- **5 Victory Conditions** — Military Dominance, Economic Hegemony, Diplomatic Unity, Ideological Victory, Survival
- **Psychological Engine** — 5-dimensional emotional modeling, cognitive biases, personality drift, grudge ledger
- **Information Warfare** — Deepfakes, social media virality, narrative battles, echo chambers
- **Financial Warfare** — SWIFT disconnection, sanctions, crypto evasion, debt-trap diplomacy, currency attacks
- **Nuclear Escalation Ladder** — Tactical through strategic escalation with deterrence mechanics
- **AI Leader Decision Engine** — Utility-based AI with psychological modeling and cognitive biases
- **Proxy Wars & Non-State Actors** — Proxy network graphs, autonomy/blowback, arms bazaar
- **Technology Race** — AI, quantum, semiconductor, space, cyber, biotech indices
- **Climate & Humanitarian Crises** — Resource security, refugee flows, pandemics
- **Post-Game Strategic Analysis** — Turn-by-turn replay with inflection point detection
- **Modding Support** — JSON-based scenarios, custom leaders, pluggable event handlers

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+ (LTS recommended)
- **npm** 10+

### One-Line Launch

```bash
git clone https://github.com/your-org/NewOrder.git
cd NewOrder
./play.sh
```

This installs dependencies, type-checks, and opens the game in your browser automatically.

### Manual Installation

```bash
npm install
npm run dev          # Start Vite dev server with HMR
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Launch Script Options

```bash
./play.sh              # Dev mode with HMR (default)
./play.sh --build      # Production build + preview
./play.sh --port 3000  # Custom port
./play.sh --no-open    # Don't auto-open browser
./play.sh --help       # All options
```

### Build

```bash
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
```

---

## 🏗️ Architecture

New Order uses a **layered pure-function architecture** with complete separation between game logic and presentation:

```
┌─────────────────────────────────────────────┐
│           UI Layer (React 19)               │
│   CommandCenter · Dashboard · Intel · Map   │
├─────────────────────────────────────────────┤
│        Engine Hooks (Zustand Selectors)      │
├─────────────────────────────────────────────┤
│         World State Store                    │
│    (Zustand + Immer, localStorage persist)   │
├─────────────────────────────────────────────┤
│        Engine Layer (93 Pure-Function        │
│              Game Modules)                   │
├─────────────────────────────────────────────┤
│      Data Layer (Types + Scenarios +         │
│            AJV Validation)                   │
├─────────────────────────────────────────────┤
│      Web Workers (Off-Thread Simulation)     │
└─────────────────────────────────────────────┘
```

### Key Design Decisions

- **Pure functions everywhere** — All 93 engine modules are side-effect-free. This enables trivial testing, memoization, and parallelization.
- **Immutable state** — Zustand + Immer provides structural sharing for efficient React re-renders.
- **Web Workers** — Heavy simulation runs off the UI thread via a typed `postMessage` protocol.
- **Single config** — All game constants live in `GAME_CONFIG` (`src/engine/config/`), enabling formula tuning with zero code changes.
- **AJV validation** — Scenario data is schema-validated at load time.
- **Seeded PRNG** — Deterministic simulation via Mulberry32 for reproducible replays.

---

## 🎮 Game Systems

| System | Engine Module | Description |
|--------|--------------|-------------|
| Turn Engine | `turn-engine.ts` | Turn structure, phase sequencing, game loop |
| AI Decision | `ai-evaluator.ts`, `ai-perception-engine.ts` | Utility-based leader AI with psychological modeling |
| Economy | `economic-engine.ts`, `market-reactions.ts` | GDP, trade, inflation, market reactions |
| Combat | `combat.ts`, `force-structure.ts` | Hex-based military operations |
| Diplomacy | `diplomacy-agreements.ts`, `alliance-evaluator.ts` | Treaties, alliances, credibility tracking |
| Nuclear | `nuclear-escalation.ts`, `nuclear-strike.ts` | Escalation ladder, MAD calculations |
| Civil Unrest | `civil-unrest.ts`, `insurrection-civilwar-engine.ts` | Domestic stability, regime change |
| Psychology | `emotional-state.ts`, `cognitive-bias.ts`, `personality-drift.ts` | Leader emotional modeling |
| Information War | `narrative-battle-engine.ts`, `virality-deepfake-engine.ts` | Media warfare, propaganda |
| Financial War | `financial-warfare.ts`, `sanctions-engine.ts` | SWIFT, sanctions, crypto evasion |
| Technology | `tech-index-engine.ts`, `space-ai-engine.ts` | Tech race, export controls |
| Resources | `resource-security.ts`, `strategic-reserves.ts` | Minerals, chokepoints, climate |
| Proxy Wars | `proxy-network-engine.ts`, `proxy-autonomy-engine.ts` | Non-state actors, blowback |
| Intelligence | `intel-operations.ts`, `intelligence-reliability.ts` | Espionage, fog of war |
| Strategy | `strategic-analysis-engine.ts`, `strategy-scoring-engine.ts` | Advisory, victory path analysis |
| Headlines | `headline-generator.ts` | Dynamic news generation |
| Victory/Loss | `victory-loss-core.ts`, `victory-loss-extended.ts` | Win/loss condition evaluation |

---

## 🛠️ Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | React | 19.x |
| **Language** | TypeScript | ~5.7 (strict mode) |
| **Build Tool** | Vite | 6.x |
| **State Management** | Zustand + Immer | 5.x / 11.x |
| **Validation** | AJV | 8.x |
| **Unit Testing** | Vitest | 4.x |
| **E2E Testing** | Playwright | 1.58.x |
| **Linting** | ESLint (flat config) | 9.x |
| **Formatting** | Prettier | 3.x |
| **DOM Environment** | happy-dom | 20.x |
| **Target** | ES2022 | — |

### Production Dependencies (5 only)

```
react · react-dom · zustand · immer · ajv
```

Bundle size: **222 KB raw / 70.76 KB gzip** (43 modules)

---

## 📁 Project Structure

```
NewOrder/
├── src/
│   ├── engine/           # 93 pure-function game engine modules
│   │   ├── config/       # Centralized game configuration constants
│   │   ├── __tests__/    # 91 engine test files
│   │   ├── index.ts      # Barrel re-exports
│   │   ├── store.ts      # Zustand world state store
│   │   ├── hooks.ts      # React hooks for UI bindings
│   │   ├── turn-engine.ts
│   │   └── ...           # 87 more engine files
│   ├── data/
│   │   ├── types/        # TypeScript type definitions & enums
│   │   ├── scenarios/    # March 2026 initial conditions
│   │   └── validation/   # AJV schema validation
│   ├── ui/               # React components
│   │   ├── App.tsx
│   │   ├── CommandCenter.tsx
│   │   ├── StrategicDashboard.tsx
│   │   ├── DiplomacyPanel.tsx
│   │   └── ...
│   ├── workers/          # Web Worker for off-thread simulation
│   │   ├── simulation.worker.ts
│   │   ├── simulation-bridge.ts
│   │   └── protocol.ts
│   └── main.tsx          # Application entry point
├── e2e/                  # Playwright end-to-end tests
├── .project/             # Project management
│   ├── REQUIREMENTS.md   # SRS v6.0.0 (1,150 lines)
│   ├── PLAN.json         # 132 items, 28 epics — all complete
│   └── SUMMARY.html      # Interactive project analysis report
├── .github/workflows/    # CI/CD pipelines
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 🧪 Testing

The project has comprehensive test coverage with **3,621 passing tests** across **96 test files**.

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With V8 coverage report
npm run test:e2e          # Playwright E2E tests
```

### Coverage Thresholds

Engine code (`src/engine/**`) enforces **90% minimum** coverage for lines, functions, and branches.

### Test Architecture

- **Unit tests** — Pure-function engine modules tested in isolation
- **Integration tests** — Multi-engine interactions and state transitions
- **Component tests** — React components with happy-dom
- **E2E tests** — Playwright smoke tests and gameplay flows

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint with strict rules |
| `npm run format` | Prettier format all source files |
| `npm run typecheck` | TypeScript strict type checking |
| `npm test` | Run all 3,621 Vitest tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Tests with V8 coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |

---

## ⚙️ Configuration

### TypeScript

Strict mode with all safety flags enabled:

- `strict: true`
- `noUnusedLocals` / `noUnusedParameters`
- `noUncheckedIndexedAccess`
- `verbatimModuleSyntax`
- `noFallthroughCasesInSwitch`

### Path Aliases

| Alias | Maps To |
|-------|---------|
| `@/engine/*` | `src/engine/*` |
| `@/ui/*` | `src/ui/*` |
| `@/data/*` | `src/data/*` |
| `@/workers/*` | `src/workers/*` |
| `@/assets/*` | `src/assets/*` |

### Game Configuration

All game constants (formula weights, thresholds, decay rates, modifiers) are centralized in `src/engine/config/`. Tuning game balance requires changing constants only — no code modifications.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Setting up your development environment
- Code standards and TypeScript conventions
- Testing requirements
- Pull request process

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 📊 Project Status

| Metric | Value |
|--------|-------|
| **Plan Completion** | 132/132 (100%) |
| **Tests** | 3,621 passing |
| **Source LOC** | 60,323 |
| **Test LOC** | 46,455 |
| **Bundle Size** | 70.76 KB (gzip) |
| **TypeScript Strict** | ✅ All flags |
| **ESLint** | ✅ Zero violations |

> Generated from [.project/SUMMARY.html](.project/SUMMARY.html) — March 4, 2026
