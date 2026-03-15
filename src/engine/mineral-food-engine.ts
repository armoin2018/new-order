/**
 * Mineral Competition, Food Leverage & Resource Security Engine
 *
 * Implements resource security threshold evaluation (FR-1901),
 * critical mineral leverage and alternatives (FR-1902),
 * food-as-weapon mechanics (FR-1906), and strategic reserve
 * stockpiling/depletion (FR-1907).
 *
 * All public methods are pure functions.
 * Thresholds and modifiers are drawn from GAME_CONFIG.resources.
 *
 * @module mineral-food-engine
 * @see FR-1901 — Resource Security Index
 * @see FR-1902 — Critical Mineral Competition
 * @see FR-1906 — Food as Weapon
 * @see FR-1907 — Strategic Reserves
 */

import { GAME_CONFIG } from '@/engine/config';
import { MineralAlternative } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Config Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Resolved type of `GAME_CONFIG.resources`.
 * Used to allow dependency-injection of the resources config section
 * for testing and scenario overrides.
 */
export type ResourcesConfig = typeof GAME_CONFIG.resources;

// ─────────────────────────────────────────────────────────
// FR-1901 — Resource Security Types
// ─────────────────────────────────────────────────────────

/**
 * Input for a resource security threshold evaluation.
 *
 * All four resource dimensions are scored 0–100 where 0 is total
 * depletion and 100 is fully secured.
 *
 * @see FR-1901
 */
