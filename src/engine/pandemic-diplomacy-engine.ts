/**
 * Pandemic Risk & Environmental Diplomacy Engine
 *
 * Implements pandemic risk assessment and response (FR-1905),
 * and environmental diplomacy tools including Climate Accords,
 * Resource Sharing Treaties, Joint Disaster Response, and
 * Pariah Pressure (FR-1908).
 *
 * All public methods are pure functions.
 * Thresholds and modifiers drawn from GAME_CONFIG.resources.
 *
 * @module pandemic-diplomacy-engine
 * @see FR-1905 — Pandemic Risk
 * @see FR-1908 — Environmental Diplomacy
 */

import { GAME_CONFIG } from '@/engine/config';
import { PandemicResponse, EnvironmentalDiplomacyType } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Config Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Resolved type of `GAME_CONFIG.resources`.
 * Used to allow dependency-injection of the resources config section
 * for testing and scenario overrides.
 */
export type PandemicDiplomacyConfig = typeof GAME_CONFIG.resources;

// ─────────────────────────────────────────────────────────
// FR-1905 — Pandemic Risk Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating global pandemic risk on a given turn.
 *
 * Three independent risk factors are assessed:
 * - Active war theaters exceeding a threshold
 * - Lowest nation stability falling below a threshold
 * - Global average biotech level falling below a threshold
 *
 * A pandemic is triggered only when ALL three factors are present.
 *
 * @see FR-1905
 */
