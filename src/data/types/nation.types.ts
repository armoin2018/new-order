/**
 * Nation State Types — DR-104, DR-111, DR-112, DR-113
 *
 * Per-nation data structures covering economic health, geographic posture,
 * civil unrest mechanics, and ethnic/religious fault lines.
 */

import type { FactionId, EscalationStage, HexId, TurnNumber } from './enums';

// ---------------------------------------------------------------------------
// DR-104 — Nation State Object
// ---------------------------------------------------------------------------

/**
 * The composite state of a single nation per turn.
 *
 * This is the primary "health dashboard" for each faction.
 */
export interface NationState {
  /** Which faction this state belongs to. */
  factionId: FactionId;

  /**
   * Composite national health: (Popularity + EconomicGrowth) − (Inflation + ForeignInsurgency + CivilUnrest).
   * Range: 0–100. At 0 → regime change.
   */
  stability: number;

  /** Available financial reserves in billions (USD equivalent). */
  treasury: number;

  /** Gross domestic product in billions (USD equivalent). */
  gdp: number;

  /** Inflation rate as a percentage (0–100+). */
  inflation: number;

  /** Overall military readiness. Range: 0–100. */
  militaryReadiness: number;

  /**
   * Per-nation escalation index tracking proximity to nuclear weapon deployment.
   * Range: 0–100. Higher = closer to use.
   */
  nuclearThreshold: number;

  /** Diplomatic influence score. Range: 0–100. */
  diplomaticInfluence: number;

  /** Popular approval rating. Range: 0–100. */
  popularity: number;

  /** How reliable allies perceive this nation. Range: 0–100. */
  allianceCredibility: number;

  /** Aggregate technology level. Range: 0–100. */
  techLevel: number;
}

// ---------------------------------------------------------------------------
// DR-111 — Geographic Posture Data
// ---------------------------------------------------------------------------

/**
 * Per-nation geographic and strategic terrain data.
 *
 * Determines resilience to invasion, chokepoint leverage, and energy dependency.
 */
export interface GeographicPosture {
  factionId: FactionId;

  /**
   * Buffer between borders and core population/industrial centers.
   * Range: 0–100. Higher = more resilient.
   */
  strategicDepth: number;

  /** Natural defensive features (mountains, rivers, etc.). */
  naturalDefenses: string[];

  /** Known strategic weaknesses. */
  keyVulnerabilities: string[];

  /** Strategic chokepoints this nation controls or contests. */
  chokepointControl: string[];

  /** Net terrain advantage modifier. Range: −50 to +50. */
  terrainAdvantage: number;

  /**
   * Dependency on imported energy.
   * Range: 0–100. Higher = more dependent / more vulnerable.
   */
  energyDependency: number;
}

// ---------------------------------------------------------------------------
// DR-112 — Civil Unrest Component Data
// ---------------------------------------------------------------------------

/**
 * Per-nation per-turn breakdown of civil unrest drivers.
 *
 * When `civilUnrest` crosses thresholds it advances through
 * {@link EscalationStage} stages (Grumbling → … → CivilWar).
 */
export interface CivilUnrestComponents {
  factionId: FactionId;
  turn: TurnNumber;

  /** Composite civil unrest index. Range: 0–100. At 100 → regime change. */
  civilUnrest: number;

  /** Current inflation contribution. Range: 0–100. */
  inflation: number;

  /** Income inequality pressure. Range: 0–100. */
  inequality: number;

  /** Backlash from government repression. Range: 0–100. */
  repressionBacklash: number;

  /** Ethnic/religious tension pressure. Range: 0–100. */
  ethnicTension: number;

  /** Foreign propaganda influence. Range: 0–100. */
  foreignPropaganda: number;

  /** Current stage on the escalation ladder. */
  escalationStage: EscalationStage;
}

// ---------------------------------------------------------------------------
// DR-113 — Ethnic/Religious Fault Line Data
// ---------------------------------------------------------------------------

/**
 * A single ethnic or religious fault line within a nation.
 */
export interface EthnicFaultLine {
  /** Name of the ethnic/religious group. */
  groupName: string;

  /** Baseline tension level. Range: 0–100. */
  tensionBase: number;

  /** Events/conditions that can escalate this fault line. */
  triggers: string[];

  /**
   * Vulnerability to foreign sponsors exploiting this group.
   * Range: 0–100. Higher = more exploitable.
   */
  foreignSponsorVulnerability: number;

  /** Hex regions where this group is concentrated. */
  affectedHexRegions: HexId[];
}

/**
 * Per-nation collection of ethnic/religious fault lines.
 */
export interface NationFaultLines {
  factionId: FactionId;
  faultLines: EthnicFaultLine[];
}
