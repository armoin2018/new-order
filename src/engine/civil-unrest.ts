/**
 * Civil Unrest Engine — New Order
 *
 * Computes civil unrest scores, maps them to escalation stages,
 * and derives per-turn effects for each stage. All methods are pure
 * functions that return new objects; no side effects.
 *
 * @see FR-1301 — Civil Unrest composite formula
 * @see FR-1302 — Escalation stage thresholds & effects
 * @see FR-1303 — Ethnic tension aggregation from fault lines
 */

import type {
  FactionId,
  TurnNumber,
  CivilUnrestComponents,
  NationFaultLines,
} from '@/data/types';
import { EscalationStage } from '@/data/types';
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
 * Configuration shape for stability & civil unrest parameters.
 * Derived from the runtime `GAME_CONFIG.stability` object.
 *
 * @see FR-1301
 * @see FR-1302
 */
export type CivilUnrestConfig = typeof GAME_CONFIG.stability;

/**
 * Raw numeric inputs that feed the civil-unrest composite formula.
 * Each field ranges 0–100.
 *
 * @see FR-1301
 */
export interface UnrestComputationInput {
  /** Current inflation pressure. Range: 0–100. */
  readonly inflation: number;
  /** Income inequality index. Range: 0–100. */
  readonly inequality: number;
  /** Backlash from government repression. Range: 0–100. */
  readonly repressionBacklash: number;
  /** Ethnic/religious tension pressure. Range: 0–100. */
  readonly ethnicTension: number;
  /** Foreign propaganda influence. Range: 0–100. */
  readonly foreignPropaganda: number;
}

/**
 * Per-turn mechanical effects applied at a given escalation stage.
 *
 * @see FR-1302
 */
export interface StageEffects {
  /** Change to leader popularity per turn. */
  readonly popularityDelta: number;
  /** Change to nation stability per turn. */
  readonly stabilityDelta: number;
  /** Multiplier applied to economic growth (negative = decay). */
  readonly economicGrowthMultiplier: number;
  /** Change to military readiness per turn. */
  readonly militaryReadinessDelta: number;
  /** Morale penalty applied to each riot-affected hex. */
  readonly moraleHitPerRiotHex: number;
}

/**
 * Complete result of an escalation evaluation, including the computed
 * civil-unrest score, stage transition info, and derived effects.
 *
 * @see FR-1301
 * @see FR-1302
 */
export interface EscalationResult {
  /** Composite civil unrest value. Range: 0–100. */
  readonly civilUnrest: number;
  /** Stage the faction was in before this evaluation. */
  readonly previousStage: EscalationStage;
  /** Stage the faction is in after this evaluation. */
  readonly currentStage: EscalationStage;
  /** Whether the escalation stage changed this turn. */
  readonly stageChanged: boolean;
  /** Mechanical effects to apply for the current stage. */
  readonly effects: StageEffects;
}

/**
 * Result of aggregating ethnic/religious fault-line tensions.
 *
 * @see FR-1303
 */
export interface EthnicTensionResult {
  /** Average tension across all fault lines. Range: 0–100 (or 0 if none). */
  readonly totalTension: number;
  /** Individual fault-line scores. */
  readonly faultLineScores: ReadonlyArray<{
    readonly groupName: string;
    readonly tension: number;
  }>;
}

// ─────────────────────────────────────────────────────────
// Null-object constants (zero-effect defaults)
// ─────────────────────────────────────────────────────────

/** Zero effects — used for the Grumbling stage (no mechanical impact). */
const ZERO_EFFECTS: StageEffects = {
  popularityDelta: 0,
  stabilityDelta: 0,
  economicGrowthMultiplier: 0,
  militaryReadinessDelta: 0,
  moraleHitPerRiotHex: 0,
} as const;

/**
 * Hard-coded effects for Civil War stage (Phase 2 placeholder).
 * Not yet in the config because full civil-war mechanics are
 * deferred to Phase 2 of the roadmap.
 *
 * @see FR-1302
 */
