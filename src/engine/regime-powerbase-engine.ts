/**
 * Regime Power Base Engine — New Order
 *
 * Implements martial law, regime change, power base erosion,
 * and coup attempts. All methods are pure functions that return
 * new objects; no side effects.
 *
 * @see FR-1308 — Martial Law
 * @see FR-1309 — Regime Change
 * @see FR-1310 — Power Base Erosion
 * @see FR-1311 — Coup Attempts
 */

import type {
  LeaderPsychology,
  PowerBase,
} from '@/data/types';
import {
  CoupOutcome,
  RegimeChangeType,
  PowerBaseCategory,
} from '@/data/types';
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
 * Configuration shape for stability & power-base parameters.
 * Derived from the runtime `GAME_CONFIG` object.
 *
 * @see FR-1308
 * @see FR-1309
 * @see FR-1310
 * @see FR-1311
 */
export type RegimePowerBaseConfig = {
  readonly stability: typeof GAME_CONFIG.stability;
  readonly powerBase: typeof GAME_CONFIG.powerBase;
};

/**
 * Result of evaluating martial law effects on a nation.
 *
 * @see FR-1308
 */
export interface MartialLawResult {
  /** Immediate change to civil unrest (negative = reduction). */
  readonly unrestDelta: number;
  /** Popularity change per turn under martial law. */
  readonly popularityDelta: number;
  /** Multiplier applied to economic growth (e.g. −0.3 = −30%). */
  readonly economicGrowthMultiplier: number;
  /** Tension increase applied to all other factions. */
  readonly tensionDelta: number;
  /** Whether the leader's military power base is below the coup risk threshold. */
  readonly coupRiskTriggered: boolean;
}

/**
 * Result of checking whether regime change conditions are met.
 *
 * @see FR-1309
 */
export interface RegimeChangeTriggerResult {
  /** Whether regime change conditions are met. */
  readonly triggered: boolean;
  /** The type of trigger that caused regime change, or null if not triggered. */
  readonly triggerType: RegimeChangeType | null;
  /** Current stability value used in evaluation. */
  readonly stability: number;
  /** Current civil unrest value used in evaluation. */
  readonly civilUnrest: number;
}

/**
 * Result of executing a regime change on a faction.
 *
 * @see FR-1309
 */
export interface RegimeChangeResult {
  /** Whether the regime actually changed. */
  readonly regimeChanged: boolean;
  /** How the regime change occurred. */
  readonly changeType: RegimeChangeType;
  /** New leader psychology after regime change (null if player game over). */
  readonly newPsychology: LeaderPsychology | null;
  /** New power base after regime change (null if player game over). */
  readonly newPowerBase: PowerBase | null;
  /** Whether the player has lost the game. */
  readonly playerGameOver: boolean;
  /** Whether the player can continue as a successor. */
  readonly successionAvailable: boolean;
}

/**
 * Result of applying power base erosion from a single action.
 *
 * @see FR-1310
 */
export interface PowerBaseErosionResult {
  /** Power base before erosion was applied. */
  readonly previousPowerBase: PowerBase;
  /** Power base after erosion deltas. */
  readonly newPowerBase: PowerBase;
  /** Per-category delta values that were applied. */
  readonly deltas: Record<string, number>;
  /** The action category that caused erosion. */
  readonly actionCategory: string;
}

/**
 * Result of detecting hostile factions within a power base.
 *
 * @see FR-1310
 */
export interface HostileFactionResult {
  /** List of factions whose loyalty has dropped below the hostile threshold. */
  readonly hostileFactions: ReadonlyArray<{
    readonly category: PowerBaseCategory;
    readonly value: number;
  }>;
  /** Whether any faction is hostile. */
  readonly hasHostile: boolean;
  /** Number of hostile factions. */
  readonly hostileCount: number;
}

/**
 * Result of evaluating whether a coup attempt occurs and its outcome.
 *
 * @see FR-1311
 */
export interface CoupAttemptResult {
  /** Whether coup conditions are met (military AND security below thresholds). */
  readonly eligible: boolean;
  /** Calculated coup probability (0–100). */
  readonly coupChance: number;
  /** Outcome of the coup attempt. */
  readonly outcome: CoupOutcome;
  /** Whether military power base is below the coup threshold. */
  readonly militaryBelow: boolean;
  /** Whether security services power base is below the coup threshold. */
  readonly securityBelow: boolean;
}

