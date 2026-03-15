/**
 * @module MassPsychology
 * @description Mass Psychology Engine for New Order.
 *
 * Models population-level psychological dynamics — the collective emotional
 * state of a nation's citizenry and how it interacts with leader psychology,
 * ongoing conflicts, and national resilience.
 *
 * **Mass Psychology Index (FR-1517)** — Each nation tracks five population-
 * level dimensions: fear, anger, hope, war weariness, and nationalism. These
 * feed into civil unrest calculations, recruitment modifiers, treasury yields,
 * and desertion rates.
 *
 * **Emotional Contagion (FR-1518)** — Leader emotions bleed into the
 * population mood at a rate determined by regime type. Autocracies dampen
 * contagion (state media filters leader mood); democracies amplify it.
 * When leader and population diverge for several consecutive turns the
 * leader accumulates stress from the disconnect.
 *
 * **War Weariness (FR-1519)** — Active conflicts and grey-zone operations
 * steadily exhaust the population. High nationalism can resist some of the
 * accumulation, but once weariness crosses the effects threshold the nation
 * suffers civil-unrest bonuses, treasury cost inflation, and popularity decay.
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1517
 * @see FR-1518
 * @see FR-1519
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, LeaderId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

/**
 * Configuration shape for the psychology sub-system, derived from
 * `GAME_CONFIG.psychology`. Keeps the engine in sync with central config.
 *
 * @see FR-1517
 * @see FR-1518
 * @see FR-1519
 */
export type MassPsychConfig = typeof GAME_CONFIG.psychology;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Input for bidirectional emotional contagion between a leader and their
 * nation's population.
 *
 * @see FR-1518
 */
export interface ContagionInput {
  /** Faction whose population is being influenced. */
  readonly factionId: FactionId;
  /** The faction's current leader. */
  readonly leaderId: LeaderId;
  /** Leader's current emotional state. All values 0–100. */
  readonly leaderEmotions: {
    readonly fear: number;
    readonly anger: number;
    readonly stress: number;
    readonly confidence: number;
    readonly resolve: number;
  };
  /** Population's current mass-psychology dimensions. All values 0–100. */
  readonly massPsych: {
    readonly fear: number;
    readonly anger: number;
    readonly hope: number;
    readonly warWeariness: number;
    readonly nationalism: number;
  };
  /** Whether the faction's government is autocratic. */
  readonly isAutocracy: boolean;
  /** Consecutive turns the leader and population have diverged. */
  readonly turnsDiverged: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of the emotional contagion calculation.
 *
 * @see FR-1518
 */
export interface ContagionResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** Updated population mass-psychology dimensions after contagion. */
  readonly updatedMassPsych: {
    readonly fear: number;
    readonly anger: number;
    readonly hope: number;
    readonly warWeariness: number;
    readonly nationalism: number;
  };
  /** Stress increase on the leader from population divergence (0 if not applicable). */
  readonly leaderStressDelta: number;
  /** Effective contagion rate used for this calculation. */
  readonly contagionRate: number;
  /** Whether the leader and population currently diverge above the threshold. */
  readonly divergent: boolean;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

/**
 * Input for war-weariness accumulation and decay.
 *
 * @see FR-1519
 */
export interface WarWearinessInput {
  /** Faction whose war weariness is being evaluated. */
  readonly factionId: FactionId;
  /** Current war-weariness level (0–100). */
  readonly currentWarWeariness: number;
  /** Whether the faction is in an active armed conflict this turn. */
  readonly inActiveConflict: boolean;
  /** Whether the faction is engaged in grey-zone operations this turn. */
  readonly inGreyZoneOps: boolean;
  /** Current nationalism level of the population (0–100). */
  readonly currentNationalism: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of the war-weariness calculation.
 *
 * @see FR-1519
 */
export interface WarWearinessResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** War-weariness level before this calculation. */
  readonly previousWeariness: number;
  /** War-weariness level after this calculation (clamped 0–100). */
  readonly newWeariness: number;
  /** Raw change applied this turn. */
  readonly delta: number;
  /** Whether weariness exceeds the effects threshold and penalties are active. */
  readonly effectsActive: boolean;
  /** Civil-unrest modifier from war weariness (0 when below threshold). */
  readonly civilUnrestModifier: number;
  /** Treasury cost multiplier from war weariness (1.0 when below threshold). */
  readonly treasuryCostModifier: number;
  /** Popularity decay per turn from war weariness (0 when below threshold). */
  readonly popularityDecay: number;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

/**
 * Input for computing aggregate mass-psychology effects on national metrics.
 *
 * @see FR-1517
 */
export interface MassPsychEffectsInput {
  /** Faction being evaluated. */
  readonly factionId: FactionId;
  /** Population's current mass-psychology dimensions. All values 0–100. */
  readonly massPsych: {
    readonly fear: number;
    readonly anger: number;
    readonly hope: number;
    readonly warWeariness: number;
    readonly nationalism: number;
  };
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of the mass-psychology effects calculation.
 *
 * @see FR-1517
 */
export interface MassPsychEffectsResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** Net civil-unrest modifier from mass psychology. */
  readonly civilUnrestModifier: number;
  /** Net recruitment modifier from mass psychology. */
  readonly recruitmentModifier: number;
  /** Desertion rate from mass psychology (0 when weariness is below threshold). */
  readonly desertionRate: number;
  /** Net treasury modifier from mass psychology. */
  readonly treasuryModifier: number;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure-function engine for population-level mass-psychology mechanics.
 *
 * Provides three core computations:
 * 1. **Emotional contagion** — leader emotions bleeding into population mood.
 * 2. **War weariness** — accumulation from conflict, decay in peacetime.
 * 3. **Mass psychology effects** — aggregate impact on unrest, recruitment,
 *    desertion, and treasury.
 *
 * All methods are stateless; the caller is responsible for persisting results.
 *
 * @see FR-1517
 * @see FR-1518
 * @see FR-1519
 */
export class MassPsychologyEngine {
  private readonly cfg: MassPsychConfig;

