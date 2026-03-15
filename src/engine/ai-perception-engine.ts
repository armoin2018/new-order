/**
 * AI Perception Engine — New Order
 *
 * Implements the AI perception model of the player-leader and the
 * expanded 8-faction AI profile system. AI leaders maintain a running
 * accuracy estimate of the player's psychological profile. Consistent
 * player behaviour lets AI predict and counter-strategy; inconsistent
 * behaviour degrades AI accuracy, making rivals less predictable.
 *
 * All methods are pure functions that return new objects; no side effects.
 *
 * @see FR-1204 — AI Perception Model of Player-Leader
 * @see FR-300  — 8-Faction AI Profile System (expanded)
 */

import type {
  LeaderPsychology,
  PowerBase,
} from '@/data/types';
import {
  FactionId,
  DecisionStyle,
  StressResponse,
} from '@/data/types';
import type { LeaderId } from '@/data/types';
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
 * Configuration shape for AI perception parameters.
 * Derived from the runtime `GAME_CONFIG.leaderCreation` object.
 *
 * @see FR-1204
 */
export type AiPerceptionConfig = typeof GAME_CONFIG.leaderCreation;

/**
 * A single AI faction's perception accuracy of the player-leader.
 *
 * @see FR-1204
 */
export interface AiPerceptionEntry {
  /** The AI faction maintaining this perception. */
  readonly factionId: FactionId;
  /** Current accuracy of this faction's perception model (0–100). */
  readonly accuracy: number;
  /** Number of perception updates applied since initialisation. */
  readonly updatesApplied: number;
}

/**
 * Aggregate perception state across all AI factions for a single
 * player-leader target.
 *
 * @see FR-1204
 */
export interface AiPerceptionState {
  /** The player-leader being perceived. */
  readonly targetLeaderId: LeaderId;
  /** Per-faction perception entries. */
  readonly perceptions: ReadonlyArray<AiPerceptionEntry>;
  /** Running total of consistent actions taken by the player. */
  readonly totalConsistentActions: number;
  /** Running total of inconsistent actions taken by the player. */
  readonly totalInconsistentActions: number;
}

/**
 * Result of evaluating whether a counter-strategy bonus applies.
 *
 * @see FR-1204
 */
export interface CounterStrategyResult {
  /** Whether the counter-strategy bonus is currently active. */
  readonly active: boolean;
  /** The bonus multiplier applied (0 when inactive). */
  readonly bonus: number;
  /** The accuracy value used for evaluation. */
  readonly accuracy: number;
}

/**
 * What the AI "thinks" the player's psychological profile looks like
 * given its current perception accuracy.
 *
 * @see FR-1204
 */
export interface PerceivedProfileResult {
  /** The AI-perceived psychology — drifts toward neutral at low accuracy. */
  readonly perceivedPsychology: LeaderPsychology;
  /** The accuracy level used to compute this perception. */
  readonly accuracy: number;
  /** Average magnitude of drift across all numeric dimensions (0–100 scale). */
  readonly driftMagnitude: number;
}

/**
 * Hard-coded AI personality profile for a single faction, including
 * default psychology, power base, historical analog, and desperation
 * thresholds.
 *
 * @see FR-300
 */
export interface FactionAiProfile {
  /** Faction this profile belongs to. */
  readonly factionId: FactionId;
  /** Default psychological profile for this faction's AI leader. */
  readonly defaultPsychology: LeaderPsychology;
  /** Default domestic power base for this faction's AI leader. */
  readonly defaultPowerBase: PowerBase;
  /** Historical figure or archetype this AI personality echoes. */
  readonly historicalAnalog: string;
  /** Thresholds that trigger Desperation Mode for this faction. */
  readonly desperationThresholds: {
    /** Stability floor below which desperation activates. */
    readonly stabilityMin: number;
    /** Minimum power base sub-score below which desperation activates. */
    readonly powerBaseMin: number;
    /** Civil unrest ceiling above which desperation activates. */
    readonly civilUnrestMax: number;
  };
}

/**
 * Result of evaluating whether an AI leader has entered Desperation Mode.
 *
 * @see FR-300
 */