/**
 * Aggregated snapshot of power base state after applying all
 * turn actions, detecting hostiles, and evaluating coup eligibility.
 *
 * @see FR-1310
 * @see FR-1311
 */
export interface PowerBaseSnapshotResult {
  /** Power base after all action erosions have been applied. */
  readonly finalPowerBase: PowerBase;
  /** Factions whose loyalty is below the hostile threshold. */
  readonly hostileFactions: ReadonlyArray<{
    readonly category: PowerBaseCategory;
    readonly value: number;
  }>;
  /** Whether coup conditions are met after all erosions. */
  readonly coupEligible: boolean;
  /** Calculated coup probability after all erosions (0 if ineligible). */
  readonly coupChance: number;
  /** Number of action erosions successfully applied. */
  readonly actionsApplied: number;
}

// ─────────────────────────────────────────────────────────
// Power base category mapping
// ─────────────────────────────────────────────────────────

/**
 * Mapping from PowerBase property keys to PowerBaseCategory enum values.
 * Used for iterating over power base sub-scores.
 */
const POWER_BASE_CATEGORY_MAP: ReadonlyArray<{
  readonly key: keyof PowerBase;
  readonly category: PowerBaseCategory;
}> = [
  { key: 'military', category: PowerBaseCategory.Military },
  { key: 'oligarchs', category: PowerBaseCategory.Oligarchs },
  { key: 'party', category: PowerBaseCategory.Party },
  { key: 'clergy', category: PowerBaseCategory.Clergy },
  { key: 'public', category: PowerBaseCategory.Public },
  { key: 'securityServices', category: PowerBaseCategory.SecurityServices },
] as const;



// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that evaluates martial law, regime change,
 * power base erosion, and coup attempt mechanics.
 *
 * Every public method is **pure**: no mutation of `this`, no
 * side effects, all results are freshly-allocated objects.
 *
 * @see FR-1308 — Martial Law
 * @see FR-1309 — Regime Change
 * @see FR-1310 — Power Base Erosion
 * @see FR-1311 — Coup Attempts
 */
export class RegimePowerBaseEngine {
  /** Configuration snapshot — never mutated. */
  private readonly config: RegimePowerBaseConfig;

