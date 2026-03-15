/**
 * Political System Engine — CNFL-3101, FR-2201, FR-2203
 *
 * Computes gameplay-impacting modifiers derived from a nation's political
 * system profile. Each political system (liberal democracy, military junta,
 * theocracy, etc.) produces a unique modifier fingerprint that affects
 * decision speed, stability resilience, intelligence effectiveness, civil
 * unrest thresholds, economic efficiency, and reform capacity.
 *
 * All methods are pure functions that return new objects; no side effects,
 * no state mutation. The political system profile data IS the configuration
 * — no dependency on GAME_CONFIG.
 *
 * @module political-system-engine
 * @see FR-2201 — Political System Catalog Assignment
 * @see FR-2203 — Political System Gameplay Modifiers
 */

import type {
  FactionId,
  NationState,
  PoliticalSystemProfile,
} from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value, guaranteed to be within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Computed gameplay modifiers derived from a political system profile.
 *
 * These modifiers are applied by downstream engines (economic, military,
 * intelligence, civil unrest) to shape faction-specific gameplay.
 *
 * @see FR-2203
 */
export interface PoliticalSystemModifiers {
  /**
   * Multiplier for action processing speed.
   * - 0.5 = 50% slower (sluggish democracies with coalition haggling)
   * - 1.0 = baseline
   * - 1.5 = 50% faster (autocratic decree-by-fiat)
   */
  readonly decisionSpeedMultiplier: number;

  /**
   * Bonus stability points recovered per turn while in recovery phase.
   * Democracies with institutional resilience recover faster.
   */
  readonly stabilityRecoveryRate: number;

  /**
   * Stability threshold bonus before a crisis event triggers.
   * Autocracies resist initial shocks better through repressive control.
   */
  readonly stabilityShockResistance: number;

  /**
   * Modifier to the civil unrest escalation trigger level.
   * Higher = takes more pressure before unrest escalates.
   * Democracies with civil liberties provide legitimate dissent channels.
   */
  readonly civilLibertyThreshold: number;

  /**
   * Modifier to information warfare effectiveness (both offensive and
   * defensive). Derived from press freedom.
   * - High press freedom → harder to control domestic narrative but
   *   better at projecting soft power abroad.
   * - Low press freedom → stronger domestic propaganda control.
   */
  readonly pressFreedomModifier: number;

  /**
   * Bonus to counter-intelligence operations.
   * Closed societies with restricted civil liberties gain up to +15.
   */
  readonly counterIntelBonus: number;

  /**
   * Bonus to human intelligence (HUMINT) collection abroad.
   * Open societies with press freedom and civil liberties gain up to +10.
   */
  readonly humintAbroadBonus: number;

  /**
   * Economic efficiency multiplier.
   * - 1.0 = baseline (no corruption drag)
   * - Lower values reflect corruption tax on GDP/treasury income.
   * Corruption 0 → 1.0; Corruption 100 → 0.5.
   */
  readonly economicEfficiencyModifier: number;

  /**
   * Multiplier for military force deployment speed.
   * Autocracies can mobilise faster due to fewer approval gates.
   */
  readonly militaryDeploymentSpeed: number;

  /**
   * Difficulty of enacting policy reforms (0–100).
   * Higher = harder to change. Inverse of the profile's reformCapacity.
   */
  readonly reformDifficulty: number;
}

/**
 * Per-nation political system effect result for a single evaluation.
 *
 * Combines the computed modifiers with action-delay and succession-risk
 * calculations that depend on the current nation state.
 *
 * @see FR-2201
 * @see FR-2203
 */
export interface PoliticalSystemEffect {
  /** Which faction this effect applies to. */
  readonly factionId: FactionId;

  /** The political system identifier (e.g. 'liberal-democracy'). */
  readonly systemId: string;

  /** Full set of computed gameplay modifiers. */
  readonly modifiers: PoliticalSystemModifiers;

  /**
   * Number of turns a controversial action is delayed.
   * 0 for autocracies (immediate execution); 1+ for democracies
   * that must navigate legislative or coalition approval.
   */
  readonly actionDelayTurns: number;

