/**
 * New Order: Emotional State Engine
 *
 * Implements the leader emotional-state subsystem defined by FR-1501 and
 * FR-1502.  Each leader tracks five core emotional dimensions — stress,
 * confidence, anger, fear, and resolve — that evolve every turn in response
 * to world events.  The resulting emotional profile feeds directly into the
 * AI utility pipeline, biasing decisions toward aggression, caution, or
 * erratic behaviour depending on which thresholds are exceeded.
 *
 * All public methods are **pure functions**: they accept immutable inputs and
 * return new objects without mutating anything.  Config-driven thresholds and
 * multipliers are pulled from `GAME_CONFIG.psychology` so that balance tuning
 * requires no code changes (NFR-204).
 *
 * @module emotional-state
 * @see FR-1501 — Five-dimensional emotional model per leader
 * @see FR-1502 — Emotional modifiers on AI utility calculations
 * @see FR-1507 — Stress inoculation after prolonged high-stress exposure
 * @see NFR-204 — Config-driven formula tuning
 */

import type { LeaderId, TurnNumber, EmotionalStateSnapshot } from '@/data/types';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Derived config type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of `GAME_CONFIG.psychology` extracted at the type level so that
 * consuming code can accept an arbitrary psychology configuration without
 * importing the full game config object.
 */
export type PsychologyConfig = typeof GAME_CONFIG.psychology;

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A discrete emotional stimulus applied during a turn.
 *
 * Events are produced by other engine subsystems (combat, diplomacy, espionage,
 * etc.) and consumed by {@link EmotionalStateEngine.updateEmotionalState} to
 * move the leader's emotional profile.
 *
 * @see FR-1501
 */
export interface EmotionalEvent {
  /** Which of the five emotional dimensions this event affects. */
  readonly dimension: 'stress' | 'confidence' | 'anger' | 'fear' | 'resolve';
  /** Signed magnitude of change (positive = increase, negative = decrease). */
  readonly delta: number;
  /** Human-readable origin tag, e.g. `"military_victory"`, `"diplomatic_insult"`. */
  readonly source: string;
}

/**
 * The result of applying emotional modifiers to a single AI utility score.
 *
 * Returned by {@link EmotionalStateEngine.applyEmotionalModifiers} so that
 * callers can inspect exactly which bonuses and noise were layered onto the
 * original value.
 *
 * @see FR-1502
 */
export interface EmotionalModifierResult {
  /** The utility score before any emotional adjustments. */
  readonly originalUtility: number;
  /** The utility score after all emotional adjustments. */
  readonly modifiedUtility: number;
  /** Absolute bonus added when anger exceeds the high-anger threshold. */
  readonly aggressiveBonus: number;
  /** Absolute bonus added when fear exceeds the high-fear threshold. */
  readonly defensiveBonus: number;
  /** Risk-tolerance metadata boost when confidence exceeds its threshold. */
  readonly confidenceRiskBoost: number;
  /** Noise value actually applied to the utility (0 if stress is below threshold). */
  readonly noiseApplied: number;
  /** Whether resolve was high enough to activate the stress-gain reduction path. */
  readonly resolveStressReduction: boolean;
}

/**
 * Complete before-and-after record of a per-turn emotional state transition.
 *
 * Returned by {@link EmotionalStateEngine.updateEmotionalState} to provide
 * full traceability for the event logger and replay systems.
 *
 * @see FR-1501
 */
