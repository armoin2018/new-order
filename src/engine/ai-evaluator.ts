/**
 * New Order: AI Utility Score Framework + Desperation Mode
 *
 * Implements FR-301 (utility-based action evaluation), FR-302 (personality-
 * weighted scoring), and FR-303 (desperation mode when stability < threshold).
 *
 * Every AI leader evaluates candidate actions using a composite utility function
 * weighted by psychology, emotional state, difficulty scaling, and desperation.
 * The highest-utility action is selected; all calculations are logged in debug mode.
 *
 * @see FR-301 — Utility Score function weighted by personality profile
 * @see FR-302 — Scenario-tunable personality weights
 * @see FR-303 — Desperation Mode (stability < 20)
 *
 * @module engine/ai-evaluator
 */

import type {
  FactionId,
  DecisionStyle,
} from '@/data/types';

import type {
  LeaderProfile,
  LeaderPsychology,
  EmotionalStateSnapshot,
  NationState,
} from '@/data/types';

import { GAME_CONFIG } from '@/engine/config';
import { type SeededRandom } from '@/engine/rng';

// ─────────────────────────────────────────────────────────
// 1. Action Classification Types
// ─────────────────────────────────────────────────────────

/** Broad action categories the AI can consider. */
export type AIActionCategory =
  | 'diplomatic'    // negotiations, treaties, sanctions
  | 'military'      // unit movements, strikes, deployments
  | 'economic'      // tariffs, trade deals, investment
  | 'intelligence'  // espionage, cyber ops, recon
  | 'domestic'      // stability measures, propaganda, reforms
  | 'nuclear'       // nuclear posturing, deployment, strikes
  | 'grey-zone';    // proxy ops, fishing fleet, covert action

/** A candidate action for the AI to evaluate. */
export interface AIAction {
  /** Unique identifier for this action. */
  id: string;
  /** Broad category this action falls into. */
  category: AIActionCategory;
  /** Short human-readable name. */
  name: string;
  /** Longer description for debug / UI display. */
  description: string;
  /** Base utility score before personality weighting. Range: 0–100. */
  baseUtility: number;
  /** Per-category weight modifiers applied by the action itself. */
  categoryWeights: Partial<Record<AIActionCategory, number>>;
  /** Is this an extreme/desperate action? */
  isExtreme: boolean;
  /** Minimum stability required (action unavailable above this). */
  extremeThreshold?: number;
  /** Risk level 0–100. */
  riskLevel: number;
  /** Estimated impact on various nation metrics. */
  estimatedImpact: {
    stability?: number;
    treasury?: number;
    diplomaticInfluence?: number;
    militaryReadiness?: number;
    nuclearThreshold?: number;
    popularity?: number;
    allianceCredibility?: number;
  };
  /** Target faction (if applicable). */
  targetFaction?: FactionId;
  /** Prerequisites (simple string tags). */
  prerequisites?: string[];
}

// ─────────────────────────────────────────────────────────
// 2. Utility Weights (FR-302)
// ─────────────────────────────────────────────────────────

/**
 * The 5 scenario-tunable personality weights from FR-302.
 *
 * Each weight ranges 0–100 and controls how strongly the AI favours
 * actions in the corresponding category.
 */
export interface UtilityWeights {
  /** Weight for military/nuclear actions. Range: 0–100. */
  aggression: number;
  /** Weight for economic actions. Range: 0–100. */
  economicFocus: number;
  /** Weight for diplomatic actions. Range: 0–100. */
  diplomaticPreference: number;
  /** Willingness to accept high-risk actions. Range: 0–100. */
  riskTolerance: number;
  /** Weight for domestic stability actions. Range: 0–100. */
  domesticPriority: number;
}

// ─────────────────────────────────────────────────────────
// 3. Evaluation Context
// ─────────────────────────────────────────────────────────

