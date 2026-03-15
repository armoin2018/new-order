/**
 * Climate Events & Refugee Flows Engine
 *
 * Implements climate event evaluation and effects (FR-1903),
 * refugee flow trigger/response mechanics (FR-1904), and
 * weaponized migration assessment.
 *
 * All public methods are pure functions.
 * Thresholds and modifiers drawn from GAME_CONFIG.resources.
 *
 * @module climate-refugee-engine
 * @see FR-1903 — Climate Events
 * @see FR-1904 — Refugee Flows
 */

import { GAME_CONFIG } from '@/engine/config';
import { ClimateEventType, RefugeeResponse, RefugeeCause } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Config Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Resolved type of `GAME_CONFIG.resources`.
 * Used to allow dependency-injection of the resources config section
 * for testing and scenario overrides.
 */
export type ClimateRefugeeConfig = typeof GAME_CONFIG.resources;

// ─────────────────────────────────────────────────────────
// FR-1903 — Climate Event Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the effects of a climate event on a faction.
 *
 * Severity is a 1–10 scale that acts as a multiplier on base effects.
 * A severity of 5 produces 1.0× base values; 10 produces 2.0×.
 *
 * @see FR-1903
 */
export interface ClimateEventInput {
  /** The type of climate event occurring. */
  readonly eventType: ClimateEventType;
  /** Severity multiplier (1–10). Scale factor = severity / 5. */
  readonly severity: number;
  /** Faction affected by the climate event. */
  readonly targetNation: FactionId;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Detailed effects produced by a climate event evaluation.
 *
 * Each field represents a specific impact dimension. Values are
 * negative for penalties, positive for improvements.
 *
 * @see FR-1903
 */
export interface ClimateEventEffects {
  /** Fractional food production reduction (e.g. −0.3 = −30 %). */
  readonly foodReduction: number;
  /** Fractional infrastructure damage (e.g. −0.2 = −20 %). */
  readonly infrastructureDamage: number;
  /** Treasury cost from event damage. */
  readonly treasuryCost: number;
  /** Absolute water supply reduction. */
  readonly waterReduction: number;
  /** Fractional agricultural GDP reduction (e.g. −0.15 = −15 %). */
  readonly agriculturalGDPReduction: number;
  /** Civil unrest increase (absolute). */
  readonly civilUnrestIncrease: number;
  /** Turns during which military installations are inoperable. */
  readonly militaryInoperableTurns: number;
  /** Fractional chokepoint dependency reduction (positive = benefit). */
  readonly chokepointDependencyReduction: number;
}

/**
 * Result of evaluating a climate event, including all effects,
 * strategic opportunities, and event duration.
 *
 * @see FR-1903
 */
export interface ClimateEventResult {
  /** The type of climate event that was evaluated. */
  readonly eventType: ClimateEventType;
  /** Faction affected by the climate event. */
  readonly targetNation: FactionId;
  /** Detailed multi-dimensional effects of the event. */
  readonly effects: ClimateEventEffects;
  /**
   * Optional strategic opportunity unlocked by the event.
   * For example, Arctic collapse may open new shipping routes.
   * `null` when no opportunity exists.
   */
  readonly strategicOpportunity: string | null;
  /** Number of turns the effects persist. 0 = permanent. */
  readonly durationTurns: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1903 — Climate Event Probability Types
// ─────────────────────────────────────────────────────────

/**
 * Input for computing the probability of a climate event occurring
 * on a given turn.
 *
 * Probability increases with game progression to simulate
 * escalating climate instability.
 *
 * @see FR-1903
 */
export interface ClimateEventProbabilityInput {
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
  /** Base probability per turn (e.g. 0.05 = 5 %). */
  readonly baseFrequency: number;
}

/**
 * Result of a climate event probability computation.
 *
 * @see FR-1903
 */
export interface ClimateEventProbabilityResult {
  /** Computed probability clamped to [0, 0.8]. */
  readonly probability: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1904 — Refugee Flow Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the effects of a refugee flow between two
 * factions.
 *
 * Wave size is measured in thousands of displaced persons.
 * Source effects scale linearly with `waveSize / 100`.
 *
 * @see FR-1904
 */
export interface RefugeeFlowInput {
  /** Faction from which refugees originate. */
  readonly sourceNation: FactionId;
  /** Faction receiving the refugee wave. */
  readonly targetNation: FactionId;
  /** Root cause of the displacement. */
  readonly cause: RefugeeCause;
  /** Size of the refugee wave (thousands of people). */
  readonly waveSize: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating a refugee flow, including effects on both
 * the source and target nations.
 *
 * Source effects scale with wave size; target effects are per-wave
 * base values from config.
 *
 * @see FR-1904
 */
export interface RefugeeFlowResult {
  /** Effects on the nation from which refugees originate. */
  readonly sourceEffects: {
    /** Fractional labor pool reduction (e.g. −0.05 = −5 %). */
    readonly laborReduction: number;
    /** Fractional GDP reduction (e.g. −0.02 = −2 %). */
    readonly gdpReduction: number;
    /** Legitimacy boost from brain-drain narrative. */
    readonly legitimacyBoost: number;
  };
  /** Base effects on the receiving nation per wave. */
  readonly targetBaseEffects: {
    /** Civil unrest increase per refugee wave. */
    readonly civilUnrestPerWave: number;
    /** Treasury cost per refugee wave. */
    readonly treasuryPerWave: number;
  };
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1904 — Refugee Response Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the consequences of a faction's refugee
 * response policy.
 *
 * @see FR-1904
 */
export interface RefugeeResponseInput {
  /** Faction issuing the response. */
  readonly factionId: FactionId;
  /** The chosen response policy. */
  readonly response: RefugeeResponse;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating a refugee response, including legitimacy,
 * civil unrest, and border tension changes.
 *
 * @see FR-1904
 */
export interface RefugeeResponseResult {
  /** The response policy that was evaluated. */
  readonly response: RefugeeResponse;
  /** Change in international legitimacy. */
  readonly legitimacyChange: number;
  /** Change in domestic civil unrest. */
  readonly civilUnrestChange: number;
  /** Change in border tension with neighbouring factions. */
  readonly borderTensionChange: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1904 — Weaponized Migration Types
// ─────────────────────────────────────────────────────────

/**
 * Input for assessing whether a faction is eligible to weaponize
 * migration flows against a rival.
 *
 * Eligibility depends on leader pragmatism exceeding a threshold
 * OR faction stability falling below a threshold.
 *
 * @see FR-1904
 */
export interface WeaponizedMigrationInput {
  /** Faction being assessed for weaponized migration capability. */
  readonly factionId: FactionId;
  /** Leader's pragmatism score (0–100). */
  readonly leaderPragmatism: number;
  /** Faction's overall stability score (0–100). */
  readonly factionStability: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a weaponized migration eligibility assessment.
 *
 * @see FR-1904
 */
export interface WeaponizedMigrationResult {
  /** Whether the faction meets eligibility criteria. */
  readonly eligible: boolean;
  /** Human-readable explanation of the assessment. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// ClimateRefugeeEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for climate event effects and refugee
 * flow mechanics.
 *
 * All public methods are stateless and return new objects.
 * No mutations, no side effects.
 *
 * @example
 * ```ts
 * const engine = new ClimateRefugeeEngine();
 * const event = engine.evaluateClimateEvent(eventInput);
 * const flow  = engine.evaluateRefugeeFlow(flowInput);
 * ```
 *
 * @see FR-1903 — Climate Events
 * @see FR-1904 — Refugee Flows
 */
export class ClimateRefugeeEngine {
  /** Active resources configuration. */
  private readonly cfg: ClimateRefugeeConfig;

