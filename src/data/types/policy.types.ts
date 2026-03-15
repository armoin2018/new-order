/**
 * National Policy System Types — FR-5200
 *
 * Type definitions for the national policy engine: policy modelling,
 * dimensional impact tracking, policy interactions, AI-driven proposals,
 * and per-nation policy state management.
 *
 * @see FR-5200 — National Policy System
 * @see DR-213  — Policy model shape
 */

// ---------------------------------------------------------------------------
// FR-5200 — Policy Status & Enums
// ---------------------------------------------------------------------------

/**
 * Current lifecycle status of a policy.
 */
export type PolicyStatus = 'proposed' | 'active' | 'suspended' | 'repealed';

/**
 * Geographic/diplomatic scope of a policy.
 */
export type PolicyScope = 'domestic' | 'bilateral' | 'multilateral';

/**
 * Who originated the policy.
 */
export type PolicyCreator = 'player' | 'ai' | 'event';

// ---------------------------------------------------------------------------
// FR-5200 — Dimensional Impact
// ---------------------------------------------------------------------------

/**
 * A single dimensional impact produced by enacting a policy.
 */
export interface DimensionalImpact {
  /** Dimension affected (e.g. "economy", "stability", "education"). */
  dimension: string;
  /** Signed magnitude of the effect. */
  magnitude: number;
  /** Number of turns over which this impact plays out. */
  timelineTurns: number;
  /** Human-readable description of the impact. */
  description: string;
}

// ---------------------------------------------------------------------------
// FR-5200 — Policy Interaction
// ---------------------------------------------------------------------------

/**
 * How two policies relate to each other.
 */
export type PolicyInteractionType = 'synergy' | 'conflict';

// ---------------------------------------------------------------------------
// DR-213 — Policy Model
// ---------------------------------------------------------------------------

/**
 * Full policy definition (DR-213).
 */
export interface PolicyModel {
  /** Unique policy identifier. */
  policyId: string;
  /** Display name. */
  name: string;
  /** Long-form description of the policy. */
  description: string;
  /** Geographic/diplomatic scope. */
  scope: PolicyScope;
  /** Nation IDs affected, or `['domestic']` for home-only. */
  targetEntities: string[];
  /** Per-dimension impacts applied while active. */
  dimensionalImpacts: DimensionalImpact[];
  /** IDs of policies or conditions that must be met first. */
  prerequisites: string[];
  /** Treasury cost deducted each turn the policy is active. */
  costPerTurn: number;
  /** Number of turns the policy lasts, or `null` for permanent. */
  duration: number | null;
  /** Per-turn effectiveness scaling factors (0–1). */
  effectivenessCurve: number[];
  /** Narrative flavour text shown to the player. */
  narrativeContext: string;
  /** Who created the policy. */
  createdBy: PolicyCreator;
  /** Turn at which the policy was created, or `null` if pre-loaded. */
  createdAtTurn: number | null;
  /** Reason the policy was proposed, or `null`. */
  proposalReason: string | null;
  /** AI confidence score (0–100) if AI-generated, otherwise `null`. */
  aiConfidence: number | null;
}

// ---------------------------------------------------------------------------
// FR-5200 — Policy State
// ---------------------------------------------------------------------------

/**
 * Runtime state of a single policy within a nation.
 */
export interface PolicyState {
  /** Policy this state tracks. */
  policyId: string;
  /** Nation that enacted the policy. */
  nationId: string;
  /** Current lifecycle status. */
  status: PolicyStatus;
  /** Turn the policy was enacted, or `null` if still proposed. */
  enactedTurn: number | null;
  /** Current effectiveness (0–100). */
  currentEffectiveness: number;
  /** Number of turns the policy has been active. */
  turnsActive: number;
  /** Accumulated impact per dimension since enactment. */
  cumulativeImpact: Record<string, number>;
}

// ---------------------------------------------------------------------------
// FR-5200 — Policy Interaction Record
// ---------------------------------------------------------------------------

/**
 * Describes the interaction between two co-active policies.
 */
export interface PolicyInteraction {
  /** First policy in the pair. */
  policyIdA: string;
  /** Second policy in the pair. */
  policyIdB: string;
  /** Whether the policies reinforce or oppose each other. */
  interactionType: PolicyInteractionType;
  /** Human-readable explanation of the interaction. */
  description: string;
  /** Multiplicative modifier applied to combined effects. */
  impactModifier: number;
}

// ---------------------------------------------------------------------------
// FR-5200 — Policy Proposal
// ---------------------------------------------------------------------------

/**
 * A pending policy proposal awaiting player approval.
 */
export interface PolicyProposal {
  /** Policy being proposed. */
  policyId: string;
  /** Who originated the proposal. */
  source: PolicyCreator;
  /** Projected dimensional impacts. */
  impactPreview: DimensionalImpact[];
  /** Known interactions with currently active policies. */
  interactions: PolicyInteraction[];
  /** AI rationale if AI-generated, otherwise `null`. */
  aiRationale: string | null;
}

// ---------------------------------------------------------------------------
// FR-5200 — National Policy State
// ---------------------------------------------------------------------------

/**
 * Aggregate policy state for a single nation.
 */
export interface NationalPolicyState {
  /** Nation this state belongs to. */
  nationId: string;
  /** Policies currently in effect. */
  activePolicies: PolicyState[];
  /** Policies awaiting approval. */
  proposedPolicies: PolicyProposal[];
  /** Policies that have been repealed. */
  repealedPolicies: PolicyState[];
  /** Chronological log of policy actions. */
  policyHistory: Array<{ policyId: string; action: string; turn: number }>;
}