/** Full context passed to the evaluator for a single faction's turn. */
export interface AIEvaluationContext {
  /** The faction being evaluated. */
  factionId: FactionId;
  /** Current nation state for this faction. */
  nationState: NationState;
  /** The leader's full psychological profile. */
  leaderProfile: LeaderProfile;
  /** The leader's current emotional snapshot. */
  emotionalState: EmotionalStateSnapshot;
  /** Scenario-tunable personality weights (or derived from profile). */
  weights: UtilityWeights;
  /** Difficulty setting for this game. */
  difficulty: 'cautious' | 'balanced' | 'aggressive';
  /** Seeded PRNG for deterministic noise. */
  rng: SeededRandom;
  /** Relations with other factions — tension levels (0–100). */
  tensions: Record<FactionId, number>;
  /** Available candidate actions to evaluate. */
  candidateActions: AIAction[];
  /** Debug mode — log all utility calculations. */
  debug?: boolean;
}

// ─────────────────────────────────────────────────────────
// 4. Evaluation Result Types
// ─────────────────────────────────────────────────────────

/** Detailed breakdown of how an action's final score was computed. */
export interface ScoreBreakdown {
  baseUtility: number;
  personalityModifier: number;
  emotionalModifier: number;
  desperationModifier: number;
  difficultyModifier: number;
  noiseModifier: number;
  riskPenalty: number;
  totalScore: number;
}

/** An action paired with its final computed score. */
export interface ScoredAction {
  /** The original candidate action. */
  action: AIAction;
  /** Final utility score after all modifiers. */
  finalScore: number;
  /** Breakdown of how the score was computed. */
  breakdown: ScoreBreakdown;
}

/** A single debug-log entry produced during evaluation. */
export interface UtilityLogEntry {
  /** ID of the action being scored. */
  actionId: string;
  /** Name of the scoring step. */
  step: string;
  /** Numeric value at this step. */
  value: number;
  /** Human-readable detail. */
  detail: string;
}

/** The complete result of evaluating a faction's candidate actions. */
export interface AIEvaluationResult {
  /** The faction that was evaluated. */
  factionId: FactionId;
  /** The top-ranked action selected for execution. */
  selectedAction: AIAction;
  /** All actions ranked by final utility score (descending). */
  rankedActions: ScoredAction[];
  /** Was the leader in desperation mode? */
  desperationMode: boolean;
  /** Debug log of all calculations (populated if context.debug=true). */
  utilityLog: UtilityLogEntry[];
}

// ─────────────────────────────────────────────────────────
// 5. Internal Constants
// ─────────────────────────────────────────────────────────

/**
 * Mapping from AIActionCategory → UtilityWeights key.
 *
 * Categories that don't have a direct 1:1 weight map to the closest
 * personality dimension.
 */
const CATEGORY_WEIGHT_MAP: Record<AIActionCategory, keyof UtilityWeights> = {
  diplomatic: 'diplomaticPreference',
  military: 'aggression',
  economic: 'economicFocus',
  intelligence: 'aggression',       // intel ops correlate with aggression
  domestic: 'domesticPriority',
  nuclear: 'aggression',            // nuclear actions scale with aggression
  'grey-zone': 'riskTolerance',     // grey-zone correlates with risk appetite
} as const;

/** Decision-noise half-ranges per DecisionStyle (±%). */
const DECISION_NOISE_RANGES: Record<DecisionStyle, number> = {
  Analytical: 5,
  Transactional: 10,
  Intuitive: 15,
  Ideological: 8,
} as const;

/** Emotional modifier — anger boost for military/nuclear actions. */
const ANGER_MILITARY_BOOST = 0.20;
/** Emotional modifier — fear boost for domestic/defensive actions. */
const FEAR_DOMESTIC_BOOST = 0.15;
/** Emotional modifier — confidence boost for aggressive actions. */
const CONFIDENCE_AGGRESSIVE_BOOST = 0.10;
/** Emotional modifier — high stress penalty for complex actions. */
const STRESS_COMPLEXITY_PENALTY = 0.10;
/** Emotional modifier — resolve boost for extreme actions. */
const RESOLVE_EXTREME_BOOST = 0.08;

/** Desperation: diplomatic penalty fraction. */
const DESPERATION_DIPLOMATIC_PENALTY = 0.30;
/** Desperation: per-point bonus for extreme actions. */
const DESPERATION_EXTREME_BONUS_PER_POINT = 3;
/** Desperation: per-point bonus for nuclear actions. */
const DESPERATION_NUCLEAR_BONUS_PER_POINT = 5;

/** Score floor and ceiling. */
const SCORE_MIN = 0;
const SCORE_MAX = 200;

// ─────────────────────────────────────────────────────────
// 6. UtilityEvaluator
// ─────────────────────────────────────────────────────────