export interface PandemicRiskInput {
  /** Number of currently active war theaters worldwide. */
  readonly activeWarTheaters: number;
  /** Stability score of the most unstable nation (0–100). */
  readonly lowestNationStability: number;
  /** Global average biotech capability (0–100). */
  readonly globalAverageBiotech: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating global pandemic risk.
 *
 * Contains individual risk factor assessments, a total count,
 * and the pandemic trigger determination.
 *
 * @see FR-1905
 */
export interface PandemicRiskResult {
  /** Individual risk factor assessments. */
  readonly riskFactors: {
    /** True when active war theaters ≥ warTheaterThreshold. */
    readonly warTheaterExceeded: boolean;
    /** True when lowest nation stability < stabilityThreshold. */
    readonly stabilityBelowThreshold: boolean;
    /** True when global average biotech < biotechThreshold. */
    readonly biotechBelowThreshold: boolean;
  };
  /** Number of risk factors present (0–3). */
  readonly riskFactorCount: number;
  /** True when ALL three risk factors are present. */
  readonly pandemicTriggered: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1905 — Pandemic Effects Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating ongoing pandemic effects on a specific
 * faction.
 *
 * Higher biotech levels shorten the time required to develop
 * countermeasures and halt the GDP penalty.
 *
 * @see FR-1905
 */
export interface PandemicEffectsInput {
  /** Faction being evaluated. */
  readonly factionId: FactionId;
  /** Faction's biotech capability level (0–100). */
  readonly factionBiotechLevel: number;
  /** Number of turns elapsed since the pandemic started. */
  readonly turnsSincePandemicStart: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating ongoing pandemic effects for a faction.
 *
 * GDP penalty is applied each turn until the faction develops
 * countermeasures. High-biotech nations recover in 2 turns;
 * low-biotech nations require 4 turns.
 *
 * @see FR-1905
 */
export interface PandemicEffectsResult {
  /** Faction that was evaluated. */
  readonly factionId: FactionId;
  /** Per-turn GDP penalty during the pandemic (fraction, e.g. −0.03). */
  readonly gdpPenaltyPerTurn: number;
  /** Number of turns required to develop countermeasures. */
  readonly recoveryTurns: number;
  /** True when the faction has developed countermeasures. */
  readonly hasCountermeasures: boolean;
  /** True when the faction is still suffering pandemic effects. */
  readonly activeEffects: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1905 — Pandemic Response Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the consequences of a faction's pandemic
 * response policy.
 *
 * @see FR-1905
 */
export interface PandemicResponseInput {
  /** Faction issuing the response. */
  readonly factionId: FactionId;
  /** The chosen pandemic response policy. */
  readonly response: PandemicResponse;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating a pandemic response policy.
 *
 * Exhaustive switch over {@link PandemicResponse}:
 *
 * | Response    | Legitimacy | GDP Penalty | Spread Reduction | Trade Halted |
 * |------------|------------|-------------|------------------|-------------|
 * | Cooperate  | +10        | 0           | false            | false       |
 * | Hoard      | −10        | 0           | false            | false       |
 * | BorderClose| 0          | −0.05       | true             | true        |
 *
 * Values are drawn from `GAME_CONFIG.resources.pandemic`.
 *
 * @see FR-1905
 */
export interface PandemicResponseResult {
  /** The response policy that was evaluated. */
  readonly response: PandemicResponse;
  /** Change in international legitimacy. */
  readonly legitimacyChange: number;
  /** GDP penalty from the response (fraction). */
  readonly gdpPenalty: number;
  /** Whether the response reduces pandemic spread. */
  readonly spreadReduction: boolean;
  /** Whether trade is halted by the response. */
  readonly tradeHalted: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1908 — Environmental Diplomacy Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the effects of an environmental diplomacy
 * action between two factions.
 *
 * @see FR-1908
 */
export interface EnvironmentalDiplomacyInput {
  /** Faction initiating the diplomacy action. */
  readonly factionId: FactionId;
  /** Partner faction in the agreement. */
  readonly partnerFaction: FactionId;
  /** Type of environmental diplomacy being pursued. */
  readonly diplomacyType: EnvironmentalDiplomacyType;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating an environmental diplomacy action.
 *
 * Exhaustive switch over {@link EnvironmentalDiplomacyType}:
 *
 * | Type                    | Legitimacy | GDP Cost | Chemistry | Trust |
 * |------------------------|------------|----------|-----------|-------|
 * | ClimateAccords         | +5         | −0.02    | 0         | 0     |
 * | ResourceSharingTreaty  | 0          | 0        | 0         | 0     |
 * | JointDisasterResponse  | 0          | 0        | +10       | +5    |
 *
 * Values are drawn from `GAME_CONFIG.resources.environmentalDiplomacy`.
 *
 * @see FR-1908
 */
export interface EnvironmentalDiplomacyResult {
  /** The type of diplomacy that was evaluated. */
  readonly diplomacyType: EnvironmentalDiplomacyType;
  /** Change in international legitimacy. */
  readonly legitimacyChange: number;
  /** GDP cost of compliance (fraction, e.g. −0.02). */
  readonly gdpCost: number;
  /** Bilateral chemistry bonus. */
  readonly chemistryBonus: number;
  /** Bilateral trust bonus. */
  readonly trustBonus: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// FR-1908 — Environmental Pariah Types
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the cumulative legitimacy penalty imposed
 * on a faction that refuses environmental cooperation.
 *
 * Each turn of non-cooperation accrues a fixed legitimacy penalty.
 *
 * @see FR-1908
 */
export interface EnvironmentalPariahInput {
  /** Faction being assessed. */
  readonly factionId: FactionId;
  /** Number of consecutive turns the faction has refused cooperation. */
  readonly turnsOfNonCooperation: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of evaluating environmental pariah status.
 *
 * The cumulative penalty scales linearly with turns of non-cooperation.
 *
 * @see FR-1908
 */
export interface EnvironmentalPariahResult {
  /** Total accumulated legitimacy penalty (always ≤ 0). */
  readonly cumulativeLegitimacyPenalty: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// PandemicDiplomacyEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for pandemic risk assessment, pandemic
 * response evaluation, environmental diplomacy effects, and
 * environmental pariah penalties.
 *
 * All public methods are stateless and return new objects.
 * No mutations, no side effects.
 *
 * @example
 * ```ts
 * const engine = new PandemicDiplomacyEngine();
 * const risk   = engine.evaluatePandemicRisk(riskInput);
 * const fx     = engine.evaluatePandemicEffects(effectsInput);
 * const resp   = engine.evaluatePandemicResponse(responseInput);
 * const diplo  = engine.evaluateEnvironmentalDiplomacy(diploInput);
 * const pariah = engine.evaluateEnvironmentalPariah(pariahInput);
 * ```
 *
 * @see FR-1905 — Pandemic Risk
 * @see FR-1908 — Environmental Diplomacy
 */
export class PandemicDiplomacyEngine {
  /** Active resources configuration. */
  private readonly cfg: PandemicDiplomacyConfig;

