# Changelog

All notable changes to New Order will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-03-04

### Added

#### Phase 1 — Foundation & Core Systems
- **Project Foundation** (CNFL-0001) — React 19 + TypeScript 5.7 strict + Vite 6 + Zustand 5 + Vitest 4 scaffold
- **Turn Structure & Game Loop** (CNFL-0002) — Turn engine with phase sequencing, seeded PRNG (Mulberry32)
- **Hex Map & Unit System** (CNFL-0003) — Axial hex grid, unit registry, fog-of-war, ghost units
- **Utility-Based Leader AI** (CNFL-0004) — AI evaluator, perception engine, leader profiles
- **Economic Volatility & Trade Wars** (CNFL-0005) — GDP, inflation, trade, market reactions, inequality
- **Headlines & Perception Engine** (CNFL-0006) — Dynamic headline generation, media-driven perception
- **Grey Zone Interaction System** (CNFL-0007) — Covert ops, cyber warfare, maritime militia, hybrid warfare
- **Nation Selection & Custom Leaders** (CNFL-0008) — Faction picker, custom leader creation
- **Civil Unrest & Domestic Crisis** (CNFL-0009) — 5-stage escalation, regime change, power base

#### Phase 1 — Advanced Systems
- **Psychological Engine Core** (CNFL-0010) — 5D emotions, cognitive bias, decision fatigue, chemistry/trust
- **Strategic Pathfinding & Advisory** (CNFL-0011) — Victory path analysis, what-if simulation, loss warnings
- **Information Warfare & Narrative** (CNFL-0012) — Narrative battles, legitimacy, media ecosystems, fog of intent
- **Resource Security & Reserves** (CNFL-0013) — Critical minerals, chokepoints, strategic reserves
- **Command Center UI Shell** (CNFL-0014) — Dashboard, diplomacy panel, headlines, intel panel, action menu
- **Victory & Loss Conditions** (CNFL-0015) — 5 victory paths, loss triggers, game-end evaluation
- **Nuclear Escalation Sub-system** (CNFL-0016) — Escalation ladder, MAD, tactical-to-strategic, Iran proliferation
- **Diplomacy & Alliances** (CNFL-0017) — Agreements engine, alliance evaluator, credibility tracking
- **Intelligence & Espionage** (CNFL-0018) — Intel operations, capability scoring, intel sharing, covert insurgency
- **Military Doctrine & Capabilities** (CNFL-0019) — Force structure, geographic posture, special capabilities, invasion

#### Phase 2 — Deep Expansion
- **Psychological Engine Phase 2** (CNFL-0020) — PsyOps, personality drift, mass psychology, echo chambers, grudge ledger
- **Sanctions & Financial Warfare** (CNFL-0021) — SWIFT disconnection, secondary sanctions, crypto evasion, war economy
- **Technology Race & Innovation** (CNFL-0022) — Tech indices, export controls, tech decoupling, space/AI/quantum
- **Climate, Resources & Humanitarian** (CNFL-0023) — Climate events, refugee flows, pandemic diplomacy, mineral/food security
- **Proxy War Network & Non-State Actors** (CNFL-0024) — Proxy networks, autonomy/blowback, arms bazaar, terrorist escalation
- **Strategic Advisory Phase 2** (CNFL-0025) — Strategy scoring, rival pivot detection, nation briefings
- **Information Warfare Phase 2** (CNFL-0026) — Narrative campaigns, virality/deepfake engine
- **Phase 2 Expanded Systems** (CNFL-0027) — Double agents, insurrection/civil-war, regime/power-base, inequality/media

#### Phase 3 — Polish & Extensibility
- **Post-Game Analysis & Extensibility** (CNFL-0028) — Scenario difficulty/UN resolutions, visualization data, tutorial/modding, discovery engine, post-game analysis

### Infrastructure
- GitHub Actions CI pipeline (typecheck, lint, build, test)
- Playwright E2E test suite
- V8 coverage with 90% engine thresholds
- 5 path aliases (`@/engine`, `@/ui`, `@/data`, `@/workers`, `@/assets`)
- Structured logger for runtime diagnostics

### Metrics
- 224 TypeScript files (126 source, 92 test)
- 108,749 total lines of code
- 3,621 passing tests across 96 test files
- 70.76 KB gzip production bundle (43 modules)
- 0 ESLint violations, 0 TypeScript `any` in runtime code

## [0.3.0] — 2026-03-15

### Added

#### Game Flow UX — Quit Confirmation & Timeline Summary (CNFL-0052)
- **Quit confirmation modal** — Quit button now opens a confirmation overlay instead of immediately resetting; warns about unsaved progress and reminds player to export timeline
- **GameEndConfirmation intermediate screen** — Game-over events (stability collapse, max turns, victory conditions) now route through a confirmation screen before showing final results; offers "View Results & Reports" or "New Game"
- **Timeline Summary panel** — New 📜 Timeline tab accessible at any time during gameplay; shows turn-by-turn expandable history with faction snapshots, markets, tensions, and deep analysis
- **Timeline JSON export** — Export full game timeline as `neworder-timeline-v1` format JSON
- **Scenario seed export** — Convert current game state into a `neworder-scenario-seed-v1` format importable as a scenario for future games
- **JSON import** — File picker supporting both timeline and scenario seed formats, restoring to localStorage

### Changed
- Game-over routing now requires explicit confirmation (`endConfirmed` state) before proceeding to GameOverScreen
- Quit button triggers `showQuitConfirm` modal instead of calling `resetGame()` directly
- `PanelId` type extended with `'timeline'` variant

### Metrics
- 167 test files, 6,226 passing tests
- 296 plan items (all DONE)
- 0 TypeScript errors