  /**
   * Create a new ClimateRefugeeEngine.
   *
   * @param config - Optional resources configuration override. When
   *   omitted, uses `GAME_CONFIG.resources`. Useful for testing or
   *   scenario-specific tuning.
   */
  constructor(config: ClimateRefugeeConfig = GAME_CONFIG.resources) {
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
  // 1. evaluateClimateEvent (FR-1903)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the multi-dimensional effects of a climate event on a
   * target faction.
   *
   * Severity (1–10) scales all base effects linearly:
   * `scale = severity / 5` (so severity 5 = 1.0×, severity 10 = 2.0×,
   * severity 1 = 0.2×).
   *
   * Exhaustive switch over {@link ClimateEventType}:
   *
   * | Type            | Primary Effects                          | Duration |
   * |----------------|------------------------------------------|----------|
   * | HeatWave       | food ↓, civil unrest ↑                   | 2 turns  |
   * | Flooding       | infrastructure ↓, treasury ↓             | 1 turn   |
   * | Drought        | water ↓, agri GDP ↓, civil unrest ↑      | 2 turns  |
   * | Typhoon        | military inoperable                      | 1 turn   |
   * | ArcticCollapse | chokepoint dependency ↓, infrastructure ↓ | permanent|
   * | Wildfire       | food ↓, civil unrest ↑                   | 1 turn   |
   * | Earthquake     | infrastructure ↓↓, treasury ↓↓           | 1 turn   |
   *
   * @param input - Event type, severity, target faction, and turn.
   * @returns A {@link ClimateEventResult} with all effects and duration.
   *
   * @example
   * ```ts
   * const result = engine.evaluateClimateEvent({
   *   eventType: ClimateEventType.Drought,
   *   severity: 8,
   *   targetNation: 'IN',
   *   currentTurn: 12 as TurnNumber,
   * });
   * // result.effects.waterReduction === -20 * (8/5)
   * // result.durationTurns === 2
   * ```
   *
   * @see FR-1903
   */
  evaluateClimateEvent(input: ClimateEventInput): ClimateEventResult {
    const ce = this.cfg.climateEffects;
    const severity = ClimateRefugeeEngine.clamp(input.severity, 1, 10);
    const scale = severity / 5;

    const zeroEffects: ClimateEventEffects = {
      foodReduction: 0,
      infrastructureDamage: 0,
      treasuryCost: 0,
      waterReduction: 0,
      agriculturalGDPReduction: 0,
      civilUnrestIncrease: 0,
      militaryInoperableTurns: 0,
      chokepointDependencyReduction: 0,
    };

    let effects: ClimateEventEffects;
    let strategicOpportunity: string | null = null;
    let durationTurns: number;

    switch (input.eventType) {
      case ClimateEventType.HeatWave:
        effects = {
          ...zeroEffects,
          foodReduction: ce.heatFoodReduction * scale,
          civilUnrestIncrease: ce.heatCivilUnrestIncrease * scale,
        };
        durationTurns = ce.heatDurationTurns;
        break;

      case ClimateEventType.Flooding:
        effects = {
          ...zeroEffects,
          infrastructureDamage: ce.floodInfrastructureDamage * scale,
          treasuryCost: ce.floodTreasuryCost * scale,
        };
        durationTurns = 1;
        break;

      case ClimateEventType.Drought:
        effects = {
          ...zeroEffects,
          waterReduction: ce.droughtWaterReduction * scale,
          agriculturalGDPReduction: ce.droughtAgricultureGDPReduction * scale,
          civilUnrestIncrease: ce.droughtCivilUnrestIncrease * scale,
        };
        durationTurns = 2;
        break;

      case ClimateEventType.Typhoon:
        effects = {
          ...zeroEffects,
          militaryInoperableTurns: ce.typhoonMilitaryInoperableTurns,
        };
        durationTurns = 1;
        break;

      case ClimateEventType.ArcticCollapse:
        effects = {
          ...zeroEffects,
          chokepointDependencyReduction: ce.arcticChokepointDependencyReduction * scale,
          infrastructureDamage: ce.floodInfrastructureDamage * 0.5 * scale,
        };
        strategicOpportunity = 'New Arctic shipping routes reduce chokepoint dependency';
        durationTurns = 0;
        break;

      case ClimateEventType.Wildfire:
        effects = {
          ...zeroEffects,
          foodReduction: ce.heatFoodReduction * 0.5 * scale,
          civilUnrestIncrease: ce.heatCivilUnrestIncrease * scale,
        };
        durationTurns = 1;
        break;

      case ClimateEventType.Earthquake:
        effects = {
          ...zeroEffects,
          infrastructureDamage: ce.floodInfrastructureDamage * 1.5 * scale,
          treasuryCost: ce.floodTreasuryCost * 1.5 * scale,
        };
        durationTurns = 1;
        break;

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = input.eventType;
        return _exhaustive;
      }
    }

    const durationLabel = durationTurns === 0
      ? 'permanent'
      : String(durationTurns) + ' turn(s)';

    const reason =
      'FR-1903 Climate Event [' + String(input.targetNation) + ' T' +
      String(input.currentTurn) + ']: ' + String(input.eventType) +
      ' severity ' + String(severity) + ' (scale ' +
      String(Math.round(scale * 100) / 100) + '×). Duration: ' +
      durationLabel +
      (strategicOpportunity !== null
        ? '. Opportunity: ' + strategicOpportunity
        : '') + '.';

    return {
      eventType: input.eventType,
      targetNation: input.targetNation,
      effects,
      strategicOpportunity,
      durationTurns,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. computeClimateEventProbability (FR-1903)
  // ───────────────────────────────────────────────────────

  /**
   * Compute the probability of a climate event occurring on the
   * current turn.
   *
   * Probability increases with game progression to simulate
   * escalating climate instability:
   *
   * ```
   * probability = baseFrequency × (1 + currentTurn / 20)
   * ```
   *
   * Result is clamped to [0, 0.8] to prevent guaranteed events.
   *
   * @param input - Base frequency and current turn.
   * @returns A {@link ClimateEventProbabilityResult} with the computed
   *   probability.
   *
   * @example
   * ```ts
   * const result = engine.computeClimateEventProbability({
   *   currentTurn: 20 as TurnNumber,
   *   baseFrequency: 0.05,
   * });
   * // probability = 0.05 × (1 + 20/20) = 0.05 × 2 = 0.10
   * ```
   *
   * @see FR-1903
   */
  computeClimateEventProbability(
    input: ClimateEventProbabilityInput,
  ): ClimateEventProbabilityResult {
    const turnNum = input.currentTurn as number;
    const raw = input.baseFrequency * (1 + turnNum / 20);
    const probability = ClimateRefugeeEngine.clamp(raw, 0, 0.8);

    return {
      probability,
      reason:
        'FR-1903 Climate Probability [T' + String(input.currentTurn) +
        ']: base ' + String(input.baseFrequency) +
        ' × (1 + ' + String(turnNum) + '/20) = ' +
        String(Math.round(raw * 1000) / 1000) +
        ', clamped to ' + String(Math.round(probability * 1000) / 1000) + '.',
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. evaluateRefugeeFlow (FR-1904)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the effects of a refugee flow on both the source and
   * target nations.
   *
   * **Source effects** scale linearly with `waveSize / 100`:
   * - Labor reduction: −5 % per 100k
   * - GDP reduction: −2 % per 100k
   * - Legitimacy boost: +5 per 100k (brain-drain narrative)
   *
   * **Target base effects** are per-wave constants from config:
   * - Civil unrest: +5 per wave
   * - Treasury cost: −3 per wave
   *
   * @param input - Source/target factions, cause, wave size, and turn.
   * @returns A {@link RefugeeFlowResult} with effects on both nations.
   *
   * @example
   * ```ts
   * const result = engine.evaluateRefugeeFlow({
   *   sourceNation: 'IR',
   *   targetNation: 'EU',
   *   cause: RefugeeCause.War,
   *   waveSize: 200,
   *   currentTurn: 10 as TurnNumber,
   * });
   * // result.sourceEffects.laborReduction === -0.05 * 2 = -0.10
   * // result.targetBaseEffects.civilUnrestPerWave === 5
   * ```
   *
   * @see FR-1904
   */
  evaluateRefugeeFlow(input: RefugeeFlowInput): RefugeeFlowResult {
    const src = this.cfg.refugeeFlow.source;
    const rcv = this.cfg.refugeeFlow.receiver;
    const waveScale = Math.max(0, input.waveSize) / 100;

    const sourceEffects = {
      laborReduction: src.laborReduction * waveScale,
      gdpReduction: src.gdpReduction * waveScale,
      legitimacyBoost: src.legitimacyBoost * waveScale,
    };

    const targetBaseEffects = {
      civilUnrestPerWave: rcv.civilUnrestPerWave,
      treasuryPerWave: rcv.treasuryPerWave,
    };

    const reason =
      'FR-1904 Refugee Flow [' + String(input.sourceNation) +
      ' → ' + String(input.targetNation) + ' T' +
      String(input.currentTurn) + ']: cause=' + String(input.cause) +
      ', waveSize=' + String(input.waveSize) + 'k (scale ' +
      String(Math.round(waveScale * 100) / 100) + '×). Source: labor ' +
      String(Math.round(sourceEffects.laborReduction * 1000) / 1000) +
      ', GDP ' +
      String(Math.round(sourceEffects.gdpReduction * 1000) / 1000) +
      ', legitimacy +' +
      String(Math.round(sourceEffects.legitimacyBoost * 100) / 100) +
      '. Target per-wave: unrest +' + String(targetBaseEffects.civilUnrestPerWave) +
      ', treasury ' + String(targetBaseEffects.treasuryPerWave) + '.';

    return {
      sourceEffects,
      targetBaseEffects,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. evaluateRefugeeResponse (FR-1904)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the diplomatic and domestic consequences of a faction's
   * refugee response policy.
   *
   * Exhaustive switch over {@link RefugeeResponse}:
   *
   * | Response   | Legitimacy | Civil Unrest | Border Tension |
   * |-----------|------------|-------------|----------------|
   * | Accept    | +5         | +3          | 0              |
   * | Reject    | −10        | 0           | +10            |
   * | Weaponized| 0          | 0           | 0 (separate)   |
   *
   * Values are drawn from `GAME_CONFIG.resources.refugeeResponseEffects`.
   * The "Weaponized" response yields zero changes here; its effects
   * are handled by {@link evaluateWeaponizedMigration}.
   *
   * @param input - Faction, chosen response, and turn context.
   * @returns A {@link RefugeeResponseResult} with all effect changes.
   *
   * @example
   * ```ts
   * const result = engine.evaluateRefugeeResponse({
   *   factionId: 'EU',
   *   response: RefugeeResponse.Accept,
   *   currentTurn: 14 as TurnNumber,
   * });
   * // result.legitimacyChange === 5
   * // result.civilUnrestChange === 3
   * // result.borderTensionChange === 0
   * ```
   *
   * @see FR-1904
   */
  evaluateRefugeeResponse(input: RefugeeResponseInput): RefugeeResponseResult {
    const rre = this.cfg.refugeeResponseEffects;
    const response = input.response;

    switch (response) {
      case RefugeeResponse.Accept:
        return {
          response,
          legitimacyChange: rre.acceptLegitimacyGain,
          civilUnrestChange: rre.acceptCivilUnrestIncrease,
          borderTensionChange: 0,
          reason:
            'FR-1904 Refugee Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) + ']: Accept — legitimacy +' +
            String(rre.acceptLegitimacyGain) + ', civil unrest +' +
            String(rre.acceptCivilUnrestIncrease) +
            ', border tension unchanged.',
        };

      case RefugeeResponse.Reject:
        return {
          response,
          legitimacyChange: rre.rejectLegitimacyPenalty,
          civilUnrestChange: 0,
          borderTensionChange: rre.rejectBorderTensionIncrease,
          reason:
            'FR-1904 Refugee Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) + ']: Reject — legitimacy ' +
            String(rre.rejectLegitimacyPenalty) +
            ', civil unrest unchanged, border tension +' +
            String(rre.rejectBorderTensionIncrease) + '.',
        };

      case RefugeeResponse.Weaponized:
        return {
          response,
          legitimacyChange: 0,
          civilUnrestChange: 0,
          borderTensionChange: 0,
          reason:
            'FR-1904 Refugee Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) +
            ']: Weaponized — direct effects handled separately ' +
            'via evaluateWeaponizedMigration.',
        };

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = response;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 5. evaluateWeaponizedMigration (FR-1904)
  // ───────────────────────────────────────────────────────

  /**
   * Assess whether a faction is eligible to weaponize migration
   * flows as a grey-zone tool against rivals.
   *
   * A faction qualifies when **either** of the following conditions
   * is met:
   * - Leader pragmatism exceeds the threshold (default > 70)
   * - Faction stability falls below the threshold (default < 25)
   *
   * Thresholds are drawn from
   * `GAME_CONFIG.resources.refugeeResponseEffects`.
   *
   * @param input - Faction, leader pragmatism, stability, and turn.
   * @returns A {@link WeaponizedMigrationResult} with eligibility and
   *   explanation.
   *
   * @example
   * ```ts
   * const result = engine.evaluateWeaponizedMigration({
   *   factionId: 'TR',
   *   leaderPragmatism: 80,
   *   factionStability: 50,
   *   currentTurn: 18 as TurnNumber,
   * });
   * // result.eligible === true  (pragmatism 80 > 70)
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluateWeaponizedMigration({
   *   factionId: 'IR',
   *   leaderPragmatism: 40,
   *   factionStability: 15,
   *   currentTurn: 22 as TurnNumber,
   * });
   * // result.eligible === true  (stability 15 < 25)
   * ```
   *
   * @see FR-1904
   */
  evaluateWeaponizedMigration(
    input: WeaponizedMigrationInput,
  ): WeaponizedMigrationResult {
    const rre = this.cfg.refugeeResponseEffects;
    const pragmatismThreshold = rre.weaponizedPragmatismThreshold;
    const stabilityThreshold = rre.weaponizedStabilityThreshold;

    const pragmatism = ClimateRefugeeEngine.clamp(input.leaderPragmatism, 0, 100);
    const stability = ClimateRefugeeEngine.clamp(input.factionStability, 0, 100);

    const highPragmatism = pragmatism > pragmatismThreshold;
    const lowStability = stability < stabilityThreshold;
    const eligible = highPragmatism || lowStability;

    if (eligible) {
      const reasons: string[] = [];
      if (highPragmatism) {
        reasons.push(
          'pragmatism ' + String(pragmatism) + ' > ' +
          String(pragmatismThreshold),
        );
      }
      if (lowStability) {
        reasons.push(
          'stability ' + String(stability) + ' < ' +
          String(stabilityThreshold),
        );
      }

      return {
        eligible: true,
        reason:
          'FR-1904 Weaponized Migration [' + String(input.factionId) +
          ' T' + String(input.currentTurn) + ']: Eligible — ' +
          reasons.join('; ') + '.',
      };
    }

    return {
      eligible: false,
      reason:
        'FR-1904 Weaponized Migration [' + String(input.factionId) +
        ' T' + String(input.currentTurn) + ']: Not eligible — pragmatism ' +
        String(pragmatism) + ' ≤ ' + String(pragmatismThreshold) +
        ' AND stability ' + String(stability) + ' ≥ ' +
        String(stabilityThreshold) + '.',
    };
  }
}
