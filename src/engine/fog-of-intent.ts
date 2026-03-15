/**
 * New Order: Fog of Intent Engine — CNFL-1608
 *
 * Extends the classic fog-of-war beyond *capability* to *purpose*. When a
 * rival masses troops near a border the player does not simply learn
 * "there are 12 divisions" — they receive a probability distribution over
 * possible intents:
 *
 *   "60 % Defensive / 25 % Signal / 10 % Exercise / 5 % Attack Prep"
 *
 * Accuracy of the assessment is gated by
 * `HUMINT × PsychologicalProfileKnowledge` on the target faction.
 * Players with deep psychological intelligence can read intent; those
 * without are flying blind. Misreading intent is a primary driver of
 * unintended escalation in the simulation.
 *
 * ### Design principles
 *
 * 1. **Deterministic** — no `Math.random()`. Noise is modelled as a
 *    blend between a "truth" distribution (mass concentrated on the true
 *    intent) and the config-supplied default distribution. A `clarity`
 *    factor (derived from the accuracy score) controls the blend, making
 *    every output fully reproducible for a given set of inputs.
 *
 * 2. **Pure-computational** — no side effects, no UI, no state
 *    management. All methods receive their inputs as arguments and return
 *    plain data structures.
 *
 * 3. **Configurable** — every constant lives in
 *    {@link GAME_CONFIG.infoWar.fogOfIntent}. Formula tuning requires no
 *    code changes.
 *
 * @see FR-1608 — Fog of Intent: uncertainty of purpose
 * @module engine/fog-of-intent
 */

import { GAME_CONFIG } from '@/engine/config';

import type { FactionId } from '@/data/types';

// ═════════════════════════════════════════════════════════════════════════════
// Constants — Intent Type Vocabulary
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The four canonical intent categories a troop buildup can be
 * classified under.
 *
 * Uses `as const` object pattern (no `enum`).
 *
 * @see FR-1608
 */
export const IntentType = {
  /** Defensive posture — protecting borders, no aggressive aim. */
  Defensive: 'defensive',
  /** Political signal — a show of force intended to deter or coerce. */
  Signal: 'signal',
  /** Military exercise — routine or scheduled training activity. */
  Exercise: 'exercise',
  /** Attack preparation — active pre-positioning for an offensive. */
  AttackPrep: 'attackPrep',
} as const;

/**
 * Union of all possible true intent values.
 *
 * @see FR-1608
 */
export type TrueIntentType = (typeof IntentType)[keyof typeof IntentType];

// ═════════════════════════════════════════════════════════════════════════════
// Accuracy Level
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Qualitative accuracy classification for an intent assessment.
 *
 * - `'high'`   — HUMINT × PsychProfile score ≥ highAccuracyThreshold
 * - `'medium'` — between thresholds
 * - `'low'`    — score ≤ lowAccuracyThreshold
 *
 * @see FR-1608
 */
export type AccuracyLevel = 'high' | 'medium' | 'low';

// ═════════════════════════════════════════════════════════════════════════════
// Intent Probabilities
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A probability distribution over the four intent categories.
 *
 * Invariant: `defensive + signal + exercise + attackPrep === 1.0`
 * (within floating-point tolerance).
 *
 * @see FR-1608
 */