  /**
   * Probability (0–1) of a leadership crisis this turn.
   * Driven by the system's succession risk, leader age, and stability.
   */
  readonly successionRiskThisTurn: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum counter-intelligence bonus for fully closed societies. */
const MAX_COUNTER_INTEL_BONUS = 15;

/** Maximum HUMINT abroad bonus for fully open societies. */
const MAX_HUMINT_ABROAD_BONUS = 10;

/** Civil liberty threshold at which controversial actions incur delay. */
const CIVIL_LIBERTY_DELAY_THRESHOLD = 50;

/** Maximum civil-liberty-driven unrest threshold bonus. */
const MAX_CIVIL_LIBERTY_THRESHOLD = 30;

/** Maximum stability recovery rate bonus. */
const MAX_STABILITY_RECOVERY = 5;

/** Maximum shock resistance bonus for autocracies. */
const MAX_SHOCK_RESISTANCE = 10;

/** Age at which succession risk begins to increase. */
const SUCCESSION_AGE_ONSET = 60;

/** Age-risk coefficient per year above onset. */
const SUCCESSION_AGE_COEFFICIENT = 0.008;

/** Low-stability threshold that amplifies succession risk. */
const SUCCESSION_STABILITY_THRESHOLD = 40;

/** Succession risk amplifier when stability is below threshold. */
const SUCCESSION_STABILITY_AMPLIFIER = 1.5;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that derives gameplay modifiers from political system
 * profiles. Every method is a pure function — no internal state, no
 * side effects, no dependency on GAME_CONFIG.
 *
 * @see FR-2201 — Political System Catalog
 * @see FR-2203 — Political System Gameplay Modifiers
 */
export class PoliticalSystemEngine {
  // ── Core Modifier Computation ───────────────────────────────────────────

  /**
   * Derive the full set of gameplay modifiers from a political system profile.
   *
   * Each modifier is computed from the profile's raw indices and optional
   * `gameplayModifiers` overrides, then clamped to reasonable bounds.
   *
   * @param profile - The political system profile to evaluate.
   * @returns All computed gameplay modifiers.
   *
   * @see FR-2203
   */
  computeModifiers(profile: PoliticalSystemProfile): PoliticalSystemModifiers {
    const {
      decisionSpeedModifier,
      stabilityBaseline,
      civilLibertyIndex,
      pressFreedomIndex,
      corruptionBaseline,
      reformCapacity,
      gameplayModifiers,
    } = profile;

    // Decision speed: raw modifier (-30…+50) → multiplier (0.7…1.5)
    const decisionSpeedMultiplier = clamp(
      1.0 + decisionSpeedModifier / 100,
      0.5,
      2.0,
    );

    // Stability recovery: democracies (high civil liberty) recover faster.
    // Base contribution from stability baseline + civil liberty bonus.
    const baseRecovery = stabilityBaseline / 10;
    const civilLibertyRecovery = (civilLibertyIndex / 100) * 2;
    const overrideRecovery = gameplayModifiers?.stabilityRecoveryRate ?? 0;
    const stabilityRecoveryRate = clamp(
      baseRecovery + civilLibertyRecovery + overrideRecovery,
      -MAX_STABILITY_RECOVERY,
      MAX_STABILITY_RECOVERY,
    );

    // Shock resistance: autocracies (low civil liberty) absorb initial shocks.
    // Repressive apparatus provides a buffer before crises cascade.
    const closednessRatio = (100 - civilLibertyIndex) / 100;
    const overrideCrisis = gameplayModifiers?.crisisResistance ?? 0;
    const stabilityShockResistance = clamp(
      closednessRatio * MAX_SHOCK_RESISTANCE + overrideCrisis,
      0,
      MAX_SHOCK_RESISTANCE * 1.5,
    );

    // Civil liberty threshold: legitimate dissent channels raise the bar
    // for civil unrest to escalate. More liberty → higher trigger level.
    const overrideUnrest = gameplayModifiers?.civilUnrestThreshold ?? 0;
    const civilLibertyThreshold = clamp(
      (civilLibertyIndex / 100) * MAX_CIVIL_LIBERTY_THRESHOLD + overrideUnrest,
      0,
      MAX_CIVIL_LIBERTY_THRESHOLD * 1.5,
    );

    // Press freedom modifier: normalised 0–1 scale.
    // High press freedom amplifies soft-power projection but weakens
    // domestic narrative control.
    const pressFreedomModifier = clamp(pressFreedomIndex / 100, 0, 1);

    // Intelligence modifiers
    const { counterIntel, humintAbroad } = this.getIntelModifiers(profile);

    // Economic efficiency: corruption acts as a drag on economic output.
    // Corruption 0 → 1.0 (full efficiency); Corruption 100 → 0.5 (halved).
    const economicEfficiencyModifier = clamp(
      1.0 - corruptionBaseline / 200,
      0.5,
      1.0,
    );

    // Military deployment speed: autocracies bypass approval gates.
    // Uses decision speed modifier as the primary driver.
    const militaryDeploymentSpeed = clamp(
      1.0 + decisionSpeedModifier / 200,
      0.5,
      1.5,
    );

    // Reform difficulty: inverse of reform capacity.
    const reformDifficulty = clamp(100 - reformCapacity, 0, 100);

    return {
      decisionSpeedMultiplier,
      stabilityRecoveryRate,
      stabilityShockResistance,
      civilLibertyThreshold,
      pressFreedomModifier,
      counterIntelBonus: counterIntel,
      humintAbroadBonus: humintAbroad,
      economicEfficiencyModifier,
      militaryDeploymentSpeed,
      reformDifficulty,
    };
  }