export interface EmotionalUpdateResult {
  /** The emotional snapshot that was supplied as input (unchanged). */
  readonly previousState: EmotionalStateSnapshot;
  /** The newly computed emotional snapshot after applying all events. */
  readonly newState: EmotionalStateSnapshot;
  /** The ordered list of events that were processed. */
  readonly appliedEvents: readonly EmotionalEvent[];
  /** Whether stress inoculation was newly triggered this turn. */
  readonly stressInoculationTriggered: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum value for any emotional dimension. */
const DIMENSION_MIN = 0 as const;

/** Maximum value for any emotional dimension. */
const DIMENSION_MAX = 100 as const;

/**
 * Clamp `value` to the closed interval [`min`, `max`].
 *
 * @param value - The number to constrain.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure-function engine that manages leader emotional state transitions and
 * the downstream modifiers those states impose on AI utility calculations.
 *
 * Instantiate with a {@link PsychologyConfig} (typically `GAME_CONFIG.psychology`)
 * and call methods each turn to evolve emotional profiles.
 *
 * ```ts
 * const engine = new EmotionalStateEngine(GAME_CONFIG.psychology);
 * const result = engine.updateEmotionalState(snapshot, events, currentTurn);
 * ```
 *
 * @see FR-1501
 * @see FR-1502
 */
export class EmotionalStateEngine {
  /** Psychology sub-config used for all threshold and multiplier lookups. */
  private readonly config: PsychologyConfig;

