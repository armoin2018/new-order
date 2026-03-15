/**
 * @module EchoChamber
 * @description Echo Chamber & Sycophancy system for New Order.
 *
 * Implements two complementary information-distortion mechanics that model
 * how authoritarian leaders lose contact with ground truth:
 *
 * **Echo Chamber (FR-1515)** — When any single Power Base sub-score exceeds
 * the configured threshold (default 80), the dominant faction's worldview
 * crowds out dissenting perspectives. Intelligence reliability drops, options
 * opposed to the dominant faction are penalised, faction-aligned options are
 * boosted, and existing cognitive biases intensify. Hysteresis prevents rapid
 * toggling: once active, the chamber remains until the dominant score drops
 * below the exit threshold (default 70).
 *
 * **Sycophancy Trap (FR-1516)** — When the Security Services power-base score
 * exceeds 80 AND leader paranoia exceeds 70, subordinates begin telling the
 * leader only what they want to hear. Intelligence reliability is inflated
 * (hiding failures), bad news is delayed, and civil-unrest warnings arrive
 * late. Rivals can detect this via HUMINT, making the sycophancy detectable.
 *
 * When both mechanics activate simultaneously the leader faces **compound
 * risk** — a severely degraded information environment that accelerates
 * strategic miscalculation.
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1515
 * @see FR-1516
 */

import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId } from '@/data/types';

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

/**
 * Configuration shape for the psychology sub-system, derived from
 * `GAME_CONFIG.psychology`. Keeps the engine in sync with central config.
 *
 * @see FR-1515
 * @see FR-1516
 */
export type EchoChamberConfig = typeof GAME_CONFIG.psychology;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Input for the echo-chamber evaluation.
 * @see FR-1515
 */
export interface EchoChamberInput {
  /** The leader being evaluated. */
  readonly leaderId: LeaderId;
  /** Current Power Base loyalty scores for all six domestic factions. */
  readonly powerBase: {
    readonly military: number;
    readonly oligarchs: number;
    readonly party: number;
    readonly clergy: number;
    readonly public: number;
    readonly securityServices: number;
  };
  /** Whether the echo chamber was active on the previous turn (hysteresis). */
  readonly wasInEchoChamber: boolean;
}

/**
 * Effects applied while the echo chamber is active.
 * All values are 0 when the echo chamber is inactive.
 * @see FR-1515
 */
export interface EchoChamberEffects {
  /** Modifier to intelligence reliability (e.g. −0.3). */
  readonly intelligenceReliabilityModifier: number;
  /** Utility penalty for options opposed to the dominant faction (e.g. −0.4). */
  readonly opposedUtilityModifier: number;
  /** Utility bonus for options aligned with the dominant faction (e.g. +0.25). */
  readonly factionUtilityModifier: number;
  /** Increase to existing cognitive-bias intensity (e.g. +20). */
  readonly biasIntensification: number;
}

/**
 * Result of an echo-chamber evaluation for a single leader.
 * @see FR-1515
 */
export interface EchoChamberResult {
  /** The leader evaluated. */
  readonly leaderId: LeaderId;
  /** Whether the echo chamber is currently active. */
  readonly active: boolean;
  /** Name of the Power Base key exceeding the threshold, or null. */
  readonly dominantFaction: string | null;
  /** The highest Power Base score across all six factions. */
  readonly dominantScore: number;
  /** Active effects (all zero when inactive). */
  readonly effects: EchoChamberEffects;
  /** Human-readable explanation of why the result was produced. */
  readonly reason: string;
}

/**
 * Input for the sycophancy evaluation.
 * @see FR-1516
 */
export interface SycophancyInput {
  /** The leader being evaluated. */
  readonly leaderId: LeaderId;
  /** Current Security Services power-base score (0–100). */
  readonly securityServicesScore: number;
  /** Current paranoia level (0–100). */
  readonly paranoia: number;
}

/**
 * Effects applied while the sycophancy trap is active.
 * All values are 0/false when inactive.
 * @see FR-1516
 */
export interface SycophancyEffects {
  /** Reliability inflation applied to incoming intelligence (e.g. +15). */
  readonly reliabilityInflation: number;
  /** Turns of delay before bad news reaches the leader (1 or 0). */
  readonly newsDelayTurns: number;
  /** Turns of delay before civil-unrest warnings arrive (2 or 0). */
  readonly unrestWarningDelayTurns: number;
  /** Whether rivals can detect this via HUMINT. True when active. */
  readonly detectable: boolean;
}

