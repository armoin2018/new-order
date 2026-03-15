/**
 * Multi-Action Turn System Types — FR-5000
 *
 * Type definitions for the multi-action turn system: action slates,
 * interaction effects, resolution results, and per-turn summaries.
 *
 * @see FR-5001 — Action slate composition and validation
 * @see FR-5002 — Interaction effect detection (synergy / conflict)
 * @see FR-5003 — Simultaneous action resolution
 * @see FR-5004 — Turn summary aggregation
 * @see DR-215  — Action slate data requirements
 */

// ---------------------------------------------------------------------------
// Action Type Union
// ---------------------------------------------------------------------------

/**
 * The domain category of an action within a turn slate.
 * @see FR-5001
 */
export type ActionType =
  | 'diplomatic'
  | 'military'
  | 'economic'
  | 'intelligence'
  | 'policy'
  | 'humanitarian'
  | 'technology'
  | 'propaganda';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

/**
 * Branded string type for action identifiers.
 * Format: `act_{timestamp}_{randomHex}` — guarantees uniqueness.
 */
export type ActionId = string & { readonly __brand: 'ActionId' };

// ---------------------------------------------------------------------------
// Priority & Interaction Effect
// ---------------------------------------------------------------------------

/**
 * Discrete priority level for an action (1 = highest, 5 = lowest).
 * @see FR-5001
 */
export type ActionPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Classification of the interaction between two co-scheduled actions.
 * @see FR-5002
 */
export type InteractionEffectType = 'synergy' | 'conflict' | 'neutral';

// ---------------------------------------------------------------------------
// FR-5001 — Action Definition
// ---------------------------------------------------------------------------

/**
 * A single action within a nation's turn slate.
 * @see DR-215
 * @see FR-5001
 */
export interface ActionDefinition {
  /** Unique action identifier. */
  readonly actionId: ActionId;
  /** Domain category of this action. */
  actionType: ActionType;
  /** Nation targeted by this action. */
  targetNation: string;
  /** Optional dimension targeted (e.g. 'economy', 'military'), or null. */
  targetDimension: string | null;
  /** Arbitrary parameters that customise behaviour. */
  parameters: Record<string, unknown>;
  /** Estimated impact keyed by dimension name. */
  estimatedImpact: Record<string, number>;
  /** Total resource cost of executing this action. */
  resourceCost: number;
  /** Execution priority within the slate. */
  priority: ActionPriority;
  /** Short human-readable label. */
  label: string;
  /** Longer description of intent and expected outcome. */
  description: string;
}

// ---------------------------------------------------------------------------
// FR-5002 — Interaction Effect
// ---------------------------------------------------------------------------

/**
 * Describes how two actions in the same slate interact.
 * @see FR-5002
 */
export interface InteractionEffect {
  /** First action in the pair. */
  actionIdA: ActionId;
  /** Second action in the pair. */
  actionIdB: ActionId;
  /** Classification of the interaction. */
  effectType: InteractionEffectType;
  /** Human-readable explanation of the interaction. */
  description: string;
  /** Multiplicative modifier applied to both actions' impacts. */
  impactModifier: number;
}

// ---------------------------------------------------------------------------
// DR-215 — Action Slate
// ---------------------------------------------------------------------------

/**
 * The full set of actions a nation submits for a single turn.
 * @see DR-215
 * @see FR-5001
 */
export interface ActionSlate {
  /** Nation that owns this slate. */
  nationId: string;
  /** Turn number this slate belongs to. */
  turnNumber: number;
  /** Ordered list of actions selected for this turn. */
  actions: ActionDefinition[];
  /** Maximum number of actions allowed this turn. */
  maxActions: number;
  /** Detected interaction effects between actions in the slate. */
  interactionEffects: InteractionEffect[];
  /** Whether the slate has been committed (locked for resolution). */
  committed: boolean;
}

// ---------------------------------------------------------------------------
// FR-5003 — Action Resolution Result
// ---------------------------------------------------------------------------

/**
 * Outcome of resolving a single action during turn execution.
 * @see FR-5003
 */
export interface ActionResolutionResult {
  /** The action that was resolved. */
  actionId: ActionId;
  /** Whether the action succeeded. */
  success: boolean;
  /** Actual impact keyed by dimension name (post-resolution). */
  actualImpact: Record<string, number>;
  /** AI-generated narrative summary of what happened. */
  narrativeSummary: string;
}

// ---------------------------------------------------------------------------
// FR-5004 — Turn Action Summary
// ---------------------------------------------------------------------------

/**
 * Aggregated results for all nations in a single turn.
 * @see FR-5004
 */
export interface TurnActionSummary {
  /** Turn number these results belong to. */
  turnNumber: number;
  /** Per-nation resolution summaries. */
  nationSummaries: Array<{
    /** Nation identifier. */
    nationId: string;
    /** Resolution results for each action the nation took. */
    actions: ActionResolutionResult[];
    /** Aggregate impact across all resolved actions, keyed by dimension. */
    aggregateImpact: Record<string, number>;
  }>;
}
