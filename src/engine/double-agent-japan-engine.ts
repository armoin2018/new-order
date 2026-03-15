/**
 * Double Agent & Japan Latent Nuclear Engine
 *
 * Handles two distinct but thematically linked subsystems:
 *
 * 1. **Double Agent Operations** (FR-906) — detect rival-recruited assets,
 *    attempt to turn them, feed disinformation (ghost units + false pacts),
 *    and handle diplomatic fallout from expulsion.
 *
 * 2. **Japan Latent Nuclear Program** (FR-1007) — 6-turn R&D pipeline,
 *    Constitutional Amendment gate, nuclear activation with cascading
 *    Stability −25, DI −30, and increased nuclear thresholds for China
 *    and DPRK.
 *
 * Pure functions — no side effects, no mutation of input, no Math.random.
 *
 * @see FR-906  — Double agent operations
 * @see FR-1007 — Japan latent nuclear capability
 */

import type {
  TurnNumber,
  DoubleAgentStatus,
  JapanNuclearPhase,
} from '@/data/types';
import {
  DoubleAgentStatus as DoubleAgentStatusEnum,
  JapanNuclearPhase as JapanNuclearPhaseEnum,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number between `min` and `max` (inclusive). */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// ---------------------------------------------------------------------------
// Exported Config Type
// ---------------------------------------------------------------------------

/**
 * Configuration shape consumed by the engine — derived from
 * `GAME_CONFIG.doubleAgent` and `GAME_CONFIG.military.japanLatentNuclear`.
 *
 * @see FR-906
 * @see FR-1007
 */
export type DoubleAgentJapanConfig = {
  doubleAgent: typeof GAME_CONFIG.doubleAgent;
  japanLatentNuclear: typeof GAME_CONFIG.military.japanLatentNuclear;
};

// ---------------------------------------------------------------------------
// Result Interfaces
// ---------------------------------------------------------------------------

/**
 * Result of evaluating whether a rival-recruited double agent has been
 * detected by the player's counter-intelligence apparatus.
 *
 * @see FR-906
 */
export interface DetectionResult {
  /** Whether the rival asset was detected. */
  detected: boolean;
  /** Computed detection probability (0–1). */
  detectionProbability: number;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Result of attempting to turn a detected double agent into a
 * player-controlled asset.
 *
 * @see FR-906
 */
export interface TurnAttemptResult {
  /** Whether the turn attempt succeeded. */
  success: boolean;
  /** Computed turn probability (0–1). */
  turnProbability: number;
  /** New status of the double agent after the attempt. */
  newStatus: DoubleAgentStatus;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Result of computing the ongoing disinformation campaign fed through
 * a turned double agent.
 *
 * @see FR-906
 */
export interface DisinformationResult {
  /** Whether disinformation is still being actively injected. */
  active: boolean;
  /** Number of ghost (phantom) units injected this turn. */
  ghostUnitsInjected: number;
  /** Number of false pacts injected this turn. */
  falsePactsInjected: number;
  /** Turns remaining in the disinformation campaign. */
  remainingTurns: number;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Result of expelling a detected double agent — diplomatic fallout.
 *
 * @see FR-906
 */
export interface ExpulsionResult {
  /** Increase in bilateral tension from the expulsion. */
  tensionIncrease: number;
  /** Status after expulsion. */
  newStatus: DoubleAgentStatus;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Result of advancing Japan's latent nuclear R&D pipeline by one turn.
 *
 * @see FR-1007
 */
export interface NuclearRnDResult {
  /** Phase after this turn's advancement. */
  newPhase: JapanNuclearPhase;
  /** Total turns of R&D completed so far. */
  turnsCompleted: number;
  /** Turns remaining until R&D is finished. */
  turnsRemaining: number;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Result of evaluating whether Japan's Constitutional Amendment passes,
 * gating the transition from AmendmentPending to Active nuclear status.
 *
 * @see FR-1007
 */
export interface AmendmentResult {
  /** Whether the amendment passed. */
  passed: boolean;
  /** Phase after evaluation. */
  newPhase: JapanNuclearPhase;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/**
 * Cascade effects triggered when Japan's nuclear program becomes Active.
 * These penalties and threshold changes are applied to the wider game state.
 *
 * @see FR-1007
 */
export interface NuclearCascadeResult {
  /** Stability penalty applied to Japan. */
  stabilityPenalty: number;
  /** Diplomatic Influence penalty applied to Japan. */
  diPenalty: number;
  /** Nuclear threshold increase applied to China. */
  chinaNuclearThresholdIncrease: number;
  /** Nuclear threshold increase applied to DPRK. */
  dprkNuclearThresholdIncrease: number;
  /** Human-readable explanation of the cascade effects. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that evaluates double agent operations and Japan's
 * latent nuclear program each turn.
 *
 * All public methods are pure — they return new objects and never mutate
 * their inputs. Config is injectable via the constructor; defaults to the
 * relevant slices of `GAME_CONFIG`.
 *
 * @see FR-906  — Double agent operations
 * @see FR-1007 — Japan latent nuclear capability
 */
export class DoubleAgentJapanEngine {
  private readonly cfg: DoubleAgentJapanConfig;

  constructor(config?: DoubleAgentJapanConfig) {
    this.cfg = config ?? {
      doubleAgent: GAME_CONFIG.doubleAgent,
      japanLatentNuclear: GAME_CONFIG.military.japanLatentNuclear,
    };
  }

  // -----------------------------------------------------------------------
  // Double Agent Operations (FR-906)
  // -----------------------------------------------------------------------

  /**
   * Evaluate whether a rival-recruited double agent has been detected.
   *
   * Detection probability is `counterIntelScore × detectionMultiplier`.
   * The check is deterministic: detected when probability ≥ 0.5.
   *
   * @param input.counterIntelScore  The player's counter-intelligence score (0–100).
   * @param input.rivalAssetPresent  Whether a rival asset currently exists.
   * @param input.currentTurn        Current game turn.
   * @returns Detection outcome with probability and explanation.
   *
   * @see FR-906
   */
  evaluateDetection(input: {
    counterIntelScore: number;
    rivalAssetPresent: boolean;
    currentTurn: TurnNumber;
  }): DetectionResult {
    const { counterIntelScore, rivalAssetPresent, currentTurn } = input;
    const { detectionMultiplier } = this.cfg.doubleAgent;

    if (!rivalAssetPresent) {
      return {
        detected: false,
        detectionProbability: 0,
        reason: `Turn ${currentTurn as number}: No rival asset present — detection not applicable.`,
      };
    }

    const probability = clamp(counterIntelScore * detectionMultiplier, 0, 1);
    const detected = probability >= 0.5;

    return {
      detected,
      detectionProbability: probability,
      reason: detected
        ? `Turn ${currentTurn as number}: Rival asset detected (probability ${probability.toFixed(3)} ≥ 0.5, counterIntel=${counterIntelScore}).`
        : `Turn ${currentTurn as number}: Rival asset not detected (probability ${probability.toFixed(3)} < 0.5, counterIntel=${counterIntelScore}).`,
    };
  }

  /**
   * Attempt to turn a detected double agent into a player-controlled asset.
   *
   * Requires `counterIntelScore ≥ minCounterIntelToTurn`. Turn probability
   * is `turnSuccessBase + max(0, covertScore − 50) × covertBonusPerPoint`.
   * The check is deterministic: success when probability ≥ 0.6.
   *
   * @param input.counterIntelScore  The player's counter-intelligence score (0–100).
   * @param input.covertScore        The player's covert operations score (0–100).
   * @param input.currentTurn        Current game turn.
   * @returns Turn attempt outcome with probability, new status, and explanation.
   *
   * @see FR-906
   */
  evaluateTurnAttempt(input: {
    counterIntelScore: number;
    covertScore: number;
    currentTurn: TurnNumber;
  }): TurnAttemptResult {
    const { counterIntelScore, covertScore, currentTurn } = input;
    const {
      minCounterIntelToTurn,
      turnSuccessBase,
      covertBonusPerPoint,
    } = this.cfg.doubleAgent;

    if (counterIntelScore < minCounterIntelToTurn) {
      return {
        success: false,
        turnProbability: 0,
        newStatus: DoubleAgentStatusEnum.Detected,
        reason: `Turn ${currentTurn as number}: Counter-intel score ${counterIntelScore} below minimum ${minCounterIntelToTurn} — cannot attempt to turn agent.`,
      };
    }

    const covertBonus = Math.max(0, covertScore - 50) * covertBonusPerPoint;
    const probability = clamp(turnSuccessBase + covertBonus, 0, 1);
    const success = probability >= 0.6;

    return {
      success,
      turnProbability: probability,
      newStatus: success
        ? DoubleAgentStatusEnum.Turned
        : DoubleAgentStatusEnum.Expelled,
      reason: success
        ? `Turn ${currentTurn as number}: Agent turned successfully (probability ${probability.toFixed(3)} ≥ 0.6, covert=${covertScore}).`
        : `Turn ${currentTurn as number}: Turn attempt failed — agent expelled (probability ${probability.toFixed(3)} < 0.6, covert=${covertScore}).`,
    };
  }

  /**
   * Compute ongoing disinformation injected through a turned double agent.
   *
   * While `turnsActive < disinformationDurationTurns`, ghost units and
   * false pacts are injected each turn. Once the duration expires the
   * campaign goes inactive.
   *
   * @param input.turnsActive  Number of turns the disinformation campaign has been running.
   * @param input.currentTurn  Current game turn.
   * @returns Disinformation outcome with injected counts and remaining turns.
   *
   * @see FR-906
   */
  computeDisinformation(input: {
    turnsActive: number;
    currentTurn: TurnNumber;
  }): DisinformationResult {
    const { turnsActive, currentTurn } = input;
    const {
      disinformationDurationTurns,
      ghostUnitsPerTurn,
      falsePactsPerTurn,
    } = this.cfg.doubleAgent;

    if (turnsActive >= disinformationDurationTurns) {
      return {
        active: false,
        ghostUnitsInjected: 0,
        falsePactsInjected: 0,
        remainingTurns: 0,
        reason: `Turn ${currentTurn as number}: Disinformation campaign expired after ${disinformationDurationTurns} turns.`,
      };
    }

    const remainingTurns = disinformationDurationTurns - turnsActive;

    return {
      active: true,
      ghostUnitsInjected: ghostUnitsPerTurn,
      falsePactsInjected: falsePactsPerTurn,
      remainingTurns,
      reason: `Turn ${currentTurn as number}: Disinformation active — injecting ${ghostUnitsPerTurn} ghost units and ${falsePactsPerTurn} false pacts (${remainingTurns} turns remaining).`,
    };
  }

  /**
   * Evaluate the diplomatic fallout from expelling a double agent.
   *
   * Returns the configured tension increase and sets status to Expelled.
   *
   * @param input.currentTurn  Current game turn.
   * @returns Expulsion outcome with tension increase and new status.
   *
   * @see FR-906
   */
  evaluateExpulsion(input: {
    currentTurn: TurnNumber;
  }): ExpulsionResult {
    const { currentTurn } = input;
    const { expulsionTensionIncrease } = this.cfg.doubleAgent;

    return {
      tensionIncrease: expulsionTensionIncrease,
      newStatus: DoubleAgentStatusEnum.Expelled,
      reason: `Turn ${currentTurn as number}: Double agent expelled — bilateral tension increased by ${expulsionTensionIncrease}.`,
    };
  }

  // -----------------------------------------------------------------------
  // Japan Latent Nuclear Program (FR-1007)
  // -----------------------------------------------------------------------

  /**
   * Advance Japan's latent nuclear R&D pipeline by one turn.
   *
   * - **Dormant → RnDInProgress**: begins the pipeline at `turnsCompleted = 1`.
   * - **RnDInProgress**: increments `turnsCompleted`; when
   *   `turnsCompleted ≥ rdTurns` transitions to **AmendmentPending**.
   * - Other phases are no-ops (program already past R&D).
   *
   * @param input.currentPhase    Current nuclear development phase.
   * @param input.turnsCompleted  R&D turns completed so far.
   * @param input.currentTurn     Current game turn.
   * @returns Updated phase, turns completed, turns remaining, and explanation.
   *
   * @see FR-1007
   */
  advanceNuclearRnD(input: {
    currentPhase: JapanNuclearPhase;
    turnsCompleted: number;
    currentTurn: TurnNumber;
  }): NuclearRnDResult {
    const { currentPhase, turnsCompleted, currentTurn } = input;
    const { rdTurns } = this.cfg.japanLatentNuclear;

    if (currentPhase === JapanNuclearPhaseEnum.Dormant) {
      const newTurnsCompleted = 1;
      const turnsRemaining = rdTurns - newTurnsCompleted;
      return {
        newPhase: JapanNuclearPhaseEnum.RnDInProgress,
        turnsCompleted: newTurnsCompleted,
        turnsRemaining,
        reason: `Turn ${currentTurn as number}: Japan begins nuclear R&D — 1/${rdTurns} turns completed (${turnsRemaining} remaining).`,
      };
    }

    if (currentPhase === JapanNuclearPhaseEnum.RnDInProgress) {
      const newTurnsCompleted = turnsCompleted + 1;

      if (newTurnsCompleted >= rdTurns) {
        return {
          newPhase: JapanNuclearPhaseEnum.AmendmentPending,
          turnsCompleted: newTurnsCompleted,
          turnsRemaining: 0,
          reason: `Turn ${currentTurn as number}: Japan completes nuclear R&D (${newTurnsCompleted}/${rdTurns}) — Constitutional Amendment now pending.`,
        };
      }

      const turnsRemaining = rdTurns - newTurnsCompleted;
      return {
        newPhase: JapanNuclearPhaseEnum.RnDInProgress,
        turnsCompleted: newTurnsCompleted,
        turnsRemaining,
        reason: `Turn ${currentTurn as number}: Japan nuclear R&D progresses — ${newTurnsCompleted}/${rdTurns} turns completed (${turnsRemaining} remaining).`,
      };
    }

    // AmendmentPending, Active, or Failed — no R&D advancement applicable.
    return {
      newPhase: currentPhase,
      turnsCompleted,
      turnsRemaining: 0,
      reason: `Turn ${currentTurn as number}: Japan nuclear program in phase "${currentPhase}" — R&D advancement not applicable.`,
    };
  }

  /**
   * Evaluate whether Japan's Constitutional Amendment passes.
   *
   * Only valid when `currentPhase === AmendmentPending`. The amendment
   * passes if `currentStability ≥ amendmentStabilityThreshold`, advancing
   * the program to **Active**. Otherwise the program transitions to
   * **Failed**.
   *
   * @param input.currentStability  Japan's current stability score (0–100).
   * @param input.currentPhase      Current nuclear development phase.
   * @param input.currentTurn       Current game turn.
   * @returns Whether the amendment passed, new phase, and explanation.
   *
   * @see FR-1007
   */
  evaluateConstitutionalAmendment(input: {
    currentStability: number;
    currentPhase: JapanNuclearPhase;
    currentTurn: TurnNumber;
  }): AmendmentResult {
    const { currentStability, currentPhase, currentTurn } = input;
    const { amendmentStabilityThreshold } = this.cfg.japanLatentNuclear;

    if (currentPhase !== JapanNuclearPhaseEnum.AmendmentPending) {
      return {
        passed: false,
        newPhase: currentPhase,
        reason: `Turn ${currentTurn as number}: Constitutional Amendment not applicable — phase is "${currentPhase}", expected "AmendmentPending".`,
      };
    }

    if (currentStability >= amendmentStabilityThreshold) {
      return {
        passed: true,
        newPhase: JapanNuclearPhaseEnum.Active,
        reason: `Turn ${currentTurn as number}: Constitutional Amendment passed (stability ${currentStability} ≥ ${amendmentStabilityThreshold}) — Japan's nuclear program is now Active.`,
      };
    }

    return {
      passed: false,
      newPhase: JapanNuclearPhaseEnum.Failed,
      reason: `Turn ${currentTurn as number}: Constitutional Amendment failed (stability ${currentStability} < ${amendmentStabilityThreshold}) — Japan's nuclear program has Failed.`,
    };
  }

  /**
   * Compute cascade effects when Japan's nuclear program becomes Active.
   *
   * Returns stability and DI penalties for Japan, plus nuclear threshold
   * increases for China and DPRK. These values are applied by the caller
   * to the wider game state.
   *
   * @param input.currentTurn  Current game turn.
   * @returns All cascade penalties and threshold increases with explanation.
   *
   * @see FR-1007
   */
  computeNuclearCascade(input: {
    currentTurn: TurnNumber;
  }): NuclearCascadeResult {
    const { currentTurn } = input;
    const {
      stabilityPenalty,
      diPenalty,
      chinaNuclearThresholdIncrease,
      dprkNuclearThresholdIncrease,
    } = this.cfg.japanLatentNuclear;

    return {
      stabilityPenalty,
      diPenalty,
      chinaNuclearThresholdIncrease,
      dprkNuclearThresholdIncrease,
      reason: `Turn ${currentTurn as number}: Japan nuclear cascade — Stability ${stabilityPenalty}, DI ${diPenalty}, China nuclear threshold +${chinaNuclearThresholdIncrease}, DPRK nuclear threshold +${dprkNuclearThresholdIncrease}.`,
    };
  }
}