  constructor(cfg: MassPsychConfig = GAME_CONFIG.psychology) {
    this.cfg = cfg;
  }

  // -----------------------------------------------------------------------
  // FR-1518 — Emotional Contagion
  // -----------------------------------------------------------------------

  /**
   * Compute the emotional contagion between a leader and their population.
   *
   * Leader emotions map to population dimensions as follows:
   * - leader.fear → population.fear
   * - leader.anger → population.anger
   * - leader.confidence → population.hope
   * - leader.resolve → population.nationalism
   *
   * War weariness is **not** affected by contagion (separate mechanic).
   *
   * Divergence check: if the average absolute difference between leader and
   * population on the shared dimensions (fear, anger) exceeds the configured
   * threshold for the required number of consecutive turns, the leader incurs
   * a per-turn stress penalty.
   *
   * @param input - Current leader/population emotional state.
   * @returns Updated population psychology, stress delta, and divergence info.
   * @see FR-1518
   */
  computeContagion(input: ContagionInput): ContagionResult {
    const ec = this.cfg.emotionalContagion;
    const { leaderEmotions, massPsych, isAutocracy, turnsDiverged, factionId } = input;

    // Effective contagion rate: regime-type factor × base rate
    const regimeFactor = isAutocracy
      ? ec.autocracyContagionRate
      : ec.democracyContagionRate;
    const rate = ec.leaderToPopulationRate * regimeFactor;

    // Shift population dimensions toward leader emotions
    const newFear = MassPsychologyEngine.clamp(
      massPsych.fear + (leaderEmotions.fear - massPsych.fear) * rate,
      0,
      100,
    );
    const newAnger = MassPsychologyEngine.clamp(
      massPsych.anger + (leaderEmotions.anger - massPsych.anger) * rate,
      0,
      100,
    );
    const newHope = MassPsychologyEngine.clamp(
      massPsych.hope + (leaderEmotions.confidence - massPsych.hope) * rate,
      0,
      100,
    );
    const newNationalism = MassPsychologyEngine.clamp(
      massPsych.nationalism + (leaderEmotions.resolve - massPsych.nationalism) * rate,
      0,
      100,
    );

    // War weariness is untouched by contagion
    const newWarWeariness = massPsych.warWeariness;

    // Divergence check (fear + anger average absolute difference)
    const fearDiff = Math.abs(leaderEmotions.fear - newFear);
    const angerDiff = Math.abs(leaderEmotions.anger - newAnger);
    const avgDivergence = (fearDiff + angerDiff) / 2;
    const divergent = avgDivergence > ec.populationDivergenceThreshold;

    const leaderStressDelta =
      divergent && turnsDiverged >= ec.divergenceTurns
        ? ec.stressPenaltyPerTurn
        : 0;

    const reasons: string[] = [];
    reasons.push(`Contagion rate ${rate.toFixed(3)} (${isAutocracy ? 'autocracy' : 'democracy'})`);
    if (divergent) {
      reasons.push(
        `Divergence ${avgDivergence.toFixed(1)} > ${ec.populationDivergenceThreshold} threshold`,
      );
      if (leaderStressDelta > 0) {
        reasons.push(
          `Leader stress +${leaderStressDelta} (diverged ${turnsDiverged}/${ec.divergenceTurns} turns)`,
        );
      }
    }

    return {
      factionId,
      updatedMassPsych: {
        fear: newFear,
        anger: newAnger,
        hope: newHope,
        warWeariness: newWarWeariness,
        nationalism: newNationalism,
      },
      leaderStressDelta,
      contagionRate: rate,
      divergent,
      reason: reasons.join('; '),
    };
  }