export interface DesperationModeResult {
  /** Whether the leader is currently in Desperation Mode. */
  readonly inDesperation: boolean;
  /** Human-readable descriptions of each trigger that fired. */
  readonly triggers: readonly string[];
  /** Additive psychology modifiers applied while in Desperation Mode. */
  readonly psychologyModifiers: {
    /** Change to risk tolerance (positive = more risk-seeking). */
    readonly riskToleranceDelta: number;
    /** Change to paranoia (positive = more paranoid). */
    readonly paranoiaDelta: number;
    /** Change to patience (negative = more impatient). */
    readonly patienceDelta: number;
  };
}

/**
 * Summary of how AI perception of the player has drifted from its
 * initial baseline over elapsed turns.
 *
 * @see FR-1204
 */
export interface PerceptionDriftSummary {
  /** Per-faction drift information. */
  readonly perFactionDrift: ReadonlyArray<{
    readonly factionId: FactionId;
    /** Absolute drift from initial accuracy (positive = degraded). */
    readonly drift: number;
    /** Current accuracy value. */
    readonly accuracy: number;
  }>;
  /** Mean absolute drift across all factions. */
  readonly averageDrift: number;
  /** Number of factions whose accuracy has dropped below 30 (critically low). */
  readonly criticallyLowCount: number;
  /** Number of turns elapsed since perception tracking began. */
  readonly turnsElapsed: number;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that evaluates AI perception of the player-leader
 * and provides expanded 8-faction AI personality profiles.
 *
 * Every public method is **pure**: no mutation of `this`, no
 * side effects, all results are freshly-allocated objects.
 *
 * @see FR-1204 — AI Perception Model of Player-Leader
 * @see FR-300  — 8-Faction AI Profile System (expanded)
 */
export class AiPerceptionEngine {
  /** Configuration snapshot — never mutated. */
  private readonly config: AiPerceptionConfig;