/**
 * Stateless utility-based AI action evaluator.
 *
 * Scores every candidate action through a multi-stage pipeline:
 *
 * 1. Base utility
 * 2. Personality-weighted category match
 * 3. Emotional modifiers
 * 4. Desperation mode (FR-303)
 * 5. Risk penalty
 * 6. Difficulty scaling
 * 7. Decision noise
 * 8. Clamp [0, 200]
 *
 * @see FR-301 — Utility Score evaluation
 * @see FR-302 — Personality-weighted scoring
 * @see FR-303 — Desperation Mode
 */
export class UtilityEvaluator {
  // ── Primary entry point ────────────────────────────────

  /**
   * Evaluate all candidate actions and return them ranked by utility score.
   * The top action is selected for execution.
   *
   * @param context - Full evaluation context for a single faction's turn.
   * @returns Ranked actions with the selected (top) action and debug log.
   *
   * @see FR-301
   */
  static evaluate(context: AIEvaluationContext): AIEvaluationResult {
    const {
      factionId,
      nationState,
      leaderProfile,
      emotionalState,
      weights,
      difficulty,
      rng,
      candidateActions,
      debug,
    } = context;

    const log: UtilityLogEntry[] = [];
    const desperationActive = UtilityEvaluator.isInDesperationMode(
      nationState.stability,
    );
    const scaledWeights = UtilityEvaluator.applyDifficultyScaling(
      weights,
      difficulty,
    );

    if (debug) {
      log.push({
        actionId: '*',
        step: 'context',
        value: nationState.stability,
        detail: `Stability=${nationState.stability}, desperation=${String(desperationActive)}, difficulty=${difficulty}`,
      });
    }

    // Filter out actions gated by extremeThreshold
    const availableActions = candidateActions.filter((action) => {
      if (action.extremeThreshold != null) {
        return nationState.stability <= action.extremeThreshold;
      }
      return true;
    });

    const scored: ScoredAction[] = availableActions.map((action) => {
      // Step 1: Base utility
      let score = action.baseUtility;
      const breakdown: ScoreBreakdown = {
        baseUtility: action.baseUtility,
        personalityModifier: 0,
        emotionalModifier: 0,
        desperationModifier: 0,
        difficultyModifier: 0,
        noiseModifier: 0,
        riskPenalty: 0,
        totalScore: 0,
      };

      if (debug) {
        log.push({
          actionId: action.id,
          step: 'base',
          value: score,
          detail: `Base utility for "${action.name}"`,
        });
      }

      // Step 2: Personality-weighted category match
      const personalityMod = UtilityEvaluator.computePersonalityModifier(
        action,
        scaledWeights,
      );
      score += personalityMod;
      breakdown.personalityModifier = personalityMod;

      if (debug) {
        log.push({
          actionId: action.id,
          step: 'personality',
          value: personalityMod,
          detail: `Category-weight match → +${personalityMod.toFixed(2)}`,
        });
      }

      // Step 3: Emotional modifiers
      const emotionalMod = UtilityEvaluator.applyEmotionalModifiers(
        score,
        action,
        emotionalState,
      );
      const emotionalDelta = emotionalMod - score;
      score = emotionalMod;
      breakdown.emotionalModifier = emotionalDelta;

      if (debug) {
        log.push({
          actionId: action.id,
          step: 'emotional',
          value: emotionalDelta,
          detail: `Emotional shift → ${emotionalDelta >= 0 ? '+' : ''}${emotionalDelta.toFixed(2)}`,
        });
      }

      // Step 4: Desperation mode (FR-303)
      const despMod = desperationActive
        ? UtilityEvaluator.applyDesperationModifiers(
            score,
            action,
            nationState.stability,
          )
        : score;
      const despDelta = despMod - score;
      score = despMod;
      breakdown.desperationModifier = despDelta;

      if (debug && desperationActive) {
        log.push({
          actionId: action.id,
          step: 'desperation',
          value: despDelta,
          detail: `Desperation mode shift → ${despDelta >= 0 ? '+' : ''}${despDelta.toFixed(2)}`,
        });
      }

      // Step 5: Risk penalty
      const riskPenalty = UtilityEvaluator.computeRiskPenalty(
        action,
        scaledWeights,
      );
      score -= riskPenalty;
      breakdown.riskPenalty = riskPenalty;

      if (debug && riskPenalty > 0) {
        log.push({
          actionId: action.id,
          step: 'risk-penalty',
          value: -riskPenalty,
          detail: `Risk penalty (level ${action.riskLevel} vs tolerance ${scaledWeights.riskTolerance.toFixed(1)}) → -${riskPenalty.toFixed(2)}`,
        });
      }

      // Step 6: Difficulty scaling delta
      // Already applied in scaledWeights; compute explicit delta for logging
      const difficultyDelta = UtilityEvaluator.computeDifficultyDelta(
        action,
        weights,
        scaledWeights,
      );
      breakdown.difficultyModifier = difficultyDelta;

      if (debug && difficultyDelta !== 0) {
        log.push({
          actionId: action.id,
          step: 'difficulty',
          value: difficultyDelta,
          detail: `Difficulty scaling (${difficulty}) → ${difficultyDelta >= 0 ? '+' : ''}${difficultyDelta.toFixed(2)}`,
        });
      }

      // Step 7: Decision noise
      const noisyScore = UtilityEvaluator.applyDecisionNoise(
        score,
        leaderProfile.psychology.decisionStyle,
        rng,
      );
      const noiseDelta = noisyScore - score;
      score = noisyScore;
      breakdown.noiseModifier = noiseDelta;

      if (debug) {
        log.push({
          actionId: action.id,
          step: 'noise',
          value: noiseDelta,
          detail: `Decision noise (${leaderProfile.psychology.decisionStyle}) → ${noiseDelta >= 0 ? '+' : ''}${noiseDelta.toFixed(2)}`,
        });
      }

      // Step 8: Clamp
      score = clamp(score, SCORE_MIN, SCORE_MAX);
      breakdown.totalScore = score;

      if (debug) {
        log.push({
          actionId: action.id,
          step: 'final',
          value: score,
          detail: `Final clamped score for "${action.name}"`,
        });
      }

      return { action, finalScore: score, breakdown };
    });

    // Sort descending by final score
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Select the top action (fallback to first candidate if none scored)
    const selected = scored[0];
    if (!selected) {
      // Defensive: should never happen unless candidateActions was empty
      throw new Error(
        `[UtilityEvaluator] No scoreable actions for faction "${factionId}".`,
      );
    }

    return {
      factionId,
      selectedAction: selected.action,
      rankedActions: scored,
      desperationMode: desperationActive,
      utilityLog: log,
    };
  }

