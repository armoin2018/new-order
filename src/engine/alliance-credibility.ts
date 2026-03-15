/**
 * Alliance Credibility Engine
 * @see FR-702 — Tracks faction credibility based on agreement adherence,
 * applies breach penalties, passive recovery, and acceptance modifiers.
 * @module
 */

import { GAME_CONFIG } from '@/engine/config';
import { AgreementType } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const AT = AgreementType;

/* ------------------------------------------------------------------ */
/*  Exported Types                                                     */
/* ------------------------------------------------------------------ */

/** Credibility configuration derived from GAME_CONFIG. */
export type CredibilityConfig = typeof GAME_CONFIG.diplomacy.credibility;

/** Per-faction credibility tracking state. */
export interface CredibilityState {
  factionId: FactionId;
  /** Current credibility score (0–100). */
  credibility: number;
  /** Turn on which the faction last breached an agreement, or null. */
  lastBreachTurn: TurnNumber | null;
  /** Lifetime count of breaches committed by this faction. */
  totalBreaches: number;
  /** Immutable log of every breach event. */
  breachHistory: readonly BreachRecord[];
}

/** A single historical breach event. */
export interface BreachRecord {
  turn: TurnNumber;
  agreementType: AgreementType;
  targetFaction: FactionId;
  credibilityPenalty: number;
  diPenalty: number;
}

/** Input parameters for processing a breach. */
export interface BreachInput {
  breakingFaction: FactionId;
  targetFaction: FactionId;
  agreementType: AgreementType;
  currentTurn: TurnNumber;
}

/** Result returned after processing a breach. */
export interface BreachResult {
  newState: CredibilityState;
  credibilityPenalty: number;
  diPenalty: number;
  betrayedStabilityPenalty: number;
  record: BreachRecord;
}

/** Result returned after attempting passive recovery. */
export interface RecoveryResult {
  newState: CredibilityState;
  recovered: boolean;
  amount: number;
  reason: string;
}

/** Acceptance modifier computed from a credibility score. */
export interface AcceptanceModifier {
  credibilityModifier: number;
  isTrustedAlly: boolean;
  isAutoRejected: boolean;
  reason: string;
}

/** Input for a full-turn credibility update. */
export interface CredibilityTurnInput {
  states: readonly CredibilityState[];
  currentTurn: TurnNumber;
}

/** Result of a full-turn credibility update. */
export interface CredibilityTurnResult {
  updatedStates: CredibilityState[];
  recoveries: Array<{ factionId: FactionId; amount: number }>;
}

/* ------------------------------------------------------------------ */
/*  Credibility Tier Type                                              */
/* ------------------------------------------------------------------ */

/** Descriptive label for a credibility value. */
export type CredibilityTier =
  | 'pariah'
  | 'unreliable'
  | 'neutral'
  | 'reliable'
  | 'trusted';

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

/**
 * Pure-functional engine that manages per-faction credibility scores,
 * breach penalties, passive recovery, and diplomacy acceptance modifiers.
 *
 * @see FR-702
 */
export class AllianceCredibilityEngine {
  private readonly cfg: CredibilityConfig;

  constructor(config?: CredibilityConfig) {
    this.cfg = config ?? GAME_CONFIG.diplomacy.credibility;
  }

