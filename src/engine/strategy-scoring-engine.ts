/**
 * Strategy Scoring Engine
 *
 * Evaluates strategic consistency, computes composite strategy scores,
 * manages grand strategy presets, and classifies strategic grades.
 *
 * @see FR-1412 — Strategic Consistency (rolling window, focus bonus, drift penalty)
 * @see FR-1413 — Composite Strategy Score (weighted formula, grade classification)
 * @see FR-1414 — Strategic Presets / Grand Strategy (preset weighting, mid-game switch)
 * @module
 */

import type {
  FactionId,
  TurnNumber,
  GrandStrategyPreset,
  StrategicGrade,
} from '@/data/types';
import {
  GrandStrategyPreset as GrandStrategyPresetEnum,
  StrategicGrade as StrategicGradeEnum,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Clamps a numeric value to the inclusive range [min, max].
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/*  Exported Types                                                     */
/* ------------------------------------------------------------------ */

/**
 * Configuration slice used by the Strategy Scoring Engine.
 * Derived from `GAME_CONFIG.advisory`.
 *
 * @see FR-1412
 * @see FR-1413
 * @see FR-1414
 */
export type StrategyScoringConfig = typeof GAME_CONFIG.advisory;

/**
 * A single entry in the rolling consistency window representing
 * one turn's player action and the victory path it aligned with.
 *
 * @see FR-1412
 */
export interface ConsistencyWindowEntry {
  /** The turn on which the action was taken. */
  turn: TurnNumber;
  /** The victory path this action was aligned with. */
  alignedVictoryPath: string;
}

/**
 * Input parameters for evaluating strategic consistency.
 *
 * @see FR-1412
 */
export interface ConsistencyEvaluationInput {
  /** The faction whose consistency is being evaluated. */
  factionId: FactionId;
  /** Recent actions within the rolling window. */
  recentActions: ConsistencyWindowEntry[];
  /** The current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of a strategic consistency evaluation, including score,
 * dominant path, bonus/penalty flags, and any triggered headline.
 *
 * @see FR-1412
 */
export interface ConsistencyEvaluationResult {
  /** Consistency percentage (0–100). */
  consistencyScore: number;
  /** The most frequently aligned victory path in the window. */
  dominantPath: string;
  /** Whether the focus bonus threshold was exceeded. */
  hasFocusBonus: boolean;
  /** Whether the drift penalty threshold was triggered. */
  hasDriftPenalty: boolean;
  /** Effectiveness modifier applied to actions (+0.05, −0.05, or 0). */
  effectivenessModifier: number;
  /** Popularity decay per turn from drift penalty (0 or negative). */
  popularityDecayPerTurn: number;
  /** Whether a headline was triggered by drift. */
  headlineTriggered: boolean;
  /** The generated headline text, or empty string. */
  headline: string;
  /** Human-readable explanation of the evaluation. */
  reason: string;
}

/**
 * Input parameters for computing the composite strategy score.
 *
 * @see FR-1413
 */
export interface CompositeScoreInput {
  /** The faction whose composite score is being computed. */
  factionId: FactionId;
  /** The top victory-path viability score (0–100). */
  topViabilityScore: number;
  /** The consistency score (0–100). */
  consistencyScore: number;
  /** The nearest loss margin score (0–100). */
  nearestLossMargin: number;
  /** The current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of the composite strategy score computation.
 *
 * @see FR-1413
 */
export interface CompositeScoreResult {
  /** The computed composite strategy score (0–100). */
  strategyScore: number;
  /** The classified strategic grade (S–F). */
  grade: StrategicGrade;
  /** Human-readable explanation of the score and grade. */
  reason: string;
}

/**
 * Weighting multipliers for each action category under a grand strategy preset.
 *
 * @see FR-1414
 */
export interface PresetWeighting {
  /** Weight multiplier for economic actions. */
  economic: number;
  /** Weight multiplier for military actions. */
  military: number;
  /** Weight multiplier for diplomatic actions. */
  diplomatic: number;
  /** Weight multiplier for survival actions. */
  survival: number;
}

/**
 * Input parameters for retrieving a preset's weighting.
 *
 * @see FR-1414
 */
export interface PresetSelectionInput {
  /** The faction selecting the preset. */
  factionId: FactionId;
  /** The grand strategy preset to apply. */
  preset: GrandStrategyPreset;
  /** The current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of a preset selection, including the weighting table.
 *
 * @see FR-1414
 */
export interface PresetSelectionResult {
  /** The selected grand strategy preset. */
  preset: GrandStrategyPreset;
  /** The category weighting multipliers for this preset. */
  weighting: PresetWeighting;
  /** Whether the preset is Adaptive (disables preset weighting). */
  isAdaptive: boolean;
  /** Human-readable explanation of the selection. */
  reason: string;
}

/**
 * Input parameters for switching between grand strategy presets mid-game.
 *
 * @see FR-1414
 */
export interface PresetSwitchInput {
  /** The faction switching presets. */
  factionId: FactionId;
  /** The previously active preset. */
  oldPreset: GrandStrategyPreset;
  /** The newly selected preset. */
  newPreset: GrandStrategyPreset;
  /** The faction's current consistency score before the switch. */
  currentConsistencyScore: number;
  /** The current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of a mid-game preset switch, indicating whether
 * the consistency score was reset.
 *
 * @see FR-1414
 */
export interface PresetSwitchResult {
  /** The consistency score after the switch (0 if reset). */
  newConsistencyScore: number;
  /** Whether the consistency was reset due to switching presets. */
  consistencyReset: boolean;
  /** Human-readable explanation of the switch. */
  reason: string;
}

/* ------------------------------------------------------------------ */
/*  Preset Weighting Lookup                                            */
/* ------------------------------------------------------------------ */

/**
 * Static lookup table mapping each {@link GrandStrategyPreset} to its
 * category weighting multipliers.
 *
 * @see FR-1414
 */
const PRESET_WEIGHTINGS: Readonly<Record<GrandStrategyPreset, PresetWeighting>> = {
  [GrandStrategyPresetEnum.EconomicHegemon]: {
    economic: 2.0,
    military: 0.5,
    diplomatic: 1.0,
    survival: 0.5,
  },
  [GrandStrategyPresetEnum.MilitarySuperpower]: {
    economic: 0.5,
    military: 2.0,
    diplomatic: 0.5,
    survival: 1.0,
  },
  [GrandStrategyPresetEnum.DiplomaticBroker]: {
    economic: 1.0,
    military: 0.5,
    diplomatic: 2.0,
    survival: 0.5,
  },
  [GrandStrategyPresetEnum.SurvivalMode]: {
    economic: 0.5,
    military: 1.0,
    diplomatic: 0.5,
    survival: 2.0,
  },
  [GrandStrategyPresetEnum.Adaptive]: {
    economic: 1.0,
    military: 1.0,
    diplomatic: 1.0,
    survival: 1.0,
  },
};

/* ------------------------------------------------------------------ */
/*  Engine Class                                                       */
/* ------------------------------------------------------------------ */

/**
 * Strategy Scoring Engine
 *
 * Evaluates strategic consistency over a rolling window of player actions,
 * computes a composite strategy score for post-game grading and the
 * Strategic Dashboard, manages grand strategy presets with category
 * weightings, and handles mid-game preset switches.
 *
 * All formulas are driven by config values — no magic numbers.
 * All methods are pure functions that do not mutate input state.
 *
 * @see FR-1412 — Strategic Consistency
 * @see FR-1413 — Composite Strategy Score
 * @see FR-1414 — Strategic Presets / Grand Strategy
 */
export class StrategyScoringEngine {
  /** Resolved advisory configuration slice. */
  private readonly cfg: StrategyScoringConfig;

  /**
   * Creates a new Strategy Scoring Engine.
   *
   * @param config - The advisory configuration slice from `GAME_CONFIG.advisory`.
   */
  constructor(config: StrategyScoringConfig) {
    this.cfg = config;
  }

  /* ---------------------------------------------------------------- */
  /*  Method 1 — evaluateConsistency                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Evaluates strategic consistency over a rolling window of the player's
   * most recent actions. Determines the dominant victory path, computes
   * a consistency percentage, and applies a Focus Bonus or Drift Penalty
   * as appropriate.
   *
   * **Algorithm**:
   * 1. Slice the last `consistencyWindow` (6) entries from `recentActions`.
   * 2. If the window is empty, return a neutral score of 50.
   * 3. Count the frequency of each `alignedVictoryPath`.
   * 4. The dominant path is the most frequent; ties broken by first occurrence.
   * 5. `consistencyScore = (dominantCount / windowSize) × 100`.
   * 6. Focus Bonus fires when normalized score > 0.7 threshold.
   * 7. Drift Penalty fires when normalized score < 0.3 threshold.
   * 8. Drift triggers an "Indecisive Leadership" headline.
   *
   * @param input - The consistency evaluation input.
   * @returns The consistency evaluation result.
   *
   * @see FR-1412 — Strategic Consistency
   */
  evaluateConsistency(input: ConsistencyEvaluationInput): ConsistencyEvaluationResult {
    const windowSize = this.cfg.consistencyWindow;
    const window = input.recentActions.slice(-windowSize);

    /* Empty window → neutral defaults */
    if (window.length === 0) {
      return {
        consistencyScore: 50,
        dominantPath: '',
        hasFocusBonus: false,
        hasDriftPenalty: false,
        effectivenessModifier: 0,
        popularityDecayPerTurn: 0,
        headlineTriggered: false,
        headline: '',
        reason: `Consistency evaluation for ${input.factionId}: 50.0% — Normal (no actions in window)`,
      };
    }

    /* Count frequency of each aligned victory path */
    const frequencyMap = new Map<string, number>();
    for (const entry of window) {
      const current = frequencyMap.get(entry.alignedVictoryPath) ?? 0;
      frequencyMap.set(entry.alignedVictoryPath, current + 1);
    }

    /* Determine dominant path (most frequent; first occurrence breaks ties) */
    let dominantPath = '';
    let dominantCount = 0;
    for (const entry of window) {
      const count = frequencyMap.get(entry.alignedVictoryPath) ?? 0;
      if (count > dominantCount) {
        dominantCount = count;
        dominantPath = entry.alignedVictoryPath;
      }
    }

    /* Compute consistency percentage and normalized score */
    const consistencyScore = (dominantCount / window.length) * 100;
    const normalizedScore = consistencyScore / 100;

    /* Evaluate bonus / penalty thresholds */
    const hasFocusBonus = normalizedScore > this.cfg.focusBonus.consistencyThreshold;
    const hasDriftPenalty = normalizedScore < this.cfg.driftPenalty.consistencyThreshold;

    /* Determine effectiveness modifier */
    let effectivenessModifier: number;
    if (hasFocusBonus) {
      effectivenessModifier = this.cfg.focusBonus.effectivenessBonus;
    } else if (hasDriftPenalty) {
      effectivenessModifier = this.cfg.driftPenalty.effectivenessPenalty;
    } else {
      effectivenessModifier = 0;
    }

    /* Popularity decay only applies during drift */
    const popularityDecayPerTurn = hasDriftPenalty
      ? this.cfg.driftPenalty.popularityDecayPerTurn
      : 0;

    /* Headline triggered only by drift */
    const headlineTriggered = hasDriftPenalty;
    const headline = hasDriftPenalty ? 'Indecisive Leadership' : '';

    /* Build descriptive state label */
    let state: string;
    if (hasFocusBonus) {
      state = 'Focus Bonus';
    } else if (hasDriftPenalty) {
      state = 'Drift Penalty';
    } else {
      state = 'Normal';
    }

    const reason =
      `Consistency evaluation for ${input.factionId}: ${consistencyScore.toFixed(4)}% — ${state}`;

    return {
      consistencyScore,
      dominantPath,
      hasFocusBonus,
      hasDriftPenalty,
      effectivenessModifier,
      popularityDecayPerTurn,
      headlineTriggered,
      headline,
      reason,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Method 2 — computeCompositeScore                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Computes the composite strategy score using a weighted formula and
   * classifies the result into a strategic grade (S–F).
   *
   * **Formula**:
   * ```
   * StrategyScore = (TopViability × topViabilityWeight)
   *               + (Consistency  × consistencyWeight)
   *               + (LossMargin   × lossMarginWeight)
   * ```
   *
   * The result is clamped to [0, 100] and classified via grade thresholds.
   *
   * @param input - The composite score input parameters.
   * @returns The composite score result with grade.
   *
   * @see FR-1413 — Composite Strategy Score
   */
  computeCompositeScore(input: CompositeScoreInput): CompositeScoreResult {
    const weights = this.cfg.compositeStrategy;

    const rawScore =
      input.topViabilityScore * weights.topViabilityWeight +
      input.consistencyScore * weights.consistencyWeight +
      input.nearestLossMargin * weights.lossMarginWeight;

    const strategyScore = clamp(rawScore, 0, 100);
    const grade = this.classifyGrade(strategyScore);

    const reason =
      `Composite strategy score for ${input.factionId}: ${strategyScore.toFixed(1)} (Grade ${grade})`;

    return {
      strategyScore,
      grade,
      reason,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Method 3 — getPresetWeighting                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Returns the category weighting multipliers for a given grand strategy
   * preset. The "Adaptive" preset uses uniform weights (1.0 across all
   * categories), effectively disabling preset-based recommendation weighting.
   *
   * @param input - The preset selection input.
   * @returns The preset selection result with weighting table.
   *
   * @see FR-1414 — Strategic Presets / Grand Strategy
   */
  getPresetWeighting(input: PresetSelectionInput): PresetSelectionResult {
    const weighting = PRESET_WEIGHTINGS[input.preset];
    const isAdaptive = input.preset === GrandStrategyPresetEnum.Adaptive;

    const reason = `Preset weighting for ${input.factionId}: ${input.preset}`;

    return {
      preset: input.preset,
      weighting,
      isAdaptive,
      reason,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Method 4 — evaluatePresetSwitch                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Evaluates a mid-game switch between grand strategy presets.
   * Switching to a different preset resets the consistency score to 0.
   * Switching to the same preset (no-op) preserves the current score.
   *
   * @param input - The preset switch input.
   * @returns The preset switch result indicating whether consistency was reset.
   *
   * @see FR-1414 — Strategic Presets / Grand Strategy
   */
  evaluatePresetSwitch(input: PresetSwitchInput): PresetSwitchResult {
    /* No-op: switching to the same preset */
    if (input.oldPreset === input.newPreset) {
      return {
        newConsistencyScore: input.currentConsistencyScore,
        consistencyReset: false,
        reason:
          `Preset switch for ${input.factionId}: ${input.oldPreset} → ${input.newPreset} — no change`,
      };
    }

    /* Switching presets resets consistency to 0 */
    return {
      newConsistencyScore: 0,
      consistencyReset: true,
      reason:
        `Preset switch for ${input.factionId}: ${input.oldPreset} → ${input.newPreset} — consistency reset to 0`,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Method 5 — classifyGrade                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Classifies a numeric score into a strategic grade (S through F)
   * using the configured grade thresholds.
   *
   * | Grade | Minimum Score |
   * |-------|---------------|
   * | S     | ≥ 90          |
   * | A     | ≥ 75          |
   * | B     | ≥ 60          |
   * | C     | ≥ 45          |
   * | D     | ≥ 30          |
   * | F     | < 30          |
   *
   * @param score - The numeric score to classify (0–100).
   * @returns The corresponding {@link StrategicGrade}.
   *
   * @see FR-1413 — Composite Strategy Score
   */
  classifyGrade(score: number): StrategicGrade {
    const t = this.cfg.gradeThresholds;

    if (score >= t.S) return StrategicGradeEnum.S;
    if (score >= t.A) return StrategicGradeEnum.A;
    if (score >= t.B) return StrategicGradeEnum.B;
    if (score >= t.C) return StrategicGradeEnum.C;
    if (score >= t.D) return StrategicGradeEnum.D;

    return StrategicGradeEnum.F;
  }
}