  // ── Weight derivation from psychology (FR-302) ─────────

  /**
   * Derive {@link UtilityWeights} from a leader's psychological dimensions.
   *
   * Maps the 8 psychology scalars onto the 5 FR-302 tunable weights
   * using designer-authored linear combinations:
   *
   * - `aggression` = (100 − patience) × 0.4 + vengefulIndex × 0.3 + riskTolerance × 0.3
   * - `economicFocus` = pragmatism × 0.5 + patience × 0.3 + (100 − riskTolerance) × 0.2
   * - `diplomaticPreference` = pragmatism × 0.4 + patience × 0.3 + (100 − paranoia) × 0.3
   * - `riskTolerance` = psychology.riskTolerance (direct)
   * - `domesticPriority` = (100 − narcissism) × 0.3 + pragmatism × 0.4 + patience × 0.3
   *
   * @param psychology - The leader's core psychological dimensions.
   * @returns Derived utility weights clamped to [0, 100].
   *
   * @see FR-302
   */
  static deriveWeightsFromProfile(psychology: LeaderPsychology): UtilityWeights {
    const {
      riskTolerance,
      paranoia,
      narcissism,
      pragmatism,
      patience,
      vengefulIndex,
    } = psychology;

    return {
      aggression: clamp(
        (100 - patience) * 0.4 + vengefulIndex * 0.3 + riskTolerance * 0.3,
        0,
        100,
      ),
      economicFocus: clamp(
        pragmatism * 0.5 + patience * 0.3 + (100 - riskTolerance) * 0.2,
        0,
        100,
      ),
      diplomaticPreference: clamp(
        pragmatism * 0.4 + patience * 0.3 + (100 - paranoia) * 0.3,
        0,
        100,
      ),
      riskTolerance,
      domesticPriority: clamp(
        (100 - narcissism) * 0.3 + pragmatism * 0.4 + patience * 0.3,
        0,
        100,
      ),
    };
  }

