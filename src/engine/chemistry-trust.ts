/**
 * @module ChemistryTrust
 * @description Interpersonal Chemistry & Trust Calculus system for New Order.
 *
 * Implements the four interpersonal-relationship formulas that govern how
 * leaders perceive, negotiate with, and hold grudges against one another.
 *
 * ## FR-1508 — Interpersonal Chemistry
 *
 * Chemistry is a pairwise value (−50 to +50) that modifies every diplomatic
 * interaction between two leaders:
 *
 * | Chemistry | Agreement Acceptance | Tension Change |
 * |-----------|----------------------|----------------|
 * | Positive  | +10 %                | −5             |
 * | Negative  | −10 %                | +5             |
 * | Zero      | No modifier          | No modifier    |
 *
 * ## FR-1509 — Trust Calculus
 *
 * Trust is computed from a weighted formula and gates which diplomatic
 * agreements are available:
 *
 * ```
 * Trust = (PromisesKept × 2) − (PromisesBroken × 5)
 *       + SharedEnemyBonus
 *       + (IdeologicalAlignment × 0.5)
 *       − (PastBetrayals × 10)
 * ```
 *
 * | Trust Score | Available Agreements          |
 * |-------------|-------------------------------|
 * | > 20        | Non-Aggression Pact (NAP)     |
 * | > 40        | Defense Pact                  |
 * | > 60        | Intelligence Sharing          |
 * | > 60        | Red Telephone (50 % discount) |
 *
 * ## FR-1510 — Grudge Ledger
 *
 * Each unresolved grudge decays by −0.5 severity per turn, down to a minimum
 * severity of 1. Vengeful leaders (vengeful index ≥ threshold) decay at half
 * the normal rate. Grudges fuel a retaliatory-action utility bonus equal to
 * the sum of all unresolved grudge severities multiplied by the retaliation
 * multiplier (×2).
 *
 * ## FR-1511 — Diplomatic Encounter Modifier
 *
 * When two leaders meet for any diplomatic action, the outcome is modified by
 * a weighted composite score:
 *
 * ```
 * OutcomeModifier = (Chemistry × 0.3) + (Trust × 0.3)
 *                 + (RelativePower × 0.2) + (EmotionalAlignment × 0.2)
 * ```
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1508
 * @see FR-1509
 * @see FR-1510
 * @see FR-1511
 */

import type { Grudge } from '@/data/types';
import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Config type alias
// ---------------------------------------------------------------------------

/**
 * Type alias for the psychology sub-tree of {@link GAME_CONFIG}.
 *
 * Pulled from `typeof GAME_CONFIG.psychology` so that every method can be
 * driven by the same configuration object and tests can supply overrides.
 */
export type ChemistryTrustConfig = typeof GAME_CONFIG.psychology;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Input / Result interfaces
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing trust between two leaders.
 *
 * @see FR-1509
 */
export interface TrustInput {
  /** Number of promises that have been kept. */
  readonly promisesKept: number;
  /** Number of promises that have been broken. */
  readonly promisesBroken: number;
  /** Bonus from fighting a shared enemy. */
  readonly sharedEnemyBonus: number;
  /** Ideological alignment on a 0–100 scale. */
  readonly ideologicalAlignment: number;
  /** Number of past betrayals. */
  readonly pastBetrayals: number;
}

/**
 * Result of a trust computation.
 *
 * Includes the raw and clamped trust scores, plus boolean flags indicating
 * which diplomatic actions the trust level unlocks.
 *
 * @see FR-1509
 */
export interface TrustResult {
  /** Unclamped trust score from the formula. */
  readonly rawTrust: number;
  /** Trust score clamped to [−100, +100]. */
  readonly clampedTrust: number;
  /** Whether trust exceeds the NAP threshold (> 20). */
  readonly canNegotiateNAP: boolean;
  /** Whether trust exceeds the Defense Pact threshold (> 40). */
  readonly canNegotiateDefensePact: boolean;
  /** Whether trust exceeds the Intelligence Sharing threshold (> 60). */
  readonly canShareIntelligence: boolean;
  /** Red Telephone cost discount (0.5 if trust > 60, else 0). */
  readonly redTelephoneDiscount: number;
}

/**
 * Result of applying a chemistry modifier to a diplomatic interaction.
 *
 * @see FR-1508
 */