/**
 * Result of a sycophancy evaluation for a single leader.
 * @see FR-1516
 */
export interface SycophancyResult {
  /** The leader evaluated. */
  readonly leaderId: LeaderId;
  /** Whether the sycophancy trap is currently active. */
  readonly active: boolean;
  /** Active effects (all zero/false when inactive). */
  readonly effects: SycophancyEffects;
  /** Human-readable explanation of why the result was produced. */
  readonly reason: string;
}

/**
 * Input for a combined echo-chamber + sycophancy assessment.
 * @see FR-1515
 * @see FR-1516
 */
export interface CombinedAssessmentInput {
  /** The leader being evaluated. */
  readonly leaderId: LeaderId;
  /** Current Power Base loyalty scores for all six domestic factions. */
  readonly powerBase: {
    readonly military: number;
    readonly oligarchs: number;
    readonly party: number;
    readonly clergy: number;
    readonly public: number;
    readonly securityServices: number;
  };
  /** Current Security Services power-base score (0–100). */
  readonly securityServicesScore: number;
  /** Current paranoia level (0–100). */
  readonly paranoia: number;
  /** Whether the echo chamber was active on the previous turn. */
  readonly wasInEchoChamber: boolean;
}

/**
 * Result of a combined echo-chamber + sycophancy assessment.
 * @see FR-1515
 * @see FR-1516
 */