  // ── Desperation Mode check (FR-303) ────────────────────

  /**
   * Check if a faction is in Desperation Mode.
   *
   * @param stability - Current national stability (0–100).
   * @returns `true` when stability is strictly below the configured threshold.
   *
   * @see FR-303
   */
  static isInDesperationMode(stability: number): boolean {
    return stability < GAME_CONFIG.aiDecision.desperationModeStabilityThreshold;
  }

  // ── Difficulty scaling ─────────────────────────────────

  /**
   * Apply difficulty scaling to base utility weights.
   *
   * Multiplies `aggression` by the difficulty profile's `aggression` scalar
   * and `riskTolerance` by its `riskTolerance` scalar. Other weights are
   * left unchanged; they are indirectly affected through risk penalty math.
   *
   * @param weights - Original personality weights.
   * @param difficulty - Selected difficulty tier.
   * @returns New weights with difficulty scaling applied, clamped to [0, 100].
   *
   * @see FR-305
   */
  static applyDifficultyScaling(
    weights: UtilityWeights,
    difficulty: 'cautious' | 'balanced' | 'aggressive',
  ): UtilityWeights {
    const profile = GAME_CONFIG.aiDecision.difficultyScaling[difficulty];

    return {
      ...weights,
      aggression: clamp(weights.aggression * profile.aggression, 0, 100),
      riskTolerance: clamp(
        weights.riskTolerance * profile.riskTolerance,
        0,
        100,
      ),
    };
  }

  // ── Emotional modifiers ────────────────────────────────

  /**
   * Apply emotional state modifiers to an action's running score.
   *
   * | Emotion    | Boost target                | Magnitude |
   * |------------|-----------------------------|-----------|
   * | anger      | military, nuclear, grey-zone| +20%      |
   * | fear       | domestic, diplomatic        | +15%      |
   * | confidence | military, nuclear, grey-zone| +10%      |
   * | stress     | intelligence (complexity)   | −10%      |
   * | resolve    | extreme actions             | +8%       |
   *
   * Modifiers stack additively on the percentage scale, then the total
   * multiplier is applied once.
   *
   * @param baseScore - Score entering this stage.
   * @param action - The action being scored.
   * @param emotionalState - Leader's current emotional snapshot.
   * @returns Modified score.
   *
   * @see FR-301
   */
  static applyEmotionalModifiers(
    baseScore: number,
    action: AIAction,
    emotionalState: EmotionalStateSnapshot,
  ): number {
    let multiplier = 1.0;

    // Anger → boost military / nuclear / grey-zone
    if (
      action.category === 'military' ||
      action.category === 'nuclear' ||
      action.category === 'grey-zone'
    ) {
      multiplier += (emotionalState.anger / 100) * ANGER_MILITARY_BOOST;
    }

    // Fear → boost domestic / diplomatic (defensive posture)
    if (
      action.category === 'domestic' ||
      action.category === 'diplomatic'
    ) {
      multiplier += (emotionalState.fear / 100) * FEAR_DOMESTIC_BOOST;
    }

    // Confidence → boost aggressive actions (military/nuclear/grey-zone)
    if (
      action.category === 'military' ||
      action.category === 'nuclear' ||
      action.category === 'grey-zone'
    ) {
      multiplier +=
        (emotionalState.confidence / 100) * CONFIDENCE_AGGRESSIVE_BOOST;
    }

    // High stress → penalise complex actions (intelligence)
    if (action.category === 'intelligence') {
      multiplier -= (emotionalState.stress / 100) * STRESS_COMPLEXITY_PENALTY;
    }

    // Resolve → boost extreme actions
    if (action.isExtreme) {
      multiplier += (emotionalState.resolve / 100) * RESOLVE_EXTREME_BOOST;
    }

    return baseScore * Math.max(multiplier, 0);
  }

  // ── Desperation modifiers (FR-303) ─────────────────────

