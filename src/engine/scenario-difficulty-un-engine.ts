/**
 * Scenario / Difficulty / UN-Resolution Engine
 *
 * Combines three cross-cutting subsystems into a single stateless engine:
 *
 *  1. **Scenario Selection** (FR-104) — list, validate, and load scenarios.
 *  2. **AI Difficulty Scaling** (FR-305) — scale AI behavioural parameters
 *     across three difficulty tiers (Cautious / Balanced / Aggressive).
 *  3. **UN-Style Resolutions** (FR-703) — propose, vote (utility-weighted),
 *     and enforce resolution outcomes (sanctions, peacekeeping, condemnation).
 *
 * Pure functions — no side effects, no mutation of input, no Math.random.
 *
 * @see FR-104  — Scenario selection screen
 * @see FR-305  — 3 AI difficulty levels
 * @see FR-703  — UN-style resolutions
 */

import type {
  FactionId,
  TurnNumber,
  UNResolutionType,
  AIDifficultyLevel,
} from '@/data/types';
import {
  UNResolutionType as UNResolutionTypeEnum,
  AIDifficultyLevel as AIDifficultyLevelEnum,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Config Type
// ---------------------------------------------------------------------------

/**
 * Configuration shape consumed by this engine.
 * Derived directly from the central `GAME_CONFIG` object so any tuning
 * changes propagate automatically without type drift.
 */
export type ScenarioDifficultyUNConfig = {
  scenarioSelection: typeof GAME_CONFIG.scenarioSelection;
  aiDifficulty: typeof GAME_CONFIG.aiDifficulty;
  unResolutions: typeof GAME_CONFIG.unResolutions;
};

// ---------------------------------------------------------------------------
// Scenario Selection Types (FR-104)
// ---------------------------------------------------------------------------

/** A single entry in the scenario list. */
export interface ScenarioEntry {
  /** Unique scenario identifier. */
  id: string;
  /** Whether this entry is the default scenario. */
  isDefault: boolean;
}

/** Result of listing available scenarios. @see FR-104 */
export interface ScenarioListResult {
  /** Filtered / capped list of scenario entries. */
  scenarios: ScenarioEntry[];
  /** The default scenario ID from config. */
  defaultScenarioId: string;
  /** Human-readable explanation. */
  reason: string;
}

/** Result of validating a scenario ID. @see FR-104 */
export interface ScenarioValidationResult {
  /** Whether the scenario ID is valid. */
  valid: boolean;
  /** The scenario ID that was validated. */
  scenarioId: string;
  /** Human-readable explanation. */
  reason: string;
}

// ---------------------------------------------------------------------------
// AI Difficulty Types (FR-305)
// ---------------------------------------------------------------------------

/** Result of applying difficulty-based scaling to AI behaviour parameters. @see FR-305 */
export interface DifficultyScalingResult {
  /** Difficulty level that was applied. */
  difficulty: AIDifficultyLevel;
  /** Scaled risk-tolerance value (0–100). */
  scaledRiskTolerance: number;
  /** Scaled aggression value (0–100). */
  scaledAggression: number;
  /** Scaled economic-focus value (0–100). */
  scaledEconomicFocus: number;
  /** Scaled diplomatic-preference value (0–100). */
  scaledDiplomaticPreference: number;
  /** Human-readable explanation. */
  reason: string;
}

// ---------------------------------------------------------------------------
// UN Resolution Types (FR-703)
// ---------------------------------------------------------------------------

/** Result of proposing a UN-style resolution. @see FR-703 */
export interface ResolutionProposalResult {
  /** Faction that proposed the resolution. */
  proposer: FactionId;
  /** Faction targeted by the resolution. */
  target: FactionId;
  /** Type of resolution proposed. */
  resolutionType: UNResolutionType;
  /** Turn the proposal was made. */
  proposalTurn: TurnNumber;
  /** Human-readable explanation. */
  reason: string;
}

/** Result of a single faction's vote on a resolution. @see FR-703 */
export interface FactionVoteResult {
  /** Faction that cast the vote. */
  voter: FactionId;
  /** The vote cast. */
  vote: 'yea' | 'nay' | 'abstain';
  /** Computed utility score that drove the decision. */
  utilityScore: number;
  /** Human-readable explanation. */
  reason: string;
}

/** Aggregate effects applied when a resolution is enacted. @see FR-703 */
export interface ResolutionEffects {
  /** GDP growth penalty on target (negative = penalty). */
  gdpGrowthPenalty: number;
  /** Trade volume reduction (0–1 fraction). */
  tradeReduction: number;
  /** Stability bonus to target. */
  stabilityBonus: number;
  /** Civil unrest reduction in target (negative = reduction). */
  civilUnrestReduction: number;
  /** Legitimacy penalty on target (negative = penalty). */
  legitimacyPenalty: number;
  /** Diplomatic-influence penalty on target (negative = penalty). */
  diPenalty: number;
  /** Diplomatic-influence cost to proposer (negative = cost). */
  diCostToProposer: number;
}

/** Result of resolving (tallying) a vote. @see FR-703 */
export interface ResolutionOutcomeResult {
  /** Whether the resolution passed. */
  passed: boolean;
  /** Number of yea votes. */
  yeaCount: number;
  /** Number of nay votes. */
  nayCount: number;
  /** Number of abstentions. */
  abstainCount: number;
  /** Effects applied if passed (all zeros if not). */
  effects: ResolutionEffects;
  /** Turn the resolution expires (enacted turn + duration). */
  expiryTurn: TurnNumber;
  /** Human-readable explanation. */
  reason: string;
}

/** Result of computing resolution expiry. @see FR-703 */
export interface ResolutionExpiryResult {
  /** Turn the resolution expires. */
  expiryTurn: TurnNumber;
  /** Duration in turns from config. */
  durationTurns: number;
  /** Human-readable explanation. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that handles scenario selection, AI difficulty scaling,
 * and UN-resolution lifecycle.
 *
 * All public methods are pure — they return new objects and never mutate
 * their inputs. Config is injectable via the constructor; defaults to
 * the relevant sections of `GAME_CONFIG`.
 *
 * @see FR-104  — Scenario selection
 * @see FR-305  — AI difficulty levels
 * @see FR-703  — UN-style resolutions
 */
export class ScenarioDifficultyUNEngine {
  private readonly cfg: ScenarioDifficultyUNConfig;

  constructor(config?: ScenarioDifficultyUNConfig) {
    this.cfg = config ?? {
      scenarioSelection: GAME_CONFIG.scenarioSelection,
      aiDifficulty: GAME_CONFIG.aiDifficulty,
      unResolutions: GAME_CONFIG.unResolutions,
    };
  }

  // -----------------------------------------------------------------------
  // FR-104 — Scenario Selection
  // -----------------------------------------------------------------------

  /**
   * List available scenarios, capped to `maxScenarioListSize` and annotated
   * with which entry is the default.
   *
   * @param input.availableIds - All known scenario IDs.
   * @returns Filtered scenario list with default marker. @see FR-104
   */
  listScenarios(input: { availableIds: string[] }): ScenarioListResult {
    const { availableIds } = input;
    const max = this.cfg.scenarioSelection.maxScenarioListSize;
    const defaultId = this.cfg.scenarioSelection.defaultScenarioId;

    const capped = availableIds.slice(0, max);
    const scenarios: ScenarioEntry[] = capped.map((id) => ({
      id,
      isDefault: id === defaultId,
    }));

    return {
      scenarios,
      defaultScenarioId: defaultId,
      reason:
        availableIds.length > max
          ? `Showing first ${max} of ${availableIds.length} available scenarios.`
          : `Showing all ${availableIds.length} available scenario(s).`,
    };
  }

  /**
   * Validate whether a scenario ID exists in the set of available IDs.
   *
   * @param input.scenarioId    - ID to validate.
   * @param input.availableIds  - All known scenario IDs.
   * @returns Validation result with reason. @see FR-104
   */
  validateScenarioId(input: {
    scenarioId: string;
    availableIds: string[];
  }): ScenarioValidationResult {
    const { scenarioId, availableIds } = input;
    const valid = availableIds.includes(scenarioId);

    return {
      valid,
      scenarioId,
      reason: valid
        ? `Scenario '${scenarioId}' is available and valid.`
        : `Scenario '${scenarioId}' was not found among ${availableIds.length} available scenario(s).`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-305 — AI Difficulty Scaling
  // -----------------------------------------------------------------------

  /**
   * Apply difficulty-based multipliers to base AI behavioural parameters.
   *
   * Each base value is multiplied by the corresponding config multiplier
   * for the selected difficulty level, then clamped to 0–100.
   *
   * @param input.difficulty              - Selected AI difficulty level.
   * @param input.baseRiskTolerance       - Unscaled risk-tolerance (0–100).
   * @param input.baseAggression          - Unscaled aggression (0–100).
   * @param input.baseEconomicFocus       - Unscaled economic focus (0–100).
   * @param input.baseDiplomaticPreference - Unscaled diplomatic preference (0–100).
   * @returns Scaled values clamped to 0–100. @see FR-305
   */
  computeDifficultyScaling(input: {
    difficulty: AIDifficultyLevel;
    baseRiskTolerance: number;
    baseAggression: number;
    baseEconomicFocus: number;
    baseDiplomaticPreference: number;
  }): DifficultyScalingResult {
    const {
      difficulty,
      baseRiskTolerance,
      baseAggression,
      baseEconomicFocus,
      baseDiplomaticPreference,
    } = input;

    const multipliers = this.getMultipliersForDifficulty(difficulty);

    const scaledRiskTolerance = this.clamp(
      baseRiskTolerance * multipliers.riskToleranceMultiplier,
    );
    const scaledAggression = this.clamp(
      baseAggression * multipliers.aggressionMultiplier,
    );
    const scaledEconomicFocus = this.clamp(
      baseEconomicFocus * multipliers.economicFocusMultiplier,
    );
    const scaledDiplomaticPreference = this.clamp(
      baseDiplomaticPreference * multipliers.diplomaticPreferenceMultiplier,
    );

    return {
      difficulty,
      scaledRiskTolerance,
      scaledAggression,
      scaledEconomicFocus,
      scaledDiplomaticPreference,
      reason:
        `Applied '${difficulty}' multipliers: ` +
        `risk ${baseRiskTolerance}→${scaledRiskTolerance}, ` +
        `aggression ${baseAggression}→${scaledAggression}, ` +
        `economic ${baseEconomicFocus}→${scaledEconomicFocus}, ` +
        `diplomatic ${baseDiplomaticPreference}→${scaledDiplomaticPreference}.`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-703 — UN-Style Resolutions
  // -----------------------------------------------------------------------

  /**
   * Create a structured proposal for a UN-style resolution.
   *
   * @param input.proposer       - Faction proposing the resolution.
   * @param input.target         - Faction targeted by the resolution.
   * @param input.resolutionType - Type of resolution (Sanctions / Peacekeeping / Condemnation).
   * @param input.currentTurn    - Turn the proposal is made.
   * @returns Structured proposal record. @see FR-703
   */
  proposeResolution(input: {
    proposer: FactionId;
    target: FactionId;
    resolutionType: UNResolutionType;
    currentTurn: TurnNumber;
  }): ResolutionProposalResult {
    const { proposer, target, resolutionType, currentTurn } = input;

    return {
      proposer,
      target,
      resolutionType,
      proposalTurn: currentTurn,
      reason:
        `${proposer} proposed a ${resolutionType} resolution targeting ${target} on turn ${currentTurn as number}.`,
    };
  }

  /**
   * Compute a single faction's vote on a proposed resolution.
   *
   * The utility score is a weighted sum of four normalised factors
   * (all −100 to +100) using the weights from config:
   *
   *   utility = w₁·relationshipWithProposer
   *           + w₂·(−relationshipWithTarget)
   *           + w₃·strategicInterest
   *           + w₄·legitimacyImpact
   *
   * The relationship-with-target factor is negated because a higher
   * relationship with the target makes a voter *less* inclined to
   * vote against them.
   *
   * Decision: utility > +5 → yea, < −5 → nay, otherwise → abstain.
   *
   * @param input - Vote evaluation inputs.
   * @returns Vote result with utility score. @see FR-703
   */
  computeFactionVote(input: {
    voter: FactionId;
    proposer: FactionId;
    target: FactionId;
    resolutionType: UNResolutionType;
    relationshipWithProposer: number;
    relationshipWithTarget: number;
    strategicInterest: number;
    legitimacyImpact: number;
  }): FactionVoteResult {
    const {
      voter,
      relationshipWithProposer,
      relationshipWithTarget,
      strategicInterest,
      legitimacyImpact,
    } = input;

    const w = this.cfg.unResolutions.votingWeights;

    const utilityScore =
      w.relationshipWithProposer * relationshipWithProposer +
      w.relationshipWithTarget * -relationshipWithTarget +
      w.strategicInterest * strategicInterest +
      w.legitimacyImpact * legitimacyImpact;

    const ABSTAIN_THRESHOLD = 5;
    let vote: 'yea' | 'nay' | 'abstain';
    if (utilityScore > ABSTAIN_THRESHOLD) {
      vote = 'yea';
    } else if (utilityScore < -ABSTAIN_THRESHOLD) {
      vote = 'nay';
    } else {
      vote = 'abstain';
    }

    return {
      voter,
      vote,
      utilityScore,
      reason:
        `${voter} voted '${vote}' (utility=${utilityScore.toFixed(2)}). ` +
        `Factors: proposer-rel=${relationshipWithProposer}, ` +
        `target-rel=${relationshipWithTarget}, ` +
        `strategic=${strategicInterest}, ` +
        `legitimacy=${legitimacyImpact}.`,
    };
  }

  /**
   * Tally faction votes and determine whether a resolution passes.
   *
   * Passing condition: `yea / (yea + nay) >= passingThreshold`.
   * Abstentions are excluded from the denominator.
   *
   * If the resolution passes, effects are drawn from the matching
   * resolution-type config. Non-applicable effect fields default to 0.
   *
   * @param input.votes          - Individual faction vote results.
   * @param input.proposer       - Faction that proposed the resolution.
   * @param input.target         - Faction targeted by the resolution.
   * @param input.resolutionType - Type of resolution.
   * @param input.currentTurn    - Turn the vote is resolved.
   * @returns Outcome with pass/fail, counts, effects, and expiry. @see FR-703
   */
  resolveVote(input: {
    votes: FactionVoteResult[];
    proposer: FactionId;
    target: FactionId;
    resolutionType: UNResolutionType;
    currentTurn: TurnNumber;
  }): ResolutionOutcomeResult {
    const { votes, proposer, target, resolutionType, currentTurn } = input;

    const yeaCount = votes.filter((v) => v.vote === 'yea').length;
    const nayCount = votes.filter((v) => v.vote === 'nay').length;
    const abstainCount = votes.filter((v) => v.vote === 'abstain').length;

    const denominator = yeaCount + nayCount;
    const ratio = denominator > 0 ? yeaCount / denominator : 0;
    const passed = ratio >= this.cfg.unResolutions.passingThreshold;

    const effects = passed
      ? this.buildEffects(resolutionType)
      : this.emptyEffects();

    const expiryResult = this.computeResolutionExpiry({
      resolutionType,
      enactedTurn: currentTurn,
    });

    return {
      passed,
      yeaCount,
      nayCount,
      abstainCount,
      effects,
      expiryTurn: passed ? expiryResult.expiryTurn : currentTurn,
      reason:
        `Vote on ${resolutionType} by ${proposer} vs ${target}: ` +
        `${yeaCount} yea, ${nayCount} nay, ${abstainCount} abstain ` +
        `(ratio=${ratio.toFixed(2)}, threshold=${this.cfg.unResolutions.passingThreshold}). ` +
        `Resolution ${passed ? 'PASSED' : 'FAILED'}.`,
    };
  }

  /**
   * Compute the expiry turn for a resolution based on its type.
   *
   * @param input.resolutionType - Type of resolution.
   * @param input.enactedTurn    - Turn the resolution was enacted.
   * @returns Expiry turn and duration. @see FR-703
   */
  computeResolutionExpiry(input: {
    resolutionType: UNResolutionType;
    enactedTurn: TurnNumber;
  }): ResolutionExpiryResult {
    const { resolutionType, enactedTurn } = input;
    const durationTurns = this.getDurationForType(resolutionType);
    const expiryTurn = ((enactedTurn as number) + durationTurns) as TurnNumber;

    return {
      expiryTurn,
      durationTurns,
      reason:
        `${resolutionType} resolution enacted on turn ${enactedTurn as number} ` +
        `expires on turn ${expiryTurn as number} (duration=${durationTurns} turns).`,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Clamp a value to the 0–100 range. */
  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  /**
   * Look up the difficulty multiplier set for a given difficulty level.
   * Falls back to 'balanced' if the level is somehow unrecognised.
   */
  private getMultipliersForDifficulty(
    difficulty: AIDifficultyLevel,
  ): (typeof GAME_CONFIG.aiDifficulty)[keyof typeof GAME_CONFIG.aiDifficulty] {
    switch (difficulty) {
      case AIDifficultyLevelEnum.Cautious:
        return this.cfg.aiDifficulty.cautious;
      case AIDifficultyLevelEnum.Aggressive:
        return this.cfg.aiDifficulty.aggressive;
      case AIDifficultyLevelEnum.Balanced:
      default:
        return this.cfg.aiDifficulty.balanced;
    }
  }

  /** Get the duration (in turns) for a given resolution type. */
  private getDurationForType(resolutionType: UNResolutionType): number {
    switch (resolutionType) {
      case UNResolutionTypeEnum.Sanctions:
        return this.cfg.unResolutions.sanctions.durationTurns;
      case UNResolutionTypeEnum.Peacekeeping:
        return this.cfg.unResolutions.peacekeeping.durationTurns;
      case UNResolutionTypeEnum.Condemnation:
        return this.cfg.unResolutions.condemnation.durationTurns;
      default:
        return 0;
    }
  }

  /**
   * Build resolution effects for a given type.
   * Non-applicable fields default to 0.
   */
  private buildEffects(resolutionType: UNResolutionType): ResolutionEffects {
    const base = this.emptyEffects();

    switch (resolutionType) {
      case UNResolutionTypeEnum.Sanctions:
        return {
          ...base,
          gdpGrowthPenalty: this.cfg.unResolutions.sanctions.gdpGrowthPenalty,
          tradeReduction: this.cfg.unResolutions.sanctions.tradeReduction,
          legitimacyPenalty: this.cfg.unResolutions.sanctions.legitimacyPenalty,
        };
      case UNResolutionTypeEnum.Peacekeeping:
        return {
          ...base,
          stabilityBonus: this.cfg.unResolutions.peacekeeping.stabilityBonus,
          civilUnrestReduction:
            this.cfg.unResolutions.peacekeeping.civilUnrestReduction,
          diCostToProposer:
            this.cfg.unResolutions.peacekeeping.diCostToProposer,
        };
      case UNResolutionTypeEnum.Condemnation:
        return {
          ...base,
          legitimacyPenalty:
            this.cfg.unResolutions.condemnation.legitimacyPenalty,
          diPenalty: this.cfg.unResolutions.condemnation.diPenalty,
        };
      default:
        return base;
    }
  }

  /** Return an effects object with all fields set to 0. */
  private emptyEffects(): ResolutionEffects {
    return {
      gdpGrowthPenalty: 0,
      tradeReduction: 0,
      stabilityBonus: 0,
      civilUnrestReduction: 0,
      legitimacyPenalty: 0,
      diPenalty: 0,
      diCostToProposer: 0,
    };
  }
}