  // -----------------------------------------------------------------------
  // FR-1519 — War Weariness
  // -----------------------------------------------------------------------

  /**
   * Compute the war-weariness delta for a single turn.
   *
   * Active conflict and grey-zone operations accumulate weariness; peacetime
   * decays it. High nationalism partially resists positive-delta accumulation.
   * When weariness crosses the effects threshold the nation suffers civil-
   * unrest bonuses, treasury-cost inflation, and popularity decay.
   *
   * @param input - Current weariness state and conflict flags.
   * @returns Updated weariness, delta breakdown, and downstream effects.
   * @see FR-1519
   */
  computeWarWeariness(input: WarWearinessInput): WarWearinessResult {
    const ww = this.cfg.warWeariness;
    const { factionId, currentWarWeariness, inActiveConflict, inGreyZoneOps, currentNationalism } = input;

    let delta = 0;

    if (inActiveConflict) {
      delta += ww.activeConflictPerTurn;
    } else if (inGreyZoneOps) {
      delta += ww.greyZonePerTurn;
    } else {
      delta += ww.peacetimeDecayPerTurn;
    }

    // High nationalism resists weariness accumulation (only when delta > 0)
    if (currentNationalism >= ww.nationalismResistanceThreshold && delta > 0) {
      delta += ww.nationalismResistanceReduction;
    }

    const newWeariness = MassPsychologyEngine.clamp(currentWarWeariness + delta, 0, 100);
    const effectsActive = newWeariness > ww.effectsThreshold;

    const civilUnrestModifier = effectsActive ? ww.civilUnrestBonus : 0;
    const treasuryCostModifier = effectsActive ? ww.treasuryCostMultiplier : 1.0;
    const popularityDecay = effectsActive ? ww.popularityDecayPerTurn : 0;

    const reasons: string[] = [];
    if (inActiveConflict) {
      reasons.push(`Active conflict +${ww.activeConflictPerTurn}`);
    } else if (inGreyZoneOps) {
      reasons.push(`Grey-zone ops +${ww.greyZonePerTurn}`);
    } else {
      reasons.push(`Peacetime decay ${ww.peacetimeDecayPerTurn}`);
    }
    if (currentNationalism >= ww.nationalismResistanceThreshold && delta > 0) {
      reasons.push(`Nationalism resistance ${ww.nationalismResistanceReduction}`);
    }
    if (effectsActive) {
      reasons.push(`Effects active (weariness ${newWeariness} > ${ww.effectsThreshold})`);
    }

    return {
      factionId,
      previousWeariness: currentWarWeariness,
      newWeariness,
      delta,
      effectsActive,
      civilUnrestModifier,
      treasuryCostModifier,
      popularityDecay,
      reason: reasons.join('; '),
    };
  }

