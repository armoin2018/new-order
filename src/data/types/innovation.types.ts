/**
 * Future Innovations & Discovery System Types — FR-5100
 *
 * Type definitions for the innovation research tree, discovery events,
 * multi-order impact modelling, dependency graphs, and per-nation
 * research state tracking.
 *
 * @see FR-5100 — Future Innovations & Discovery System
 * @see DR-212  — Innovation model shape
 */

// ---------------------------------------------------------------------------
// FR-5100 — Innovation Category & Tiers
// ---------------------------------------------------------------------------

/**
 * High-level research domain an innovation belongs to.
 */
export type InnovationCategory =
  | 'space'
  | 'quantum'
  | 'biotech'
  | 'ai_computing'
  | 'materials'
  | 'energy'
  | 'military'
  | 'human_enhancement'
  | 'virtual_digital';

/**
 * Innovation complexity tier (1 = near-term, 5 = far-future breakthrough).
 */
export type InnovationTier = 1 | 2 | 3 | 4 | 5;

/**
 * Multi-order impact level (1 = direct, 5 = emergent / systemic).
 */
export type ImpactOrder = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// FR-5100 — Multi-Order Impact
// ---------------------------------------------------------------------------

/**
 * A single dimension of cascading impact produced by a discovery.
 */
export interface MultiOrderImpact {
  /** Impact order (1 = direct, 5 = emergent). */
  order: ImpactOrder;
  /** Dimension affected (e.g. "economy", "military", "diplomacy"). */
  dimension: string;
  /** Human-readable description of the impact. */
  description: string;
  /** Signed magnitude of the effect. Range: −50 – +50. */
  magnitude: number;
}

// ---------------------------------------------------------------------------
// DR-212 — Innovation Model
// ---------------------------------------------------------------------------

/**
 * Core data record for a single innovation in the research tree.
 * @see DR-212
 */
export interface InnovationModel {
  /** Unique innovation identifier. */
  readonly innovationId: string;
  /** Display name. */
  name: string;
  /** Short prose description. */
  description: string;
  /** Research domain. */
  category: InnovationCategory;
  /** Complexity tier. */
  tier: InnovationTier;
  /** IDs of innovations that must be discovered first. */
  dependencies: string[];
  /** Base research cost (resource points). */
  researchCost: number;
  /** Turns required at full funding. */
  researchDuration: number;
  /** Base % chance per turn when funded. */
  discoveryProbability: number;
  /** Weighted impact distribution across dimensions. */
  impactWeights: Record<string, number>;
  /** Cascading multi-order impact definitions. */
  multiOrderImpacts: MultiOrderImpact[];
  /** Real-world progress estimate. Range: 0–100. */
  realWorldProgress: number;
  /** Tech domain minimum scores required to unlock research. */
  prerequisites: Record<string, number>;
}

// ---------------------------------------------------------------------------
// FR-5100 — Per-Nation Research State
// ---------------------------------------------------------------------------

/**
 * Tracks a single nation's progress toward discovering an innovation.
 */
export interface InnovationResearchState {
  /** The innovation being researched. */
  innovationId: string;
  /** The nation conducting research. */
  nationId: string;
  /** Current research progress. Range: 0–100. */
  researchProgress: number;
  /** Current funding allocation. Range: 0–100. */
  fundingLevel: number;
  /** Number of turns invested so far. */
  turnsInvested: number;
  /** Whether the innovation has been successfully discovered. */
  discovered: boolean;
  /** Turn on which discovery occurred, or null if not yet discovered. */
  discoveredAtTurn: number | null;
}

// ---------------------------------------------------------------------------
// FR-5100 — Discovery Event
// ---------------------------------------------------------------------------

/**
 * Event emitted when a nation successfully discovers an innovation.
 */
export interface InnovationDiscoveryEvent {
  /** The innovation that was discovered. */
  innovationId: string;
  /** The nation that made the discovery. */
  nationId: string;
  /** Turn on which the discovery occurred. */
  turn: number;
  /** News headline summarising the discovery. */
  headline: string;
  /** Immediate market-sector impact deltas. */
  marketImpact: Record<string, number>;
  /** Diplomatic relationship deltas keyed by nation. */
  diplomaticImpact: Record<string, number>;
  /** Military balance deltas, or null if not applicable. */
  militaryImpact: Record<string, number> | null;
  /** Narrative description of societal consequences. */
  societalNarrative: string;
}

// ---------------------------------------------------------------------------
// FR-5100 — Briefing Report (Web-Gathered Intelligence)
// ---------------------------------------------------------------------------

/**
 * AI-generated briefing synthesised from real-world data sources.
 */
export interface InnovationBriefingReport {
  /** Innovation this briefing covers. */
  innovationId: string;
  /** ISO-8601 timestamp when the briefing was generated. */
  generatedAt: string;
  /** Prose summary of real-world progress. */
  realWorldSummary: string;
  /** Discovery probability after real-world data adjustment. */
  adjustedProbability: number;
  /** Source URLs / references used to compile the briefing. */
  sources: string[];
}

// ---------------------------------------------------------------------------
// FR-5100 — Dependency Graph Node
// ---------------------------------------------------------------------------

/**
 * A node in the innovation dependency graph used for UI rendering
 * and prerequisite validation.
 */
export interface InnovationDependencyNode {
  /** Innovation identifier. */
  innovationId: string;
  /** Display name. */
  name: string;
  /** Complexity tier. */
  tier: InnovationTier;
  /** IDs of innovations that depend on this one. */
  children: string[];
  /** IDs of innovations this one depends on. */
  parents: string[];
  /** Current research status. */
  status: 'locked' | 'available' | 'in_progress' | 'discovered';
}

// ---------------------------------------------------------------------------
// FR-5100 — Aggregate Innovation State
// ---------------------------------------------------------------------------

/**
 * Top-level slice of game state for the innovation subsystem.
 */
export interface InnovationState {
  /** All registered innovations keyed by innovationId. */
  innovations: Record<string, InnovationModel>;
  /** Per-nation research state. Outer key = nationId, inner key = innovationId. */
  nationResearch: Record<string, Record<string, InnovationResearchState>>;
  /** Chronological log of all discovery events. */
  discoveryLog: InnovationDiscoveryEvent[];
}
