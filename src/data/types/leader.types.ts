/**
 * Leader Psychology Types — DR-108, DR-119, DR-120, DR-121, DR-122, DR-123, DR-124
 *
 * The psychological engine is the beating heart of the simulation.
 * Every AI decision passes through the leader's profile, emotional state,
 * biases, and interpersonal relationships.
 */

import type {
  FactionId,
  LeaderId,
  DecisionStyle,
  StressResponse,
  BiasType,
  InteractionTone,
  TurnNumber,
  EventId,
} from './enums';

// ---------------------------------------------------------------------------
// DR-108 — Leader Psychological Profile
// ---------------------------------------------------------------------------

/** The leader's public identity. */
export interface LeaderIdentity {
  name: string;
  title: string;
  nation: FactionId;
  age: number;
  ideology: string;
}

/** Core psychological dimensions. */
export interface LeaderPsychology {
  decisionStyle: DecisionStyle;
  stressResponse: StressResponse;
  /** Appetite for bold moves. Range: 0–100. */
  riskTolerance: number;
  /** Likelihood of seeing threats where none exist. Range: 0–100. */
  paranoia: number;
  /** Weight given to personal legacy vs. national interest. Range: 0–100. */
  narcissism: number;
  /** Willingness to abandon ideology for survival. Range: 0–100. */
  pragmatism: number;
  /** Tolerance for slow-burn strategies. Range: 0–100. */
  patience: number;
  /** Memory for slights; likelihood of retaliatory action. Range: 0–100. */
  vengefulIndex: number;
}

/** What drives the leader forward. */
export interface LeaderMotivations {
  /** e.g. "Reunification", "Economic Dominance", "Regime Survival". */
  primaryGoal: string;
  /** e.g. "Marxist-Leninist", "MAGA Nationalism", "Shia Theocracy". */
  ideologicalCore: string;
  /** Actions that ALWAYS trigger maximum response. */
  redLines: string[];
  /** What they want history to remember. */
  legacyAmbition: string;
}

/**
 * The coalition of domestic factions sustaining the leader.
 * Each value is 0–100 representing loyalty/support.
 */
export interface PowerBase {
  /** Loyalty of armed forces. Range: 0–100. */
  military: number;
  /** Support from economic elites. Range: 0–100. */
  oligarchs: number;
  /** Ruling party/faction cohesion. Range: 0–100. */
  party: number;
  /** Religious establishment support (0 if secular). Range: 0–100. */
  clergy: number;
  /** Popular approval rating. Range: 0–100. */
  public: number;
  /** Intelligence/secret police loyalty. Range: 0–100. */
  securityServices: number;
}

/** Structural weaknesses that can topple the leader. */
export interface LeaderVulnerabilities {
  /** Probability of incapacitation per turn. Range: 0–100. */
  healthRisk: number;
  /** How orderly a transition would be (0 = chaos). Range: 0–100. */
  successionClarity: number;
  /** Probability of internal overthrow attempt. Range: 0–100. */
  coupRisk: number;
  /** Exposure to damaging information. Range: 0–100. */
  personalScandal: number;
}

/**
 * The full leader psychological profile (DR-108).
 *
 * Defined in scenario JSON; some fields (emotionalState, cognitiveBiases,
 * driftTrajectory) evolve dynamically at runtime.
 */
export interface LeaderProfile {
  readonly id: LeaderId;
  identity: LeaderIdentity;
  psychology: LeaderPsychology;
  motivations: LeaderMotivations;
  powerBase: PowerBase;
  vulnerabilities: LeaderVulnerabilities;
  /** Historical figure this leader's personality echoes. */
  historicalAnalog: string;
}

// ---------------------------------------------------------------------------
// DR-119 — Emotional State Snapshot
// ---------------------------------------------------------------------------

/**
 * Per-leader per-turn emotional state.
 *
 * All emotion fields range 0–100. The emotional state modifies
 * utility calculations, risk tolerance, and bias intensities each turn.
 */
export interface EmotionalStateSnapshot {
  leaderId: LeaderId;
  turn: TurnNumber;
  /** Accumulated pressure; high stress degrades decision quality. Range: 0–100. */
  stress: number;
  /** Self-assurance; affects risk tolerance dynamically. Range: 0–100. */
  confidence: number;
  /** Reactive emotion; amplifies aggression and retaliatory actions. Range: 0–100. */
  anger: number;
  /** Threat response; amplifies defensive/escalatory behavior. Range: 0–100. */
  fear: number;
  /** Determination under pressure; buffers against stress collapse. Range: 0–100. */
  resolve: number;
  /** Accumulated cognitive load from complex decisions. Range: 0–100. */
  decisionFatigue: number;
  /**
   * Whether this leader has developed stress resistance
   * (>20 turns under stress → −20% stress gain rate).
   */
  stressInoculated: boolean;
}

// ---------------------------------------------------------------------------
// DR-120 — Cognitive Bias Registry
// ---------------------------------------------------------------------------

