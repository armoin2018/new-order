/**
 * Insurrection & Civil War Engine — New Order
 *
 * Phase 2 expansion of civil unrest stages 4 (Insurrection) and 5 (Civil War),
 * plus ethnic fault-line foreign funding mechanics.
 *
 * All methods are **pure functions** — no side effects, no mutation of
 * `this` or input parameters. Every result is a freshly-allocated object.
 *
 * @see FR-1302 — Insurrection (61-80): armed factions, hex control loss, military diversion
 * @see FR-1302 — Civil War (81-100): nation splits, treasury division, military loyalty
 * @see FR-1303 — Ethnic tension from hostile government actions & foreign separatism funding
 */

import type {
  TurnNumber,
  NationFaultLines,
} from '@/data/types';
import { EscalationStage, NationSplitStatus } from '@/data/types';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────
// Exported type aliases & interfaces
// ─────────────────────────────────────────────────────────

/**
 * Configuration shape for insurrection, civil war, and ethnic funding parameters.
 * Derived from the runtime `GAME_CONFIG.stability` object.
 *
 * @see FR-1302
 * @see FR-1303
 */
export type InsurrectionCivilWarConfig = typeof GAME_CONFIG.stability;

/**
 * Result of evaluating insurrection onset when civil unrest transitions
 * into the Insurrection stage.
 *
 * @see FR-1302
 */
export interface InsurrectionOnsetResult {
  /** Whether the insurrection stage was triggered this evaluation. */
  readonly triggered: boolean;
  /** Number of armed faction units spawned. */
  readonly factionsSpawned: number;
  /** Strength of each spawned faction (0–100). */
  readonly factionStrength: number;
  /** Number of hexes initially affected by insurrection. */
  readonly affectedHexCount: number;
}

/**
 * Per-turn effects during an active Insurrection stage.
 *
 * @see FR-1302
 */
export interface InsurrectionEffectsResult {
  /** Number of hexes lost to insurgent control this turn. */
  readonly hexControlLost: number;
  /** Remaining government hex control as a percentage (0–100). */
  readonly remainingControlPercent: number;
  /** Military readiness change from diverting forces to insurrection. */
  readonly militaryReadinessDelta: number;
}

/**
 * Result of evaluating civil war onset when civil unrest transitions
 * into the CivilWar stage.
 *
 * @see FR-1302
 */
export interface CivilWarOnsetResult {
  /** Whether the civil war stage was triggered this evaluation. */
  readonly triggered: boolean;
  /** Number of factions the nation splits into (2–3). */
  readonly splitFactions: number;
  /** Nation's split status after evaluation. */
  readonly splitStatus: NationSplitStatus;
  /** Treasury allocated to each faction after the split. */
  readonly treasuryPerFaction: number;
}

/**
 * Per-turn effects during an active Civil War stage.
 *
 * @see FR-1302
 */
export interface CivilWarEffectsResult {
  /** Stability change per turn during civil war. */
  readonly stabilityDelta: number;
  /** Multiplier applied to economic growth (negative = contraction). */
  readonly economicGrowthMultiplier: number;
  /** Military readiness decay per individual faction. */
  readonly militaryReadinessDeltaPerFaction: number;
  /** Total military readiness delta across all factions. */
  readonly totalMilitaryReadinessDelta: number;
}

/**
 * Result of computing ethnic tension changes from foreign covert funding
 * and government hostile actions.
 *
 * @see FR-1303
 */
export interface EthnicFundingResult {
  /** Aggregate tension increase across all fault lines this turn. */
  readonly totalTensionIncrease: number;
  /** Per-fault-line tension deltas and new tension values. */
  readonly faultLineUpdates: ReadonlyArray<{
    /** Name of the ethnic/religious group. */
    readonly groupName: string;
    /** Tension change applied this turn. */
    readonly tensionDelta: number;
    /** New tension value after applying the delta. */
    readonly newTension: number;
  }>;
}

/**
 * Result of determining how military units split loyalty during civil war.
 *
 * @see FR-1302
 */