  /* ---------------------------------------------------------------- */
  /*  Static helpers                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * Create the initial credibility state for a faction.
   *
   * Credibility starts at `initialValue` (75) with no breach history.
   *
   * @see FR-702
   */
  static createInitialState(factionId: FactionId): CredibilityState {
    return {
      factionId,
      credibility: GAME_CONFIG.diplomacy.credibility.initialValue,
      lastBreachTurn: null,
      totalBreaches: 0,
      breachHistory: [],
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Breach Penalty Lookup                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Return the credibility penalty associated with breaching a given
   * agreement type.
   *
   * @see FR-702
   */
  getBreachPenalty(agreementType: AgreementType): number {
    switch (agreementType) {
      case AT.NAP:
        return this.cfg.napBreachPenalty;
      case AT.TradeDeal:
        return this.cfg.tradeDealBreachPenalty;
      case AT.DefensePact:
        return this.cfg.defensePactBreachPenalty;
      case AT.IntelSharing:
        return this.cfg.intelSharingBreachPenalty;
      default: {
        const _exhaustive: never = agreementType;
        return _exhaustive;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Breach Processing                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Process an agreement breach for a faction.
   *
   * 1. Determine the credibility penalty for the agreement type.
   * 2. Apply the penalty (clamped to [min, max]).
   * 3. Record the breach in an immutable history.
   * 4. Update `lastBreachTurn` and `totalBreaches`.
   * 5. Return a {@link BreachResult} with all penalties.
   *
   * @see FR-702
   */
  processBreach(state: CredibilityState, input: BreachInput): BreachResult {
    const credibilityPenalty = this.getBreachPenalty(input.agreementType);
    const diPenalty = this.cfg.breachDiPenalty;
    const betrayedStabilityPenalty = this.cfg.betrayedStabilityPenalty;

    const newCredibility = this.clamp(state.credibility + credibilityPenalty);

    const record: BreachRecord = {
      turn: input.currentTurn,
      agreementType: input.agreementType,
      targetFaction: input.targetFaction,
      credibilityPenalty,
      diPenalty,
    };

    const newState: CredibilityState = {
      factionId: state.factionId,
      credibility: newCredibility,
      lastBreachTurn: input.currentTurn,
      totalBreaches: state.totalBreaches + 1,
      breachHistory: [...state.breachHistory, record],
    };

    return {
      newState,
      credibilityPenalty,
      diPenalty,
      betrayedStabilityPenalty,
      record,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Passive Recovery                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Apply passive per-turn credibility recovery for a single faction.
   *
   * Recovery is granted only when:
   * - `lastBreachTurn` is `null` **or** `(currentTurn - lastBreachTurn)`
   *   exceeds `recoveryGracePeriod`.
   * - The faction's credibility is below `max`.
   *
   * If eligible, credibility increases by `passiveRecoveryPerTurn`
   * (clamped to max).
   *
   * @see FR-702
   */
  applyRecovery(
    state: CredibilityState,
    currentTurn: TurnNumber,
  ): RecoveryResult {
    /* Already at ceiling — nothing to recover. */
    if (state.credibility >= this.cfg.max) {
      return {
        newState: state,
        recovered: false,
        amount: 0,
        reason: 'Credibility already at maximum',
      };
    }

    /* Check grace-period eligibility. */
    if (state.lastBreachTurn !== null) {
      const turnsSinceBreach =
        (currentTurn as number) - (state.lastBreachTurn as number);

      if (turnsSinceBreach <= this.cfg.recoveryGracePeriod) {
        return {
          newState: state,
          recovered: false,
          amount: 0,
          reason: `Within grace period — ${this.cfg.recoveryGracePeriod - turnsSinceBreach} turn(s) remaining`,
        };
      }
    }

    /* Apply recovery. */
    const recoveryAmount = this.cfg.passiveRecoveryPerTurn;
    const newCredibility = this.clamp(state.credibility + recoveryAmount);
    const actualAmount = newCredibility - state.credibility;

    const newState: CredibilityState = {
      ...state,
      credibility: newCredibility,
    };

    return {
      newState,
      recovered: true,
      amount: actualAmount,
      reason: 'Passive recovery applied',
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Acceptance Modifier                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Calculate the diplomacy-acceptance modifier for a given credibility
   * score.
   *
   * - **Auto-rejected** (`≤ autoRejectThreshold`): modifier = -1.
   * - **Trusted ally** (`≥ trustedAllyThreshold`): modifier equals
   *   `trustedAllyAcceptanceBonus`.
   * - **Otherwise**: modifier = `(credibility - 50) × acceptanceMultiplierPerPoint`.
   *
   * @see FR-702
   */
  calculateAcceptanceModifier(credibility: number): AcceptanceModifier {
    if (credibility <= this.cfg.autoRejectThreshold) {
      return {
        credibilityModifier: -1,
        isTrustedAlly: false,
        isAutoRejected: true,
        reason: `Credibility ${credibility} is at or below auto-reject threshold (${this.cfg.autoRejectThreshold})`,
      };
    }

    if (credibility >= this.cfg.trustedAllyThreshold) {
      return {
        credibilityModifier: this.cfg.trustedAllyAcceptanceBonus,
        isTrustedAlly: true,
        isAutoRejected: false,
        reason: `Credibility ${credibility} meets trusted-ally threshold (${this.cfg.trustedAllyThreshold})`,
      };
    }

    const modifier =
      (credibility - 50) * this.cfg.acceptanceMultiplierPerPoint;

    return {
      credibilityModifier: modifier,
      isTrustedAlly: false,
      isAutoRejected: false,
      reason: `Credibility ${credibility} yields modifier ${modifier.toFixed(4)}`,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Turn Processing                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Process a full turn for all factions: apply passive recovery to
   * every {@link CredibilityState} and collect the results.
   *
   * @see FR-702
   */
  processTurn(input: CredibilityTurnInput): CredibilityTurnResult {
    const updatedStates: CredibilityState[] = [];
    const recoveries: Array<{ factionId: FactionId; amount: number }> = [];

    for (const state of input.states) {
      const result = this.applyRecovery(state, input.currentTurn);
      updatedStates.push(result.newState);

      if (result.recovered) {
        recoveries.push({
          factionId: state.factionId,
          amount: result.amount,
        });
      }
    }

    return { updatedStates, recoveries };
  }

  /* ---------------------------------------------------------------- */
  /*  Quick Queries                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Return `true` if the given credibility score is at or below the
   * auto-reject threshold.
   *
   * @see FR-702
   */
  isAutoRejected(credibility: number): boolean {
    return credibility <= this.cfg.autoRejectThreshold;
  }

  /**
   * Return `true` if the given credibility score meets or exceeds the
   * trusted-ally threshold.
   *
   * @see FR-702
   */
  isTrustedAlly(credibility: number): boolean {
    return credibility >= this.cfg.trustedAllyThreshold;
  }

  /**
   * Return a human-readable tier label for a credibility score.
   *
   * | Range   | Tier         |
   * |---------|--------------|
   * | 0–20    | `pariah`     |
   * | 21–40   | `unreliable` |
   * | 41–60   | `neutral`    |
   * | 61–80   | `reliable`   |
   * | 81–100  | `trusted`    |
   *
   * @see FR-702
   */
  getCredibilityTier(credibility: number): CredibilityTier {
    if (credibility <= 20) return 'pariah';
    if (credibility <= 40) return 'unreliable';
    if (credibility <= 60) return 'neutral';
    if (credibility <= 80) return 'reliable';
    return 'trusted';
  }

  /* ---------------------------------------------------------------- */
  /*  Private Helpers                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Clamp a value to the configured [min, max] range.
   *
   * @see FR-702
   */
  private clamp(value: number): number {
    return Math.max(this.cfg.min, Math.min(this.cfg.max, value));
  }
}