export interface ResourceSecurityInput {
  /** Faction being evaluated. */
  readonly factionId: FactionId;
  /** Energy security level (0–100). */
  readonly energy: number;
  /** Food security level (0–100). */
  readonly food: number;
  /** Water security level (0–100). */
  readonly water: number;
  /** Critical minerals security level (0–100). */
  readonly criticalMinerals: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating resource security thresholds across all four
 * dimensions. Effects are cumulative — each resource below a threshold
 * contributes independently.
 *
 * @see FR-1901
 */
export interface ResourceSecurityResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** The single lowest resource dimension. */
  readonly lowestResource: { readonly name: string; readonly level: number };
  /** Total inflation increase: +5 per resource below the warning threshold. */
  readonly inflationIncrease: number;
  /**
   * Total civil unrest increase: +3 per resource below warning,
   * PLUS +10 per resource below critical.
   */
  readonly civilUnrestIncrease: number;
  /** Total popularity penalty: −10 per resource below critical. */
  readonly popularityPenalty: number;
  /** Total stability decay per turn: −10 per resource below catastrophic. */
  readonly stabilityDecayPerTurn: number;
  /** True if any resource is below the catastrophic threshold. */
  readonly massMigrationTriggered: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1902 — Mineral Leverage Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating whether one faction can leverage mineral
 * dominance against another.
 *
 * @see FR-1902
 */
export interface MineralLeverageInput {
  /** Faction that controls the mineral supply. */
  readonly controllerFaction: FactionId;
  /** Faction targeted by the leverage. */
  readonly targetFaction: FactionId;
  /** Controller's share of global mineral supply (0–1). */
  readonly controllerMineralShare: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a mineral leverage evaluation.
 *
 * When the controller holds ≥ 40 % of global supply, the target
 * suffers semiconductor cost increases and GDP reduction.
 *
 * @see FR-1902
 */
export interface MineralLeverageResult {
  /** Whether the controller meets the control threshold (≥ 0.4). */
  readonly eligible: boolean;
  /** Semiconductor cost increase imposed on the target (0.3 or 0). */
  readonly targetSemiconductorCostIncrease: number;
  /** GDP reduction imposed on the target (−0.03 or 0). */
  readonly targetGDPReduction: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1902 — Mineral Alternative Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating a mineral alternative method for a faction.
 *
 * @see FR-1902
 */
export interface MineralAlternativeInput {
  /** Faction attempting the alternative. */
  readonly factionId: FactionId;
  /** The alternative method being evaluated. */
  readonly method: MineralAlternative;
  /** Faction's current space-tech level (0–100). Needed for deep-sea check. */
  readonly factionSpaceLevel: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating a single mineral alternative method.
 *
 * @see FR-1902
 */
export interface MineralAlternativeResult {
  /** The method that was evaluated. */
  readonly method: MineralAlternative;
  /** Whether the faction meets the eligibility requirements. */
  readonly eligible: boolean;
  /** Cost multiplier relative to imports (1.0 = same cost). */
  readonly costMultiplier: number;
  /** Turns required before the alternative begins producing. */
  readonly timeTurns: number;
  /** Reduction in import dependency (fraction, e.g. 0.2 = −20 %). */
  readonly dependencyReduction: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1906 — Food as Weapon Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating whether a faction can weaponize food exports
 * against a target.
 *
 * @see FR-1906
 */
export interface FoodWeaponInput {
  /** Faction wielding the food weapon. */
  readonly wielderFaction: FactionId;
  /** Faction targeted by the food weapon. */
  readonly targetFaction: FactionId;
  /** Wielder's share of global grain production (0–1). */
  readonly wielderGrainShare: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a food-weapon evaluation.
 *
 * When the wielder controls ≥ 30 % of global grain, the target
 * suffers food-supply, civil-unrest, and stability penalties —
 * at the cost of the wielder's international legitimacy.
 *
 * @see FR-1906
 */
export interface FoodWeaponResult {
  /** Whether the wielder meets the grain control threshold (≥ 0.3). */
  readonly eligible: boolean;
  /** Target's food supply reduction (−20 when eligible, else 0). */
  readonly targetFoodReduction: number;
  /** Target's civil unrest increase (+10 when eligible, else 0). */
  readonly targetCivilUnrestIncrease: number;
  /** Target's stability decay (−5 when eligible, else 0). */
  readonly targetStabilityDecay: number;
  /** Legitimacy cost to the wielder (−15 when eligible, else 0). */
  readonly wielderLegitimacyCost: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1907 — Strategic Reserves Types
// ─────────────────────────────────────────────────────────

/**
 * Input for computing the treasury cost of stockpiling strategic
 * reserves.
 *
 * @see FR-1907
 */
export interface StockpilingInput {
  /** Faction purchasing reserves. */
  readonly factionId: FactionId;
  /** Number of reserve units the faction wishes to stockpile. */
  readonly unitsToStockpile: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a stockpiling cost computation.
 *
 * @see FR-1907
 */
export interface StockpilingResult {
  /** Total treasury cost (negative value). */
  readonly treasuryCost: number;
  /** Actual units bought (clamped to ≥ 0). */
  readonly unitsBought: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * Input for computing per-turn depletion of strategic reserves.
 *
 * @see FR-1907
 */
export interface ReserveDepletionInput {
  /** Faction whose reserves are depleting. */
  readonly factionId: FactionId;
  /** Current reserve level (≥ 0). */
  readonly currentReserves: number;
  /** Units depleted per turn (positive number). */
  readonly deficitRate: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a reserve depletion computation.
 *
 * @see FR-1907
 */
export interface ReserveDepletionResult {
  /** Remaining reserves after depletion (clamped to ≥ 0). */
  readonly remainingReserves: number;
  /** Estimated turns until reserves are fully depleted. 0 if already 0. */
  readonly turnsUntilDepleted: number;
  /** True when remaining reserves have reached zero. */
  readonly depleted: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// MineralFoodEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for mineral competition, food leverage,
 * and strategic reserve mechanics.
 *
 * All public methods are stateless and return new objects.
 * No mutations, no side effects.
 *
 * @example
 * ```ts
 * const engine = new MineralFoodEngine();
 * const security = engine.evaluateResourceSecurity(input);
 * const leverage = engine.evaluateMineralLeverage(leverageInput);
 * ```
 *
 * @see FR-1901 — Resource Security Index
 * @see FR-1902 — Critical Mineral Competition
 * @see FR-1906 — Food as Weapon
 * @see FR-1907 — Strategic Reserves
 */
export class MineralFoodEngine {
  /** Active resources configuration. */
  private readonly cfg: ResourcesConfig;

  /**
   * Create a new MineralFoodEngine.
   *
   * @param config - Optional resources configuration override. When
   *   omitted, uses `GAME_CONFIG.resources`. Useful for testing or
   *   scenario-specific tuning.
   */
  constructor(config: ResourcesConfig = GAME_CONFIG.resources) {
    this.cfg = config;
  }