  /**
   * Create a new AiPerceptionEngine.
   *
   * @param config - Configuration containing `leaderCreation` section
   *                 (typically `GAME_CONFIG.leaderCreation`).
   */
  constructor(config: AiPerceptionConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // 1. initializePerception
  // ───────────────────────────────────────────────────────

  /**
   * Create the initial perception state for a player-leader as perceived
   * by all AI factions. Every AI faction starts at `initialAccuracy`.
   *
   * @param targetLeaderId - The player-leader being perceived.
   * @param allFactionIds  - All factions in the game (AI + player).
   * @returns A fresh {@link AiPerceptionState} with one entry per faction.
   *
   * @see FR-1204
   */
  initializePerception(
    targetLeaderId: LeaderId,
    allFactionIds: readonly FactionId[],
  ): AiPerceptionState {
    const initial = this.config.aiPerception.initialAccuracy;

    const perceptions: AiPerceptionEntry[] = allFactionIds.map(
      (factionId): AiPerceptionEntry => ({
        factionId,
        accuracy: initial,
        updatesApplied: 0,
      }),
    );

    return {
      targetLeaderId,
      perceptions,
      totalConsistentActions: 0,
      totalInconsistentActions: 0,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. updatePerceptionAccuracy
  // ───────────────────────────────────────────────────────

  /**
   * After the player takes an action, update every AI faction's perception
   * accuracy. Consistent actions recover accuracy; inconsistent actions
   * degrade it. Values are clamped to [minimumAccuracy, maximumAccuracy].
   *
   * @param currentState    - Current perception state.
   * @param actionConsistent - Whether the player's latest action was
   *                           consistent with their psychological profile.
   * @returns A new {@link AiPerceptionState} with updated accuracy values.
   *
   * @see FR-1204
   */
  updatePerceptionAccuracy(
    currentState: AiPerceptionState,
    actionConsistent: boolean,
  ): AiPerceptionState {
    const { aiPerception } = this.config;
    const delta = actionConsistent
      ? aiPerception.recoveryPerConsistency
      : -aiPerception.degradationPerInconsistency;

    const updatedPerceptions: AiPerceptionEntry[] = currentState.perceptions.map(
      (entry): AiPerceptionEntry => ({
        factionId: entry.factionId,
        accuracy: clamp(
          entry.accuracy + delta,
          aiPerception.minimumAccuracy,
          aiPerception.maximumAccuracy,
        ),
        updatesApplied: entry.updatesApplied + 1,
      }),
    );

    return {
      targetLeaderId: currentState.targetLeaderId,
      perceptions: updatedPerceptions,
      totalConsistentActions: currentState.totalConsistentActions + (actionConsistent ? 1 : 0),
      totalInconsistentActions: currentState.totalInconsistentActions + (actionConsistent ? 0 : 1),
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. evaluateCounterStrategyBonus
  // ───────────────────────────────────────────────────────

  /**
   * Determine whether a counter-strategy bonus applies for a given
   * perception accuracy. When accuracy exceeds 70, the AI receives a
   * multiplicative bonus defined by `highAccuracyCounterBonus`.
   *
   * @param accuracy - The AI faction's current perception accuracy (0–100).
   * @returns A {@link CounterStrategyResult} with bonus details.
   *
   * @see FR-1204
   */
  evaluateCounterStrategyBonus(accuracy: number): CounterStrategyResult {
    const threshold = 70;
    const active = accuracy > threshold;
    const bonus = active ? this.config.aiPerception.highAccuracyCounterBonus : 0;

    return {
      active,
      bonus,
      accuracy,
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. computePerceivedProfile
  // ───────────────────────────────────────────────────────

  /**
   * Given the actual player psychology and an AI faction's perception
   * accuracy, compute what the AI "thinks" the player's profile looks
   * like.
   *
   * At 100% accuracy the perceived profile equals the actual profile.
   * At lower accuracy, numeric dimensions drift toward 50 (neutral).
   *
   * **Drift formula**: `perceived = actual + (50 − actual) × (1 − accuracy / 100)`
   *
   * Non-numeric dimensions (decisionStyle, stressResponse) are preserved
   * as-is — the AI always knows the player's decision style.
   *
   * @param actualProfile - The player's real psychological profile.
   * @param accuracy      - The AI faction's current perception accuracy (0–100).
   * @returns A {@link PerceivedProfileResult} containing the perceived profile
   *          and magnitude of drift.
   *
   * @see FR-1204
   */
  computePerceivedProfile(
    actualProfile: LeaderPsychology,
    accuracy: number,
  ): PerceivedProfileResult {
    const driftFactor = 1 - accuracy / 100;

    const driftValue = (actual: number): number =>
      actual + (50 - actual) * driftFactor;

    const perceivedRiskTolerance = driftValue(actualProfile.riskTolerance);
    const perceivedParanoia = driftValue(actualProfile.paranoia);
    const perceivedNarcissism = driftValue(actualProfile.narcissism);
    const perceivedPragmatism = driftValue(actualProfile.pragmatism);
    const perceivedPatience = driftValue(actualProfile.patience);
    const perceivedVengefulIndex = driftValue(actualProfile.vengefulIndex);

    const perceivedPsychology: LeaderPsychology = {
      decisionStyle: actualProfile.decisionStyle,
      stressResponse: actualProfile.stressResponse,
      riskTolerance: perceivedRiskTolerance,
      paranoia: perceivedParanoia,
      narcissism: perceivedNarcissism,
      pragmatism: perceivedPragmatism,
      patience: perceivedPatience,
      vengefulIndex: perceivedVengefulIndex,
    };

    // Compute average absolute drift across all 6 numeric dimensions
    const drifts = [
      Math.abs(perceivedRiskTolerance - actualProfile.riskTolerance),
      Math.abs(perceivedParanoia - actualProfile.paranoia),
      Math.abs(perceivedNarcissism - actualProfile.narcissism),
      Math.abs(perceivedPragmatism - actualProfile.pragmatism),
      Math.abs(perceivedPatience - actualProfile.patience),
      Math.abs(perceivedVengefulIndex - actualProfile.vengefulIndex),
    ];
    const driftMagnitude = drifts.reduce((sum, d) => sum + d, 0) / drifts.length;

    return {
      perceivedPsychology,
      accuracy,
      driftMagnitude,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. buildFactionAiProfile
  // ───────────────────────────────────────────────────────

  /**
   * Return the hard-coded AI personality profile for one of the 8 factions.
   * Each profile encodes default psychology, power base, historical analog,
   * and desperation thresholds.
   *
   * @param factionId - The faction whose AI profile is requested.
   * @returns A complete {@link FactionAiProfile} for the faction.
   *
   * @see FR-300
   */
  buildFactionAiProfile(factionId: FactionId): FactionAiProfile {
    switch (factionId) {
      // ── United States ──────────────────────────────────
      case FactionId.US:
        return {
          factionId: FactionId.US,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Analytical,
            stressResponse: StressResponse.Escalate,
            riskTolerance: 55,
            paranoia: 40,
            narcissism: 50,
            pragmatism: 70,
            patience: 45,
            vengefulIndex: 45,
          },
          defaultPowerBase: {
            military: 75,
            oligarchs: 65,
            party: 55,
            clergy: 30,
            public: 60,
            securityServices: 70,
          },
          historicalAnalog: 'Strategic Realist',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── China ──────────────────────────────────────────
      case FactionId.China:
        return {
          factionId: FactionId.China,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Analytical,
            stressResponse: StressResponse.Consolidate,
            riskTolerance: 40,
            paranoia: 55,
            narcissism: 45,
            pragmatism: 65,
            patience: 85,
            vengefulIndex: 50,
          },
          defaultPowerBase: {
            military: 70,
            oligarchs: 60,
            party: 85,
            clergy: 10,
            public: 55,
            securityServices: 80,
          },
          historicalAnalog: 'Long Game Strategist',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── Russia ─────────────────────────────────────────
      case FactionId.Russia:
        return {
          factionId: FactionId.Russia,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Intuitive,
            stressResponse: StressResponse.Escalate,
            riskTolerance: 70,
            paranoia: 75,
            narcissism: 65,
            pragmatism: 50,
            patience: 35,
            vengefulIndex: 80,
          },
          defaultPowerBase: {
            military: 70,
            oligarchs: 75,
            party: 60,
            clergy: 40,
            public: 35,
            securityServices: 85,
          },
          historicalAnalog: 'Siege Mentality Strongman',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── Japan ──────────────────────────────────────────
      case FactionId.Japan:
        return {
          factionId: FactionId.Japan,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Analytical,
            stressResponse: StressResponse.Consolidate,
            riskTolerance: 25,
            paranoia: 35,
            narcissism: 30,
            pragmatism: 80,
            patience: 75,
            vengefulIndex: 20,
          },
          defaultPowerBase: {
            military: 55,
            oligarchs: 70,
            party: 60,
            clergy: 15,
            public: 65,
            securityServices: 50,
          },
          historicalAnalog: 'Defensive Modernizer',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── Iran ───────────────────────────────────────────
      case FactionId.Iran:
        return {
          factionId: FactionId.Iran,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Ideological,
            stressResponse: StressResponse.Deflect,
            riskTolerance: 55,
            paranoia: 70,
            narcissism: 55,
            pragmatism: 35,
            patience: 60,
            vengefulIndex: 70,
          },
          defaultPowerBase: {
            military: 60,
            oligarchs: 30,
            party: 50,
            clergy: 85,
            public: 30,
            securityServices: 75,
          },
          historicalAnalog: 'Revolutionary Guardian',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── DPRK ───────────────────────────────────────────
      case FactionId.DPRK:
        return {
          factionId: FactionId.DPRK,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Intuitive,
            stressResponse: StressResponse.Escalate,
            riskTolerance: 65,
            paranoia: 95,
            narcissism: 85,
            pragmatism: 25,
            patience: 30,
            vengefulIndex: 75,
          },
          defaultPowerBase: {
            military: 85,
            oligarchs: 20,
            party: 90,
            clergy: 5,
            public: 15,
            securityServices: 90,
          },
          historicalAnalog: 'Hereditary Survivalist',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── EU ─────────────────────────────────────────────
      case FactionId.EU:
        return {
          factionId: FactionId.EU,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Analytical,
            stressResponse: StressResponse.Consolidate,
            riskTolerance: 25,
            paranoia: 30,
            narcissism: 25,
            pragmatism: 75,
            patience: 80,
            vengefulIndex: 15,
          },
          defaultPowerBase: {
            military: 45,
            oligarchs: 60,
            party: 65,
            clergy: 20,
            public: 70,
            securityServices: 45,
          },
          historicalAnalog: 'Institutional Moderator',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      // ── Syria ──────────────────────────────────────────
      case FactionId.Syria:
        return {
          factionId: FactionId.Syria,
          defaultPsychology: {
            decisionStyle: DecisionStyle.Intuitive,
            stressResponse: StressResponse.Escalate,
            riskTolerance: 60,
            paranoia: 85,
            narcissism: 70,
            pragmatism: 30,
            patience: 20,
            vengefulIndex: 85,
          },
          defaultPowerBase: {
            military: 50,
            oligarchs: 40,
            party: 45,
            clergy: 35,
            public: 10,
            securityServices: 70,
          },
          historicalAnalog: 'Cornered Dictator',
          desperationThresholds: {
            stabilityMin: 20,
            powerBaseMin: 15,
            civilUnrestMax: 80,
          },
        };

      default: {
        const _exhaustive: never = factionId;
        return _exhaustive;
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // 6. evaluateDesperationMode
  // ───────────────────────────────────────────────────────

  /**
   * Determine whether an AI leader has entered Desperation Mode.
   *
   * Desperation Mode activates when **any** of these conditions are true:
   * - stability < 20
   * - any PowerBase sub-score < 15
   * - civilUnrest > 80
   *
   * While in Desperation Mode the leader's psychology is additively
   * modified: riskTolerance +30, paranoia +20, patience −30.
   *
   * @param powerBase   - The leader's current domestic power base.
   * @param stability   - Current national stability (0–100).
   * @param civilUnrest - Current civil unrest level (0–100).
   * @returns A {@link DesperationModeResult} with trigger info and modifiers.
   *
   * @see FR-300
   */
  evaluateDesperationMode(
    powerBase: PowerBase,
    stability: number,
    civilUnrest: number,
  ): DesperationModeResult {
    const triggers: string[] = [];

    if (stability < 20) {
      triggers.push('Stability below 20 (current: ' + String(stability) + ')');
    }

    if (civilUnrest > 80) {
      triggers.push('Civil unrest above 80 (current: ' + String(civilUnrest) + ')');
    }

    const powerBaseKeys: ReadonlyArray<keyof PowerBase> = [
      'military',
      'oligarchs',
      'party',
      'clergy',
      'public',
      'securityServices',
    ];

    for (const key of powerBaseKeys) {
      if (powerBase[key] < 15) {
        triggers.push(
          'PowerBase.' + key + ' below 15 (current: ' + String(powerBase[key]) + ')',
        );
      }
    }

    const inDesperation = triggers.length > 0;

    return {
      inDesperation,
      triggers,
      psychologyModifiers: {
        riskToleranceDelta: inDesperation ? 30 : 0,
        paranoiaDelta: inDesperation ? 20 : 0,
        patienceDelta: inDesperation ? -30 : 0,
      },
    };
  }

  // ───────────────────────────────────────────────────────
  // 7. computePerceptionDrift
  // ───────────────────────────────────────────────────────

  /**
   * Summarise how much each AI faction's perception of the player has
   * drifted from the initial accuracy baseline.
   *
   * Drift is measured as the absolute difference between the initial
   * accuracy and the current accuracy for each faction. Positive drift
   * indicates the AI's model has degraded.
   *
   * A faction is considered "critically low" if its accuracy is below 30.
   *
   * @param currentState  - Current perception state with per-faction accuracies.
   * @param turnsElapsed  - Number of turns since perception tracking began.
   * @returns A {@link PerceptionDriftSummary} with per-faction and aggregate metrics.
   *
   * @see FR-1204
   */
  computePerceptionDrift(
    currentState: AiPerceptionState,
    turnsElapsed: number,
  ): PerceptionDriftSummary {
    const initialAccuracy = this.config.aiPerception.initialAccuracy;
    const criticalThreshold = 30;

    let totalDrift = 0;
    let criticallyLowCount = 0;

    const perFactionDrift = currentState.perceptions.map((entry) => {
      const drift = Math.abs(initialAccuracy - entry.accuracy);
      totalDrift += drift;

      if (entry.accuracy < criticalThreshold) {
        criticallyLowCount += 1;
      }

      return {
        factionId: entry.factionId,
        drift,
        accuracy: entry.accuracy,
      };
    });

    const factionCount = currentState.perceptions.length;
    const averageDrift = factionCount > 0 ? totalDrift / factionCount : 0;

    return {
      perFactionDrift,
      averageDrift,
      criticallyLowCount,
      turnsElapsed,
    };
  }
}