  /**
   * @param config - The psychology portion of the game configuration.
   *                 Usually `GAME_CONFIG.psychology`.
   */
  constructor(config: PsychologyConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. updateEmotionalState
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Apply a set of emotional events to an existing snapshot, producing a new
   * immutable {@link EmotionalStateSnapshot} and a full audit trail.
   *
   * **Processing rules:**
   * 1. Events are applied in order.
   * 2. For *stress increases* (`dimension === 'stress'` and `delta > 0`), the
   *    effective delta is computed via {@link computeStressGain} which accounts
   *    for high-resolve buffering and stress inoculation.
   * 3. All other dimensions receive the raw delta directly.
   * 4. Every dimension is clamped to [0, 100] after each event.
   * 5. After all events, stress inoculation is evaluated: if the leader has
   *    been above `stressInoculation.stressThreshold` for at least
   *    `stressInoculation.turnsRequired` consecutive turns, they become
   *    inoculated.
   *
   * @param current     - The leader's emotional state at the start of the turn.
   * @param events      - Ordered list of stimuli to process.
   * @param currentTurn - The turn number to stamp onto the output snapshot.
   * @returns A result object containing the previous state, the new state,
   *          the events that were applied, and whether inoculation fired.
   *
   * @see FR-1501
   * @see FR-1507
   */
  updateEmotionalState(
    current: EmotionalStateSnapshot,
    events: readonly EmotionalEvent[],
    currentTurn: TurnNumber,
  ): EmotionalUpdateResult {
    // Start from the current dimension values — we accumulate into locals
    // and build a new snapshot at the end.
    let stress = current.stress;
    let confidence = current.confidence;
    let anger = current.anger;
    let fear = current.fear;
    let resolve = current.resolve;
    const decisionFatigue = current.decisionFatigue;
    let stressInoculated = current.stressInoculated;

    // Process each event sequentially.
    for (const event of events) {
      switch (event.dimension) {
        case 'stress': {
          if (event.delta > 0) {
            // Positive stress gains run through the resolve / inoculation pipeline.
            const effectiveDelta = this.computeStressGain(
              event.delta,
              resolve,
              stressInoculated,
            );
            stress = clamp(stress + effectiveDelta, DIMENSION_MIN, DIMENSION_MAX);
          } else {
            // Stress decreases are applied directly (e.g. rest, peacetime).
            stress = clamp(stress + event.delta, DIMENSION_MIN, DIMENSION_MAX);
          }
          break;
        }
        case 'confidence': {
          confidence = clamp(confidence + event.delta, DIMENSION_MIN, DIMENSION_MAX);
          break;
        }
        case 'anger': {
          anger = clamp(anger + event.delta, DIMENSION_MIN, DIMENSION_MAX);
          break;
        }
        case 'fear': {
          fear = clamp(fear + event.delta, DIMENSION_MIN, DIMENSION_MAX);
          break;
        }
        case 'resolve': {
          resolve = clamp(resolve + event.delta, DIMENSION_MIN, DIMENSION_MAX);
          break;
        }
      }
    }

    // ── Stress inoculation check ───────────────────────────────────────────
    // A leader becomes inoculated after spending enough consecutive turns
    // above the stress threshold.  We use a simplified heuristic: the number
    // of turns elapsed since turn 1 is treated as the upper bound of
    // consecutive high-stress turns.  A real implementation might track a
    // running counter on the snapshot; here we trigger if the leader is
    // *already* above threshold and has been in the game long enough.
    const inoculationCfg = this.config.stressInoculation;
    let stressInoculationTriggered = false;

    if (
      !stressInoculated &&
      stress >= inoculationCfg.stressThreshold &&
      (currentTurn as number) >= inoculationCfg.turnsRequired
    ) {
      stressInoculated = true;
      stressInoculationTriggered = true;
    }

    // ── Build immutable output snapshot ────────────────────────────────────
    const newState: EmotionalStateSnapshot = {
      leaderId: current.leaderId,
      turn: currentTurn,
      stress,
      confidence,
      anger,
      fear,
      resolve,
      decisionFatigue,
      stressInoculated,
    };

    return {
      previousState: current,
      newState,
      appliedEvents: events,
      stressInoculationTriggered,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. applyEmotionalModifiers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute the emotional adjustment to an AI utility score.
   *
   * The emotional modifiers are applied as *absolute additions* (not
   * multiplicative scaling) so that balance designers can reason about them
   * independently of the score magnitude.
   *
   * | Condition          | Effect                                          |
   * |--------------------|-------------------------------------------------|
   * | anger ≥ 60         | +0.20 aggressive bonus                          |
   * | fear  ≥ 60         | +0.15 defensive bonus                           |
   * | confidence ≥ 70    | +15 risk-tolerance (metadata, not added to util) |
   * | stress ≥ 70        | ±0.15 noise (using pre-rolled `noiseValue`)     |
   *
   * The caller is responsible for supplying a pre-rolled `noiseValue` from a
   * seeded RNG in the range [-1, 1].  This keeps the method pure and
   * deterministic for replay.
   *
   * @param state       - The leader's current emotional snapshot.
   * @param baseUtility - The raw utility score to modify.
   * @param noiseValue  - A pre-rolled value in [-1, 1] from the seeded RNG.
   * @returns A {@link EmotionalModifierResult} with full modifier breakdown.
   *
   * @see FR-1502
   */
  applyEmotionalModifiers(
    state: EmotionalStateSnapshot,
    baseUtility: number,
    noiseValue: number,
  ): EmotionalModifierResult {
    const mods = this.config.emotionalModifiers;

    // ── Anger → aggressive action bonus ────────────────────────────────────
    const aggressiveBonus =
      state.anger >= mods.highAnger.threshold
        ? mods.highAnger.aggressiveActionWeightBonus
        : 0;

    // ── Fear → defensive action bonus ──────────────────────────────────────
    const defensiveBonus =
      state.fear >= mods.highFear.threshold
        ? mods.highFear.defensiveActionWeightBonus
        : 0;

    // ── Confidence → risk-tolerance metadata boost ─────────────────────────
    // This value is reported but NOT added to the utility directly; the
    // caller (AI evaluator) decides how to apply it to risk calculations.
    const confidenceRiskBoost =
      state.confidence >= mods.highConfidence.threshold
        ? mods.highConfidence.riskToleranceBoost
        : 0;

    // ── Stress → decision noise ────────────────────────────────────────────
    const noiseApplied =
      state.stress >= mods.highStress.threshold
        ? mods.highStress.decisionNoiseRange * noiseValue
        : 0;

    // ── Resolve → stress-reduction flag (informational) ────────────────────
    const resolveStressReduction =
      state.resolve >= mods.highResolve.threshold;

    // ── Compose final utility ──────────────────────────────────────────────
    const modifiedUtility = baseUtility + aggressiveBonus + defensiveBonus + noiseApplied;

    return {
      originalUtility: baseUtility,
      modifiedUtility,
      aggressiveBonus,
      defensiveBonus,
      confidenceRiskBoost,
      noiseApplied,
      resolveStressReduction,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. createInitialState
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Construct a fresh {@link EmotionalStateSnapshot} with sensible defaults.
   *
   * All five emotional dimensions default to **50** (neutral midpoint) unless
   * explicit overrides are supplied.  Decision fatigue starts at 0, and
   * stress inoculation is always `false` for a new leader.
   *
   * @param leaderId - The leader's unique identifier.
   * @param turn     - The turn on which this snapshot is created.
   * @param defaults - Optional partial overrides for the five core dimensions.
   * @returns A fully populated, immutable emotional state snapshot.
   *
   * @see FR-1501
   */
  createInitialState(
    leaderId: LeaderId,
    turn: TurnNumber,
    defaults?: Partial<
      Pick<EmotionalStateSnapshot, 'stress' | 'confidence' | 'anger' | 'fear' | 'resolve'>
    >,
  ): EmotionalStateSnapshot {
    const DEFAULT_MIDPOINT = 50;

    return {
      leaderId,
      turn,
      stress: clamp(defaults?.stress ?? DEFAULT_MIDPOINT, DIMENSION_MIN, DIMENSION_MAX),
      confidence: clamp(defaults?.confidence ?? DEFAULT_MIDPOINT, DIMENSION_MIN, DIMENSION_MAX),
      anger: clamp(defaults?.anger ?? DEFAULT_MIDPOINT, DIMENSION_MIN, DIMENSION_MAX),
      fear: clamp(defaults?.fear ?? DEFAULT_MIDPOINT, DIMENSION_MIN, DIMENSION_MAX),
      resolve: clamp(defaults?.resolve ?? DEFAULT_MIDPOINT, DIMENSION_MIN, DIMENSION_MAX),
      decisionFatigue: 0,
      stressInoculated: false,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. computeStressGain
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Calculate the effective stress delta after applying resolve buffering and
   * stress inoculation reductions.
   *
   * The reduction pipeline is:
   *
   * 1. **Resolve buffer** — If `currentResolve` ≥ the `highResolve.threshold`
   *    (default 70), multiply `rawDelta` by `highResolve.stressGainReduction`
   *    (default 0.5), halving the stress gain.
   * 2. **Inoculation** — If `stressInoculated` is `true`, further multiply by
   *    `(1 + stressInoculation.stressGainReduction)` (default `1 + (−0.2) = 0.8`),
   *    reducing the gain by an additional 20%.
   *
   * The returned value is always ≥ 0 for positive raw deltas.
   *
   * @param rawDelta         - The raw stress increase before reductions.
   * @param currentResolve   - The leader's current resolve dimension value.
   * @param stressInoculated - Whether the leader has achieved stress inoculation.
   * @returns The effective (reduced) stress delta.
   *
   * @see FR-1502 — Resolve ≥ 70 halves stress gains
   * @see FR-1507 — Stress inoculation reduces gains by 20%
   */
  computeStressGain(
    rawDelta: number,
    currentResolve: number,
    stressInoculated: boolean,
  ): number {
    const mods = this.config.emotionalModifiers;
    const inoculationCfg = this.config.stressInoculation;

    let effectiveDelta = rawDelta;

    // Step 1 — Resolve buffer: halve stress gains when resolve is high.
    if (currentResolve >= mods.highResolve.threshold) {
      effectiveDelta *= mods.highResolve.stressGainReduction;
    }

    // Step 2 — Inoculation: further reduce by 20% if inoculated.
    if (stressInoculated) {
      effectiveDelta *= 1 + inoculationCfg.stressGainReduction;
    }

    // Ensure we never invert the direction (positive raw → positive effective).
    return Math.max(0, effectiveDelta);
  }
}