  /**
   * Create a new PandemicDiplomacyEngine.
   *
   * @param config - Optional resources configuration override. When
   *   omitted, uses `GAME_CONFIG.resources`. Useful for testing or
   *   scenario-specific tuning.
   */
  constructor(config: PandemicDiplomacyConfig = GAME_CONFIG.resources) {
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
  // 1. evaluatePandemicRisk (FR-1905)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate global pandemic risk based on three independent factors.
   *
   * A pandemic is triggered only when **all three** factors are met
   * simultaneously:
   *
   * 1. **War Theater Exceeded** — `activeWarTheaters >= warTheaterThreshold` (default 3)
   * 2. **Stability Below Threshold** — `lowestNationStability < stabilityThreshold` (default 15)
   * 3. **Biotech Below Threshold** — `globalAverageBiotech < biotechThreshold` (default 30)
   *
   * Thresholds are drawn from `GAME_CONFIG.resources.pandemic`.
   *
   * @param input - War theaters, lowest stability, average biotech, and turn.
   * @returns A {@link PandemicRiskResult} with factor assessments and
   *   trigger determination.
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicRisk({
   *   activeWarTheaters: 4,
   *   lowestNationStability: 10,
   *   globalAverageBiotech: 20,
   *   currentTurn: 15 as TurnNumber,
   * });
   * // result.riskFactorCount === 3
   * // result.pandemicTriggered === true
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicRisk({
   *   activeWarTheaters: 1,
   *   lowestNationStability: 50,
   *   globalAverageBiotech: 60,
   *   currentTurn: 5 as TurnNumber,
   * });
   * // result.riskFactorCount === 0
   * // result.pandemicTriggered === false
   * ```
   *
   * @see FR-1905
   */
  evaluatePandemicRisk(input: PandemicRiskInput): PandemicRiskResult {
    const pan = this.cfg.pandemic;

    const warTheaterExceeded =
      input.activeWarTheaters >= pan.warTheaterThreshold;
    const stabilityBelowThreshold =
      input.lowestNationStability < pan.stabilityThreshold;
    const biotechBelowThreshold =
      input.globalAverageBiotech < pan.biotechThreshold;

    const riskFactors = {
      warTheaterExceeded,
      stabilityBelowThreshold,
      biotechBelowThreshold,
    };

    const riskFactorCount =
      (warTheaterExceeded ? 1 : 0) +
      (stabilityBelowThreshold ? 1 : 0) +
      (biotechBelowThreshold ? 1 : 0);

    const pandemicTriggered =
      warTheaterExceeded && stabilityBelowThreshold && biotechBelowThreshold;

    const factorDetails: string[] = [];

    factorDetails.push(
      'warTheaters=' + String(input.activeWarTheaters) +
      (warTheaterExceeded ? ' ≥ ' : ' < ') +
      String(pan.warTheaterThreshold) +
      (warTheaterExceeded ? ' [RISK]' : ' [ok]'),
    );

    factorDetails.push(
      'stability=' + String(input.lowestNationStability) +
      (stabilityBelowThreshold ? ' < ' : ' ≥ ') +
      String(pan.stabilityThreshold) +
      (stabilityBelowThreshold ? ' [RISK]' : ' [ok]'),
    );

    factorDetails.push(
      'biotech=' + String(input.globalAverageBiotech) +
      (biotechBelowThreshold ? ' < ' : ' ≥ ') +
      String(pan.biotechThreshold) +
      (biotechBelowThreshold ? ' [RISK]' : ' [ok]'),
    );

    const reason =
      'FR-1905 Pandemic Risk [T' + String(input.currentTurn) +
      ']: ' + String(riskFactorCount) + '/3 factors met — ' +
      factorDetails.join('; ') + '. Pandemic ' +
      (pandemicTriggered ? 'TRIGGERED' : 'not triggered') + '.';

    return {
      riskFactors,
      riskFactorCount,
      pandemicTriggered,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. evaluatePandemicEffects (FR-1905)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate ongoing pandemic effects on a specific faction.
   *
   * Each turn during an active pandemic, the faction suffers a GDP
   * penalty (default −3 % per turn). Factions with higher biotech
   * develop countermeasures faster:
   *
   * - **Biotech ≥ 50**: Recovery in 2 turns
   * - **Biotech < 50**: Recovery in 4 turns
   *
   * Once `turnsSincePandemicStart >= recoveryTurns`, the faction
   * has countermeasures and effects cease.
   *
   * Thresholds are drawn from `GAME_CONFIG.resources.pandemic`.
   *
   * @param input - Faction, biotech level, turns since pandemic, and turn.
   * @returns A {@link PandemicEffectsResult} with GDP penalty, recovery
   *   timeline, and active status.
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicEffects({
   *   factionId: 'US',
   *   factionBiotechLevel: 70,
   *   turnsSincePandemicStart: 1,
   *   currentTurn: 16 as TurnNumber,
   * });
   * // result.recoveryTurns === 2
   * // result.hasCountermeasures === false  (1 < 2)
   * // result.activeEffects === true
   * // result.gdpPenaltyPerTurn === -0.03
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicEffects({
   *   factionId: 'US',
   *   factionBiotechLevel: 70,
   *   turnsSincePandemicStart: 3,
   *   currentTurn: 18 as TurnNumber,
   * });
   * // result.recoveryTurns === 2
   * // result.hasCountermeasures === true  (3 >= 2)
   * // result.activeEffects === false
   * ```
   *
   * @see FR-1905
   */
  evaluatePandemicEffects(input: PandemicEffectsInput): PandemicEffectsResult {
    const pan = this.cfg.pandemic;

    const biotechLevel = PandemicDiplomacyEngine.clamp(
      input.factionBiotechLevel, 0, 100,
    );

    const recoveryTurns =
      biotechLevel >= pan.biotechRecoveryThreshold
        ? pan.highBiotechRecoveryTurns
        : pan.lowBiotechRecoveryTurns;

    const hasCountermeasures =
      input.turnsSincePandemicStart >= recoveryTurns;

    const activeEffects = !hasCountermeasures;

    const reason =
      'FR-1905 Pandemic Effects [' + String(input.factionId) + ' T' +
      String(input.currentTurn) + ']: biotech=' +
      String(biotechLevel) +
      (biotechLevel >= pan.biotechRecoveryThreshold ? ' ≥ ' : ' < ') +
      String(pan.biotechRecoveryThreshold) + ' → recovery in ' +
      String(recoveryTurns) + ' turn(s). Turns elapsed=' +
      String(input.turnsSincePandemicStart) +
      (hasCountermeasures
        ? ' ≥ ' + String(recoveryTurns) + ' → countermeasures ACTIVE, effects ceased.'
        : ' < ' + String(recoveryTurns) + ' → effects ACTIVE, GDP penalty ' +
          String(pan.gdpPenaltyPerTurn) + '/turn.');

    return {
      factionId: input.factionId,
      gdpPenaltyPerTurn: pan.gdpPenaltyPerTurn,
      recoveryTurns,
      hasCountermeasures,
      activeEffects,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. evaluatePandemicResponse (FR-1905)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the diplomatic, economic, and epidemiological
   * consequences of a faction's pandemic response policy.
   *
   * Exhaustive switch over {@link PandemicResponse}:
   *
   * | Response    | Legitimacy | GDP Penalty | Spread Reduction | Trade Halted |
   * |------------|------------|-------------|------------------|-------------|
   * | Cooperate  | +10        | 0           | false            | false       |
   * | Hoard      | −10        | 0           | false            | false       |
   * | BorderClose| 0          | −0.05       | true             | true        |
   *
   * Values are drawn from `GAME_CONFIG.resources.pandemic`.
   *
   * @param input - Faction, chosen response, and turn context.
   * @returns A {@link PandemicResponseResult} with all effect changes.
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicResponse({
   *   factionId: 'EU',
   *   response: PandemicResponse.Cooperate,
   *   currentTurn: 17 as TurnNumber,
   * });
   * // result.legitimacyChange === 10
   * // result.gdpPenalty === 0
   * // result.spreadReduction === false
   * // result.tradeHalted === false
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluatePandemicResponse({
   *   factionId: 'CN',
   *   response: PandemicResponse.BorderClose,
   *   currentTurn: 17 as TurnNumber,
   * });
   * // result.legitimacyChange === 0
   * // result.gdpPenalty === -0.05
   * // result.spreadReduction === true
   * // result.tradeHalted === true
   * ```
   *
   * @see FR-1905
   */
  evaluatePandemicResponse(
    input: PandemicResponseInput,
  ): PandemicResponseResult {
    const pan = this.cfg.pandemic;
    const response = input.response;

    switch (response) {
      case PandemicResponse.Cooperate:
        return {
          response,
          legitimacyChange: pan.cooperativeLegitimacyGain,
          gdpPenalty: 0,
          spreadReduction: false,
          tradeHalted: false,
          reason:
            'FR-1905 Pandemic Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) + ']: Cooperate — legitimacy +' +
            String(pan.cooperativeLegitimacyGain) +
            ', no GDP penalty, no spread reduction, trade open.',
        };

      case PandemicResponse.Hoard:
        return {
          response,
          legitimacyChange: pan.hoardingLegitimacyPenalty,
          gdpPenalty: 0,
          spreadReduction: false,
          tradeHalted: false,
          reason:
            'FR-1905 Pandemic Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) + ']: Hoard — legitimacy ' +
            String(pan.hoardingLegitimacyPenalty) +
            ', no GDP penalty, no spread reduction, trade open.',
        };

      case PandemicResponse.BorderClose:
        return {
          response,
          legitimacyChange: 0,
          gdpPenalty: pan.borderClosureGDPPenalty,
          spreadReduction: true,
          tradeHalted: true,
          reason:
            'FR-1905 Pandemic Response [' + String(input.factionId) + ' T' +
            String(input.currentTurn) + ']: BorderClose — legitimacy unchanged' +
            ', GDP penalty ' + String(pan.borderClosureGDPPenalty) +
            ', spread reduction active, trade halted.',
        };

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = response;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 4. evaluateEnvironmentalDiplomacy (FR-1908)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the effects of an environmental diplomacy action
   * between two factions.
   *
   * Exhaustive switch over {@link EnvironmentalDiplomacyType}:
   *
   * | Type                    | Legitimacy | GDP Cost | Chemistry | Trust |
   * |------------------------|------------|----------|-----------|-------|
   * | ClimateAccords         | +5         | −0.02    | 0         | 0     |
   * | ResourceSharingTreaty  | 0          | 0        | 0         | 0     |
   * | JointDisasterResponse  | 0          | 0        | +10       | +5    |
   *
   * **ResourceSharingTreaty** yields zero direct effects here;
   * resource dependency effects are handled by the resource-security
   * engine.
   *
   * Values are drawn from `GAME_CONFIG.resources.environmentalDiplomacy`.
   *
   * @param input - Factions, diplomacy type, and turn context.
   * @returns An {@link EnvironmentalDiplomacyResult} with all effect
   *   changes.
   *
   * @example
   * ```ts
   * const result = engine.evaluateEnvironmentalDiplomacy({
   *   factionId: 'EU',
   *   partnerFaction: 'US',
   *   diplomacyType: EnvironmentalDiplomacyType.ClimateAccords,
   *   currentTurn: 20 as TurnNumber,
   * });
   * // result.legitimacyChange === 5
   * // result.gdpCost === -0.02
   * // result.chemistryBonus === 0
   * // result.trustBonus === 0
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluateEnvironmentalDiplomacy({
   *   factionId: 'IN',
   *   partnerFaction: 'JP',
   *   diplomacyType: EnvironmentalDiplomacyType.JointDisasterResponse,
   *   currentTurn: 25 as TurnNumber,
   * });
   * // result.legitimacyChange === 0
   * // result.gdpCost === 0
   * // result.chemistryBonus === 10
   * // result.trustBonus === 5
   * ```
   *
   * @see FR-1908
   */
  evaluateEnvironmentalDiplomacy(
    input: EnvironmentalDiplomacyInput,
  ): EnvironmentalDiplomacyResult {
    const ed = this.cfg.environmentalDiplomacy;
    const diplomacyType = input.diplomacyType;

    switch (diplomacyType) {
      case EnvironmentalDiplomacyType.ClimateAccords:
        return {
          diplomacyType,
          legitimacyChange: ed.accordsLegitimacyBonus,
          gdpCost: ed.accordsGDPComplianceCost,
          chemistryBonus: 0,
          trustBonus: 0,
          reason:
            'FR-1908 Environmental Diplomacy [' + String(input.factionId) +
            ' ↔ ' + String(input.partnerFaction) + ' T' +
            String(input.currentTurn) + ']: ClimateAccords — legitimacy +' +
            String(ed.accordsLegitimacyBonus) + ', GDP cost ' +
            String(ed.accordsGDPComplianceCost) +
            ', no chemistry/trust bonus.',
        };

      case EnvironmentalDiplomacyType.ResourceSharingTreaty:
        return {
          diplomacyType,
          legitimacyChange: 0,
          gdpCost: 0,
          chemistryBonus: 0,
          trustBonus: 0,
          reason:
            'FR-1908 Environmental Diplomacy [' + String(input.factionId) +
            ' ↔ ' + String(input.partnerFaction) + ' T' +
            String(input.currentTurn) +
            ']: ResourceSharingTreaty — no direct effects; ' +
            'resource dependency changes handled by resource-security engine.',
        };

      case EnvironmentalDiplomacyType.JointDisasterResponse:
        return {
          diplomacyType,
          legitimacyChange: 0,
          gdpCost: 0,
          chemistryBonus: ed.jointResponseChemistryBonus,
          trustBonus: ed.jointResponseTrustBonus,
          reason:
            'FR-1908 Environmental Diplomacy [' + String(input.factionId) +
            ' ↔ ' + String(input.partnerFaction) + ' T' +
            String(input.currentTurn) +
            ']: JointDisasterResponse — chemistry +' +
            String(ed.jointResponseChemistryBonus) + ', trust +' +
            String(ed.jointResponseTrustBonus) +
            ', no legitimacy/GDP effects.',
        };

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = diplomacyType;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 5. evaluateEnvironmentalPariah (FR-1908)
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the cumulative legitimacy penalty for a faction that
   * has refused environmental cooperation over multiple turns.
   *
   * The penalty scales linearly:
   * ```
   * cumulativeLegitimacyPenalty = turnsOfNonCooperation × pariahLegitimacyPenaltyPerTurn
   * ```
   *
   * The per-turn penalty (default −2) is drawn from
   * `GAME_CONFIG.resources.environmentalDiplomacy.pariahLegitimacyPenaltyPerTurn`.
   *
   * @param input - Faction, turns of non-cooperation, and turn context.
   * @returns An {@link EnvironmentalPariahResult} with the cumulative
   *   penalty.
   *
   * @example
   * ```ts
   * const result = engine.evaluateEnvironmentalPariah({
   *   factionId: 'RU',
   *   turnsOfNonCooperation: 5,
   *   currentTurn: 30 as TurnNumber,
   * });
   * // result.cumulativeLegitimacyPenalty === 5 * -2 = -10
   * ```
   *
   * @example
   * ```ts
   * const result = engine.evaluateEnvironmentalPariah({
   *   factionId: 'EU',
   *   turnsOfNonCooperation: 0,
   *   currentTurn: 10 as TurnNumber,
   * });
   * // result.cumulativeLegitimacyPenalty === 0
   * ```
   *
   * @see FR-1908
   */
  evaluateEnvironmentalPariah(
    input: EnvironmentalPariahInput,
  ): EnvironmentalPariahResult {
    const ed = this.cfg.environmentalDiplomacy;

    const turns = Math.max(0, input.turnsOfNonCooperation);
    const cumulativeLegitimacyPenalty =
      turns * ed.pariahLegitimacyPenaltyPerTurn;

    const reason =
      'FR-1908 Environmental Pariah [' + String(input.factionId) + ' T' +
      String(input.currentTurn) + ']: ' + String(turns) +
      ' turn(s) of non-cooperation × ' +
      String(ed.pariahLegitimacyPenaltyPerTurn) +
      '/turn = cumulative legitimacy penalty ' +
      String(cumulativeLegitimacyPenalty) + '.';

    return {
      cumulativeLegitimacyPenalty,
      reason,
    };
  }
}