  // -----------------------------------------------------------------------
  // FR-1517 — Mass Psychology Effects
  // -----------------------------------------------------------------------

  /**
   * Compute the aggregate downstream effects of population mass psychology
   * on civil unrest, recruitment, desertion, and treasury.
   *
   * - **Civil unrest**: high anger + low hope = unrest; high nationalism
   *   dampens it.
   * - **Recruitment**: high nationalism + low weariness = bonus; high
   *   weariness = penalty.
   * - **Desertion**: triggered when weariness exceeds threshold.
   * - **Treasury**: fear + nationalism yields war-bond bonus; low hope
   *   penalises income.
   *
   * @param input - Current population mass-psychology dimensions.
   * @returns Modifiers for unrest, recruitment, desertion, and treasury.
   * @see FR-1517
   */
  computeMassPsychEffects(input: MassPsychEffectsInput): MassPsychEffectsResult {
    const fx = this.cfg.massPsychologyEffects;
    const { factionId, massPsych } = input;
    const { fear, anger, hope, warWeariness, nationalism } = massPsych;

    const reasons: string[] = [];

    // ── Civil unrest ──────────────────────────────────────────────────
    let civilUnrestModifier = 0;
    if (anger >= fx.highAngerThreshold && hope < fx.lowHopeThreshold) {
      civilUnrestModifier += fx.angerLowHopeUnrestPerTurn;
      reasons.push(
        `High anger (${anger}) + low hope (${hope}): unrest +${fx.angerLowHopeUnrestPerTurn}`,
      );
    }
    if (nationalism >= fx.highNationalismThreshold) {
      civilUnrestModifier += fx.nationalismUnrestDampening;
      reasons.push(`High nationalism (${nationalism}): unrest ${fx.nationalismUnrestDampening}`);
    }

    // ── Recruitment ───────────────────────────────────────────────────
    let recruitmentModifier = 0;
    if (nationalism >= fx.highNationalismThreshold && warWeariness < fx.wearinessEffectThreshold) {
      recruitmentModifier += fx.recruitmentBonus;
      reasons.push(`High nationalism + low weariness: recruitment +${fx.recruitmentBonus}`);
    }
    if (warWeariness >= fx.wearinessEffectThreshold) {
      recruitmentModifier += fx.recruitmentPenalty;
      reasons.push(`High weariness (${warWeariness}): recruitment ${fx.recruitmentPenalty}`);
    }

    // ── Desertion ─────────────────────────────────────────────────────
    const desertionRate =
      warWeariness >= fx.wearinessEffectThreshold ? fx.desertionRate : 0;
    if (desertionRate > 0) {
      reasons.push(`Weariness ≥ ${fx.wearinessEffectThreshold}: desertion ${fx.desertionRate}`);
    }

    // ── Treasury ──────────────────────────────────────────────────────
    let treasuryModifier = 0;
    if (fear >= fx.highAngerThreshold && nationalism >= fx.highNationalismThreshold) {
      treasuryModifier += fx.warBondBonus;
      reasons.push(`Fear + nationalism: war bonds +${fx.warBondBonus}`);
    }
    if (hope < fx.lowHopeThreshold) {
      treasuryModifier += fx.lowHopeTreasuryPenalty;
      reasons.push(`Low hope (${hope}): treasury ${fx.lowHopeTreasuryPenalty}`);
    }

    if (reasons.length === 0) {
      reasons.push('No mass-psychology effects active');
    }

    return {
      factionId,
      civilUnrestModifier,
      recruitmentModifier,
      desertionRate,
      treasuryModifier,
      reason: reasons.join('; '),
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