  // ───────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to an inclusive [min, max] range.
   *
   * @param value - The raw value.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // ───────────────────────────────────────────────────────
  // 1. evaluateResourceSecurity (FR-1901)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate resource security thresholds across all four dimensions
   * and compute cumulative crisis effects.
   *
   * For each resource dimension the engine checks three threshold bands
   * drawn from `GAME_CONFIG.resources.securityThresholds`:
   *
   * | Band         | Threshold | Effects per resource                            |
   * |-------------|----------|-------------------------------------------------|
   * | Warning     | < 30     | inflationIncrease +5, civilUnrestIncrease +3    |
   * | Critical    | < 15     | civilUnrestIncrease +10, popularityPenalty −10   |
   * | Catastrophic| < 5      | stabilityDecayPerTurn −10, mass migration        |
   *
   * Effects stack across multiple resources.
   *
   * @param input - The four resource levels and faction context.
   * @returns A {@link ResourceSecurityResult} with cumulative effects.
   *
   * @example
   * ```ts
   * const result = engine.evaluateResourceSecurity({
   *   factionId: 'US',
   *   energy: 45,
   *   food: 12,
   *   water: 60,
   *   criticalMinerals: 3,
   *   currentTurn: 5 as TurnNumber,
   * });
   * // result.inflationIncrease === 10  (food + criticalMinerals below 30)
   * // result.massMigrationTriggered === true (criticalMinerals below 5)
   * ```
   *
   * @see FR-1901
   */
  evaluateResourceSecurity(input: ResourceSecurityInput): ResourceSecurityResult {
    const thresholds = this.cfg.securityThresholds;

    let inflationIncrease = 0;
    let civilUnrestIncrease = 0;
    let popularityPenalty = 0;
    let stabilityDecayPerTurn = 0;
    let massMigrationTriggered = false;

    let lowestName = '';
    let lowestLevel = Infinity;

    const resources: ReadonlyArray<{ readonly name: string; readonly level: number }> = [
      { name: 'energy', level: input.energy },
      { name: 'food', level: input.food },
      { name: 'water', level: input.water },
      { name: 'criticalMinerals', level: input.criticalMinerals },
    ];

    for (const res of resources) {
      // Track the lowest resource
      if (res.level < lowestLevel) {
        lowestLevel = res.level;
        lowestName = res.name;
      }

      // ── Warning band (< 30): inflation & civil unrest ──────────
      if (res.level < thresholds.warning) {
        inflationIncrease += thresholds.warningInflationIncrease;
        civilUnrestIncrease += thresholds.warningCivilUnrestIncrease;
      }

      // ── Critical band (< 15): rationing — more unrest, popularity hit
      if (res.level < thresholds.critical) {
        civilUnrestIncrease += thresholds.criticalCivilUnrestIncrease;
        popularityPenalty += thresholds.criticalPopularityPenalty;
      }

      // ── Catastrophic band (< 5): collapse — stability decay, migration
      if (res.level < thresholds.catastrophic) {
        stabilityDecayPerTurn += thresholds.catastrophicStabilityDecayPerTurn;
        massMigrationTriggered = true;
      }
    }

    // Build reason string
    const warningCount = resources.filter((r) => r.level < thresholds.warning).length;
    const criticalCount = resources.filter((r) => r.level < thresholds.critical).length;
    const catastrophicCount = resources.filter((r) => r.level < thresholds.catastrophic).length;

    const parts: string[] = [];
    if (warningCount > 0) {
      parts.push(
        String(warningCount) + ' resource(s) below warning threshold (' +
        String(thresholds.warning) + ')',
      );
    }
    if (criticalCount > 0) {
      parts.push(
        String(criticalCount) + ' resource(s) below critical threshold (' +
        String(thresholds.critical) + ')',
      );
    }
    if (catastrophicCount > 0) {
      parts.push(
        String(catastrophicCount) + ' resource(s) below catastrophic threshold (' +
        String(thresholds.catastrophic) + ')',
      );
    }
    if (parts.length === 0) {
      parts.push('All resources above warning thresholds');
    }

    const reason =
      'FR-1901 Resource Security [' + String(input.factionId) + ' T' +
      String(input.currentTurn) + ']: ' + parts.join('; ') +
      '. Lowest: ' + lowestName + ' at ' + String(lowestLevel) + '.';

    return {
      factionId: input.factionId,
      lowestResource: { name: lowestName, level: lowestLevel },
      inflationIncrease,
      civilUnrestIncrease,
      popularityPenalty,
      stabilityDecayPerTurn,
      massMigrationTriggered,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. evaluateMineralLeverage (FR-1902)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate whether a faction's mineral market dominance qualifies
   * for economic leverage against a target faction.
   *
   * When the controller holds ≥ 40 % of global critical-mineral supply,
   * the target suffers:
   * - Semiconductor production cost increase (+30 %)
   * - GDP reduction (−3 % per turn)
   *
   * @param input - Controller/target factions and mineral share data.
   * @returns A {@link MineralLeverageResult} with eligibility and effects.
   *
   * @example
   * ```ts
   * const result = engine.evaluateMineralLeverage({
   *   controllerFaction: 'CN',
   *   targetFaction: 'US',
   *   controllerMineralShare: 0.55,
   *   currentTurn: 10 as TurnNumber,
   * });
   * // result.eligible === true
   * // result.targetSemiconductorCostIncrease === 0.3
   * ```
   *
   * @see FR-1902
   */
  evaluateMineralLeverage(input: MineralLeverageInput): MineralLeverageResult {
    const cfg = this.cfg.mineralLeverage;
    const share = MineralFoodEngine.clamp(input.controllerMineralShare, 0, 1);
    const eligible = share >= cfg.controlThreshold;

    if (eligible) {
      return {
        eligible: true,
        targetSemiconductorCostIncrease: cfg.semiconductorCostIncrease,
        targetGDPReduction: cfg.targetGDPReduction,
        reason:
          'FR-1902 Mineral Leverage [' + String(input.controllerFaction) +
          ' → ' + String(input.targetFaction) + ' T' +
          String(input.currentTurn) + ']: Controller holds ' +
          String(Math.round(share * 100)) + '% share (≥ ' +
          String(Math.round(cfg.controlThreshold * 100)) +
          '%). Target suffers +' +
          String(Math.round(cfg.semiconductorCostIncrease * 100)) +
          '% semiconductor cost, ' + String(cfg.targetGDPReduction * 100) +
          '% GDP.',
      };
    }

    return {
      eligible: false,
      targetSemiconductorCostIncrease: 0,
      targetGDPReduction: 0,
      reason:
        'FR-1902 Mineral Leverage [' + String(input.controllerFaction) +
        ' → ' + String(input.targetFaction) + ' T' +
        String(input.currentTurn) + ']: Controller holds ' +
        String(Math.round(share * 100)) + '% share (< ' +
        String(Math.round(cfg.controlThreshold * 100)) +
        '%). No leverage.',
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. evaluateMineralAlternative (FR-1902)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the feasibility and effects of a mineral alternative method.
   *
   * Exhaustive switch over {@link MineralAlternative}:
   *
   * | Method         | Eligible?              | Cost ×  | Time   | Dep. Reduction |
   * |---------------|------------------------|---------|--------|----------------|
   * | DomesticMining | Always                 | 3.0     | 0      | 0              |
   * | DeepSeaMining  | spaceLevel ≥ 40        | 1.0     | 5 turns| 0              |
   * | Recycling      | Always                 | 1.0     | 0      | 0.2 (−20 %)   |
   *
   * @param input - Faction, method, and current space level.
   * @returns A {@link MineralAlternativeResult} with eligibility, costs, and timing.
   *
   * @example
   * ```ts
   * const result = engine.evaluateMineralAlternative({
   *   factionId: 'US',
   *   method: MineralAlternative.DeepSeaMining,
   *   factionSpaceLevel: 55,
   *   currentTurn: 12 as TurnNumber,
   * });
   * // result.eligible === true
   * // result.timeTurns === 5
   * ```
   *
   * @see FR-1902
   */
  evaluateMineralAlternative(input: MineralAlternativeInput): MineralAlternativeResult {
    const cfg = this.cfg.mineralAlternatives;
    const method = input.method;

    switch (method) {
      case MineralAlternative.DomesticMining:
        return {
          method,
          eligible: true,
          costMultiplier: cfg.domesticMiningCostMultiplier,
          timeTurns: 0,
          dependencyReduction: 0,
          reason:
            'FR-1902 Mineral Alternative [' + String(input.factionId) +
            ' T' + String(input.currentTurn) +
            ']: DomesticMining — always eligible, cost ×' +
            String(cfg.domesticMiningCostMultiplier) + ' (+200%), immediate.',
        };

      case MineralAlternative.DeepSeaMining: {
        const eligible = input.factionSpaceLevel >= cfg.deepSeaSpaceRequirement;
        return {
          method,
          eligible,
          costMultiplier: eligible ? 1.0 : 0,
          timeTurns: eligible ? cfg.deepSeaTimeTurns : 0,
          dependencyReduction: 0,
          reason: eligible
            ? 'FR-1902 Mineral Alternative [' + String(input.factionId) +
              ' T' + String(input.currentTurn) +
              ']: DeepSeaMining — eligible (spaceLevel ' +
              String(input.factionSpaceLevel) + ' ≥ ' +
              String(cfg.deepSeaSpaceRequirement) + '), cost ×1.0, ' +
              String(cfg.deepSeaTimeTurns) + ' turns lead time.'
            : 'FR-1902 Mineral Alternative [' + String(input.factionId) +
              ' T' + String(input.currentTurn) +
              ']: DeepSeaMining — ineligible (spaceLevel ' +
              String(input.factionSpaceLevel) + ' < ' +
              String(cfg.deepSeaSpaceRequirement) + ').',
        };
      }

      case MineralAlternative.Recycling:
        return {
          method,
          eligible: true,
          costMultiplier: 1.0,
          timeTurns: 0,
          dependencyReduction: cfg.recyclingDependencyReduction,
          reason:
            'FR-1902 Mineral Alternative [' + String(input.factionId) +
            ' T' + String(input.currentTurn) +
            ']: Recycling — always eligible, cost ×1.0, immediate, ' +
            'dependency reduction ' +
            String(cfg.recyclingDependencyReduction * 100) + '%.',
        };

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = method;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 4. evaluateFoodWeapon (FR-1906)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate whether a faction can weaponize food exports against a
   * target and compute the resulting effects on both sides.
   *
   * When the wielder controls ≥ 30 % of global grain production:
   * - Target: food −20, civil unrest +10, stability −5
   * - Wielder: legitimacy −15
   *
   * @param input - Wielder/target factions and grain share data.
   * @returns A {@link FoodWeaponResult} with eligibility and effects.
   *
   * @example
   * ```ts
   * const result = engine.evaluateFoodWeapon({
   *   wielderFaction: 'RU',
   *   targetFaction: 'EU',
   *   wielderGrainShare: 0.35,
   *   currentTurn: 8 as TurnNumber,
   * });
   * // result.eligible === true
   * // result.targetFoodReduction === -20
   * // result.wielderLegitimacyCost === -15
   * ```
   *
   * @see FR-1906
   */
  evaluateFoodWeapon(input: FoodWeaponInput): FoodWeaponResult {
    const cfg = this.cfg.foodWeapon;
    const share = MineralFoodEngine.clamp(input.wielderGrainShare, 0, 1);
    const eligible = share >= cfg.controlThreshold;

    if (eligible) {
      return {
        eligible: true,
        targetFoodReduction: cfg.targetFoodReduction,
        targetCivilUnrestIncrease: cfg.civilUnrestIncrease,
        targetStabilityDecay: cfg.stabilityDecay,
        wielderLegitimacyCost: cfg.legitimacyCost,
        reason:
          'FR-1906 Food Weapon [' + String(input.wielderFaction) +
          ' → ' + String(input.targetFaction) + ' T' +
          String(input.currentTurn) + ']: Wielder holds ' +
          String(Math.round(share * 100)) + '% grain share (≥ ' +
          String(Math.round(cfg.controlThreshold * 100)) +
          '%). Target: food ' + String(cfg.targetFoodReduction) +
          ', unrest +' + String(cfg.civilUnrestIncrease) +
          ', stability ' + String(cfg.stabilityDecay) +
          '. Wielder legitimacy ' + String(cfg.legitimacyCost) + '.',
      };
    }

    return {
      eligible: false,
      targetFoodReduction: 0,
      targetCivilUnrestIncrease: 0,
      targetStabilityDecay: 0,
      wielderLegitimacyCost: 0,
      reason:
        'FR-1906 Food Weapon [' + String(input.wielderFaction) +
        ' → ' + String(input.targetFaction) + ' T' +
        String(input.currentTurn) + ']: Wielder holds ' +
        String(Math.round(share * 100)) + '% grain share (< ' +
        String(Math.round(cfg.controlThreshold * 100)) +
        '%). Not eligible.',
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. computeStockpilingCost (FR-1907)
  // ───────────────────────────────────────────────────────

  /**
   * Compute the treasury cost and units purchased when a faction
   * stockpiles strategic reserves.
   *
   * Cost formula:
   * ```
   * treasuryCost = ceil(unitsToStockpile / 10) × costPer10Units
   * ```
   *
   * `costPer10Units` is negative (a treasury drain). Units bought
   * is clamped to ≥ 0 (no negative purchases).
   *
   * @param input - Faction, desired units, and turn context.
   * @returns A {@link StockpilingResult} with cost and units bought.
   *
   * @example
   * ```ts
   * const result = engine.computeStockpilingCost({
   *   factionId: 'US',
   *   unitsToStockpile: 25,
   *   currentTurn: 4 as TurnNumber,
   * });
   * // result.treasuryCost === -15 (ceil(25/10)=3 × -5)
   * // result.unitsBought === 25
   * ```
   *
   * @see FR-1907
   */
  computeStockpilingCost(input: StockpilingInput): StockpilingResult {
    const costPer10 = this.cfg.strategicReserves.costPer10Units;
    const unitsBought = Math.max(0, input.unitsToStockpile);
    const batches = Math.ceil(unitsBought / 10);
    const treasuryCost = batches * costPer10;

    return {
      treasuryCost,
      unitsBought,
      reason:
        'FR-1907 Stockpiling [' + String(input.factionId) + ' T' +
        String(input.currentTurn) + ']: ' + String(unitsBought) +
        ' units in ' + String(batches) + ' batch(es) at ' +
        String(costPer10) + ' treasury per batch = ' +
        String(treasuryCost) + ' total treasury cost.',
    };
  }

  // ───────────────────────────────────────────────────────
  // 6. computeReserveDepletion (FR-1907)
  // ───────────────────────────────────────────────────────

  /**
   * Compute per-turn depletion of strategic reserves and estimate
   * turns remaining until full depletion.
   *
   * Reserves are reduced by `deficitRate` each turn and clamped to
   * ≥ 0. If the deficit rate is zero or negative, reserves do not
   * deplete.
   *
   * @param input - Current reserves, depletion rate, and turn context.
   * @returns A {@link ReserveDepletionResult} with remaining reserves
   *   and depletion timeline.
   *
   * @example
   * ```ts
   * const result = engine.computeReserveDepletion({
   *   factionId: 'EU',
   *   currentReserves: 30,
   *   deficitRate: 7,
   *   currentTurn: 15 as TurnNumber,
   * });
   * // result.remainingReserves === 23  (30 - 7)
   * // result.turnsUntilDepleted === 4  (ceil(23 / 7))
   * // result.depleted === false
   * ```
   *
   * @see FR-1907
   */
  computeReserveDepletion(input: ReserveDepletionInput): ReserveDepletionResult {
    const reserves = Math.max(0, input.currentReserves);
    const rate = Math.max(0, input.deficitRate);

    const remaining = MineralFoodEngine.clamp(reserves - rate, 0, Infinity);
    const depleted = remaining <= 0;

    let turnsUntilDepleted: number;
    if (remaining <= 0) {
      turnsUntilDepleted = 0;
    } else if (rate <= 0) {
      turnsUntilDepleted = Infinity;
    } else {
      turnsUntilDepleted = Math.ceil(remaining / rate);
    }

    return {
      remainingReserves: remaining,
      turnsUntilDepleted,
      depleted,
      reason:
        'FR-1907 Reserve Depletion [' + String(input.factionId) + ' T' +
        String(input.currentTurn) + ']: ' + String(reserves) +
        ' reserves − ' + String(rate) + ' deficit = ' +
        String(remaining) + ' remaining' +
        (depleted
          ? ' (DEPLETED).'
          : '. Estimated ' + String(turnsUntilDepleted) + ' turn(s) until depleted.'),
    };
  }
}
