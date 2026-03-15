/**
 * Civil War & Protest Scenario Types — FR-5300
 *
 * Type definitions for protest movements, civil war states,
 * government unrest responses, resolution outcomes, and
 * international civil war interventions.
 *
 * @see FR-5300 — Civil War & Protest Scenarios
 * @see DR-216  — Protest movement data record
 * @see DR-217  — Civil war state data record
 */

// ---------------------------------------------------------------------------
// FR-5300 — Protest Causes & Organisation
// ---------------------------------------------------------------------------

/** Root cause driving a protest movement. */
export type ProtestCause =
  | 'economic'
  | 'political'
  | 'ethnic'
  | 'religious'
  | 'ideological';

/** How organised / militarised a protest movement has become. */
export type OrganizationLevel =
  | 'spontaneous'
  | 'organized'
  | 'militant';

// ---------------------------------------------------------------------------
// FR-5300 — Government Response Options
// ---------------------------------------------------------------------------

/** Strategy the government can employ against domestic unrest. */
export type UnrestResponseType =
  | 'negotiate'
  | 'reform'
  | 'repress'
  | 'concede'
  | 'divide'
  | 'ignore';

/** Current posture of the government toward a protest movement. */
export type GovernmentResponseStatus =
  | 'none'
  | 'negotiating'
  | 'reforming'
  | 'repressing';

// ---------------------------------------------------------------------------
// FR-5300 — Civil War Resolution
// ---------------------------------------------------------------------------

/** How a civil war ultimately ends. */
export type CivilWarResolutionType =
  | 'government_victory'
  | 'rebel_victory'
  | 'negotiated_settlement'
  | 'external_intervention'
  | 'partition';

// ---------------------------------------------------------------------------
// DR-216 — Protest Movement
// ---------------------------------------------------------------------------

/**
 * Tracks a single protest movement within a nation.
 * @see DR-216
 */
export interface ProtestMovement {
  /** Unique identifier for this movement. */
  movementId: string;
  /** Nation in which the movement is active. */
  nationId: string;
  /** Human-readable name of the movement. */
  name: string;
  /** Root cause driving the protest. */
  cause: ProtestCause;
  /** Percentage of the population participating. Range: 0–100. */
  sizePercent: number;
  /** Current organisation level of the movement. */
  organizationLevel: OrganizationLevel;
  /** List of concrete demands issued by the movement. */
  demands: string[];
  /** External nation backing the movement, if any. */
  foreignBacking: { nationId: string; level: number } | null;
  /** Number of turns since the movement began. */
  turnsActive: number;
  /** Name of the movement's leader figure. */
  leaderName: string;
  /** Public sympathy toward the movement. Range: 0–100. */
  publicSympathy: number;
  /** Government's current response posture. */
  governmentResponse: GovernmentResponseStatus;
  /** Whether the movement has been resolved. */
  resolved: boolean;
}

// ---------------------------------------------------------------------------
// DR-217 — Civil War State
// ---------------------------------------------------------------------------

/**
 * Full state record for an active civil war.
 * @see DR-217
 */
export interface CivilWarState {
  /** Unique identifier for this civil war. */
  warId: string;
  /** Nation experiencing the civil war. */
  nationId: string;
  /** Name of the rebel faction. */
  rebelFactionName: string;
  /** Root cause of the conflict. */
  cause: string;
  /** Turn on which the civil war started. */
  startTurn: number;
  /** Percentage of territory under government control. Range: 0–100. */
  territoryControlPercent: number;
  /** Fraction of the military loyal to the government. Range: 0–1. */
  militarySplitRatio: number;
  /** Cumulative economic damage as a percentage. */
  economicDamagePercent: number;
  /** External nations and which side they back. */
  externalSupport: Record<string, 'government' | 'rebel'>;
  /** Total casualties since the war began. */
  casualties: number;
  /** Total refugees generated since the war began. */
  refugeesGenerated: number;
  /** How the war was resolved, or null if still active. */
  resolutionType: CivilWarResolutionType | null;
  /** Turn on which the resolution occurred, or null if still active. */
  resolutionTurn: number | null;
}

// ---------------------------------------------------------------------------
// FR-5300 — Unrest Reaction Options & Results
// ---------------------------------------------------------------------------

/**
 * A single response option the player (or AI) can choose
 * when reacting to domestic unrest.
 */
export interface UnrestReactionOption {
  /** Which response strategy this option represents. */
  type: UnrestResponseType;
  /** Short label for UI display. */
  label: string;
  /** Longer description for tooltips / detail panels. */
  description: string;
  /** Treasury cost to execute this response. */
  costTreasury: number;
  /** Immediate stability delta. */
  stabilityEffect: number;
  /** Immediate unrest delta. */
  unrestEffect: number;
  /** Diplomatic reputation delta. */
  internationalReputationEffect: number;
  /** Long-term tension delta carried forward. */
  longTermTensionEffect: number;
}

/**
 * Result of executing an unrest response against a movement.
 */
export interface UnrestResponseResult {
  /** The response strategy that was applied. */
  responseType: UnrestResponseType;
  /** Movement that was targeted. */
  targetMovementId: string;
  /** Map of dimension key → numeric effect applied. */
  effectsApplied: Record<string, number>;
  /** Human-readable narrative summarising the outcome. */
  narrativeSummary: string;
}

// ---------------------------------------------------------------------------
// FR-5300 — International Civil War Responses
// ---------------------------------------------------------------------------

/** Actions a foreign nation can take toward another nation's civil war. */
export type InternationalCivilWarResponse =
  | 'humanitarian_aid'
  | 'arms_embargo'
  | 'recognize_rebels'
  | 'deploy_peacekeepers'
  | 'exploit_chaos';

// ---------------------------------------------------------------------------
// FR-5300 — Per-Nation Aggregate Civil War State
// ---------------------------------------------------------------------------

/**
 * Aggregate civil-war and protest state for a single nation.
 */
export interface NationCivilWarState {
  /** Nation this state belongs to. */
  nationId: string;
  /** All active or recently-resolved protest movements. */
  protestMovements: ProtestMovement[];
  /** All active or recently-resolved civil wars. */
  activeCivilWars: CivilWarState[];
  /** Consecutive turns where national unrest exceeded the high threshold. */
  consecutiveHighUnrestTurns: number;
  /** Ordered history of government responses to unrest. */
  unrestResponseHistory: UnrestResponseResult[];
}