  /**
   * Create a new RegimePowerBaseEngine.
   *
   * @param config - Configuration containing `stability` and `powerBase`
   *                 sections (typically from `GAME_CONFIG`).
   */
  constructor(config: RegimePowerBaseConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // 1. evaluateMartialLaw
  // ───────────────────────────────────────────────────────

  /**
   * Apply martial law effects on a nation.
   *
   * Martial law immediately reduces CivilUnrest by 30 but imposes
   * Popularity −20/turn, EconomicGrowth −30%, triggers international
   * condemnation (TensionLevel +10 with all factions), and risks a
   * coup if PowerBase.military < 50.
   *
   * @param currentUnrest     - Current civil unrest value (0–100).
   * @param powerBaseMilitary - Current military power base score (0–100).
   * @returns A {@link MartialLawResult} with all computed deltas.
   *
   * @see FR-1308
   */
  evaluateMartialLaw(
    _currentUnrest: number,
    powerBaseMilitary: number,
  ): MartialLawResult {
    const ml = this.config.stability.martialLaw;

    const unrestDelta = ml.unrestReduction;
    const popularityDelta = ml.popularityDecayPerTurn;
    const economicGrowthMultiplier = ml.economicGrowthReduction;
    const tensionDelta = ml.tensionIncreaseAllFactions;
    const coupRiskTriggered = powerBaseMilitary < ml.coupRiskMilitaryThreshold;

    return {
      unrestDelta,
      popularityDelta,
      economicGrowthMultiplier,
      tensionDelta,
      coupRiskTriggered,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. checkRegimeChangeTrigger
  // ───────────────────────────────────────────────────────

  /**
   * Check whether regime change conditions are met.
   *
   * Regime change triggers when Stability ≤ 0 OR CivilUnrest ≥ 100.
   * If both conditions are met, StabilityCollapse takes priority.
   *
   * @param stability   - Current stability value.
   * @param civilUnrest - Current civil unrest value.
   * @returns A {@link RegimeChangeTriggerResult} indicating trigger status.
   *
   * @see FR-1309
   */
  checkRegimeChangeTrigger(
    stability: number,
    civilUnrest: number,
  ): RegimeChangeTriggerResult {
    const rc = this.config.stability.regimeChange;

    const stabilityTriggered = stability <= rc.stabilityThreshold;
    const unrestTriggered = civilUnrest >= rc.civilUnrestThreshold;
    const triggered = stabilityTriggered || unrestTriggered;

    let triggerType: RegimeChangeType | null = null;
    if (stabilityTriggered) {
      triggerType = RegimeChangeType.StabilityCollapse;
    } else if (unrestTriggered) {
      triggerType = RegimeChangeType.CivilUnrest;
    }

    return {
      triggered,
      triggerType,
      stability,
      civilUnrest,
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. executeRegimeChange
  // ───────────────────────────────────────────────────────

  /**
   * Execute a regime change on a faction.
   *
   * **AI factions**: new leader inherits a randomized personality
   * (±20 on numeric psychology dimensions) and a reduced power base.
   *
   * **Player faction**: Game Over unless SuccessionClarity > 60,
   * in which case the player can continue as a successor with a
   * damaged state.
   *
   * Psychology randomization uses a deterministic pattern:
   * for each numeric key at index `i`, delta =
   * `personalityRandomizationRange × ((i % 2 === 0) ? 1 : -1) × ((i + 1) / 6)`.
   *
   * @param currentPsychology  - The outgoing leader's psychological profile.
   * @param currentPowerBase   - The outgoing leader's power base.
   * @param isPlayer           - Whether this faction is controlled by the player.
   * @param successionClarity  - SuccessionClarity value from LeaderVulnerabilities.
   * @returns A {@link RegimeChangeResult} describing the outcome.
   *
   * @see FR-1309
   */
  executeRegimeChange(
    currentPsychology: LeaderPsychology,
    currentPowerBase: PowerBase,
    isPlayer: boolean,
    successionClarity: number,
  ): RegimeChangeResult {
    const rc = this.config.stability.regimeChange;

    // ── Player faction ──────────────────────────────────
    if (isPlayer) {
      const successionAvailable =
        successionClarity > rc.successionClarityThreshold;

      if (!successionAvailable) {
        return {
          regimeChanged: true,
          changeType: RegimeChangeType.StabilityCollapse,
          newPsychology: null,
          newPowerBase: null,
          playerGameOver: true,
          successionAvailable: false,
        };
      }

      // Player continues as successor with damaged power base
      const newPowerBase = this.applyPowerBaseReduction(
        currentPowerBase,
        rc.successorPowerBaseReduction,
      );

      return {
        regimeChanged: true,
        changeType: RegimeChangeType.StabilityCollapse,
        newPsychology: { ...currentPsychology },
        newPowerBase,
        playerGameOver: false,
        successionAvailable: true,
      };
    }

    // ── AI faction ──────────────────────────────────────
    const newPsychology = this.randomizePsychology(
      currentPsychology,
      rc.personalityRandomizationRange,
    );

    const newPowerBase = this.applyPowerBaseReduction(
      currentPowerBase,
      rc.successorPowerBaseReduction,
    );

    return {
      regimeChanged: true,
      changeType: RegimeChangeType.StabilityCollapse,
      newPsychology,
      newPowerBase,
      playerGameOver: false,
      successionAvailable: false,
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. applyPowerBaseErosion
  // ───────────────────────────────────────────────────────

  /**
   * Apply erosion deltas to a power base for a given action category.
   *
   * Each action category (e.g. `unpopularWar`, `economicSanctions`)
   * has a predefined delta table. All resulting values are clamped
   * to [0, 100].
   *
   * If the action category is not recognised, no deltas are applied
   * and all deltas in the result are zero.
   *
   * @param currentPowerBase - The power base before erosion.
   * @param actionCategory   - Key into the erosionPerAction config table.
   * @returns A {@link PowerBaseErosionResult} with before/after values.
   *
   * @see FR-1310
   */
  applyPowerBaseErosion(
    currentPowerBase: PowerBase,
    actionCategory: string,
  ): PowerBaseErosionResult {
    const erosionTable = this.config.powerBase.erosionPerAction;
    const categoryDeltas =
      erosionTable[actionCategory as keyof typeof erosionTable] as
        | Record<string, number>
        | undefined;

    if (!categoryDeltas) {
      return {
        previousPowerBase: { ...currentPowerBase },
        newPowerBase: { ...currentPowerBase },
        deltas: {
          military: 0,
          oligarchs: 0,
          party: 0,
          clergy: 0,
          public: 0,
          securityServices: 0,
        },
        actionCategory,
      };
    }

    const deltas: Record<string, number> = {};
    const newPowerBase: PowerBase = { ...currentPowerBase };

    for (const entry of POWER_BASE_CATEGORY_MAP) {
      const delta = (categoryDeltas[entry.key] as number) ?? 0;
      deltas[entry.key] = delta;
      (newPowerBase as unknown as Record<string, number>)[entry.key] = clamp(
        currentPowerBase[entry.key] + delta,
        0,
        100,
      );
    }

    return {
      previousPowerBase: { ...currentPowerBase },
      newPowerBase,
      deltas,
      actionCategory,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. detectHostileFactions
  // ───────────────────────────────────────────────────────

  /**
   * Detect which power base factions are hostile (loyalty below
   * the hostile threshold of 15). Hostile factions actively work
   * against the leader.
   *
   * @param powerBase - Current power base scores.
   * @returns A {@link HostileFactionResult} listing all hostile factions.
   *
   * @see FR-1310
   */
  detectHostileFactions(powerBase: PowerBase): HostileFactionResult {
    const threshold = this.config.powerBase.hostileThreshold;

    const hostileFactions: Array<{
      readonly category: PowerBaseCategory;
      readonly value: number;
    }> = [];

    for (const entry of POWER_BASE_CATEGORY_MAP) {
      const value = powerBase[entry.key];
      if (value < threshold) {
        hostileFactions.push({ category: entry.category, value });
      }
    }

    return {
      hostileFactions,
      hasHostile: hostileFactions.length > 0,
      hostileCount: hostileFactions.length,
    };
  }

  // ───────────────────────────────────────────────────────
  // 6. evaluateCoupAttempt
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate whether a coup attempt occurs and determine its outcome.
   *
   * **Eligibility**: PowerBase.military < 30 AND PowerBase.securityServices < 30.
   *
   * **Formula (FR-1311):**
   * ```
   * CoupChance = (100 − military) × 0.3
   *            + (100 − securityServices) × 0.3
   *            − Popularity × 0.2
   * ```
   *
   * Outcome determination (deterministic, based on coupChance):
   * - coupChance ≥ 60 → Success
   * - coupChance ≥ 30 → Failed (attempted but repelled)
   * - coupChance < 30  → Averted (plot discovered before execution)
   *
   * @param powerBase  - Current power base scores.
   * @param popularity - Leader popularity (0–100).
   * @returns A {@link CoupAttemptResult} with eligibility, chance, and outcome.
   *
   * @see FR-1311
   */
  evaluateCoupAttempt(
    powerBase: PowerBase,
    popularity: number,
  ): CoupAttemptResult {
    const coupCfg = this.config.powerBase.coup;
    const formula = this.config.powerBase.coupFormula;

    const militaryBelow = powerBase.military < coupCfg.militaryThreshold;
    const securityBelow =
      powerBase.securityServices < coupCfg.securityThreshold;
    const eligible = militaryBelow && securityBelow;

    if (!eligible) {
      return {
        eligible: false,
        coupChance: 0,
        outcome: CoupOutcome.Averted,
        militaryBelow,
        securityBelow,
      };
    }

    const rawChance =
      (formula.base - powerBase.military) * formula.militaryWeight +
      (formula.base - powerBase.securityServices) * formula.securityWeight -
      popularity * formula.popularityWeight;

    const coupChance = clamp(rawChance, 0, 100);

    let outcome: CoupOutcome;
    if (coupChance >= 60) {
      outcome = CoupOutcome.Success;
    } else if (coupChance >= 30) {
      outcome = CoupOutcome.Failed;
    } else {
      outcome = CoupOutcome.Averted;
    }

    return {
      eligible,
      coupChance,
      outcome,
      militaryBelow,
      securityBelow,
    };
  }

  // ───────────────────────────────────────────────────────
  // 7. computePowerBaseSnapshot
  // ───────────────────────────────────────────────────────

  /**
   * Apply multiple action erosions in sequence for a full turn,
   * then detect hostile factions and evaluate coup eligibility.
   *
   * Actions that are not recognised in the erosionPerAction table
   * are silently skipped (no delta applied).
   *
   * @param currentPowerBase - Power base at the start of the turn.
   * @param actionsThisTurn  - Ordered list of action category keys
   *                           (e.g. `['unpopularWar', 'militarySpending']`).
   * @returns A {@link PowerBaseSnapshotResult} with final state.
   *
   * @see FR-1310
   * @see FR-1311
   */
  computePowerBaseSnapshot(
    currentPowerBase: PowerBase,
    actionsThisTurn: readonly string[],
  ): PowerBaseSnapshotResult {
    let runningPowerBase: PowerBase = { ...currentPowerBase };
    let actionsApplied = 0;

    for (const action of actionsThisTurn) {
      const erosionResult = this.applyPowerBaseErosion(
        runningPowerBase,
        action,
      );
      // Only count actions that exist in the erosion table
      const erosionTable = this.config.powerBase.erosionPerAction;
      if (action in erosionTable) {
        actionsApplied += 1;
      }
      runningPowerBase = { ...erosionResult.newPowerBase };
    }

    const hostileResult = this.detectHostileFactions(runningPowerBase);

    // Use popularity = public power base for coup evaluation context
    const coupResult = this.evaluateCoupAttempt(
      runningPowerBase,
      runningPowerBase.public,
    );

    return {
      finalPowerBase: runningPowerBase,
      hostileFactions: hostileResult.hostileFactions,
      coupEligible: coupResult.eligible,
      coupChance: coupResult.coupChance,
      actionsApplied,
    };
  }

  // ───────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────

  /**
   * Apply a deterministic personality shift to a leader's psychology.
   *
   * For each numeric key at index `i`:
   * ```
   * delta = range × ((i % 2 === 0) ? 1 : -1) × ((i + 1) / 6)
   * ```
   *
   * Non-numeric keys (decisionStyle, stressResponse) are preserved.
   * All numeric values are clamped to [0, 100].
   *
   * @param psychology - Original leader psychology.
   * @param range      - ± range for the randomization (e.g. 20).
   * @returns A new LeaderPsychology with shifted numeric values.
   */
  private randomizePsychology(
    psychology: LeaderPsychology,
    range: number,
  ): LeaderPsychology {
    const numericKeys: (keyof LeaderPsychology)[] = [
      'riskTolerance',
      'paranoia',
      'narcissism',
      'pragmatism',
      'patience',
      'vengefulIndex',
    ];

    const shifted: Record<string, number> = {};
    for (let i = 0; i < numericKeys.length; i++) {
      const key = numericKeys[i]!;
      const sign = i % 2 === 0 ? 1 : -1;
      const delta = range * sign * ((i + 1) / 6);
      const original = psychology[key] as number;
      shifted[key] = clamp(original + delta, 0, 100);
    }

    return {
      decisionStyle: psychology.decisionStyle,
      stressResponse: psychology.stressResponse,
      riskTolerance: shifted['riskTolerance'],
      paranoia: shifted['paranoia'],
      narcissism: shifted['narcissism'],
      pragmatism: shifted['pragmatism'],
      patience: shifted['patience'],
      vengefulIndex: shifted['vengefulIndex'],
    } as LeaderPsychology;
  }

  /**
   * Reduce every power base sub-score by a flat amount, clamped to [0, 100].
   *
   * @param powerBase - Original power base.
   * @param reduction - Flat amount subtracted from every sub-score.
   * @returns A new PowerBase with reduced values.
   */
  private applyPowerBaseReduction(
    powerBase: PowerBase,
    reduction: number,
  ): PowerBase {
    return {
      military: clamp(powerBase.military - reduction, 0, 100),
      oligarchs: clamp(powerBase.oligarchs - reduction, 0, 100),
      party: clamp(powerBase.party - reduction, 0, 100),
      clergy: clamp(powerBase.clergy - reduction, 0, 100),
      public: clamp(powerBase.public - reduction, 0, 100),
      securityServices: clamp(powerBase.securityServices - reduction, 0, 100),
    };
  }
}