  /**
   * Apply desperation mode weight shifts when stability is critically low.
   *
   * - **Extreme** actions: bonus = (threshold − stability) × 3
   * - **Nuclear** actions: bonus = (threshold − stability) × 5
   * - Non-extreme **diplomatic** actions: −30% penalty
   *
   * @param baseScore - Score entering this stage.
   * @param action - The action being scored.
   * @param stability - Current national stability.
   * @returns Modified score.
   *
   * @see FR-303
   */
  static applyDesperationModifiers(
    baseScore: number,
    action: AIAction,
    stability: number,
  ): number {
    const threshold =
      GAME_CONFIG.aiDecision.desperationModeStabilityThreshold;
    const gap = threshold - stability; // positive when desperate

    let score = baseScore;

    // Nuclear gets the strongest boost
    if (action.category === 'nuclear') {
      score += gap * DESPERATION_NUCLEAR_BONUS_PER_POINT;
    } else if (action.isExtreme) {
      // Other extreme actions
      score += gap * DESPERATION_EXTREME_BONUS_PER_POINT;
    }

    // Diplomatic actions that are NOT extreme get penalised
    if (action.category === 'diplomatic' && !action.isExtreme) {
      score -= baseScore * DESPERATION_DIPLOMATIC_PENALTY;
    }

    return score;
  }

  // ── Decision noise ─────────────────────────────────────

  /**
   * Apply personality-driven noise — a small random perturbation based on
   * the leader's decision style.
   *
   * | Style         | Noise range |
   * |---------------|-------------|
   * | Analytical    | ±5%         |
   * | Transactional | ±10%        |
   * | Intuitive     | ±15%        |
   * | Ideological   | ±8%         |
   *
   * Uses a Gaussian distribution centred at 0 with σ = range/2 so that
   * most perturbations are small and extremes are rare.
   *
   * @param score - Score entering this stage.
   * @param decisionStyle - The leader's decision style.
   * @param rng - Seeded PRNG for deterministic noise.
   * @returns Perturbed score.
   *
   * @see FR-301
   */
  static applyDecisionNoise(
    score: number,
    decisionStyle: DecisionStyle,
    rng: SeededRandom,
  ): number {
    const range = DECISION_NOISE_RANGES[decisionStyle] ?? 10;
    // Gaussian noise: σ = range/2, most values within ±range
    const noisePct = rng.nextGaussian(0, range / 2);
    return score * (1 + noisePct / 100);
  }

  // ── Internal helpers ───────────────────────────────────

  /**
   * Compute the personality modifier for an action.
   *
   * Sums (action's per-category weight × matching personality weight) / 100
   * for each category the action declares. The action's own category also
   * contributes its primary personality weight.
   */
  private static computePersonalityModifier(
    action: AIAction,
    weights: UtilityWeights,
  ): number {
    let modifier = 0;

    // Primary category contribution
    const primaryKey = CATEGORY_WEIGHT_MAP[action.category];
    modifier += weights[primaryKey] / 100 * action.baseUtility * 0.5;

    // Explicit per-category weight contributions
    for (const cat of Object.keys(action.categoryWeights) as AIActionCategory[]) {
      const actionWeight = action.categoryWeights[cat];
      if (actionWeight == null) continue;

      const personalityKey = CATEGORY_WEIGHT_MAP[cat];
      if (personalityKey == null) continue;

      modifier += (actionWeight * weights[personalityKey]) / 100;
    }

    return modifier;
  }

  /**
   * Compute risk penalty: if action risk exceeds the leader's tolerance,
   * the excess is penalised at 0.5× per point.
   */
  private static computeRiskPenalty(
    action: AIAction,
    weights: UtilityWeights,
  ): number {
    if (action.riskLevel <= weights.riskTolerance) return 0;
    return (action.riskLevel - weights.riskTolerance) * 0.5;
  }

  /**
   * Compute the delta that difficulty scaling contributed to the personality
   * modifier. Used purely for the score breakdown / logging.
   */
  private static computeDifficultyDelta(
    action: AIAction,
    originalWeights: UtilityWeights,
    scaledWeights: UtilityWeights,
  ): number {
    const originalMod = UtilityEvaluator.computePersonalityModifier(
      action,
      originalWeights,
    );
    const scaledMod = UtilityEvaluator.computePersonalityModifier(
      action,
      scaledWeights,
    );
    return scaledMod - originalMod;
  }
}

// ─────────────────────────────────────────────────────────
// 7. Utility helpers
// ─────────────────────────────────────────────────────────

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
