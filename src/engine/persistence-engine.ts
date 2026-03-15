/**
 * Simulation Persistence Engine — FR-4200 (DR-188, DR-189)
 *
 * Pure functions for simulation save/load, auto-save scheduling,
 * running-context document generation, and simulation browser queries.
 *
 * **No side effects** — actual file I/O lives in a separate adapter layer.
 *
 * @see FR-4201 — Auto-save simulations to disk
 * @see FR-4202 — Running context document updated each turn
 * @see FR-4203 — Simulation browser listing saved simulations
 * @see FR-4204 — Load and resume saved simulations
 * @see FR-4205 — Auto-save every N turns, manual save
 * @see DR-188  — Save directory structure
 * @see DR-189  — Running context document format
 */

import type {
  SimulationId,
  SimulationStatus,
  SimulationMetadata,
  SimulationSaveManifest,
  AutoSaveConfig,
  RunningContextSection,
  RunningContextDocument,
} from '@/data/types/persistence.types';
import { persistenceConfig } from '@/engine/config/persistence';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Random hex string of `length` characters. */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — generateSimulationId                                        FR-4201
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a unique `SimulationId` composed of a timestamp and random hex suffix.
 *
 * Format: `sim_{Date.now()}_{8 random hex chars}`
 *
 * @returns A branded SimulationId.
 * @see FR-4201
 */