export interface CombinedAssessmentResult {
  /** The leader evaluated. */
  readonly leaderId: LeaderId;
  /** Echo-chamber evaluation result. */
  readonly echoChamber: EchoChamberResult;
  /** Sycophancy evaluation result. */
  readonly sycophancy: SycophancyResult;
  /** True if BOTH echo chamber and sycophancy are active simultaneously. */
  readonly compoundRisk: boolean;
  /** Human-readable explanation of the combined assessment. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that evaluates Echo Chamber and Sycophancy mechanics
 * for a single leader per invocation.
 *
 * All methods are pure functions — they accept input and return a result
 * with no side effects.
 *
 * @see FR-1515
 * @see FR-1516
 */
export class EchoChamberEngine {
  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Find the Power Base dimension with the highest score.
   *
   * @param powerBase - The six domestic-faction loyalty scores.
   * @returns The name of the dominant faction and its score.
   */
  private findDominantFaction(powerBase: EchoChamberInput['powerBase']): {
    faction: string;
    score: number;
  } {
    const entries: readonly (readonly [string, number])[] = [
      ['military', powerBase.military] as const,
      ['oligarchs', powerBase.oligarchs] as const,
      ['party', powerBase.party] as const,
      ['clergy', powerBase.clergy] as const,
      ['public', powerBase.public] as const,
      ['securityServices', powerBase.securityServices] as const,
    ];

    let bestFaction = 'military';
    let bestScore = powerBase.military;

    for (const [faction, score] of entries) {
      if (score > bestScore) {
        bestFaction = faction;
        bestScore = score;
      }
    }

    return { faction: bestFaction, score: bestScore };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Evaluate whether a leader is trapped in an echo chamber.
   *
   * The echo chamber activates when any single Power Base sub-score exceeds
   * `powerBaseThreshold` (80). Once active, it remains until the highest
   * sub-score drops below `exitThreshold` (70) — hysteresis prevents rapid
   * toggling.
   *
   * @param input - Echo-chamber evaluation input.
   * @returns The evaluation result with effects and reasoning.
   * @see FR-1515
   */
  evaluateEchoChamber(input: EchoChamberInput): EchoChamberResult {
    const cfg = GAME_CONFIG.psychology.echoChamber;
    const { faction, score } = this.findDominantFaction(input.powerBase);

    let active: boolean;
    let reason: string;

    if (input.wasInEchoChamber) {
      // Hysteresis: stays active until dominant score drops below exit threshold
      active = score >= cfg.exitThreshold;
      reason = active
        ? `Echo chamber persists: dominant faction '${faction}' score (${score}) ≥ exit threshold (${cfg.exitThreshold}).`
        : `Echo chamber dissolved: dominant faction '${faction}' score (${score}) < exit threshold (${cfg.exitThreshold}).`;
    } else {
      // Activation: triggers when any score exceeds power-base threshold
      active = score > cfg.powerBaseThreshold;
      reason = active
        ? `Echo chamber activated: dominant faction '${faction}' score (${score}) > threshold (${cfg.powerBaseThreshold}).`
        : `No echo chamber: dominant faction '${faction}' score (${score}) ≤ threshold (${cfg.powerBaseThreshold}).`;
    }

    const effects: EchoChamberEffects = active
      ? {
          intelligenceReliabilityModifier: cfg.intelligenceReliabilityPenalty,
          opposedUtilityModifier: cfg.opposedUtilityPenalty,
          factionUtilityModifier: cfg.factionUtilityBonus,
          biasIntensification: cfg.biasIntensification,
        }
      : {
          intelligenceReliabilityModifier: 0,
          opposedUtilityModifier: 0,
          factionUtilityModifier: 0,
          biasIntensification: 0,
        };

    return {
      leaderId: input.leaderId,
      active,
      dominantFaction: faction,
      dominantScore: score,
      effects,
      reason,
    };
  }

  /**
   * Evaluate whether a leader has fallen into the sycophancy trap.
   *
   * The trap activates when `securityServicesScore > securityThreshold` (80)
   * AND `paranoia > paranoiaThreshold` (70). When active, intelligence
   * reliability is inflated, bad news is delayed, and civil-unrest warnings
   * arrive late. Rivals can detect the trap via HUMINT.
   *
   * @param input - Sycophancy evaluation input.
   * @returns The evaluation result with effects and reasoning.
   * @see FR-1516
   */
  evaluateSycophancy(input: SycophancyInput): SycophancyResult {
    const cfg = GAME_CONFIG.psychology.sycophancy;

    const active =
      input.securityServicesScore > cfg.securityThreshold &&
      input.paranoia > cfg.paranoiaThreshold;

    const reason = active
      ? `Sycophancy trap active: securityServices (${input.securityServicesScore}) > ${cfg.securityThreshold} AND paranoia (${input.paranoia}) > ${cfg.paranoiaThreshold}.`
      : `No sycophancy: securityServices (${input.securityServicesScore}) ${input.securityServicesScore > cfg.securityThreshold ? '>' : '≤'} ${cfg.securityThreshold}, paranoia (${input.paranoia}) ${input.paranoia > cfg.paranoiaThreshold ? '>' : '≤'} ${cfg.paranoiaThreshold}.`;

    const effects: SycophancyEffects = active
      ? {
          reliabilityInflation: cfg.reliabilityInflation,
          newsDelayTurns: cfg.newsDelay,
          unrestWarningDelayTurns: cfg.unrestWarningDelay,
          detectable: true,
        }
      : {
          reliabilityInflation: 0,
          newsDelayTurns: 0,
          unrestWarningDelayTurns: 0,
          detectable: false,
        };

    return {
      leaderId: input.leaderId,
      active,
      effects,
      reason,
    };
  }

  /**
   * Evaluate both echo chamber and sycophancy in a single call, producing a
   * combined assessment that includes compound-risk detection.
   *
   * @param input - Combined assessment input.
   * @returns Combined result with both sub-evaluations and compound-risk flag.
   * @see FR-1515
   * @see FR-1516
   */
  evaluateCombined(input: CombinedAssessmentInput): CombinedAssessmentResult {
    const echoChamber = this.evaluateEchoChamber({
      leaderId: input.leaderId,
      powerBase: input.powerBase,
      wasInEchoChamber: input.wasInEchoChamber,
    });

    const sycophancy = this.evaluateSycophancy({
      leaderId: input.leaderId,
      securityServicesScore: input.securityServicesScore,
      paranoia: input.paranoia,
    });

    const compoundRisk = echoChamber.active && sycophancy.active;

    const reason = compoundRisk
      ? `COMPOUND RISK: Both echo chamber and sycophancy active for leader. Information environment severely degraded.`
      : `Echo chamber ${echoChamber.active ? 'active' : 'inactive'}, sycophancy ${sycophancy.active ? 'active' : 'inactive'}.`;

    return {
      leaderId: input.leaderId,
      echoChamber,
      sycophancy,
      compoundRisk,
      reason,
    };
  }
}