const CIVIL_WAR_EFFECTS: StageEffects = {
  popularityDelta: 0,
  stabilityDelta: -10,
  economicGrowthMultiplier: -0.5,
  militaryReadinessDelta: -10,
  moraleHitPerRiotHex: 0,
} as const;

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that evaluates civil-unrest formulas and
 * escalation-stage transitions.
 *
 * Every public method is **pure**: no mutation of `this`, no
 * side effects, all results are freshly-allocated objects.
 *
 * @see FR-1301 — CivilUnrest composite formula
 * @see FR-1302 — Escalation stage mapping & effects
 * @see FR-1303 — Ethnic tension aggregation
 */
export class CivilUnrestEngine {
  /** Stability config snapshot — never mutated. */
  private readonly config: CivilUnrestConfig;

  /**
   * Create a new CivilUnrestEngine.
   *
   * @param config - Stability configuration (typically `GAME_CONFIG.stability`).
   */
  constructor(config: CivilUnrestConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // 1. computeCivilUnrest
  // ───────────────────────────────────────────────────────

  /**
   * Compute the composite civil-unrest index from weighted inputs.
   *
   * **Formula (FR-1301):**
   * ```
   * CivilUnrest = (Inflation × 0.3)
   *             + (Inequality × 0.2)
   *             + (RepressionBacklash × 0.2)
   *             + (EthnicTension × 0.15)
   *             + (ForeignPropaganda × 0.15)
   * ```
   *
   * The result is clamped to **[0, 100]**.
   *
   * @param input - The five unrest driver values.
   * @returns Clamped civil-unrest score in [0, 100].
   *
   * @see FR-1301
   */
  computeCivilUnrest(input: UnrestComputationInput): number {
    const w = this.config.civilUnrestWeights;

    const raw =
      input.inflation * w.inflation +
      input.inequality * w.inequality +
      input.repressionBacklash * w.repressionBacklash +
      input.ethnicTension * w.ethnicTension +
      input.foreignPropaganda * w.foreignPropaganda;

    return clamp(raw, 0, 100);
  }

  // ───────────────────────────────────────────────────────
  // 2. determineEscalationStage
  // ───────────────────────────────────────────────────────

  /**
   * Map a civil-unrest score to an {@link EscalationStage}.
   *
   * | Range  | Stage         |
   * | ------ | ------------- |
   * | 0–20   | Grumbling     |
   * | 21–40  | Protests      |
   * | 41–60  | Riots         |
   * | 61–80  | Insurrection  |
   * | 81–100 | CivilWar      |
   *
   * @param civilUnrest - Clamped civil-unrest value in [0, 100].
   * @returns The corresponding escalation stage.
   *
   * @see FR-1302
   */
  determineEscalationStage(civilUnrest: number): EscalationStage {
    const t = this.config.escalationThresholds;

    if (civilUnrest <= t.grumblingMax) {
      return EscalationStage.Grumbling;
    }
    if (civilUnrest <= t.protestsMax) {
      return EscalationStage.Protests;
    }
    if (civilUnrest <= t.riotsMax) {
      return EscalationStage.Riots;
    }
    if (civilUnrest <= t.insurrectionMax) {
      return EscalationStage.Insurrection;
    }
    return EscalationStage.CivilWar;
  }

  // ───────────────────────────────────────────────────────
  // 3. computeStageEffects
  // ───────────────────────────────────────────────────────

  /**
   * Derive per-turn mechanical effects for a given escalation stage.
   *
   * | Stage        | Effects                                                   |
   * | ------------ | --------------------------------------------------------- |
   * | Grumbling    | No mechanical effect (all zeros).                         |
   * | Protests     | popularity −2/turn, econ growth −1/turn.                  |
   * | Riots        | stability −3/turn, FDI/tourism −0.2, morale −10/hex.     |
   * | Insurrection | stability −5/turn, military readiness −5/turn.            |
   * | CivilWar     | stability −10/turn, mil readiness −10, econ growth −0.5. |
   *
   * @param stage - The escalation stage to evaluate.
   * @returns A frozen {@link StageEffects} object.
   *
   * @see FR-1302
   */
  computeStageEffects(stage: EscalationStage): StageEffects {
    switch (stage) {
      case EscalationStage.Grumbling:
        return { ...ZERO_EFFECTS };

      case EscalationStage.Protests:
        return {
          popularityDelta: this.config.protestsEffects.popularityDecayPerTurn,
          stabilityDelta: 0,
          economicGrowthMultiplier:
            this.config.protestsEffects.economicGrowthDecayPerTurn,
          militaryReadinessDelta: 0,
          moraleHitPerRiotHex: 0,
        };

      case EscalationStage.Riots:
        return {
          popularityDelta: 0,
          stabilityDelta: this.config.riotsEffects.stabilityDecayPerTurn,
          economicGrowthMultiplier:
            this.config.riotsEffects.tourismFDIReduction,
          militaryReadinessDelta: 0,
          moraleHitPerRiotHex: this.config.riotsEffects.moraleHitInRiotHex,
        };

      case EscalationStage.Insurrection:
        return {
          popularityDelta: 0,
          stabilityDelta:
            this.config.insurrectionEffects.stabilityDecayPerTurn,
          economicGrowthMultiplier: 0,
          militaryReadinessDelta:
            this.config.insurrectionEffects.militaryReadinessDecayPerTurn,
          moraleHitPerRiotHex: 0,
        };

      case EscalationStage.CivilWar:
        return { ...CIVIL_WAR_EFFECTS };

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = stage;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 4. evaluateEscalation
  // ───────────────────────────────────────────────────────

  /**
   * Full escalation evaluation pipeline: compute the civil-unrest
   * score, determine the new stage, detect stage transitions, and
   * derive the current-stage effects.
   *
   * @param input         - The five unrest driver values.
   * @param previousStage - The stage the faction was in last turn.
   * @returns A complete {@link EscalationResult}.
   *
   * @see FR-1301
   * @see FR-1302
   */
  evaluateEscalation(
    input: UnrestComputationInput,
    previousStage: EscalationStage,
  ): EscalationResult {
    const civilUnrest = this.computeCivilUnrest(input);
    const currentStage = this.determineEscalationStage(civilUnrest);
    const stageChanged = currentStage !== previousStage;
    const effects = this.computeStageEffects(currentStage);

    return {
      civilUnrest,
      previousStage,
      currentStage,
      stageChanged,
      effects,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. computeEthnicTension
  // ───────────────────────────────────────────────────────

  /**
   * Aggregate ethnic/religious tension from a nation's fault lines.
   *
   * The total tension is the **arithmetic mean** of all
   * `faultLine.tensionBase` values, clamped to [0, 100].
   * If there are no fault lines the total is 0.
   *
   * @param faultLines - The nation's fault-line collection.
   * @returns Individual scores and the aggregated tension.
   *
   * @see FR-1303
   */
  computeEthnicTension(faultLines: NationFaultLines): EthnicTensionResult {
    const lines = faultLines.faultLines;

    if (lines.length === 0) {
      return { totalTension: 0, faultLineScores: [] };
    }

    const faultLineScores = lines.map((fl) => ({
      groupName: fl.groupName,
      tension: clamp(fl.tensionBase, 0, 100),
    }));

    const sum = faultLineScores.reduce((acc, s) => acc + s.tension, 0);
    const totalTension = clamp(sum / faultLineScores.length, 0, 100);

    return { totalTension, faultLineScores };
  }

  // ───────────────────────────────────────────────────────
  // 6. buildUnrestComponents
  // ───────────────────────────────────────────────────────

  /**
   * Assemble a {@link CivilUnrestComponents} snapshot for a faction
   * on a given turn, computing the composite civil-unrest value and
   * the escalation stage from the provided input drivers.
   *
   * @param factionId - The faction this record belongs to.
   * @param turn      - Current turn number.
   * @param input     - The five unrest driver values.
   * @param stage     - Pre-computed escalation stage (caller typically
   *                    uses {@link evaluateEscalation} first).
   * @returns A new {@link CivilUnrestComponents} object.
   *
   * @see FR-1301
   * @see FR-1302
   */
  buildUnrestComponents(
    factionId: FactionId,
    turn: TurnNumber,
    input: UnrestComputationInput,
    stage: EscalationStage,
  ): CivilUnrestComponents {
    const civilUnrest = this.computeCivilUnrest(input);

    return {
      factionId,
      turn,
      civilUnrest,
      inflation: input.inflation,
      inequality: input.inequality,
      repressionBacklash: input.repressionBacklash,
      ethnicTension: input.ethnicTension,
      foreignPropaganda: input.foreignPropaganda,
      escalationStage: stage,
    };
  }
}