export function generateSimulationId(): SimulationId {
  return `sim_${Date.now()}_${randomHex(8)}` as SimulationId;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createSimulationMetadata                                    FR-4203
// ═══════════════════════════════════════════════════════════════════════════

/** Parameters for creating fresh simulation metadata. */
export interface CreateMetadataParams {
  name: string;
  scenarioName: string;
  totalTurns: number;
  playerFaction: string;
  parentSimulationId?: SimulationId;
}

/**
 * Build initial {@link SimulationMetadata} for a brand-new simulation.
 *
 * @param params — Player-supplied creation parameters.
 * @returns Fully initialised metadata with turn 0, status 'active', score 0.
 * @see FR-4203
 */
export function createSimulationMetadata(
  params: CreateMetadataParams,
): Readonly<SimulationMetadata> {
  const now = new Date().toISOString();
  return {
    id: generateSimulationId(),
    name: params.name,
    scenarioName: params.scenarioName,
    dateCreated: now,
    lastPlayed: now,
    currentTurn: 0,
    totalTurns: params.totalTurns,
    playerFaction: params.playerFaction,
    status: params.parentSimulationId ? 'forked' : 'active',
    compositeScore: 0,
    ...(params.parentSimulationId
      ? { parentSimulationId: params.parentSimulationId }
      : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — buildSaveManifest                                           DR-188
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a {@link SimulationSaveManifest} listing every file that should
 * exist inside the simulation's save directory.
 *
 * @param metadata — The simulation's current metadata.
 * @param config   — Persistence configuration (defaults to global config).
 * @returns A manifest with the metadata and ordered file list.
 * @see DR-188
 */
export function buildSaveManifest(
  metadata: SimulationMetadata,
  config: Readonly<typeof persistenceConfig> = persistenceConfig,
): Readonly<SimulationSaveManifest> {
  const files = Object.values(config.fileNames);
  return { metadata, files };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — buildRunningContext                                         FR-4202
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal game-state surface needed for context generation. */
export interface GameStateSummary {
  currentTurn: number;
  playerFaction: string;
  compositeScore: number;
  stability: number;
  treasury: number;
  militaryReadiness: number;
  diplomaticInfluence: number;
}

/**
 * Build a {@link RunningContextDocument} from the current game state,
 * recent events, and AI analysis output.
 *
 * @param gameState    — Key metrics from the current game state.
 * @param recentEvents — Human-readable list of recent events.
 * @param aiAnalysis   — AI-generated analysis text.
 * @returns A complete running-context document ready for formatting.
 * @see FR-4202, DR-189
 */
export function buildRunningContext(
  gameState: Readonly<GameStateSummary>,
  recentEvents: readonly string[],
  aiAnalysis: string,
): Readonly<RunningContextDocument> {
  const executiveSummary = [
    `Turn ${gameState.currentTurn} — ${gameState.playerFaction}`,
    `Composite Score: ${gameState.compositeScore}`,
    `Stability: ${gameState.stability} | Treasury: ${gameState.treasury}`,
    `Military Readiness: ${gameState.militaryReadiness} | Diplomatic Influence: ${gameState.diplomaticInfluence}`,
  ].join('\n');

  const recentEventsSection =
    recentEvents.length > 0
      ? recentEvents.map((e) => `- ${e}`).join('\n')
      : '_No recent events._';

  const keyMetrics = [
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Composite Score | ${gameState.compositeScore} |`,
    `| Stability | ${gameState.stability} |`,
    `| Treasury | ${gameState.treasury} |`,
    `| Military Readiness | ${gameState.militaryReadiness} |`,
    `| Diplomatic Influence | ${gameState.diplomaticInfluence} |`,
  ].join('\n');

  const recommendations =
    aiAnalysis.length > 0
      ? 'See AI Analysis above for recommended actions.'
      : '_No recommendations available this turn._';

  return {
    sections: {
      executiveSummary,
      recentEvents: recentEventsSection,
      keyMetrics,
      aiAnalysis: aiAnalysis || '_No AI analysis available._',
      recommendations,
    },
    lastUpdatedTurn: gameState.currentTurn,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — shouldAutoSave                                              FR-4205
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether auto-save should trigger on the given turn.
 *
 * Rules:
 * - Auto-save must be enabled.
 * - Turn must be > 0 (never auto-save on the initial turn).
 * - Turn must be evenly divisible by `intervalTurns`.
 *
 * @param currentTurn — The turn that just completed.
 * @param config      — Auto-save configuration.
 * @returns `true` if auto-save should fire this turn.
 * @see FR-4205
 */
export function shouldAutoSave(
  currentTurn: number,
  config: Readonly<AutoSaveConfig>,
): boolean {
  if (!config.enabled) return false;
  if (currentTurn <= 0) return false;
  if (config.intervalTurns <= 0) return false;
  return currentTurn % config.intervalTurns === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — updateMetadataForSave                                       FR-4201
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return an updated copy of simulation metadata reflecting a save event.
 *
 * @param metadata    — Existing metadata.
 * @param currentTurn — Turn at the time of save.
 * @param score       — Latest composite score.
 * @returns New metadata with updated timestamps, turn, and score.
 * @see FR-4201
 */
export function updateMetadataForSave(
  metadata: Readonly<SimulationMetadata>,
  currentTurn: number,
  score: number,
): Readonly<SimulationMetadata> {
  return {
    ...metadata,
    currentTurn,
    compositeScore: score,
    lastPlayed: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — filterSimulations                                           FR-4203
// ═══════════════════════════════════════════════════════════════════════════

/** Optional filter criteria for the simulation browser. */
export interface SimulationFilterQuery {
  /** Case-insensitive substring match on simulation name. */
  name?: string;
  /** Exact faction match. */
  faction?: string;
  /** Exact status match. */
  status?: SimulationStatus;
}

/**
 * Filter a list of simulations by optional search criteria.
 *
 * @param simulations — Full simulation list.
 * @param query       — Optional filter criteria; omit to return all.
 * @returns Filtered array (shallow copies, original untouched).
 * @see FR-4203
 */
export function filterSimulations(
  simulations: readonly SimulationMetadata[],
  query?: SimulationFilterQuery,
): readonly SimulationMetadata[] {
  if (!query) return simulations;
  return simulations.filter((sim) => {
    if (query.name && !sim.name.toLowerCase().includes(query.name.toLowerCase())) {
      return false;
    }
    if (query.faction && sim.playerFaction !== query.faction) {
      return false;
    }
    if (query.status && sim.status !== query.status) {
      return false;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — sortSimulations                                             FR-4203
// ═══════════════════════════════════════════════════════════════════════════

/** Sortable columns in the simulation browser. */
export type SimulationSortField = keyof Pick<
  SimulationMetadata,
  'name' | 'dateCreated' | 'lastPlayed' | 'currentTurn' | 'compositeScore' | 'status' | 'playerFaction' | 'scenarioName'
>;

/**
 * Sort simulations by a given field in ascending or descending order.
 *
 * @param simulations — List to sort (not mutated).
 * @param sortBy      — Field to sort on.
 * @param direction   — `'asc'` or `'desc'`.
 * @returns A new sorted array.
 * @see FR-4203
 */
export function sortSimulations(
  simulations: readonly SimulationMetadata[],
  sortBy: SimulationSortField,
  direction: 'asc' | 'desc' = 'asc',
): readonly SimulationMetadata[] {
  const sorted = [...simulations].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }
    return String(aVal).localeCompare(String(bVal));
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — validateSaveIntegrity                                       FR-4204
// ═══════════════════════════════════════════════════════════════════════════

/** Result of a save-integrity check. */
export interface IntegrityResult {
  /** Whether the manifest passes all checks. */
  valid: boolean;
  /** List of issues found (empty when valid). */
  errors: readonly string[];
}

/**
 * Validate that a save manifest is complete and internally consistent.
 *
 * Checks:
 * - Manifest has a metadata object with a non-empty id.
 * - Manifest has a non-empty files array.
 * - All expected config file names are present in the manifest.
 * - Metadata fields are non-empty / non-negative where required.
 *
 * @param manifest — The manifest to validate.
 * @param config   — Persistence configuration (defaults to global config).
 * @returns An {@link IntegrityResult} with validity flag and error list.
 * @see FR-4204
 */
export function validateSaveIntegrity(
  manifest: Readonly<SimulationSaveManifest>,
  config: Readonly<typeof persistenceConfig> = persistenceConfig,
): Readonly<IntegrityResult> {
  const errors: string[] = [];

  // Metadata checks
  if (!manifest.metadata) {
    errors.push('Manifest is missing metadata.');
  } else {
    if (!manifest.metadata.id) {
      errors.push('Metadata is missing simulation id.');
    }
    if (!manifest.metadata.name) {
      errors.push('Metadata is missing simulation name.');
    }
    if (manifest.metadata.currentTurn < 0) {
      errors.push('Metadata currentTurn is negative.');
    }
    if (manifest.metadata.totalTurns <= 0) {
      errors.push('Metadata totalTurns must be positive.');
    }
  }

  // File list checks
  if (!manifest.files || manifest.files.length === 0) {
    errors.push('Manifest has no files listed.');
  } else {
    const expectedFiles = Object.values(config.fileNames);
    for (const expected of expectedFiles) {
      if (!manifest.files.includes(expected)) {
        errors.push(`Missing required file: ${expected}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — formatContextMarkdown                                      DR-189
// ═══════════════════════════════════════════════════════════════════════════

/** Human-readable titles for each running-context section. */
const SECTION_TITLES: Readonly<Record<RunningContextSection, string>> = {
  executiveSummary: 'Executive Summary',
  recentEvents: 'Recent Events',
  keyMetrics: 'Key Metrics',
  aiAnalysis: 'AI Analysis',
  recommendations: 'Recommendations',
};

/**
 * Format a {@link RunningContextDocument} into clean Markdown suitable
 * for writing to `currentContext.md`.
 *
 * @param context — The running context document.
 * @returns A complete Markdown string.
 * @see DR-189
 */
export function formatContextMarkdown(
  context: Readonly<RunningContextDocument>,
): string {
  const sectionOrder: readonly RunningContextSection[] = [
    'executiveSummary',
    'recentEvents',
    'keyMetrics',
    'aiAnalysis',
    'recommendations',
  ];

  const header = `# Simulation Context — Turn ${context.lastUpdatedTurn}\n\n_Generated at ${context.generatedAt}_\n`;

  const body = sectionOrder
    .map((key) => {
      const title = SECTION_TITLES[key];
      const content = context.sections[key];
      return `## ${title}\n\n${content}`;
    })
    .join('\n\n');

  return `${header}\n${body}\n`;
}