  // ── Full Effect Computation ─────────────────────────────────────────────

  /**
   * Compute the complete political-system effect for a nation, including
   * gameplay modifiers, action delay, and succession risk.
   *
   * @param profile - The political system profile to evaluate.
   * @param nation  - Current nation state (for stability-dependent calcs).
   * @returns Full per-nation effect result.
   *
   * @see FR-2201
   * @see FR-2203
   */
  computeEffect(
    profile: PoliticalSystemProfile,
    nation: NationState,
  ): PoliticalSystemEffect {
    const modifiers = this.computeModifiers(profile);

    // Controversial actions are assumed when stability is low (the regime
    // is likely making aggressive or emergency moves).
    const isControversial = nation.stability < 50;
    const actionDelayTurns = this.getActionDelay(profile, isControversial);

    // Succession risk scales with low stability.
    const successionRiskThisTurn = this.computeSuccessionRisk(
      profile,
      undefined,
      nation.stability,
    );

    return {
      factionId: nation.factionId,
      systemId: profile.systemId,
      modifiers,
      actionDelayTurns,
      successionRiskThisTurn,
    };
  }

  // ── Action Delay ────────────────────────────────────────────────────────

  /**
   * Determine how many turns a particular action is delayed by the
   * political system's approval mechanisms.
   *
   * Autocracies (low civil liberty, high decision speed) process actions
   * immediately. Democracies incur delay on controversial actions such as
   * war declarations or emergency-powers invocations.
   *
   * @param profile         - The political system profile.
   * @param isControversial - Whether the action is classified as controversial.
   * @returns Number of delay turns (0 = immediate, 1+ = delayed).
   */
  getActionDelay(
    profile: PoliticalSystemProfile,
    isControversial: boolean,
  ): number {
    // Explicit override from the model takes precedence.
    const explicitDelay = profile.gameplayModifiers?.controversialActionDelay;
    if (explicitDelay !== undefined && isControversial) {
      return explicitDelay;
    }

    // Non-controversial actions never have delay regardless of system.
    if (!isControversial) {
      return 0;
    }

    // Civil liberty above the threshold → democratic approval gates apply.
    return profile.civilLibertyIndex >= CIVIL_LIBERTY_DELAY_THRESHOLD ? 1 : 0;
  }

  // ── Succession Risk ─────────────────────────────────────────────────────

  /**
   * Compute the probability of a leadership crisis (succession event)
   * occurring this turn.
   *
   * Base probability comes from the profile's `successionRisk` field (0–100
   * normalised to 0–1). Age beyond 60 adds incremental risk. Low stability
   * amplifies the overall probability.
   *
   * @param profile   - The political system profile.
   * @param leaderAge - Optional leader age in years. If omitted, age
   *                    contributes no additional risk.
   * @param stability - Optional current stability (0–100). If omitted,
   *                    stability amplification is not applied.
   * @returns Probability of succession crisis this turn (0–1).
   */
  computeSuccessionRisk(
    profile: PoliticalSystemProfile,
    leaderAge?: number,
    stability?: number,
  ): number {
    // Base risk: profile value normalised to a per-turn probability.
    // successionRisk 0 → 0.00; successionRisk 100 → 0.10 (10% per turn max base).
    let risk = profile.successionRisk / 1000;

    // Age amplifier: each year above 60 adds incremental risk.
    if (leaderAge !== undefined && leaderAge > SUCCESSION_AGE_ONSET) {
      const ageExcess = leaderAge - SUCCESSION_AGE_ONSET;
      risk += ageExcess * SUCCESSION_AGE_COEFFICIENT;
    }

    // Low-stability amplifier: instability makes leadership transitions
    // more likely and more chaotic.
    if (stability !== undefined && stability < SUCCESSION_STABILITY_THRESHOLD) {
      const stabilityFactor =
        1 +
        ((SUCCESSION_STABILITY_THRESHOLD - stability) /
          SUCCESSION_STABILITY_THRESHOLD) *
          (SUCCESSION_STABILITY_AMPLIFIER - 1);
      risk *= stabilityFactor;
    }

    return clamp(risk, 0, 1);
  }