export interface MilitaryLoyaltySplitResult {
  /** Fraction of military that remains loyal to the government (0–1). */
  readonly loyalFraction: number;
  /** Loyalty fraction assigned to each rebel faction. */
  readonly rebelFractions: ReadonlyArray<{
    /** Zero-based index of the rebel faction (0 = first rebel group). */
    readonly factionIndex: number;
    /** Fraction of total military assigned to this rebel faction (0–1). */
    readonly fraction: number;
  }>;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that evaluates insurrection onset, civil-war
 * transitions, per-turn effects for both stages, ethnic fault-line
 * foreign funding mechanics, and military loyalty splits.
 *
 * Every public method is **pure**: no mutation of `this`, no
 * side effects, all results are freshly-allocated objects.
 *
 * @see FR-1302 — Insurrection & Civil War stage mechanics
 * @see FR-1303 — Ethnic tension & foreign separatism funding
 */
export class InsurrectionCivilWarEngine {
  /** Stability config snapshot — never mutated. */
  private readonly config: InsurrectionCivilWarConfig;

  /**
   * Create a new InsurrectionCivilWarEngine.
   *
   * @param config - Stability configuration (typically `GAME_CONFIG.stability`).
   */
  constructor(config: InsurrectionCivilWarConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // 1. evaluateInsurrectionOnset
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate whether an insurrection has just begun and, if so, spawn
   * armed faction units.
   *
   * A transition is detected when `civilUnrest` falls in the Insurrection
   * band (61–80) and the `previousStage` was a lower stage. When triggered,
   * the configured number of armed factions are spawned with their base
   * strength, and the initial affected hex count equals the hex-control-loss
   * rate (one turn's worth of territory lost immediately).
   *
   * @param civilUnrest   - Current civil unrest score (0–100).
   * @param previousStage - The escalation stage from the prior turn.
   * @returns An {@link InsurrectionOnsetResult} describing the transition.
   *
   * @see FR-1302
   */
  evaluateInsurrectionOnset(
    civilUnrest: number,
    previousStage: EscalationStage,
  ): InsurrectionOnsetResult {
    const clampedUnrest = clamp(civilUnrest, 0, 100);
    const thresholds = this.config.escalationThresholds;
    const expanded = this.config.insurrectionExpanded;

    const isInInsurrectionBand =
      clampedUnrest >= thresholds.insurrectionMin &&
      clampedUnrest <= thresholds.insurrectionMax;

    const wasBelow =
      previousStage === EscalationStage.Grumbling ||
      previousStage === EscalationStage.Protests ||
      previousStage === EscalationStage.Riots;

    const triggered = isInInsurrectionBand && wasBelow;

    if (!triggered) {
      return {
        triggered: false,
        factionsSpawned: 0,
        factionStrength: 0,
        affectedHexCount: 0,
      };
    }

    return {
      triggered: true,
      factionsSpawned: expanded.armedFactionsSpawned,
      factionStrength: expanded.armedFactionStrength,
      affectedHexCount: expanded.hexControlLossPerTurn,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. computeInsurrectionEffects
  // ───────────────────────────────────────────────────────

  /**
   * Compute per-turn effects while the nation remains in the
   * Insurrection stage.
   *
   * Each turn the government loses a fixed number of hexes to insurgent
   * control, and military readiness drops due to forces diverted to
   * counter-insurgency. The remaining control percentage is derived from
   * `(hexControlled − hexControlLost) / totalHexes × 100`.
   *
   * @param turn          - Current turn number (unused in formula but
   *                        available for future turn-based scaling).
   * @param hexControlled - Number of hexes the government currently controls.
   * @param totalHexes    - Total number of hexes in the nation's territory.
   * @returns An {@link InsurrectionEffectsResult} for this turn.
   *
   * @see FR-1302
   */
  computeInsurrectionEffects(
    _turn: TurnNumber,
    hexControlled: number,
    totalHexes: number,
  ): InsurrectionEffectsResult {
    const expanded = this.config.insurrectionExpanded;

    const hexControlLost = Math.min(
      expanded.hexControlLossPerTurn,
      hexControlled,
    );

    const remainingHexes = Math.max(hexControlled - hexControlLost, 0);
    const remainingControlPercent =
      totalHexes > 0
        ? clamp((remainingHexes / totalHexes) * 100, 0, 100)
        : 0;

    return {
      hexControlLost,
      remainingControlPercent,
      militaryReadinessDelta: expanded.militaryDiversionCost,
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. evaluateCivilWarOnset
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate whether a civil war has just begun and compute the
   * initial faction split and treasury division.
   *
   * A transition is detected when `civilUnrest` enters the CivilWar
   * band (81–100) from any lower stage. The nation splits into 2–3
   * factions. When `treasurySplitEqual` is true, each faction receives
   * an equal share of the national treasury; otherwise the government
   * retains half and the remainder is divided among rebel factions.
   *
   * The split count is deterministic: 2 factions at the lower end of
   * the band (81–90) and 3 factions at the upper end (91–100).
   *
   * @param civilUnrest   - Current civil unrest score (0–100).
   * @param previousStage - The escalation stage from the prior turn.
   * @param treasury      - Current national treasury value.
   * @returns A {@link CivilWarOnsetResult} describing the transition.
   *
   * @see FR-1302
   */
  evaluateCivilWarOnset(
    civilUnrest: number,
    previousStage: EscalationStage,
    treasury: number,
  ): CivilWarOnsetResult {
    const clampedUnrest = clamp(civilUnrest, 0, 100);
    const thresholds = this.config.escalationThresholds;
    const expanded = this.config.civilWarExpanded;

    const isInCivilWarBand = clampedUnrest >= thresholds.civilWarMin;

    const wasBelowCivilWar = previousStage !== EscalationStage.CivilWar;

    const triggered = isInCivilWarBand && wasBelowCivilWar;

    if (!triggered) {
      return {
        triggered: false,
        splitFactions: 0,
        splitStatus: NationSplitStatus.Intact,
        treasuryPerFaction: treasury,
      };
    }

    // Determine split count: higher unrest → more factions
    const bandMidpoint =
      thresholds.civilWarMin +
      Math.floor((100 - thresholds.civilWarMin) / 2);

    const splitFactions =
      clampedUnrest >= bandMidpoint
        ? expanded.maxSplitFactions
        : expanded.minSplitFactions;

    // Treasury division
    const treasuryPerFaction = expanded.treasurySplitEqual
      ? treasury / splitFactions
      : treasury / (splitFactions + 1); // government keeps an extra share

    return {
      triggered: true,
      splitFactions,
      splitStatus: NationSplitStatus.Split,
      treasuryPerFaction: Math.max(treasuryPerFaction, 0),
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. computeCivilWarEffects
  // ───────────────────────────────────────────────────────

  /**
   * Compute per-turn effects during an active civil war.
   *
   * Stability decays at a fixed rate. Economic growth is multiplied
   * by a negative factor. Military readiness decays per faction,
   * and the total decay is the per-faction rate × number of split
   * factions (more factions = more coordination overhead).
   *
   * @param splitFactions - Number of factions the nation has split into.
   * @param _turn         - Current turn number (available for future
   *                        turn-based scaling).
   * @returns A {@link CivilWarEffectsResult} for this turn.
   *
   * @see FR-1302
   */
  computeCivilWarEffects(
    splitFactions: number,
    _turn: TurnNumber,
  ): CivilWarEffectsResult {
    const expanded = this.config.civilWarExpanded;

    const clampedFactions = clamp(
      splitFactions,
      expanded.minSplitFactions,
      expanded.maxSplitFactions,
    );

    const militaryReadinessDeltaPerFaction =
      expanded.militaryReadinessDecayPerTurn;

    const totalMilitaryReadinessDelta =
      militaryReadinessDeltaPerFaction * clampedFactions;

    return {
      stabilityDelta: expanded.stabilityDecayPerTurn,
      economicGrowthMultiplier: expanded.economicGrowthMultiplier,
      militaryReadinessDeltaPerFaction,
      totalMilitaryReadinessDelta,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. computeEthnicFunding
  // ───────────────────────────────────────────────────────

  /**
   * Calculate ethnic tension changes from foreign covert funding and
   * government hostile actions toward minorities.
   *
   * **Foreign Funding Formula (FR-1303):**
   * ```
   * fundingTension = foreignCovertFunding × tensionPerCovertUnit
   *                × (faultLine.foreignSponsorVulnerability / 100)
   * ```
   * The funding contribution is capped at `maxFundingBoostPerTurn`.
   *
   * **Hostile Action Formula (FR-1303):**
   * ```
   * hostileTension = hostileActionsThisTurn × hostileActionTensionIncrease
   * ```
   *
   * Each fault line's total delta = min(fundingTension, cap) + hostileTension.
   * New tension is clamped to [0, 100].
   *
   * @param faultLines            - The nation's ethnic/religious fault lines.
   * @param foreignCovertFunding  - Amount of foreign covert funding this turn.
   * @param hostileActionsThisTurn - Number of hostile government actions this turn.
   * @returns An {@link EthnicFundingResult} with per-fault-line updates.
   *
   * @see FR-1303
   */
  computeEthnicFunding(
    faultLines: NationFaultLines,
    foreignCovertFunding: number,
    hostileActionsThisTurn: number,
  ): EthnicFundingResult {
    const funding = this.config.ethnicFunding;
    const lines = faultLines.faultLines;

    if (lines.length === 0) {
      return { totalTensionIncrease: 0, faultLineUpdates: [] };
    }

    const hostileTension =
      Math.max(hostileActionsThisTurn, 0) *
      funding.hostileActionTensionIncrease;

    let totalTensionIncrease = 0;

    const faultLineUpdates = lines.map((fl) => {
      const vulnerability = clamp(fl.foreignSponsorVulnerability, 0, 100);

      const rawFundingTension =
        Math.max(foreignCovertFunding, 0) *
        funding.tensionPerCovertUnit *
        (vulnerability / 100);

      const cappedFundingTension = Math.min(
        rawFundingTension,
        funding.maxFundingBoostPerTurn,
      );

      const tensionDelta = cappedFundingTension + hostileTension;
      const newTension = clamp(fl.tensionBase + tensionDelta, 0, 100);

      totalTensionIncrease += tensionDelta;

      return {
        groupName: fl.groupName,
        tensionDelta,
        newTension,
      };
    });

    return {
      totalTensionIncrease,
      faultLineUpdates,
    };
  }

  // ───────────────────────────────────────────────────────
  // 6. evaluateMilitaryLoyaltySplit
  // ───────────────────────────────────────────────────────

  /**
   * Determine how military units split loyalty during a civil war.
   *
   * A higher `powerBaseMilitary` score means the government retains
   * a larger loyal fraction. The loyal fraction is computed as:
   *
   * ```
   * loyalFraction = clamp(powerBaseMilitary / 100, 0.1, 0.9)
   * ```
   *
   * The remaining fraction `(1 − loyalFraction)` is divided equally
   * among the rebel factions (i.e. `splitFactions − 1` rebel groups,
   * since one faction is the government itself).
   *
   * @param powerBaseMilitary - Government's military power-base score (0–100).
   * @param splitFactions     - Total number of factions (including government).
   * @returns A {@link MilitaryLoyaltySplitResult} with loyalty fractions.
   *
   * @see FR-1302
   */
  evaluateMilitaryLoyaltySplit(
    powerBaseMilitary: number,
    splitFactions: number,
  ): MilitaryLoyaltySplitResult {
    const expanded = this.config.civilWarExpanded;

    const clampedFactions = clamp(
      splitFactions,
      expanded.minSplitFactions,
      expanded.maxSplitFactions,
    );

    // Government's loyal fraction — higher military power → more loyalty
    const loyalFraction = clamp(powerBaseMilitary / 100, 0.1, 0.9);

    // Rebel factions = total factions minus the government faction
    const rebelCount = clampedFactions - 1;
    const rebelTotal = 1 - loyalFraction;
    const fractionPerRebel = rebelCount > 0 ? rebelTotal / rebelCount : 0;

    const rebelFractions: ReadonlyArray<{
      readonly factionIndex: number;
      readonly fraction: number;
    }> = Array.from({ length: rebelCount }, (_, i) => ({
      factionIndex: i,
      fraction: Math.round(fractionPerRebel * 1000) / 1000,
    }));

    return {
      loyalFraction: Math.round(loyalFraction * 1000) / 1000,
      rebelFractions,
    };
  }
}