/**
 * A single cognitive bias definition in the global registry.
 */
export interface CognitiveBiasDefinition {
  biasType: BiasType;
  /** Human-readable explanation of this bias. */
  description: string;
  /** Condition under which this bias activates. */
  triggerCondition: string;
  /** Formula or rule describing how this bias distorts utility scores. */
  distortionFormula: string;
  /** Leaders who carry this bias by default in the standard scenario. */
  defaultCarriers: LeaderId[];
  /** Default intensity when assigned. Range: 0–100. */
  defaultIntensity: number;
}

/**
 * A bias assignment on a specific leader (may override default intensity).
 */
export interface LeaderBiasAssignment {
  biasType: BiasType;
  /** Override intensity for this leader. Range: 0–100. */
  intensity: number;
  /** Specific trigger condition override (or use registry default). */
  trigger: string;
}

/**
 * The full cognitive bias registry plus per-leader assignments.
 */
export interface CognitiveBiasRegistry {
  /** Global catalog of all available biases. */
  definitions: CognitiveBiasDefinition[];
  /** Per-leader active bias assignments keyed by LeaderId. */
  assignments: Record<LeaderId, LeaderBiasAssignment[]>;
}

// ---------------------------------------------------------------------------
// DR-121 — Interpersonal Chemistry Matrix
// ---------------------------------------------------------------------------

/**
 * Pairwise relationship data between two leaders.
 *
 * There are C(8,2) = 28 unique pairs for the default 8 leaders.
 */
export interface InterpersonalChemistry {
  /** The two leaders in this pair. */
  leaderA: LeaderId;
  leaderB: LeaderId;
  /** Personal rapport modifier. Range: −50 to +50. */
  chemistry: number;
  /** Running trust score. Range: −100 to +100. */
  trust: number;
  /** Number of active grudges between these leaders. */
  grudgeCount: number;
  /** Tone of the most recent interaction. */
  lastInteractionTone: InteractionTone;
  /** How closely their emotional states mirror each other. Range: −100 to +100. */
  emotionalAlignment: number;
}

/**
 * Full interpersonal chemistry matrix — array of unique pairs.
 */
export type InterpersonalChemistryMatrix = InterpersonalChemistry[];

// ---------------------------------------------------------------------------
// DR-122 — Grudge Ledger
// ---------------------------------------------------------------------------

/**
 * A single grudge in a leader's memory.
 */
export interface Grudge {
  /** The leader who committed the offense. */
  offender: LeaderId;
  /** Category of the perceived slight. */
  offenseType: string;
  /** Original severity. Range: 1–10. */
  severity: number;
  /** Turn when the grudge was created. */
  turnCreated: TurnNumber;
  /** Severity after time-based decay. Range: 0–10. */
  currentDecayedSeverity: number;
  /** Whether this grudge has been resolved or avenged. */
  resolved: boolean;
}

/**
 * Per-leader grudge ledger — append-only with decay.
 */
export interface GrudgeLedger {
  leaderId: LeaderId;
  grudges: Grudge[];
}

// ---------------------------------------------------------------------------
// DR-123 — Mass Psychology Index
// ---------------------------------------------------------------------------

/**
 * Per-nation per-turn population-level psychological state.
 *
 * Feeds into CivilUnrest calculations and modifies recruitment,
 * war bond yields, and protest likelihood.
 */
export interface MassPsychologyIndex {
  factionId: FactionId;
  turn: TurnNumber;
  /** Population fear level. Range: 0–100. */
  fear: number;
  /** Population anger level. Range: 0–100. */
  anger: number;
  /** Population hope level. Range: 0–100. */
  hope: number;
  /** Exhaustion with ongoing conflict. Range: 0–100. */
  warWeariness: number;
  /** Patriotic fervor. Range: 0–100. */
  nationalism: number;
}

// ---------------------------------------------------------------------------
// DR-124 — Personality Drift Log
// ---------------------------------------------------------------------------

/**
 * A single drift event — a moment that shifted a leader's psychology.
 */
export interface DriftEvent {
  /** What caused the drift. */
  trigger: string;
  /** Related event ID if applicable. */
  eventId: EventId | null;
  /** Turn when the drift occurred. */
  turn: TurnNumber;
  /** Which psychological dimension shifted. */
  dimension: keyof LeaderPsychology;
  /** Magnitude and direction of the shift. */
  delta: number;
}

/**
 * Per-leader personality drift tracking.
 *
 * Used for post-game "Psychological Journey" visualization.
 */
export interface PersonalityDriftLog {
  leaderId: LeaderId;
  /** Immutable snapshot of initial psychology values. */
  originalProfile: LeaderPsychology;
  /** Ordered list of drift events. */
  driftEvents: DriftEvent[];
  /** How far the leader has drifted from their original profile. Range: 0–100. */
  currentDriftMagnitude: number;
  /** Turn when stress inoculation activated (null if not yet). */
  stressInoculationTurn: TurnNumber | null;
}