  // ── Stability Modifier ──────────────────────────────────────────────────

  /**
   * Compute the stability modifier based on whether the nation is currently
   * recovering from a crisis or in a normal state.
   *
   * - **Recovering**: Democracies (high civil liberty) bounce back faster
   *   thanks to institutional resilience and legitimacy. Returns a positive
   *   recovery bonus.
   * - **Normal / shock phase**: Autocracies (low civil liberty) resist
   *   initial shocks better through repressive control. Returns a positive
   *   shock-resistance bonus.
   *
   * @param profile      - The political system profile.
   * @param isRecovering - Whether the nation is in post-crisis recovery.
   * @returns Stability modifier (positive = beneficial).
   */
  getStabilityModifier(
    profile: PoliticalSystemProfile,
    isRecovering: boolean,
  ): number {
    const overrideRecovery =
      profile.gameplayModifiers?.stabilityRecoveryRate ?? 0;
    const overrideCrisis = profile.gameplayModifiers?.crisisResistance ?? 0;

    if (isRecovering) {
      // Recovery phase: civil liberty and institutional strength drive bounce-back.
      // civilLibertyIndex 100 → +3.0 base; stabilityBaseline adds flavour.
      const libertyBonus = (profile.civilLibertyIndex / 100) * 3;
      const baselineBonus = profile.stabilityBaseline / 10;
      return clamp(
        libertyBonus + baselineBonus + overrideRecovery,
        -MAX_STABILITY_RECOVERY,
        MAX_STABILITY_RECOVERY,
      );
    }

    // Shock phase: closedness and repressive capacity resist initial impact.
    // civilLibertyIndex 0 → full bonus; civilLibertyIndex 100 → no bonus.
    const closednessRatio = (100 - profile.civilLibertyIndex) / 100;
    const shockResistance = closednessRatio * MAX_SHOCK_RESISTANCE;
    return clamp(shockResistance + overrideCrisis, 0, MAX_SHOCK_RESISTANCE * 1.5);
  }

  // ── Intelligence Modifiers ──────────────────────────────────────────────

  /**
   * Compute intelligence bonuses derived from the political system.
   *
   * - **Counter-intelligence**: Closed societies (low civil liberty) can
   *   monitor populations more aggressively, gaining up to +15.
   * - **HUMINT abroad**: Open societies (high civil liberty, press freedom)
   *   have more citizens travelling, studying, and working abroad — a richer
   *   pool for HUMINT recruitment, gaining up to +10.
   *
   * @param profile - The political system profile.
   * @returns Object with `counterIntel` and `humintAbroad` bonuses.
   */
  getIntelModifiers(
    profile: PoliticalSystemProfile,
  ): { readonly counterIntel: number; readonly humintAbroad: number } {
    const intelligenceOverride = profile.gameplayModifiers?.intelligenceModifier;

    // Counter-intel: closed societies gain surveillance advantage.
    const closednessRatio = (100 - profile.civilLibertyIndex) / 100;
    const baseCounterIntel = closednessRatio * MAX_COUNTER_INTEL_BONUS;
    const overrideCounterIntel =
      typeof intelligenceOverride === 'object' &&
      intelligenceOverride !== null &&
      'counterIntel' in intelligenceOverride
        ? (intelligenceOverride as { counterIntel: number }).counterIntel
        : 0;
    const counterIntel = clamp(
      baseCounterIntel + overrideCounterIntel,
      0,
      MAX_COUNTER_INTEL_BONUS * 1.5,
    );

    // HUMINT abroad: open societies have global civilian presence.
    const opennessRatio = profile.civilLibertyIndex / 100;
    const pressFreedomBonus = (profile.pressFreedomIndex / 100) * 2;
    const baseHumint = opennessRatio * (MAX_HUMINT_ABROAD_BONUS - 2) + pressFreedomBonus;
    const overrideHumint =
      typeof intelligenceOverride === 'object' &&
      intelligenceOverride !== null &&
      'humintAbroad' in intelligenceOverride
        ? (intelligenceOverride as { humintAbroad: number }).humintAbroad
        : 0;
    const humintAbroad = clamp(
      baseHumint + overrideHumint,
      0,
      MAX_HUMINT_ABROAD_BONUS * 1.5,
    );

    return { counterIntel, humintAbroad };
  }
}
