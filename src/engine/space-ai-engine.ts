/**
 * Space Domain & AI Supremacy Engine — CNFL-1804 / CNFL-1805
 *
 * Implements the Space-domain action subsystem (satellite deployment,
 * anti-satellite strikes, GPS disruption) and the AI-supremacy tier system
 * (autonomous drones, predictive intel, strategic AI advisor) together with
 * the AI arms-race escalation mechanic and cumulative orbital-debris model.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Space-domain constants are hardcoded per FR-1804 specification.
 * AI thresholds and bonuses are drawn from `GAME_CONFIG.technology.aiThresholds`.
 *
 * @module space-ai-engine
 * @see FR-1804 — Space Domain
 * @see FR-1805 — AI Supremacy
 */

import { GAME_CONFIG } from '@/engine/config';
import { SpaceAction } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.technology` section. */
export type SpaceAIConfig = typeof GAME_CONFIG.technology;

// ---------------------------------------------------------------------------
// FR-1804 — Space-Domain Constants (hardcoded per spec)
// ---------------------------------------------------------------------------

/** SIGINT bonus granted when a satellite is deployed. @see FR-1804 */
const SATELLITE_SIGINT_BONUS = 15;

/** Minimum Space tech level required to execute an ASAT strike. @see FR-1804 */
const ASAT_SPACE_REQUIREMENT = 60;

/** Number of turns a target faction's satellites are disabled after an ASAT. @see FR-1804 */
const ASAT_DISABLED_TURNS = 5;

/** Permanent debris penalty applied to ALL nations' Space effectiveness per ASAT. @see FR-1804 */
const ASAT_DEBRIS_PENALTY = -5;

/** Legitimacy cost incurred by the faction that executes an ASAT strike. @see FR-1804 */
const ASAT_LEGITIMACY_COST = -10;

/** Minimum Space tech level required to execute GPS disruption. @see FR-1804 */
const GPS_DISRUPTION_SPACE_REQUIREMENT = 40;

/** Military-readiness penalty applied to the target of GPS disruption. @see FR-1804 */
const GPS_DISRUPTION_READINESS_PENALTY = -10;

/** Duration (turns) of the military-readiness penalty from GPS disruption. @see FR-1804 */
const GPS_DISRUPTION_PENALTY_DURATION = 3;

// ---------------------------------------------------------------------------
// FR-1804 — evaluateSpaceAction  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating a space-domain action.
 *
 * @see FR-1804
 */
export interface SpaceActionInput {
  /** The faction performing the action. */
  readonly factionId: FactionId;
  /** The space action to evaluate. */
  readonly action: SpaceAction;
  /** Faction's current Space tech level (0–100). */
  readonly factionSpaceLevel: number;
  /** Target faction, or `null` for actions that have no specific target (e.g. DeploySatellite). */
  readonly targetFaction: FactionId | null;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a space-domain action evaluation.
 *
 * Contains eligibility, localised effects on the acting faction, target
 * faction, and global debris effects, plus a deniability flag.
 *
 * @see FR-1804
 */
export interface SpaceActionResult {
  /** The action that was evaluated. */
  readonly action: SpaceAction;
  /** Whether the faction meets all prerequisites for this action. */
  readonly eligible: boolean;
  /** Effects on the acting faction. */
  readonly factionEffects: {
    /** SIGINT bonus from satellite deployment. */
    readonly sigintBonus: number;
    /** Legitimacy cost from kinetic actions. */
    readonly legitimacyCost: number;
  };
  /** Effects on the target faction (zeroed when no target). */
  readonly targetEffects: {
    /** Number of turns the target's satellites are disabled. */
    readonly satelliteDisabledTurns: number;
    /** Military-readiness penalty applied to the target. */
    readonly militaryReadinessPenalty: number;
    /** Duration (turns) of the readiness penalty. */
    readonly readinessPenaltyDuration: number;
  };
  /** Global effects from orbital debris. */
  readonly globalEffects: {
    /** Space-effectiveness penalty applied to ALL nations. */
    readonly debrisSpacePenalty: number;
    /** Whether the penalty is permanent. */
    readonly permanent: boolean;
  };
  /** Whether the action is deniable (sub-ASAT). */
  readonly deniable: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1805 — evaluateAISupremacy  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating a faction's AI-supremacy tier.
 *
 * @see FR-1805
 */
export interface AISupremacyInput {
  /** The faction being evaluated. */
  readonly factionId: FactionId;
  /** Faction's current AI tech level (0–100). */
  readonly factionAILevel: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of an AI-supremacy evaluation.
 *
 * Indicates which capability tiers have been unlocked and the bonuses they
 * confer.
 *
 * @see FR-1805
 */
export interface AISupremacyResult {
  /** The faction that was evaluated. */
  readonly factionId: FactionId;
  /** Whether the faction has unlocked autonomous drones (AI ≥ 50). */
  readonly autonomousDrones: boolean;
  /** Military-effectiveness bonus from autonomous drones. */
  readonly autonomousDronesMilitaryBonus: number;
  /** Whether the faction has unlocked predictive intelligence (AI ≥ 70). */
  readonly predictiveIntel: boolean;
  /** Intelligence-reliability bonus from predictive intel. */
  readonly predictiveIntelReliabilityBonus: number;
  /** Whether the faction has unlocked a strategic AI advisor (AI ≥ 90). */
  readonly strategicAIAdvisor: boolean;
  /** Decision-confidence improvement from the strategic AI advisor. */
  readonly strategicAIConfidenceImprovement: number;
  /** Count of AI-supremacy thresholds met (0–3). */
  readonly activeThresholds: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1805 — evaluateAIArmsRace  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating whether two factions are in an AI arms race.
 *
 * @see FR-1805
 */
export interface AIArmsRaceInput {
  /** First faction. */
  readonly factionA: FactionId;
  /** Second faction. */
  readonly factionB: FactionId;
  /** First faction's AI tech level (0–100). */
  readonly factionAAILevel: number;
  /** Second faction's AI tech level (0–100). */
  readonly factionBAILevel: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of an AI arms-race evaluation.
 *
 * @see FR-1805
 */
export interface AIArmsRaceResult {
  /** Whether both factions exceed the arms-race threshold. */
  readonly armsRaceActive: boolean;
  /** Escalation-speed multiplier (2× when active, 1× otherwise). */
  readonly escalationMultiplier: number;
  /** The pair of factions affected, or an empty tuple when inactive. */
  readonly affectedFactions: readonly [FactionId, FactionId] | readonly [];
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1804 — computeDebrisImpact  I/O
// ---------------------------------------------------------------------------

/**
 * Input for computing cumulative orbital-debris impact.
 *
 * @see FR-1804
 */
export interface DebrisImpactInput {
  /** Cumulative number of ASAT events that have occurred in the game. */
  readonly totalASATEvents: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of cumulative orbital-debris impact computation.
 *
 * @see FR-1804
 */
export interface DebrisImpactResult {
  /** Total cumulative Space-effectiveness penalty applied to ALL nations. */
  readonly totalDebrisPenalty: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Zeroed Effect Constants (shared by ineligible / no-op branches)
// ---------------------------------------------------------------------------

/** Zeroed faction-effects object for ineligible or effect-free branches. */
const ZERO_FACTION_EFFECTS: SpaceActionResult['factionEffects'] = {
  sigintBonus: 0,
  legitimacyCost: 0,
} as const;

/** Zeroed target-effects object for ineligible or effect-free branches. */
const ZERO_TARGET_EFFECTS: SpaceActionResult['targetEffects'] = {
  satelliteDisabledTurns: 0,
  militaryReadinessPenalty: 0,
  readinessPenaltyDuration: 0,
} as const;

/** Zeroed global-effects object for ineligible or effect-free branches. */
const ZERO_GLOBAL_EFFECTS: SpaceActionResult['globalEffects'] = {
  debrisSpacePenalty: 0,
  permanent: false,
} as const;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure-function engine for Space Domain actions and AI Supremacy mechanics.
 *
 * Provides:
 * - Space-domain action evaluation (deploy satellite, ASAT, GPS disruption)
 * - AI-supremacy tier evaluation (drones, predictive intel, strategic AI)
 * - AI arms-race detection between faction pairs
 * - Cumulative orbital-debris impact calculation
 *
 * @see FR-1804 — Space Domain
 * @see FR-1805 — AI Supremacy
 */
export class SpaceAIEngine {
  private readonly cfg: SpaceAIConfig;

  /**
   * Create a new SpaceAIEngine.
   *
   * @param config - Technology configuration; defaults to `GAME_CONFIG.technology`.
   */
  constructor(config: SpaceAIConfig = GAME_CONFIG.technology) {
    this.cfg = config;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Clamp a numeric value between an inclusive min and max.
   *
   * @param value - The value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // -------------------------------------------------------------------------
  // FR-1804 — evaluateSpaceAction
  // -------------------------------------------------------------------------

  /**
   * Evaluate a space-domain action for eligibility and compute all resulting
   * effects on the acting faction, the target faction, and the global
   * orbital-debris environment.
   *
   * The method uses an exhaustive switch on {@link SpaceAction} to guarantee
   * compile-time coverage of all action variants:
   *
   * - **DeploySatellite** — always eligible; grants a SIGINT bonus.
   * - **ASAT** — requires Space ≥ 60; disables target satellites, creates
   *   permanent debris, and incurs a legitimacy cost.
   * - **GPSDisruption** — requires Space ≥ 40; penalises target military
   *   readiness for a limited duration and is deniable (sub-ASAT).
   *
   * @param input - The action, faction, target, tech level, and turn.
   * @returns A {@link SpaceActionResult} describing eligibility and effects.
   *
   * @see FR-1804
   */
  evaluateSpaceAction(input: SpaceActionInput): SpaceActionResult {
    const { action, factionSpaceLevel } = input;
    const clampedSpace = SpaceAIEngine.clamp(factionSpaceLevel, 0, 100);

    switch (action) {
      // -------------------------------------------------------------------
      // Deploy Satellite — always eligible
      // -------------------------------------------------------------------
      case SpaceAction.DeploySatellite: {
        return {
          action,
          eligible: true,
          factionEffects: {
            sigintBonus: SATELLITE_SIGINT_BONUS,
            legitimacyCost: 0,
          },
          targetEffects: { ...ZERO_TARGET_EFFECTS },
          globalEffects: { ...ZERO_GLOBAL_EFFECTS },
          deniable: false,
          reason:
            `Satellite deployed successfully. SIGINT capability increased by +${String(SATELLITE_SIGINT_BONUS)}.`,
        };
      }

      // -------------------------------------------------------------------
      // Anti-Satellite Strike — requires Space >= 60
      // -------------------------------------------------------------------
      case SpaceAction.ASAT: {
        if (clampedSpace < ASAT_SPACE_REQUIREMENT) {
          return {
            action,
            eligible: false,
            factionEffects: { ...ZERO_FACTION_EFFECTS },
            targetEffects: { ...ZERO_TARGET_EFFECTS },
            globalEffects: { ...ZERO_GLOBAL_EFFECTS },
            deniable: false,
            reason:
              `ASAT strike ineligible: Space tech level ${String(clampedSpace)} ` +
              `is below the required threshold of ${String(ASAT_SPACE_REQUIREMENT)}.`,
          };
        }

        return {
          action,
          eligible: true,
          factionEffects: {
            sigintBonus: 0,
            legitimacyCost: ASAT_LEGITIMACY_COST,
          },
          targetEffects: {
            satelliteDisabledTurns: ASAT_DISABLED_TURNS,
            militaryReadinessPenalty: 0,
            readinessPenaltyDuration: 0,
          },
          globalEffects: {
            debrisSpacePenalty: ASAT_DEBRIS_PENALTY,
            permanent: true,
          },
          deniable: false,
          reason:
            `ASAT strike executed. Target satellites disabled for ${String(ASAT_DISABLED_TURNS)} turns. ` +
            `Permanent orbital debris created (${String(ASAT_DEBRIS_PENALTY)} Space to all nations). ` +
            `Legitimacy cost: ${String(ASAT_LEGITIMACY_COST)}.`,
        };
      }

      // -------------------------------------------------------------------
      // GPS Disruption — requires Space >= 40, deniable (sub-ASAT)
      // -------------------------------------------------------------------
      case SpaceAction.GPSDisruption: {
        if (clampedSpace < GPS_DISRUPTION_SPACE_REQUIREMENT) {
          return {
            action,
            eligible: false,
            factionEffects: { ...ZERO_FACTION_EFFECTS },
            targetEffects: { ...ZERO_TARGET_EFFECTS },
            globalEffects: { ...ZERO_GLOBAL_EFFECTS },
            deniable: false,
            reason:
              `GPS disruption ineligible: Space tech level ${String(clampedSpace)} ` +
              `is below the required threshold of ${String(GPS_DISRUPTION_SPACE_REQUIREMENT)}.`,
          };
        }

        return {
          action,
          eligible: true,
          factionEffects: { ...ZERO_FACTION_EFFECTS },
          targetEffects: {
            satelliteDisabledTurns: 0,
            militaryReadinessPenalty: GPS_DISRUPTION_READINESS_PENALTY,
            readinessPenaltyDuration: GPS_DISRUPTION_PENALTY_DURATION,
          },
          globalEffects: { ...ZERO_GLOBAL_EFFECTS },
          deniable: true,
          reason:
            `GPS disruption executed. Target military readiness reduced by ` +
            `${String(GPS_DISRUPTION_READINESS_PENALTY)} for ${String(GPS_DISRUPTION_PENALTY_DURATION)} turns. ` +
            `Action is deniable (sub-ASAT).`,
        };
      }

      // -------------------------------------------------------------------
      // Exhaustiveness guard
      // -------------------------------------------------------------------
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }

  // -------------------------------------------------------------------------
  // FR-1805 — evaluateAISupremacy
  // -------------------------------------------------------------------------

  /**
   * Evaluate a faction's AI-supremacy tier based on its current AI tech level.
   *
   * Three capability tiers are assessed:
   *
   * | Tier                | Threshold | Bonus                        |
   * |---------------------|-----------|------------------------------|
   * | Autonomous Drones   | AI ≥ 50   | +0.1 military effectiveness  |
   * | Predictive Intel    | AI ≥ 70   | +0.2 intelligence reliability|
   * | Strategic AI Advisor| AI ≥ 90   | +0.3 decision confidence     |
   *
   * Each bonus value is drawn from `GAME_CONFIG.technology.aiThresholds`.
   *
   * @param input - The faction, AI level, and current turn.
   * @returns An {@link AISupremacyResult} with flags and bonuses for each tier.
   *
   * @see FR-1805
   */
  evaluateAISupremacy(input: AISupremacyInput): AISupremacyResult {
    const { factionId, factionAILevel } = input;
    const clampedAI = SpaceAIEngine.clamp(factionAILevel, 0, 100);
    const thresholds = this.cfg.aiThresholds;

    const hasDrones = clampedAI >= thresholds.autonomousDrones;
    const hasPredictive = clampedAI >= thresholds.predictiveIntel;
    const hasStrategic = clampedAI >= thresholds.strategicAI;

    const dronesBonus = hasDrones ? thresholds.autonomousDronesMilitaryBonus : 0;
    const predictiveBonus = hasPredictive ? thresholds.predictiveIntelReliabilityBonus : 0;
    const strategicBonus = hasStrategic ? thresholds.strategicAIConfidenceImprovement : 0;

    const activeCount =
      (hasDrones ? 1 : 0) +
      (hasPredictive ? 1 : 0) +
      (hasStrategic ? 1 : 0);

    const parts: string[] = [];
    if (hasDrones) {
      parts.push(
        `Autonomous Drones active (AI ${String(clampedAI)} ≥ ${String(thresholds.autonomousDrones)}): ` +
        `+${String(thresholds.autonomousDronesMilitaryBonus)} military effectiveness`,
      );
    }
    if (hasPredictive) {
      parts.push(
        `Predictive Intel active (AI ${String(clampedAI)} ≥ ${String(thresholds.predictiveIntel)}): ` +
        `+${String(thresholds.predictiveIntelReliabilityBonus)} intelligence reliability`,
      );
    }
    if (hasStrategic) {
      parts.push(
        `Strategic AI Advisor active (AI ${String(clampedAI)} ≥ ${String(thresholds.strategicAI)}): ` +
        `+${String(thresholds.strategicAIConfidenceImprovement)} decision confidence`,
      );
    }

    const reason =
      activeCount > 0
        ? `${String(activeCount)} AI tier(s) active for faction ${factionId}. ${parts.join('. ')}.`
        : `No AI tiers active for faction ${factionId} (AI level ${String(clampedAI)} below all thresholds).`;

    return {
      factionId,
      autonomousDrones: hasDrones,
      autonomousDronesMilitaryBonus: dronesBonus,
      predictiveIntel: hasPredictive,
      predictiveIntelReliabilityBonus: predictiveBonus,
      strategicAIAdvisor: hasStrategic,
      strategicAIConfidenceImprovement: strategicBonus,
      activeThresholds: activeCount,
      reason,
    };
  }

  // -------------------------------------------------------------------------
  // FR-1805 — evaluateAIArmsRace
  // -------------------------------------------------------------------------

  /**
   * Determine whether two factions are engaged in an AI arms race.
   *
   * An arms race is active when **both** factions' AI tech levels meet or
   * exceed the configured `aiArmsRaceThreshold` (default 80). While active,
   * escalation events between the two factions progress at the configured
   * multiplier (default 2×).
   *
   * @param input - The two factions, their AI levels, and the current turn.
   * @returns An {@link AIArmsRaceResult} with race status and multiplier.
   *
   * @see FR-1805
   */
  evaluateAIArmsRace(input: AIArmsRaceInput): AIArmsRaceResult {
    const { factionA, factionB, factionAAILevel, factionBAILevel } = input;
    const clampedA = SpaceAIEngine.clamp(factionAAILevel, 0, 100);
    const clampedB = SpaceAIEngine.clamp(factionBAILevel, 0, 100);
    const threshold = this.cfg.aiThresholds.aiArmsRaceThreshold;

    const aQualifies = clampedA >= threshold;
    const bQualifies = clampedB >= threshold;
    const active = aQualifies && bQualifies;

    if (active) {
      return {
        armsRaceActive: true,
        escalationMultiplier: this.cfg.aiThresholds.aiArmsRaceEscalationMultiplier,
        affectedFactions: [factionA, factionB] as const,
        reason:
          `AI arms race active between ${factionA} (AI ${String(clampedA)}) and ` +
          `${factionB} (AI ${String(clampedB)}). Both exceed threshold ${String(threshold)}. ` +
          `Escalation multiplier: ${String(this.cfg.aiThresholds.aiArmsRaceEscalationMultiplier)}×.`,
      };
    }

    const belowParts: string[] = [];
    if (!aQualifies) {
      belowParts.push(`${factionA} AI ${String(clampedA)} < ${String(threshold)}`);
    }
    if (!bQualifies) {
      belowParts.push(`${factionB} AI ${String(clampedB)} < ${String(threshold)}`);
    }

    return {
      armsRaceActive: false,
      escalationMultiplier: 1,
      affectedFactions: [] as const,
      reason:
        `No AI arms race: ${belowParts.join('; ')}. Escalation multiplier remains 1×.`,
    };
  }

  // -------------------------------------------------------------------------
  // FR-1804 — computeDebrisImpact
  // -------------------------------------------------------------------------

  /**
   * Compute the cumulative orbital-debris penalty from all ASAT events.
   *
   * Each ASAT event generates permanent debris that degrades Space
   * effectiveness for **all** nations by −5 per event. The penalty is
   * cumulative and irreversible within a game session.
   *
   * @param input - The total number of ASAT events and the current turn.
   * @returns A {@link DebrisImpactResult} with the total penalty.
   *
   * @see FR-1804
   */
  computeDebrisImpact(input: DebrisImpactInput): DebrisImpactResult {
    const { totalASATEvents } = input;
    const clampedEvents = Math.max(0, Math.round(totalASATEvents));
    const totalPenalty = clampedEvents * ASAT_DEBRIS_PENALTY;

    if (clampedEvents === 0) {
      return {
        totalDebrisPenalty: 0,
        reason: 'No ASAT events recorded. Orbital environment is clear.',
      };
    }

    return {
      totalDebrisPenalty: totalPenalty,
      reason:
        `${String(clampedEvents)} cumulative ASAT event(s) have generated permanent orbital debris. ` +
        `Total Space-effectiveness penalty for all nations: ${String(totalPenalty)}.`,
    };
  }
}
