/**
 * Future Innovations & Discovery System Engine — FR-5100
 *
 * Pure functions for managing innovation research, discovery rolls,
 * dependency graphs, probability computation, and per-nation research
 * state tracking.
 *
 * **No side effects** — randomness is isolated to `rollForDiscovery`.
 *
 * @see FR-5100 — Future Innovations & Discovery System
 * @see FR-5101 — Research progress & discovery
 * @see FR-5104 — Dependency graph & prerequisites
 * @see FR-5105 — Discovery probability & real-world adjustment
 * @see FR-5106 — Discovery event generation
 */

import type {
  InnovationModel,
  InnovationState,
  InnovationResearchState,
  InnovationDiscoveryEvent,
  InnovationDependencyNode,
  InnovationCategory,
  InnovationTier,
} from '@/data/types/innovation.types';
import { innovationConfig } from '@/engine/config/innovation';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeInnovationState                                   FR-5101
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a fresh {@link InnovationState} from an array of innovation models.
 *
 * The resulting state contains all innovations keyed by their
 * `innovationId`, an empty `nationResearch` map, and an empty
 * `discoveryLog`.
 *
 * @param innovations — Array of innovation model records to register.
 * @returns A fully initialised innovation state slice.
 * @see FR-5101
 */
export function initializeInnovationState(
  innovations: InnovationModel[],
): InnovationState {
  const innovationMap: Record<string, InnovationModel> = {};
  for (const innovation of innovations) {
    innovationMap[innovation.innovationId] = innovation;
  }
  return {
    innovations: innovationMap,
    nationResearch: {},
    discoveryLog: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — initializeResearchState                                     FR-5101
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh {@link InnovationResearchState} for a nation beginning
 * research on a specific innovation.
 *
 * All progress fields start at zero and `discovered` is `false`.
 *
 * @param innovationId — The innovation to begin researching.
 * @param nationId — The nation conducting the research.
 * @returns A zeroed-out research state.
 * @see FR-5101
 */
export function initializeResearchState(
  innovationId: string,
  nationId: string,
): InnovationResearchState {
  return {
    innovationId,
    nationId,
    researchProgress: 0,
    fundingLevel: 0,
    turnsInvested: 0,
    discovered: false,
    discoveredAtTurn: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — canResearch                                                 FR-5104
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether a nation is eligible to begin researching an innovation.
 *
 * Requirements:
 * 1. Every innovation listed in `innovation.dependencies` must already be
 *    `discovered` in the nation's research map.
 * 2. The nation must not already be researching more than
 *    `maxSimultaneous` innovations (defaults to the config value).
 *
 * @param innovation — The innovation the nation wants to research.
 * @param nationResearch — The nation's current research map (keyed by innovationId).
 * @param maxSimultaneous — Optional override for the simultaneous research cap.
 * @returns `true` if all dependencies are met and the cap is not exceeded.
 * @see FR-5104
 */
export function canResearch(
  innovation: InnovationModel,
  nationResearch: Record<string, InnovationResearchState>,
  maxSimultaneous?: number,
): boolean {
  const cap = maxSimultaneous ?? innovationConfig.research.maxSimultaneousResearch;

  // All dependencies must be discovered
  const dependenciesMet = innovation.dependencies.every((depId) => {
    const dep = nationResearch[depId];
    return dep !== undefined && dep.discovered;
  });

  if (!dependenciesMet) return false;

  // Count active (in-progress, not yet discovered) research slots
  const activeCount = Object.values(nationResearch).filter(
    (r) => !r.discovered && r.researchProgress > 0,
  ).length;

  return activeCount < cap;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — advanceResearch                                             FR-5101
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Advance a nation's research progress for a single turn based on the
 * current funding level.
 *
 * Progress gained per turn is:
 * ```
 * gain = progressPerTurnFunded × (fundingLevel / 100)
 * ```
 *
 * Progress is clamped to the 0–100 range.
 *
 * @param research — Current research state.
 * @param fundingLevel — Funding allocation for this turn (0–100).
 * @returns Updated research state with incremented progress and turns.
 * @see FR-5101
 */
export function advanceResearch(
  research: InnovationResearchState,
  fundingLevel: number,
): InnovationResearchState {
  if (research.discovered) return research;

  const gain =
    innovationConfig.research.progressPerTurnFunded * (fundingLevel / 100);
  const newProgress = Math.min(100, Math.max(0, research.researchProgress + gain));

  return {
    ...research,
    researchProgress: newProgress,
    fundingLevel,
    turnsInvested: research.turnsInvested + 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — applyResearchDecay                                          FR-5101
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply progress decay to an unfunded research line.
 *
 * When a nation stops funding an innovation, accumulated progress slowly
 * erodes at the configured {@link innovationConfig.research.unfundedDecayRate}.
 *
 * Progress is clamped to a minimum of `0`.
 *
 * @param research — Current research state.
 * @returns Updated research state with decayed progress.
 * @see FR-5101
 */
export function applyResearchDecay(
  research: InnovationResearchState,
): InnovationResearchState {
  if (research.discovered) return research;

  const decayed = Math.max(
    0,
    research.researchProgress - innovationConfig.research.unfundedDecayRate,
  );

  return {
    ...research,
    researchProgress: decayed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — rollForDiscovery                                            FR-5101
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Perform a random discovery check for a research line.
 *
 * The threshold is computed from the innovation's `discoveryProbability`
 * scaled by the current research progress (0–100).
 *
 * A random roll (`Math.random() * 100`) at or below the threshold
 * indicates a successful discovery.
 *
 * @param research — Current research state.
 * @param innovation — The innovation model being researched.
 * @returns An object with `discovered`, the raw `roll`, and the computed `threshold`.
 * @see FR-5101
 */
export function rollForDiscovery(
  research: InnovationResearchState,
  innovation: InnovationModel,
): { discovered: boolean; roll: number; threshold: number } {
  const threshold = computeDiscoveryProbability(
    innovation.discoveryProbability,
    research.researchProgress,
    research.fundingLevel,
    innovation.realWorldProgress,
  );

  const roll = Math.random() * 100;

  return {
    discovered: roll <= threshold,
    roll,
    threshold,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — processDiscovery                                            FR-5106
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process a successful discovery, updating the research state and
 * generating a {@link InnovationDiscoveryEvent}.
 *
 * The event contains a headline, basic market / diplomatic / military
 * impact records derived from the innovation's `impactWeights`, and a
 * placeholder societal narrative.
 *
 * @param research — Current research state (will be marked discovered).
 * @param innovation — The innovation that was discovered.
 * @param turn — Turn on which the discovery occurred.
 * @param nationId — The nation that made the discovery.
 * @returns An object with the updated `research` state and the `event`.
 * @see FR-5106
 */
export function processDiscovery(
  research: InnovationResearchState,
  innovation: InnovationModel,
  turn: number,
  nationId: string,
): { research: InnovationResearchState; event: InnovationDiscoveryEvent } {
  const updatedResearch: InnovationResearchState = {
    ...research,
    discovered: true,
    discoveredAtTurn: turn,
    researchProgress: 100,
  };

  // Derive basic impact records from impactWeights
  const marketImpact: Record<string, number> = {};
  const diplomaticImpact: Record<string, number> = {};
  const militaryImpact: Record<string, number> = {};
  let hasMilitaryImpact = false;

  for (const [dimension, weight] of Object.entries(innovation.impactWeights) as [string, number][]) {
    if (dimension === 'military') {
      militaryImpact[nationId] = weight;
      hasMilitaryImpact = true;
    } else if (dimension === 'diplomacy') {
      diplomaticImpact[nationId] = weight;
    } else {
      marketImpact[dimension] = weight;
    }
  }

  const event: InnovationDiscoveryEvent = {
    innovationId: innovation.innovationId,
    nationId,
    turn,
    headline: `[${nationId}] achieves [${innovation.name}]!`,
    marketImpact,
    diplomaticImpact,
    militaryImpact: hasMilitaryImpact ? militaryImpact : null,
    societalNarrative: `The discovery of ${innovation.name} marks a turning point in ${innovation.category} research.`,
  };

  return { research: updatedResearch, event };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildDependencyGraph                                        FR-5104
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the full innovation dependency graph annotated with each node's
 * current research status.
 *
 * Status is determined as follows:
 * - `discovered` — the nation has discovered the innovation.
 * - `in_progress` — the nation is actively researching it.
 * - `available` — all dependencies are met but research has not started.
 * - `locked` — one or more dependencies are not yet discovered.
 *
 * @param innovations — Array of all innovation models.
 * @param nationResearch — The nation's current research map.
 * @returns An array of {@link InnovationDependencyNode} entries.
 * @see FR-5104
 */
export function buildDependencyGraph(
  innovations: InnovationModel[],
  nationResearch: Record<string, InnovationResearchState>,
): InnovationDependencyNode[] {
  // Pre-compute reverse (child) edges
  const childrenMap: Record<string, string[]> = {};
  for (const inn of innovations) {
    childrenMap[inn.innovationId] = [];
  }
  for (const inn of innovations) {
    for (const depId of inn.dependencies) {
      if (childrenMap[depId]) {
        childrenMap[depId].push(inn.innovationId);
      }
    }
  }

  return innovations.map((inn): InnovationDependencyNode => {
    const research = nationResearch[inn.innovationId];
    let status: InnovationDependencyNode['status'];

    if (research?.discovered) {
      status = 'discovered';
    } else if (research && research.researchProgress > 0) {
      status = 'in_progress';
    } else {
      const allDepsMet = inn.dependencies.every((depId) => {
        const depResearch = nationResearch[depId];
        return depResearch !== undefined && depResearch.discovered;
      });
      status = allDepsMet ? 'available' : 'locked';
    }

    return {
      innovationId: inn.innovationId,
      name: inn.name,
      tier: inn.tier,
      children: childrenMap[inn.innovationId] ?? [],
      parents: [...inn.dependencies],
      status,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — validateDependencyChain                                     FR-5104
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that the innovation dependency graph contains no circular
 * dependencies.
 *
 * Uses a DFS-based cycle detection algorithm. If any cycles are found
 * they are returned as arrays of innovation IDs forming the cycle.
 *
 * @param innovations — Array of all innovation models.
 * @returns An object with `valid` (`true` if no cycles) and `circularDeps`.
 * @see FR-5104
 */
export function validateDependencyChain(
  innovations: InnovationModel[],
): { valid: boolean; circularDeps: string[][] } {
  const circularDeps: string[][] = [];

  const WHITE = 0; // unvisited
  const GRAY = 1;  // in current path
  const BLACK = 2; // fully processed

  const color: Record<string, number> = {};
  const parent: Record<string, string | null> = {};

  // Build adjacency: innovation → its dependencies (edges point to deps)
  const adjMap: Record<string, string[]> = {};
  for (const inn of innovations) {
    adjMap[inn.innovationId] = [...inn.dependencies];
    color[inn.innovationId] = WHITE;
    parent[inn.innovationId] = null;
  }

  function dfs(nodeId: string, path: string[]): void {
    color[nodeId] = GRAY;
    path.push(nodeId);

    for (const depId of adjMap[nodeId] ?? []) {
      if (color[depId] === GRAY) {
        // Found a cycle — extract it
        const cycleStart = path.indexOf(depId);
        if (cycleStart !== -1) {
          circularDeps.push([...path.slice(cycleStart), depId]);
        }
      } else if (color[depId] === WHITE) {
        parent[depId] = nodeId;
        dfs(depId, path);
      }
    }

    path.pop();
    color[nodeId] = BLACK;
  }

  for (const inn of innovations) {
    if (color[inn.innovationId] === WHITE) {
      dfs(inn.innovationId, []);
    }
  }

  return {
    valid: circularDeps.length === 0,
    circularDeps,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getInnovationsByCategory                                   FR-5100
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter innovations by their research category.
 *
 * @param innovations — Innovation map keyed by innovationId.
 * @param category — The target {@link InnovationCategory}.
 * @returns Array of matching innovation models.
 * @see FR-5100
 */
export function getInnovationsByCategory(
  innovations: Record<string, InnovationModel>,
  category: InnovationCategory,
): InnovationModel[] {
  return Object.values(innovations).filter((inn) => inn.category === category);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — getInnovationsByTier                                       FR-5100
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter innovations by their complexity tier.
 *
 * @param innovations — Innovation map keyed by innovationId.
 * @param tier — The target {@link InnovationTier} (1–5).
 * @returns Array of matching innovation models.
 * @see FR-5100
 */
export function getInnovationsByTier(
  innovations: Record<string, InnovationModel>,
  tier: InnovationTier,
): InnovationModel[] {
  return Object.values(innovations).filter((inn) => inn.tier === tier);
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — computeDiscoveryProbability                                FR-5105
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the effective per-turn discovery probability by combining
 * the base probability with funding, progress, and real-world modifiers.
 *
 * Formula:
 * ```
 * progressFactor  = progress / 100
 * fundingFactor   = 1 + ((fundingLevel / 100) × (fundingBonusMultiplier - 1))
 * realWorldFactor = 1 + (realWorldProgress / 100 × realWorldDataWeight)
 * raw             = base × progressFactor × fundingFactor × realWorldFactor
 * result          = clamp(raw, 0, maxChancePerTurn)
 * ```
 *
 * @param base — Base discovery probability from the innovation model.
 * @param progress — Current research progress (0–100).
 * @param fundingLevel — Current funding level (0–100).
 * @param realWorldProgress — Real-world progress estimate (0–100).
 * @returns Clamped discovery probability (0–{@link innovationConfig.discovery.maxChancePerTurn}).
 * @see FR-5105
 */
export function computeDiscoveryProbability(
  base: number,
  progress: number,
  fundingLevel: number,
  realWorldProgress: number,
): number {
  const { fundingBonusMultiplier, realWorldDataWeight, maxChancePerTurn } =
    innovationConfig.discovery;

  const progressFactor = progress / 100;
  const fundingFactor =
    1 + (fundingLevel / 100) * (fundingBonusMultiplier - 1);
  const realWorldFactor =
    1 + (realWorldProgress / 100) * realWorldDataWeight;

  const raw = base * progressFactor * fundingFactor * realWorldFactor;

  return Math.min(maxChancePerTurn, Math.max(0, raw));
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 — adjustProbabilityFromRealWorld                             FR-5105
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update an innovation model's `realWorldProgress` field from an
 * externally-supplied real-world progress value, clamped to 0–100.
 *
 * Returns a new model instance — the original is not mutated.
 *
 * @param innovation — The innovation model to update.
 * @param realWorldProgress — New real-world progress value (0–100).
 * @returns A copy of the innovation with the updated `realWorldProgress`.
 * @see FR-5105
 */
export function adjustProbabilityFromRealWorld(
  innovation: InnovationModel,
  realWorldProgress: number,
): InnovationModel {
  return {
    ...innovation,
    realWorldProgress: Math.min(100, Math.max(0, realWorldProgress)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 14 — getResearchSummary                                         FR-5100
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produce a concise statistical summary of a nation's innovation research
 * for dashboards and logs.
 *
 * Categories:
 * - **total** — total number of research entries.
 * - **inProgress** — researching but not yet discovered (progress > 0).
 * - **discovered** — successfully discovered.
 * - **locked** — not yet started (progress = 0, not discovered).
 *
 * @param nationResearch — The nation's research map keyed by innovationId.
 * @returns Summary counts.
 * @see FR-5100
 */
export function getResearchSummary(
  nationResearch: Record<string, InnovationResearchState>,
): { total: number; inProgress: number; discovered: number; locked: number } {
  const entries = Object.values(nationResearch);
  let inProgress = 0;
  let discovered = 0;
  let locked = 0;

  for (const r of entries) {
    if (r.discovered) {
      discovered++;
    } else if (r.researchProgress > 0) {
      inProgress++;
    } else {
      locked++;
    }
  }

  return {
    total: entries.length,
    inProgress,
    discovered,
    locked,
  };
}