export interface ChemistryModifierResult {
  /** The raw chemistry value that was evaluated. */
  readonly chemistry: number;
  /** Whether the chemistry is positive (> 0). */
  readonly isPositive: boolean;
  /**
   * Modifier applied to agreement-acceptance probability.
   *
   * - Positive chemistry → +0.1
   * - Negative chemistry → −0.1
   * - Zero chemistry     →  0
   */
  readonly agreementAcceptanceModifier: number;
  /**
   * Modifier applied to tension between the two nations.
   *
   * - Positive chemistry → −5
   * - Negative chemistry → +5
   * - Zero chemistry     →  0
   */
  readonly tensionModifier: number;
}

/**
 * Input parameters for a diplomatic encounter evaluation.
 *
 * All values should already be normalised to a [0, 1] range by the caller.
 *
 * @see FR-1511
 */
export interface DiplomaticEncounterInput {
  /**
   * Chemistry between the two leaders, normalised to [0, 1].
   *
   * (Raw range: −50 to +50.)
   */
  readonly chemistry: number;
  /**
   * Trust score, normalised to [0, 1].
   *
   * (Raw range: −100 to +100.)
   */
  readonly trust: number;
  /**
   * Relative military / economic power ratio, already in [0, 1].
   *
   * Computed by the caller from force-structure or GDP data.
   */
  readonly relativePower: number;
  /**
   * Emotional alignment, normalised to [0, 1].
   *
   * (Raw range: −100 to +100.)
   */
  readonly emotionalAlignment: number;
}

/**
 * Breakdown of contributions to the diplomatic encounter outcome modifier.
 *
 * @see FR-1511
 */
export interface DiplomaticEncounterResult {
  /** Final weighted outcome modifier (sum of all contributions). */
  readonly outcomeModifier: number;
  /** Contribution from chemistry (chemistry × weight). */
  readonly chemistryContribution: number;
  /** Contribution from trust (trust × weight). */
  readonly trustContribution: number;
  /** Contribution from relative power (power × weight). */
  readonly powerContribution: number;
  /** Contribution from emotional alignment (alignment × weight). */
  readonly emotionalContribution: number;
}

/**
 * Result of applying per-turn grudge decay across a leader's grudge ledger.
 *
 * @see FR-1510
 */
export interface GrudgeDecayResult {
  /**
   * New grudge array with updated `currentDecayedSeverity` values.
   *
   * Resolved grudges are passed through unchanged.
   */
  readonly updatedGrudges: readonly Grudge[];
  /** Number of unresolved grudges whose severity was actively decayed. */
  readonly grudgesDecayed: number;
  /** Number of unresolved grudges that have reached minimum severity. */
  readonly grudgesAtMinimum: number;
}

// ---------------------------------------------------------------------------
// Agreement tier literal type
// ---------------------------------------------------------------------------

/**
 * Diplomatic agreement tiers, ordered by the trust required to unlock them.
 *
 * | Tier                  | Minimum Trust |
 * |-----------------------|---------------|
 * | NAP                   | 20            |
 * | defensePact           | 40            |
 * | intelligenceSharing   | 60            |
 *
 * @see FR-1509
 */
export type AgreementTier = 'NAP' | 'defensePact' | 'intelligenceSharing';

// ---------------------------------------------------------------------------
// Engine class
// ---------------------------------------------------------------------------

/**
 * Pure engine for interpersonal chemistry, trust calculus, grudge mechanics,
 * and diplomatic encounter modifiers.
 *
 * Every method is stateless and returns a new result object — the class only
 * holds a reference to the immutable configuration tree.
 *
 * @see FR-1508 — Chemistry modifiers
 * @see FR-1509 — Trust formula and agreement gating
 * @see FR-1510 — Grudge ledger and decay
 * @see FR-1511 — Diplomatic encounter composite modifier
 */
export class ChemistryTrustEngine {
  /** Immutable reference to the psychology configuration sub-tree. */
  private readonly config: ChemistryTrustConfig;