export interface IntentProbabilities {
  /** Probability that the buildup is defensive. */
  readonly defensive: number;
  /** Probability that the buildup is a political signal. */
  readonly signal: number;
  /** Probability that the buildup is a military exercise. */
  readonly exercise: number;
  /** Probability that the buildup is attack preparation. */
  readonly attackPrep: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Intent Assessment Input
// ═════════════════════════════════════════════════════════════════════════════

/**
 * All inputs required to produce a Fog-of-Intent assessment.
 *
 * @see FR-1608
 */
export interface IntentAssessmentInput {
  /** The faction performing the intelligence assessment. */
  readonly observerFaction: FactionId;
  /** The faction whose troops are being observed. */
  readonly targetFaction: FactionId;
  /**
   * Observer's HUMINT (human intelligence) capability against the target.
   * Range: 0–100.
   */
  readonly humint: number;
  /**
   * Observer's knowledge of the target leader's psychological profile.
   * Range: 0–100.
   */
  readonly psychProfile: number;
  /** The ground-truth intent behind the troop buildup. */
  readonly trueIntent: TrueIntentType;
  /**
   * Current base escalation level between the two factions.
   * Range: 0–100.
   */
  readonly baseEscalation: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Intent Assessment Output
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Full result of a Fog-of-Intent assessment including perceived
 * probability distribution, accuracy metadata, misread detection,
 * and resulting escalation risk.
 *
 * @see FR-1608
 */
export interface IntentAssessment {
  /** The faction that produced this assessment. */
  readonly observerFaction: FactionId;
  /** The faction being assessed. */
  readonly targetFaction: FactionId;
  /**
   * Perceived probability distribution over the four intent categories.
   * Probabilities sum to 1.0 after noise perturbation.
   */
  readonly perceivedProbabilities: IntentProbabilities;
  /**
   * Raw accuracy score derived from HUMINT × PsychProfile.
   * Range: 0–100.
   */
  readonly accuracyScore: number;
  /** Qualitative accuracy classification. */
  readonly accuracyLevel: AccuracyLevel;
  /**
   * Noise factor applied during perturbation.
   * Range: [minNoise, maxNoise].
   */
  readonly noiseFactor: number;
  /** `true` if the perceived top-intent differs from the actual intent. */
  readonly misread: boolean;
  /** The intent category the observer *believes* is most likely. */
  readonly perceivedIntent: TrueIntentType;
  /** The *actual* ground-truth intent. */
  readonly actualIntent: TrueIntentType;
  /**
   * Final escalation risk after applying the misread multiplier
   * (if applicable). Range: 0–100.
   */
  readonly escalationRisk: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Misread Result
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Result of comparing the observer's highest-probability intent category
 * against the ground truth.
 *
 * @see FR-1608
 */
export interface MisreadResult {
  /** `true` if the observer's top-probability intent ≠ actual intent. */
  readonly misread: boolean;
  /** The intent category the observer considers most likely. */
  readonly perceivedIntent: TrueIntentType;
  /** The ground-truth intent. */
  readonly actualIntent: TrueIntentType;
  /**
   * Base escalation risk associated with the misread (before multiplier).
   * Range: 0–100.
   */
  readonly escalationRisk: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Fog-of-Intent Configuration
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Configuration block for the Fog-of-Intent engine.
 * Mirrors the shape of `GAME_CONFIG.infoWar.fogOfIntent`.
 *
 * @see FR-1608
 */
export interface FogOfIntentConfig {
  /** Default (prior) probability distribution when intent is unknown. */
  readonly defaultProbabilities: IntentProbabilities;
  /** Weight of HUMINT in the accuracy formula (0–1). */
  readonly humintWeight: number;
  /** Weight of psychological-profile knowledge in the accuracy formula (0–1). */
  readonly psychProfileWeight: number;
  /** Accuracy score at or above which the assessment is classified "high". */
  readonly highAccuracyThreshold: number;
  /** Accuracy score at or below which the assessment is classified "low". */
  readonly lowAccuracyThreshold: number;
  /** Maximum noise factor (applied at accuracy = 0). */
  readonly maxNoise: number;
  /** Minimum noise factor (applied at accuracy = 100). */
  readonly minNoise: number;
  /** Escalation risk multiplier applied when intent is misread. */
  readonly misreadEscalationMultiplier: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Intent Keys Helper
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Ordered tuple of all intent probability keys.
 * Used internally to iterate over the four categories in a deterministic
 * order when building and normalising probability distributions.
 */
const INTENT_KEYS: readonly (keyof IntentProbabilities)[] = [
  'defensive',
  'signal',
  'exercise',
  'attackPrep',
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// FogOfIntentEngine
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Pure-computational engine that produces Fog-of-Intent assessments.
 *
 * Given a ground-truth intent and the observer's intelligence capabilities,
 * it produces a perceived probability distribution that may or may not
 * match reality. The engine is fully **deterministic** — identical inputs
 * always produce identical outputs, making it safe for replay, testing,
 * and snapshot-based equality checks.
 *
 * ### Noise Model
 *
 * Instead of stochastic perturbation the engine uses a *clarity blend*:
 *
 * ```
 * clarity = accuracyScore / 100          // 0 → blind, 1 → perfect
 * perceived[i] = clarity × truth[i] + (1 − clarity) × default[i]
 * ```
 *
 * Where `truth` is a distribution with all mass on the actual intent and
 * `default` is the prior distribution from config. The result is then
 * normalised to sum to 1.0.
 *
 * The separate `noiseFactor` (linearly interpolated between `maxNoise`
 * and `minNoise`) is reported for informational / display purposes and
 * is **not** used to add randomness.
 *
 * @see FR-1608
 */
export class FogOfIntentEngine {
  // ───────────────────────────────────────────────────────
  // Instance state
  // ───────────────────────────────────────────────────────

  /** Resolved configuration for this engine instance. */
  private readonly cfg: FogOfIntentConfig;

  // ───────────────────────────────────────────────────────
  // Constructor
  // ───────────────────────────────────────────────────────

  /**
   * Creates a new Fog-of-Intent engine.
   *
   * @param configOverride - Optional partial or full configuration
   *   override. Missing fields fall back to
   *   `GAME_CONFIG.infoWar.fogOfIntent`. Primarily useful for
   *   unit-testing with custom thresholds.
   */
  constructor(configOverride?: Partial<FogOfIntentConfig>) {
    const base = GAME_CONFIG.infoWar.fogOfIntent;
    this.cfg = {
      defaultProbabilities: configOverride?.defaultProbabilities ?? {
        defensive: base.defaultProbabilities.defensive,
        signal: base.defaultProbabilities.signal,
        exercise: base.defaultProbabilities.exercise,
        attackPrep: base.defaultProbabilities.attackPrep,
      },
      humintWeight: configOverride?.humintWeight ?? base.humintWeight,
      psychProfileWeight:
        configOverride?.psychProfileWeight ?? base.psychProfileWeight,
      highAccuracyThreshold:
        configOverride?.highAccuracyThreshold ?? base.highAccuracyThreshold,
      lowAccuracyThreshold:
        configOverride?.lowAccuracyThreshold ?? base.lowAccuracyThreshold,
      maxNoise: configOverride?.maxNoise ?? base.maxNoise,
      minNoise: configOverride?.minNoise ?? base.minNoise,
      misreadEscalationMultiplier:
        configOverride?.misreadEscalationMultiplier ??
        base.misreadEscalationMultiplier,
    };
  }

  // ───────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────

  /**
   * Clamps `value` to the inclusive range `[min, max]`.
   *
   * @param value - The number to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Normalises an {@link IntentProbabilities} object so that all four
   * values are non-negative and sum to exactly 1.0.
   *
   * If the total is zero (degenerate case) the method falls back to
   * the config default probabilities to avoid division by zero.
   *
   * @param raw - The un-normalised probability distribution.
   * @returns A new {@link IntentProbabilities} that sums to 1.0.
   */
  private normalize(raw: IntentProbabilities): IntentProbabilities {
    // Ensure all values are non-negative before summing.
    const clamped: Record<string, number> = {};
    for (const key of INTENT_KEYS) {
      clamped[key] = Math.max(raw[key], 0);
    }

    const total =
      (clamped['defensive'] ?? 0) +
      (clamped['signal'] ?? 0) +
      (clamped['exercise'] ?? 0) +
      (clamped['attackPrep'] ?? 0);

    // Degenerate — fall back to defaults.
    if (total === 0) {
      return { ...this.cfg.defaultProbabilities };
    }

    return {
      defensive: (clamped['defensive'] ?? 0) / total,
      signal: (clamped['signal'] ?? 0) / total,
      exercise: (clamped['exercise'] ?? 0) / total,
      attackPrep: (clamped['attackPrep'] ?? 0) / total,
    };
  }

  /**
   * Returns the key of the intent category with the highest probability.
   *
   * In the event of a tie the first category in {@link INTENT_KEYS} order
   * wins, providing a deterministic tie-breaking rule.
   *
   * @param probs - A normalised probability distribution.
   * @returns The key with the maximum probability.
   */
  private dominantIntent(probs: IntentProbabilities): TrueIntentType {
    let best: TrueIntentType = 'defensive';
    let bestVal = -1;

    for (const key of INTENT_KEYS) {
      if (probs[key] > bestVal) {
        bestVal = probs[key];
        best = key;
      }
    }

    return best;
  }

  /**
   * Builds a "ground-truth" distribution where 100 % of probability mass
   * sits on the given `trueIntent`.
   *
   * @param trueIntent - The actual intent behind the troop buildup.
   * @returns An {@link IntentProbabilities} with 1.0 on `trueIntent` and
   *   0.0 on all other categories.
   */
  private buildTruthDistribution(
    trueIntent: TrueIntentType,
  ): IntentProbabilities {
    return {
      defensive: trueIntent === 'defensive' ? 1.0 : 0.0,
      signal: trueIntent === 'signal' ? 1.0 : 0.0,
      exercise: trueIntent === 'exercise' ? 1.0 : 0.0,
      attackPrep: trueIntent === 'attackPrep' ? 1.0 : 0.0,
    };
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────

  /**
   * Computes a composite accuracy score from HUMINT and psychological-
   * profile knowledge on the target faction.
   *
   * Formula:
   * ```
   * accuracyScore = humint × humintWeight + psychProfile × psychProfileWeight
   * ```
   *
   * The result is clamped to the range [0, 100].
   *
   * @param humint       - Observer's HUMINT capability (0–100).
   * @param psychProfile - Observer's knowledge of the target leader's
   *   psychological profile (0–100).
   * @returns Composite accuracy score in [0, 100].
   *
   * @see FR-1608
   */
  computeAccuracyScore(humint: number, psychProfile: number): number {
    const raw =
      humint * this.cfg.humintWeight +
      psychProfile * this.cfg.psychProfileWeight;
    return this.clamp(raw, 0, 100);
  }

  /**
   * Classifies a numeric accuracy score into a qualitative
   * {@link AccuracyLevel}.
   *
   * | Range                                     | Level      |
   * | ----------------------------------------- | ---------- |
   * | `≥ highAccuracyThreshold`                 | `'high'`   |
   * | `> lowAccuracyThreshold` and `< high`     | `'medium'` |
   * | `≤ lowAccuracyThreshold`                  | `'low'`    |
   *
   * @param accuracyScore - Composite accuracy score (0–100).
   * @returns `'high'`, `'medium'`, or `'low'`.
   *
   * @see FR-1608
   */
  classifyAccuracy(accuracyScore: number): AccuracyLevel {
    if (accuracyScore >= this.cfg.highAccuracyThreshold) {
      return 'high';
    }
    if (accuracyScore <= this.cfg.lowAccuracyThreshold) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Computes the noise factor for a given accuracy score via linear
   * interpolation between {@link FogOfIntentConfig.maxNoise} (at
   * accuracy = 0) and {@link FogOfIntentConfig.minNoise} (at
   * accuracy = 100).
   *
   * ```
   * t     = clamp(accuracyScore / 100, 0, 1)
   * noise = maxNoise + t × (minNoise − maxNoise)
   * ```
   *
   * The result is clamped to `[minNoise, maxNoise]`.
   *
   * @param accuracyScore - Composite accuracy score (0–100).
   * @returns Noise factor in `[minNoise, maxNoise]`.
   *
   * @see FR-1608
   */
  computeNoiseFactor(accuracyScore: number): number {
    const t = this.clamp(accuracyScore / 100, 0, 1);
    const noise =
      this.cfg.maxNoise + t * (this.cfg.minNoise - this.cfg.maxNoise);
    return this.clamp(noise, this.cfg.minNoise, this.cfg.maxNoise);
  }

  /**
   * Produces the perceived intent probability distribution given the
   * actual (ground-truth) intent and an accuracy score.
   *
   * ### Algorithm
   *
   * 1. Compute `clarity = accuracyScore / 100` (clamped to [0, 1]).
   * 2. Build a "truth" distribution with 1.0 on the true intent.
   * 3. For each category compute:
   *    ```
   *    perceived[i] = clarity × truth[i] + (1 − clarity) × default[i]
   *    ```
   * 4. Normalise so that the distribution sums to 1.0.
   *
   * At **high accuracy** (`clarity → 1`) the true intent dominates.
   * At **low accuracy** (`clarity → 0`) the result collapses to the
   * default prior distribution — the observer sees only the base rates.
   *
   * @param trueIntent    - The actual intent behind the buildup.
   * @param accuracyScore - Composite accuracy score (0–100).
   * @returns A normalised {@link IntentProbabilities} representing the
   *   observer's perceived distribution.
   *
   * @see FR-1608
   */
  computeIntentDistribution(
    trueIntent: TrueIntentType,
    accuracyScore: number,
  ): IntentProbabilities {
    const clarity = this.clamp(accuracyScore / 100, 0, 1);
    const truth = this.buildTruthDistribution(trueIntent);
    const defaults = this.cfg.defaultProbabilities;

    const blended: Record<string, number> = {};
    for (const key of INTENT_KEYS) {
      blended[key] = clarity * truth[key] + (1 - clarity) * defaults[key];
    }

    return this.normalize({
      defensive: blended['defensive'] ?? 0,
      signal: blended['signal'] ?? 0,
      exercise: blended['exercise'] ?? 0,
      attackPrep: blended['attackPrep'] ?? 0,
    });
  }

  /**
   * Determines whether the observer's assessment constitutes a misread
   * of the target's intent.
   *
   * A **misread** occurs when the highest-probability category in the
   * perceived distribution does *not* match the actual intent.
   *
   * @param perceived - The observer's perceived probability distribution.
   * @param actual    - The ground-truth intent.
   * @returns A {@link MisreadResult} describing whether a misread occurred,
   *   the perceived vs. actual intents, and a base escalation risk of 0
   *   (escalation is computed separately via
   *   {@link computeEscalationRisk}).
   *
   * @see FR-1608
   */
  evaluateMisread(
    perceived: IntentProbabilities,
    actual: TrueIntentType,
  ): MisreadResult {
    const perceivedIntent = this.dominantIntent(perceived);
    const isMisread = perceivedIntent !== actual;

    return {
      misread: isMisread,
      perceivedIntent,
      actualIntent: actual,
      escalationRisk: 0,
    };
  }

  /**
   * Computes the final escalation risk after applying the misread
   * multiplier.
   *
   * - If the intent was **misread**, the base escalation is multiplied
   *   by {@link FogOfIntentConfig.misreadEscalationMultiplier}.
   * - If the intent was **correctly read**, the base escalation is
   *   returned unchanged.
   *
   * The result is clamped to [0, 100].
   *
   * @param misread        - The result of {@link evaluateMisread}.
   * @param baseEscalation - Current base escalation level (0–100).
   * @returns Final escalation risk in [0, 100].
   *
   * @see FR-1608
   */
  computeEscalationRisk(
    misread: MisreadResult,
    baseEscalation: number,
  ): number {
    const raw = misread.misread
      ? baseEscalation * this.cfg.misreadEscalationMultiplier
      : baseEscalation;
    return this.clamp(raw, 0, 100);
  }

  /**
   * The primary entry point — performs a complete Fog-of-Intent
   * assessment for a single observer/target pair.
   *
   * ### Pipeline
   *
   * 1. {@link computeAccuracyScore} — derive composite accuracy.
   * 2. {@link classifyAccuracy} — classify into high / medium / low.
   * 3. {@link computeNoiseFactor} — derive informational noise factor.
   * 4. {@link computeIntentDistribution} — produce perceived
   *    probability distribution.
   * 5. {@link evaluateMisread} — detect whether the assessment is a
   *    misread of the actual intent.
   * 6. {@link computeEscalationRisk} — compute escalation risk,
   *    applying the misread multiplier when appropriate.
   *
   * @param input - All inputs required for the assessment.
   * @returns A fully populated {@link IntentAssessment}.
   *
   * @see FR-1608
   */
  assessIntent(input: IntentAssessmentInput): IntentAssessment {
    // Step 1: Composite accuracy
    const accuracyScore = this.computeAccuracyScore(
      input.humint,
      input.psychProfile,
    );

    // Step 2: Qualitative classification
    const accuracyLevel = this.classifyAccuracy(accuracyScore);

    // Step 3: Informational noise factor
    const noiseFactor = this.computeNoiseFactor(accuracyScore);

    // Step 4: Perceived probability distribution
    const perceivedProbabilities = this.computeIntentDistribution(
      input.trueIntent,
      accuracyScore,
    );

    // Step 5: Misread detection
    const misreadResult = this.evaluateMisread(
      perceivedProbabilities,
      input.trueIntent,
    );

    // Step 6: Escalation risk
    const escalationRisk = this.computeEscalationRisk(
      misreadResult,
      input.baseEscalation,
    );

    return {
      observerFaction: input.observerFaction,
      targetFaction: input.targetFaction,
      perceivedProbabilities,
      accuracyScore,
      accuracyLevel,
      noiseFactor,
      misread: misreadResult.misread,
      perceivedIntent: misreadResult.perceivedIntent,
      actualIntent: misreadResult.actualIntent,
      escalationRisk,
    };
  }
}
