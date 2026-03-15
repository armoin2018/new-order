/**
 * International Legitimacy Score Engine — New Order
 *
 * Computes and manages each nation's International Legitimacy Score (0–100),
 * which reflects global perception of the nation's conduct. Legitimacy
 * gates diplomatic options and modifies diplomatic effectiveness.
 *
 * All methods are pure functions that return new objects; no side effects,
 * no UI, no state management. Legitimacy persists in save files via the
 * game-state layer — this engine is purely computational.
 *
 * Key rules:
 * - Legitimacy ≤ 30 blocks new alliances.
 * - Legitimacy ≥ 70 grants +15% diplomatic effectiveness.
 * - Aggressive actions reduce legitimacy; humanitarian actions raise it.
 * - Treaty compliance raises legitimacy.
 * - Narrative campaigns shift legitimacy positively or negatively.
 * - Each UN Resolution condemning a nation applies a −10 penalty.
 *
 * @see FR-1601 — International Legitimacy Score
 */

import type {
  FactionId,
  TurnNumber,
  NarrativeType,
  InternationalLegitimacy,
  NarrativeBattleEntry,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * Used internally to enforce the 0–100 legitimacy bounds after
 * any additive or subtractive modification.
 *
 * @param value - The raw value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value, guaranteed to be within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Minimum legitimacy score. */
const LEGITIMACY_MIN = 0;

/** Maximum legitimacy score. */
const LEGITIMACY_MAX = 100;

// ─────────────────────────────────────────────────────────
// Exported types & interfaces
// ─────────────────────────────────────────────────────────

/**
 * Raw numeric inputs for computing a single turn's legitimacy delta.
 *
 * Each field represents one category of modifier. Callers are responsible
 * for deriving these values from game events and actions taken during the
 * current turn.
 *
 * @see FR-1601
 */
export interface LegitimacyInput {
  /**
   * Penalty from aggressive military or covert actions taken this turn.
   * Expected to be negative (e.g., −5 for a border incursion).
   */
  readonly aggressiveActionPenalty: number;

  /**
   * Bonus from humanitarian actions (aid, disaster relief, refugee support).
   * Expected to be positive (e.g., +3 for sending humanitarian aid).
   */
  readonly humanitarianBonus: number;

  /**
   * Bonus from treaty compliance (honoring alliances, disarmament commitments).
   * Expected to be positive (e.g., +2 for verified treaty compliance).
   */
  readonly treatyComplianceBonus: number;

  /**
   * Net effect of active narrative campaigns on legitimacy.
   * Can be positive or negative depending on the narrative type and outcome.
   */
  readonly narrativeEffect: number;

  /**
   * Count of UN Resolutions condemning this nation this turn.
   * Each resolution applies the configured penalty (default −10).
   */
  readonly unResolutions: number;

  /**
   * Legitimacy delta from narrative battles resolved this turn.
   * Positive if the nation won the battle, negative if it lost.
   */
  readonly narrativeBattleDelta: number;

  /**
   * Catch-all for miscellaneous modifiers not covered by other fields.
   * Positive or negative.
   */
  readonly otherModifiers: number;
}

/**
 * Summary of diplomatic gating derived from a nation's current
 * legitimacy score.
 *
 * Used by the diplomacy layer to determine available diplomatic
 * options and effectiveness multipliers.
 *
 * @see FR-1601
 */
export interface DiplomaticGating {
  /**
   * `true` if the nation's legitimacy is at or below the
   * {@link LegitimacyConfig.blocksAlliances | blocksAlliances} threshold,
   * preventing formation of new alliances.
   */
  readonly blocked: boolean;

  /**
   * `true` if the nation's legitimacy meets or exceeds the
   * {@link LegitimacyConfig.diplomaticBonusThreshold | diplomaticBonusThreshold},
   * granting a diplomatic effectiveness bonus.
   */
  readonly bonusActive: boolean;

  /**
   * The diplomatic effectiveness modifier.
   * Returns `0` when below threshold, or the configured bonus (e.g., 0.15)
   * when at or above threshold.
   */
  readonly effectivenessModifier: number;
}

/**
 * Configuration shape for legitimacy engine parameters.
 *
 * Mirrors the structure under `GAME_CONFIG.infoWar.legitimacy` plus the
 * `unResolutionPenalty` from `GAME_CONFIG.infoWar`. Exposed as a separate
 * type so tests can inject custom config without depending on the full
 * game configuration tree.
 *
 * @see FR-1601
 */
export interface LegitimacyConfig {
  /**
   * Legitimacy score at-or-below which new alliance formation is blocked.
   * Default: 30.
   */
  readonly blocksAlliances: number;

  /**
   * Legitimacy score at-or-above which the diplomatic effectiveness
   * bonus is granted. Default: 70.
   */
  readonly diplomaticBonusThreshold: number;

  /**
   * Diplomatic effectiveness multiplier bonus granted when legitimacy
   * is at or above the threshold. Default: 0.15 (15%).
   */
  readonly diplomaticEffectivenessBonus: number;

  /**
   * Legitimacy penalty per UN Resolution condemning the nation.
   * Default: −10.
   */
  readonly unResolutionPenalty: number;
}

/**
 * Optional input describing a narrative battle that occurred this turn.
 *
 * When provided to {@link LegitimacyEngine.computeTurnLegitimacy},
 * the battle entry is appended to the nation's narrative battle history.
 *
 * @see FR-1606
 */
export interface NarrativeBattleInput {
  /** The faction that launched the narrative attack. */
  readonly attacker: FactionId;

  /** The faction that was targeted by the narrative attack. */
  readonly defender: FactionId;

  /** The type of narrative employed in the battle. */
  readonly narrativeType: NarrativeType;

  /** Net legitimacy delta resulting from the battle for this nation. */
  readonly legitimacyDelta: number;

  /** Whether the narrative was successfully countered by the defender. */
  readonly countered: boolean;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * International Legitimacy Score Engine.
 *
 * Provides pure-computational methods for:
 * - Computing per-turn legitimacy deltas from categorized inputs.
 * - Applying deltas with clamping to the valid 0–100 range.
 * - Evaluating diplomatic gating (alliance blocking and effectiveness bonuses).
 * - Producing updated {@link InternationalLegitimacy} snapshots.
 *
 * ### Usage
 *
 * ```ts
 * const engine = new LegitimacyEngine();
 *
 * const delta = engine.computeLegitimacyDelta(input);
 * const newScore = engine.applyLegitimacyDelta(currentScore, delta);
 * const gating = engine.assessDiplomaticGating(newScore);
 * ```
 *
 * ### Testing
 *
 * Pass a custom {@link LegitimacyConfig} to the constructor to override
 * default game configuration values:
 *
 * ```ts
 * const testEngine = new LegitimacyEngine({
 *   blocksAlliances: 20,
 *   diplomaticBonusThreshold: 80,
 *   diplomaticEffectivenessBonus: 0.20,
 *   unResolutionPenalty: -15,
 * });
 * ```
 *
 * @see FR-1601 — International Legitimacy Score
 */
export class LegitimacyEngine {
  /** Resolved configuration for this engine instance. */
  private readonly config: Readonly<LegitimacyConfig>;

  /**
   * Creates a new LegitimacyEngine.
   *
   * @param configOverride - Optional partial or full config override.
   *   When omitted, values are extracted from `GAME_CONFIG.infoWar`.
   *   When provided, the override is merged on top of the defaults,
   *   allowing tests to selectively override individual thresholds.
   */
  constructor(configOverride?: Partial<LegitimacyConfig>) {
    const defaults: LegitimacyConfig = {
      blocksAlliances: GAME_CONFIG.infoWar.legitimacy.blocksAlliances,
      diplomaticBonusThreshold:
        GAME_CONFIG.infoWar.legitimacy.diplomaticBonusThreshold,
      diplomaticEffectivenessBonus:
        GAME_CONFIG.infoWar.legitimacy.diplomaticEffectivenessBonus,
      unResolutionPenalty: GAME_CONFIG.infoWar.unResolutionPenalty,
    };

    this.config = Object.freeze({ ...defaults, ...configOverride });
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────

  /**
   * Compute the raw (unclamped) legitimacy delta for a single turn.
   *
   * Sums all modifier categories:
   * 1. **Aggressive action penalty** — negative value from military/covert ops.
   * 2. **Humanitarian bonus** — positive value from aid and relief actions.
   * 3. **Treaty compliance bonus** — positive value from honoring commitments.
   * 4. **Narrative effect** — positive or negative from active campaigns.
   * 5. **UN Resolution penalties** — count × configured penalty (default −10).
   * 6. **Narrative battle delta** — win/loss from narrative battles.
   * 7. **Other modifiers** — catch-all for miscellaneous effects.
   *
   * The returned value is intentionally **not clamped** — callers should
   * use {@link applyLegitimacyDelta} to apply it to a current score.
   *
   * @param input - Categorized legitimacy modifiers for the current turn.
   * @returns The raw legitimacy delta (may be negative, zero, or positive).
   *
   * @example
   * ```ts
   * const delta = engine.computeLegitimacyDelta({
   *   aggressiveActionPenalty: -5,
   *   humanitarianBonus: 3,
   *   treatyComplianceBonus: 2,
   *   narrativeEffect: 0,
   *   unResolutions: 1,
   *   narrativeBattleDelta: 0,
   *   otherModifiers: 0,
   * });
   * // delta = -5 + 3 + 2 + 0 + (1 × -10) + 0 + 0 = -10
   * ```
   *
   * @see FR-1601
   */
  computeLegitimacyDelta(input: LegitimacyInput): number {
    const unPenalty = input.unResolutions * this.config.unResolutionPenalty;

    return (
      input.aggressiveActionPenalty +
      input.humanitarianBonus +
      input.treatyComplianceBonus +
      input.narrativeEffect +
      unPenalty +
      input.narrativeBattleDelta +
      input.otherModifiers
    );
  }

  /**
   * Apply a legitimacy delta to a current score, clamping to [0, 100].
   *
   * This is the canonical way to update a nation's legitimacy. The result
   * is always within the valid range regardless of the delta magnitude.
   *
   * @param current - The nation's current legitimacy score (0–100).
   * @param delta   - The raw delta to apply (from {@link computeLegitimacyDelta}).
   * @returns The new legitimacy score, clamped to [0, 100].
   *
   * @example
   * ```ts
   * engine.applyLegitimacyDelta(50, -60);  // → 0  (clamped)
   * engine.applyLegitimacyDelta(90, 20);   // → 100 (clamped)
   * engine.applyLegitimacyDelta(50, -10);  // → 40
   * ```
   *
   * @see FR-1601
   */
  applyLegitimacyDelta(current: number, delta: number): number {
    return clamp(current + delta, LEGITIMACY_MIN, LEGITIMACY_MAX);
  }

  /**
   * Check whether a nation's legitimacy blocks new alliance formation.
   *
   * When legitimacy is at or below the configured
   * {@link LegitimacyConfig.blocksAlliances | blocksAlliances} threshold
   * (default: 30), the nation cannot form new alliances.
   *
   * @param legitimacy - The nation's current legitimacy score (0–100).
   * @returns `true` if legitimacy is too low for new alliances.
   *
   * @example
   * ```ts
   * engine.isDiplomacyBlocked(30);  // → true  (at threshold)
   * engine.isDiplomacyBlocked(31);  // → false
   * engine.isDiplomacyBlocked(10);  // → true
   * ```
   *
   * @see FR-1601
   */
  isDiplomacyBlocked(legitimacy: number): boolean {
    return legitimacy <= this.config.blocksAlliances;
  }

  /**
   * Get the diplomatic effectiveness modifier based on legitimacy.
   *
   * Returns the configured bonus (default: 0.15 / 15%) when legitimacy
   * meets or exceeds the {@link LegitimacyConfig.diplomaticBonusThreshold}
   * (default: 70). Returns 0 otherwise.
   *
   * This modifier is intended to be applied as a multiplier increase
   * to diplomatic action success rates:
   * `effectiveRate = baseRate × (1 + modifier)`.
   *
   * @param legitimacy - The nation's current legitimacy score (0–100).
   * @returns `0` if below threshold; the configured bonus if at/above.
   *
   * @example
   * ```ts
   * engine.getDiplomaticEffectivenessModifier(70);  // → 0.15
   * engine.getDiplomaticEffectivenessModifier(69);  // → 0
   * engine.getDiplomaticEffectivenessModifier(100); // → 0.15
   * ```
   *
   * @see FR-1601
   */
  getDiplomaticEffectivenessModifier(legitimacy: number): number {
    if (legitimacy >= this.config.diplomaticBonusThreshold) {
      return this.config.diplomaticEffectivenessBonus;
    }
    return 0;
  }

  /**
   * Produce a full {@link InternationalLegitimacy} snapshot for the
   * current turn, applying all modifiers and updating narrative history.
   *
   * This is the primary per-turn integration point. It:
   * 1. Computes the raw delta from the provided input.
   * 2. Applies the delta to the previous turn's legitimacy (clamped).
   * 3. Appends any narrative battle entry to the history.
   * 4. Preserves the previous turn's narrative-active state and
   *    whistleblower risk (those are managed by other engines).
   *
   * @param prev  - The nation's {@link InternationalLegitimacy} from the
   *   previous turn.
   * @param input - Categorized legitimacy modifiers for this turn.
   * @param turn  - The current turn number.
   * @param narrativeBattle - Optional narrative battle that occurred this
   *   turn. If provided, the entry is appended to the battle history.
   *
   * @returns A new {@link InternationalLegitimacy} snapshot for the
   *   current turn.
   *
   * @example
   * ```ts
   * const nextState = engine.computeTurnLegitimacy(
   *   previousState,
   *   {
   *     aggressiveActionPenalty: -5,
   *     humanitarianBonus: 0,
   *     treatyComplianceBonus: 2,
   *     narrativeEffect: 3,
   *     unResolutions: 0,
   *     narrativeBattleDelta: 5,
   *     otherModifiers: 0,
   *   },
   *   currentTurn,
   *   {
   *     attacker: 'us',
   *     defender: 'china',
   *     narrativeType: 'Liberation',
   *     legitimacyDelta: 5,
   *     countered: false,
   *   },
   * );
   * ```
   *
   * @see FR-1601
   */
  computeTurnLegitimacy(
    prev: InternationalLegitimacy,
    input: LegitimacyInput,
    turn: TurnNumber,
    narrativeBattle?: NarrativeBattleInput,
  ): InternationalLegitimacy {
    const delta = this.computeLegitimacyDelta(input);
    const newLegitimacy = this.applyLegitimacyDelta(prev.legitimacy, delta);

    // Build updated narrative battle history
    const updatedHistory: NarrativeBattleEntry[] = [
      ...prev.narrativeBattleHistory,
    ];

    if (narrativeBattle != null) {
      const entry: NarrativeBattleEntry = {
        turn,
        attacker: narrativeBattle.attacker,
        defender: narrativeBattle.defender,
        narrativeType: narrativeBattle.narrativeType,
        legitimacyDelta: narrativeBattle.legitimacyDelta,
        countered: narrativeBattle.countered,
      };
      updatedHistory.push(entry);
    }

    return {
      factionId: prev.factionId,
      turn,
      legitimacy: newLegitimacy,
      legitimacyDelta: delta,
      narrativeActive: prev.narrativeActive,
      narrativeBattleHistory: updatedHistory,
      whistleblowerRisk: prev.whistleblowerRisk,
    };
  }

  /**
   * Assess the full diplomatic gating status for a given legitimacy score.
   *
   * Returns a summary object combining alliance-blocking status,
   * bonus-active status, and the effectiveness modifier. This is a
   * convenience method that composes {@link isDiplomacyBlocked} and
   * {@link getDiplomaticEffectivenessModifier}.
   *
   * @param legitimacy - The nation's current legitimacy score (0–100).
   * @returns A {@link DiplomaticGating} object summarizing the nation's
   *   diplomatic capabilities based on legitimacy.
   *
   * @example
   * ```ts
   * const gating = engine.assessDiplomaticGating(75);
   * // {
   * //   blocked: false,
   * //   bonusActive: true,
   * //   effectivenessModifier: 0.15,
   * // }
   *
   * const gating2 = engine.assessDiplomaticGating(25);
   * // {
   * //   blocked: true,
   * //   bonusActive: false,
   * //   effectivenessModifier: 0,
   * // }
   * ```
   *
   * @see FR-1601
   */
  assessDiplomaticGating(legitimacy: number): DiplomaticGating {
    const blocked = this.isDiplomacyBlocked(legitimacy);
    const effectivenessModifier =
      this.getDiplomaticEffectivenessModifier(legitimacy);
    const bonusActive = effectivenessModifier > 0;

    return {
      blocked,
      bonusActive,
      effectivenessModifier,
    };
  }

  // ───────────────────────────────────────────────────────
  // Read-only config access
  // ───────────────────────────────────────────────────────

  /**
   * Returns a read-only copy of the resolved legitimacy configuration.
   *
   * Useful for debugging, logging, or displaying thresholds in the UI.
   *
   * @returns The frozen {@link LegitimacyConfig} used by this engine.
   */
  getConfig(): Readonly<LegitimacyConfig> {
    return this.config;
  }
}