  /**
   * Create a new engine instance.
   *
   * @param config - The `GAME_CONFIG.psychology` object (or a test override).
   */
  constructor(config: ChemistryTrustConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // 1. Trust Calculus — FR-1509
  // -----------------------------------------------------------------------

  /**
   * Compute the trust score between two leaders.
   *
   * Formula:
   * ```
   * Trust = (promisesKept × 2)
   *       − (promisesBroken × 5)
   *       + sharedEnemyBonus
   *       + (ideologicalAlignment × 0.5)
   *       − (pastBetrayals × 10)
   * ```
   *
   * The raw result is clamped to [−100, +100]. Boolean flags indicate which
   * agreement tiers the resulting trust level unlocks:
   *
   * - NAP:                  trust > 20
   * - Defense Pact:         trust > 40
   * - Intelligence Sharing: trust > 60
   * - Red Telephone:        50 % DI-cost discount if trust > 60
   *
   * @param input - Trust computation parameters.
   * @returns A {@link TrustResult} with raw/clamped scores and tier flags.
   *
   * @see FR-1509
   */
  computeTrust(input: TrustInput): TrustResult {
    const { trust: trustCfg, trustThresholds } = this.config;

    const rawTrust =
      input.promisesKept * trustCfg.promisesKeptMultiplier +
      input.promisesBroken * trustCfg.promisesBrokenMultiplier +
      input.sharedEnemyBonus +
      input.ideologicalAlignment * trustCfg.ideologicalAlignmentMultiplier +
      input.pastBetrayals * trustCfg.pastBetrayalMultiplier;

    const clampedTrust = clamp(rawTrust, -100, 100);

    const canNegotiateNAP = clampedTrust > trustThresholds.NAP;
    const canNegotiateDefensePact = clampedTrust > trustThresholds.defensePact;
    const canShareIntelligence = clampedTrust > trustThresholds.intelligenceSharing;
    const redTelephoneDiscount = canShareIntelligence
      ? trustThresholds.redTelephoneDiscount
      : 0;

    return {
      rawTrust,
      clampedTrust,
      canNegotiateNAP,
      canNegotiateDefensePact,
      canShareIntelligence,
      redTelephoneDiscount,
    };
  }

  // -----------------------------------------------------------------------
  // 2. Chemistry Modifier — FR-1508
  // -----------------------------------------------------------------------

  /**
   * Determine the diplomatic modifier that interpersonal chemistry applies to
   * an interaction between two leaders.
   *
   * | Chemistry | Acceptance Modifier | Tension Modifier |
   * |-----------|---------------------|------------------|
   * | > 0       | +0.10               | −5               |
   * | < 0       | −0.10               | +5               |
   * | = 0       |  0.00               |  0               |
   *
   * @param chemistry - The chemistry score (−50 to +50).
   * @returns A {@link ChemistryModifierResult} with the modifier breakdown.
   *
   * @see FR-1508
   */
  applyChemistryModifier(chemistry: number): ChemistryModifierResult {
    const { chemistry: chemistryCfg } = this.config;

    if (chemistry > 0) {
      return {
        chemistry,
        isPositive: true,
        agreementAcceptanceModifier: chemistryCfg.agreementAcceptanceBonus,
        tensionModifier: chemistryCfg.tensionReductionPerPositive,
      };
    }

    if (chemistry < 0) {
      return {
        chemistry,
        isPositive: false,
        agreementAcceptanceModifier: chemistryCfg.agreementAcceptancePenalty,
        tensionModifier: chemistryCfg.tensionIncreasePerNegative,
      };
    }

    // chemistry === 0 — no modifier
    return {
      chemistry,
      isPositive: false,
      agreementAcceptanceModifier: 0,
      tensionModifier: 0,
    };
  }

  // -----------------------------------------------------------------------
  // 3. Diplomatic Encounter — FR-1511
  // -----------------------------------------------------------------------

  /**
   * Evaluate the composite outcome modifier for a diplomatic encounter.
   *
   * Formula:
   * ```
   * OutcomeModifier = (chemistry × 0.3) + (trust × 0.3)
   *                 + (relativePower × 0.2) + (emotionalAlignment × 0.2)
   * ```
   *
   * All input values must already be normalised to [0, 1] by the caller.
   * The weights are read from `GAME_CONFIG.psychology.diplomaticEncounter`.
   *
   * @param input - Pre-normalised encounter parameters.
   * @returns A {@link DiplomaticEncounterResult} with per-factor contributions.
   *
   * @see FR-1511
   */
  evaluateDiplomaticEncounter(input: DiplomaticEncounterInput): DiplomaticEncounterResult {
    const { diplomaticEncounter: encCfg } = this.config;

    const chemistryContribution = input.chemistry * encCfg.chemistryWeight;
    const trustContribution = input.trust * encCfg.trustWeight;
    const powerContribution = input.relativePower * encCfg.relativePowerWeight;
    const emotionalContribution = input.emotionalAlignment * encCfg.emotionalAlignmentWeight;

    const outcomeModifier =
      chemistryContribution +
      trustContribution +
      powerContribution +
      emotionalContribution;

    return {
      outcomeModifier,
      chemistryContribution,
      trustContribution,
      powerContribution,
      emotionalContribution,
    };
  }

  // -----------------------------------------------------------------------
  // 4. Grudge Decay — FR-1510
  // -----------------------------------------------------------------------

  /**
   * Apply per-turn severity decay to a leader's grudge ledger.
   *
   * Rules:
   * 1. Only **unresolved** grudges (resolved === false) are decayed.
   * 2. Base decay rate: `decayPerTurn` (−0.5 by default).
   * 3. If the leader's vengeful index meets or exceeds the threshold, the
   *    decay amount is halved via `vengefulDecayReduction`.
   * 4. Severity never drops below `minimumSeverity` (1).
   * 5. Resolved grudges pass through unchanged.
   *
   * No input arrays or objects are mutated — new {@link Grudge} objects are
   * created for every entry.
   *
   * @param grudges           - The leader's current grudge array (immutable).
   * @param vengefulIndex     - The leader's vengeful personality score (0–100).
   * @param vengefulThreshold - Score at which vengeful decay kicks in (default 50).
   * @returns A {@link GrudgeDecayResult} with updated grudges and statistics.
   *
   * @see FR-1510
   */
  decayGrudges(
    grudges: readonly Grudge[],
    vengefulIndex: number,
    vengefulThreshold: number = 50,
  ): GrudgeDecayResult {
    const { grudge: grudgeCfg } = this.config;

    const isVengeful = vengefulIndex >= vengefulThreshold;

    // If vengeful, multiply the (negative) decay rate by the reduction factor
    // e.g. −0.5 × 0.5 = −0.25  →  slower decay
    const effectiveDecay = isVengeful
      ? grudgeCfg.decayPerTurn * grudgeCfg.vengefulDecayReduction
      : grudgeCfg.decayPerTurn;

    let grudgesDecayed = 0;
    let grudgesAtMinimum = 0;

    const updatedGrudges = grudges.map((grudge): Grudge => {
      // Resolved grudges pass through unchanged (as new objects)
      if (grudge.resolved) {
        return { ...grudge };
      }

      // Apply decay: severity + effectiveDecay (effectiveDecay is negative)
      const decayedSeverity = grudge.currentDecayedSeverity + effectiveDecay;
      const newSeverity = Math.max(grudgeCfg.minimumSeverity, decayedSeverity);

      // Track whether the grudge was actively decayed this turn
      if (newSeverity < grudge.currentDecayedSeverity) {
        grudgesDecayed += 1;
      }

      // Track whether the grudge has hit the floor
      if (newSeverity <= grudgeCfg.minimumSeverity) {
        grudgesAtMinimum += 1;
      }

      return {
        ...grudge,
        currentDecayedSeverity: newSeverity,
      };
    });

    return {
      updatedGrudges,
      grudgesDecayed,
      grudgesAtMinimum,
    };
  }

  // -----------------------------------------------------------------------
  // 5. Retaliation Bonus — FR-1510
  // -----------------------------------------------------------------------

  /**
   * Compute the utility bonus a leader receives for retaliatory actions,
   * based on the cumulative severity of their unresolved grudges.
   *
   * Formula:
   * ```
   * bonus = totalUnresolvedSeverity × retaliationUtilityMultiplier (2)
   * ```
   *
   * Only unresolved grudges contribute to the total.
   *
   * @param grudges - The leader's current grudge array (immutable).
   * @returns The retaliation utility bonus (≥ 0).
   *
   * @see FR-1510
   */
  computeRetaliationBonus(grudges: readonly Grudge[]): number {
    const { grudge: grudgeCfg } = this.config;

    const totalSeverity = grudges.reduce(
      (sum, g) => (g.resolved ? sum : sum + g.currentDecayedSeverity),
      0,
    );

    return totalSeverity * grudgeCfg.retaliationUtilityMultiplier;
  }

  // -----------------------------------------------------------------------
  // 6. Agreement Gate — FR-1509
  // -----------------------------------------------------------------------

  /**
   * Check whether a given trust score meets the threshold for a specific
   * diplomatic agreement tier.
   *
   * | Tier                | Required Trust |
   * |---------------------|----------------|
   * | NAP                 | > 20           |
   * | defensePact         | > 40           |
   * | intelligenceSharing | > 60           |
   *
   * @param trust - The current trust score (−100 to +100).
   * @param tier  - The agreement tier to check.
   * @returns `true` if the trust score exceeds the tier's threshold.
   *
   * @see FR-1509
   */
  canNegotiate(trust: number, tier: AgreementTier): boolean {
    const { trustThresholds } = this.config;
    return trust > trustThresholds[tier];
  }
}
