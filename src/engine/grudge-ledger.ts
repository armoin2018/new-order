/**
 * @module GrudgeLedger
 * @description Grudge Ledger & Leader Dossier engine for New Order.
 *
 * Implements per-leader offense tracking, severity decay, retaliation
 * utility boosting, and the Leader Dossier panel data aggregation system.
 *
 * ## FR-1510 — Grudge Ledger
 *
 * Each leader maintains a ledger of perceived offenses committed by other
 * leaders. Grudges decay by −0.5 severity per turn (down to a minimum
 * severity of 1). Vengeful leaders (vengeful index > 50) decay at half
 * the normal rate (−0.25 per turn). Unresolved grudge severity feeds into
 * a retaliation utility bonus:
 *
 * ```
 * utilityBoost = Σ(currentDecayedSeverity for unresolved grudges) × 2
 * modifiedUtility = baseUtility + utilityBoost
 * ```
 *
 * ## FR-1520 — Leader Dossier Panel
 *
 * The dossier aggregates psychological, emotional, social, and strategic
 * data about a target leader into discrete sections, each gated by a
 * HUMINT clarity threshold:
 *
 * | Section              | Required HUMINT |
 * |----------------------|-----------------|
 * | Psychological Profile| 30              |
 * | Emotional State      | 40              |
 * | Cognitive Biases     | 60              |
 * | Chemistry            | 20              |
 * | Trust Score          | 20              |
 * | Grudge Ledger        | 40              |
 * | Personality Drift    | 50              |
 *
 * Overall clarity bands: ≥ 60 → high, ≥ 40 → medium, ≥ 20 → low, < 20 → minimal.
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1510
 * @see FR-1520
 */

import { GAME_CONFIG } from '@/engine/config';
import { OffenseType } from '@/data/types';
import type { LeaderId, TurnNumber, Grudge } from '@/data/types';

// ---------------------------------------------------------------------------
// Config type alias
// ---------------------------------------------------------------------------

/**
 * Type alias for the psychology sub-tree of {@link GAME_CONFIG}.
 *
 * Pulled from `typeof GAME_CONFIG.psychology` so that every method can be
 * driven by the same configuration object and tests can supply overrides.
 *
 * @see FR-1510
 */
export type GrudgeLedgerConfig = typeof GAME_CONFIG.psychology;

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
// Input / Result interfaces — Grudge Ledger (FR-1510)
// ---------------------------------------------------------------------------

/**
 * Input parameters for recording a new grudge in a leader's ledger.
 *
 * @see FR-1510
 */
export interface AddGrudgeInput {
  /** Leader whose ledger receives the grudge. */
  readonly leaderId: LeaderId;
  /** Leader who committed the offense. */
  readonly offender: LeaderId;
  /** Category of the perceived offense. */
  readonly offenseType: OffenseType;
  /** Perceived severity of the offense (1–10, will be clamped). */
  readonly severity: number;
  /** Current game turn when the offense occurred. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of adding a grudge to a leader's ledger.
 *
 * @see FR-1510
 */
export interface AddGrudgeResult {
  /** The newly created grudge object. */
  readonly grudge: Grudge;
  /** Total number of unresolved grudges the leader holds against the offender. */
  readonly totalGrudgesAgainstOffender: number;
  /** Human-readable explanation of what was recorded. */
  readonly reason: string;
}

/**
 * Input parameters for decaying all grudges in a leader's ledger.
 *
 * @see FR-1510
 */
export interface DecayGrudgesInput {
  /** Leader whose grudges are decayed. */
  readonly leaderId: LeaderId;
  /** Current grudge array (immutable). */
  readonly grudges: readonly Grudge[];
  /** Leader's vengeful personality index (0–100). */
  readonly vengefulIndex: number;
  /** Current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of decaying grudges for a single turn.
 *
 * @see FR-1510
 */
export interface DecayGrudgesResult {
  /** Updated grudges array after decay has been applied. */
  readonly updatedGrudges: readonly Grudge[];
  /** Number of grudges whose severity was reduced this turn. */
  readonly grudgesDecayed: number;
  /** Number of grudges already sitting at minimum severity. */
  readonly grudgesAtMinimum: number;
  /** Human-readable explanation of the decay pass. */
  readonly reason: string;
}

/**
 * Input parameters for computing retaliation utility against a target leader.
 *
 * @see FR-1510
 */
export interface RetaliationUtilityInput {
  /** Leader evaluating whether to retaliate. */
  readonly leaderId: LeaderId;
  /** The target leader to retaliate against. */
  readonly targetLeader: LeaderId;
  /** Current grudge array (immutable). */
  readonly grudges: readonly Grudge[];
  /** Base utility of the contemplated retaliatory action. */
  readonly baseUtility: number;
}

/**
 * Result of the retaliation-utility computation.
 *
 * @see FR-1510
 */
export interface RetaliationUtilityResult {
  /** Sum of currentDecayedSeverity for all unresolved grudges against target. */
  readonly totalGrudgeSeverity: number;
  /** Utility boost: totalGrudgeSeverity × retaliationUtilityMultiplier. */
  readonly utilityBoost: number;
  /** Final modified utility: baseUtility + utilityBoost. */
  readonly modifiedUtility: number;
  /** Count of unresolved grudges against the target leader. */
  readonly grudgeCount: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

/**
 * Input parameters for resolving (forgiving / avenging) grudges.
 *
 * @see FR-1510
 */
export interface ResolveGrudgeInput {
  /** Leader whose grudge(s) are being resolved. */
  readonly leaderId: LeaderId;
  /** The offending leader whose grudges should be resolved. */
  readonly offender: LeaderId;
  /** Specific offense type to resolve, or `null` to resolve all against offender. */
  readonly offenseType: OffenseType | null;
  /** Current grudge array (immutable). */
  readonly grudges: readonly Grudge[];
  /** Current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of resolving grudges.
 *
 * @see FR-1510
 */
export interface ResolveGrudgeResult {
  /** Number of grudges that were marked as resolved. */
  readonly resolvedCount: number;
  /** Updated grudges array with matched grudges set to resolved. */
  readonly updatedGrudges: readonly Grudge[];
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Input / Result interfaces — Leader Dossier (FR-1520)
// ---------------------------------------------------------------------------

/**
 * A single section within a leader dossier report.
 *
 * Each section is gated by a minimum HUMINT clarity score. If the player's
 * HUMINT does not meet the threshold the section is marked unavailable and
 * shows `"??"` instead of real data.
 *
 * @see FR-1520
 */
export interface DossierSection {
  /** Display label for the section. */
  readonly label: string;
  /** Whether the player's HUMINT meets the section's threshold. */
  readonly available: boolean;
  /** Minimum HUMINT clarity needed to unlock this section. */
  readonly requiredHumint: number;
  /** Human-readable summary — real data if available, `"??"` otherwise. */
  readonly summary: string;
}

/**
 * Input parameters for building a leader dossier.
 *
 * @see FR-1520
 */
export interface DossierInput {
  /** Target leader to build the dossier for. */
  readonly targetLeader: LeaderId;
  /** Player's HUMINT clarity score for this target (0–100). */
  readonly humintClarity: number;
  /** Known emotional state snapshot, or `null` if unavailable. */
  readonly knownEmotionalState: {
    readonly stress: number;
    readonly confidence: number;
    readonly anger: number;
    readonly fear: number;
    readonly resolve: number;
  } | null;
  /** Number of cognitive biases known about the target. */
  readonly knownBiasCount: number;
  /** Chemistry score with the target, or `null` if unknown (−50 to +50). */
  readonly chemistry: number | null;
  /** Trust score with the target, or `null` if unknown (−100 to +100). */
  readonly trust: number | null;
  /** Number of unresolved grudges the target holds. */
  readonly grudgeCount: number;
  /** Personality drift magnitude, or `null` if unknown (0–100). */
  readonly driftMagnitude: number | null;
}

/**
 * Result of building a leader dossier.
 *
 * @see FR-1520
 */
export interface DossierResult {
  /** The target leader the dossier describes. */
  readonly targetLeader: LeaderId;
  /** Ordered sections of the dossier, each with availability gating. */
  readonly sections: readonly DossierSection[];
  /** Overall clarity band derived from HUMINT. */
  readonly overallClarity: 'high' | 'medium' | 'low' | 'minimal';
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine class
// ---------------------------------------------------------------------------

/**
 * Pure-function engine for the Grudge Ledger (FR-1510) and
 * Leader Dossier (FR-1520) subsystems.
 *
 * All methods are stateless — they accept immutable inputs and return new
 * result objects without mutating anything.
 *
 * @see FR-1510
 * @see FR-1520
 */
export class GrudgeLedgerEngine {
  private readonly cfg: GrudgeLedgerConfig;

  constructor(config: GrudgeLedgerConfig = GAME_CONFIG.psychology) {
    this.cfg = config;
  }

  // -----------------------------------------------------------------------
  // FR-1510 — addGrudge
  // -----------------------------------------------------------------------

  /**
   * Record a new grudge in a leader's ledger.
   *
   * Severity is clamped to [1, 10]. The newly created grudge starts with
   * `currentDecayedSeverity` equal to the clamped severity and
   * `resolved = false`.
   *
   * @param input - Parameters describing the offense.
   * @returns The new grudge and aggregate stats.
   *
   * @see FR-1510
   */
  addGrudge(input: AddGrudgeInput): AddGrudgeResult {
    const clampedSeverity = clamp(input.severity, 1, 10);

    const grudge: Grudge = {
      offender: input.offender,
      offenseType: input.offenseType,
      severity: clampedSeverity,
      turnCreated: input.currentTurn,
      currentDecayedSeverity: clampedSeverity,
      resolved: false,
    };

    // Count existing unresolved grudges against this offender + the new one
    const totalGrudgesAgainstOffender = 1; // caller is expected to merge into existing array

    return {
      grudge,
      totalGrudgesAgainstOffender,
      reason:
        `Recorded ${input.offenseType} grudge (severity ${clampedSeverity}) ` +
        `by ${input.leaderId as string} against ${input.offender as string} ` +
        `on turn ${input.currentTurn as number}.`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-1510 — decayGrudges
  // -----------------------------------------------------------------------

  /**
   * Apply one turn of severity decay to every unresolved grudge.
   *
   * - Base decay: `decayPerTurn` (−0.5 by default).
   * - If `vengefulIndex > 50`, effective decay is reduced by
   *   `vengefulDecayReduction` (×0.5 → −0.25 per turn).
   * - Severity cannot drop below `minimumSeverity` (1).
   * - Resolved grudges pass through unchanged.
   *
   * @param input - Grudge array and vengeful index.
   * @returns Updated grudges with decay applied.
   *
   * @see FR-1510
   */
  decayGrudges(input: DecayGrudgesInput): DecayGrudgesResult {
    const { decayPerTurn, minimumSeverity, vengefulDecayReduction } =
      this.cfg.grudge;

    const effectiveDecay =
      input.vengefulIndex > 50
        ? decayPerTurn * vengefulDecayReduction
        : decayPerTurn;

    let grudgesDecayed = 0;
    let grudgesAtMinimum = 0;

    const updatedGrudges = input.grudges.map((g) => {
      if (g.resolved) {
        return g;
      }

      const newSeverity = Math.max(
        g.currentDecayedSeverity + effectiveDecay,
        minimumSeverity,
      );

      if (newSeverity <= minimumSeverity) {
        grudgesAtMinimum++;
      }

      if (newSeverity < g.currentDecayedSeverity) {
        grudgesDecayed++;
      }

      return { ...g, currentDecayedSeverity: newSeverity };
    });

    return {
      updatedGrudges,
      grudgesDecayed,
      grudgesAtMinimum,
      reason:
        `Decayed ${grudgesDecayed} grudge(s) for ${input.leaderId as string} ` +
        `(effective decay ${effectiveDecay}/turn, vengeful=${input.vengefulIndex}). ` +
        `${grudgesAtMinimum} at minimum severity.`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-1510 — computeRetaliationUtility
  // -----------------------------------------------------------------------

  /**
   * Compute how much a leader's unresolved grudges boost the utility of
   * retaliating against a specific target.
   *
   * ```
   * totalGrudgeSeverity = Σ currentDecayedSeverity (unresolved, vs target)
   * utilityBoost        = totalGrudgeSeverity × retaliationUtilityMultiplier
   * modifiedUtility     = baseUtility + utilityBoost
   * ```
   *
   * @param input - Target leader, grudge array, and base utility.
   * @returns Utility breakdown.
   *
   * @see FR-1510
   */
  computeRetaliationUtility(
    input: RetaliationUtilityInput,
  ): RetaliationUtilityResult {
    const { retaliationUtilityMultiplier } = this.cfg.grudge;

    const relevantGrudges = input.grudges.filter(
      (g) => !g.resolved && g.offender === input.targetLeader,
    );

    const totalGrudgeSeverity = relevantGrudges.reduce(
      (sum, g) => sum + g.currentDecayedSeverity,
      0,
    );

    const utilityBoost = totalGrudgeSeverity * retaliationUtilityMultiplier;
    const modifiedUtility = input.baseUtility + utilityBoost;

    return {
      totalGrudgeSeverity,
      utilityBoost,
      modifiedUtility,
      grudgeCount: relevantGrudges.length,
      reason:
        `${input.leaderId as string} holds ${relevantGrudges.length} unresolved ` +
        `grudge(s) against ${input.targetLeader as string} ` +
        `(total severity ${totalGrudgeSeverity.toFixed(1)}). ` +
        `Utility boost: ${utilityBoost.toFixed(1)} → modified ${modifiedUtility.toFixed(1)}.`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-1510 — resolveGrudge
  // -----------------------------------------------------------------------

  /**
   * Mark one or more grudges as resolved (forgiven or avenged).
   *
   * - If `offenseType` is `null`, **all** unresolved grudges against the
   *   specified offender are resolved.
   * - Otherwise, only the **first** matching unresolved grudge with the
   *   given offender AND offense type is resolved.
   *
   * @param input - Offender, optional offense type filter, and current turn.
   * @returns Updated grudge array and count of resolved grudges.
   *
   * @see FR-1510
   */
  resolveGrudge(input: ResolveGrudgeInput): ResolveGrudgeResult {
    let resolvedCount = 0;
    let firstMatched = false;

    const updatedGrudges: Grudge[] = input.offenseType === null
      ? // Resolve ALL unresolved grudges against offender
        input.grudges.map((g) => {
          if (!g.resolved && g.offender === input.offender) {
            resolvedCount++;
            return { ...g, resolved: true };
          }
          return { ...g };
        })
      : // Resolve only the FIRST unresolved grudge matching offender + type
        input.grudges.map((g) => {
          if (
            !firstMatched &&
            !g.resolved &&
            g.offender === input.offender &&
            g.offenseType === input.offenseType
          ) {
            firstMatched = true;
            resolvedCount++;
            return { ...g, resolved: true };
          }
          return { ...g };
        });

    return {
      resolvedCount,
      updatedGrudges,
      reason:
        resolvedCount > 0
          ? `Resolved ${resolvedCount} grudge(s) held by ${input.leaderId as string} ` +
            `against ${input.offender as string}` +
            (input.offenseType !== null ? ` (type: ${input.offenseType})` : ' (all types)') +
            '.'
          : `No matching unresolved grudges found for ${input.leaderId as string} ` +
            `against ${input.offender as string}.`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-1520 — buildDossier
  // -----------------------------------------------------------------------

  /**
   * Build a Leader Dossier aggregating psychological, emotional, and
   * relational data about a target leader.
   *
   * Each section is gated by a minimum HUMINT clarity score. Sections
   * whose threshold exceeds the player's HUMINT show `"??"` and are
   * marked `available: false`.
   *
   * Overall clarity bands:
   * - ≥ 60 → `'high'`
   * - ≥ 40 → `'medium'`
   * - ≥ 20 → `'low'`
   * - < 20 → `'minimal'`
   *
   * @param input - Target leader data and HUMINT clarity score.
   * @returns Dossier with gated sections.
   *
   * @see FR-1520
   */
  buildDossier(input: DossierInput): DossierResult {
    const humint = input.humintClarity;

    const sections: DossierSection[] = [
      // (a) Psychological Profile — requires 30
      {
        label: 'Psychological Profile',
        available: humint >= 30,
        requiredHumint: 30,
        summary:
          humint >= 30
            ? `Psychological profile available for ${input.targetLeader as string}.`
            : '??',
      },
      // (b) Emotional State — requires 40
      {
        label: 'Emotional State',
        available: humint >= 40,
        requiredHumint: 40,
        summary:
          humint >= 40 && input.knownEmotionalState !== null
            ? `Stress: ${input.knownEmotionalState.stress}, ` +
              `Confidence: ${input.knownEmotionalState.confidence}, ` +
              `Anger: ${input.knownEmotionalState.anger}, ` +
              `Fear: ${input.knownEmotionalState.fear}, ` +
              `Resolve: ${input.knownEmotionalState.resolve}.`
            : '??',
      },
      // (c) Cognitive Biases — requires 60
      {
        label: 'Cognitive Biases',
        available: humint >= 60,
        requiredHumint: 60,
        summary:
          humint >= 60
            ? `${input.knownBiasCount} cognitive bias(es) identified.`
            : '??',
      },
      // (d) Chemistry — requires 20
      {
        label: 'Chemistry',
        available: humint >= 20,
        requiredHumint: 20,
        summary:
          humint >= 20 && input.chemistry !== null
            ? `Chemistry score: ${input.chemistry}.`
            : '??',
      },
      // (e) Trust Score — requires 20
      {
        label: 'Trust Score',
        available: humint >= 20,
        requiredHumint: 20,
        summary:
          humint >= 20 && input.trust !== null
            ? `Trust score: ${input.trust}.`
            : '??',
      },
      // (f) Grudge Ledger — requires 40
      {
        label: 'Grudge Ledger',
        available: humint >= 40,
        requiredHumint: 40,
        summary:
          humint >= 40
            ? `${input.grudgeCount} active grudge(s) on record.`
            : '??',
      },
      // (g) Personality Drift — requires 50
      {
        label: 'Personality Drift',
        available: humint >= 50,
        requiredHumint: 50,
        summary:
          humint >= 50 && input.driftMagnitude !== null
            ? `Drift magnitude: ${input.driftMagnitude}.`
            : '??',
      },
    ];

    const overallClarity: DossierResult['overallClarity'] =
      humint >= 60
        ? 'high'
        : humint >= 40
          ? 'medium'
          : humint >= 20
            ? 'low'
            : 'minimal';

    return {
      targetLeader: input.targetLeader,
      sections,
      overallClarity,
      reason:
        `Dossier on ${input.targetLeader as string}: ` +
        `${sections.filter((s) => s.available).length}/${sections.length} sections available ` +
        `(HUMINT ${humint}, clarity: ${overallClarity}).`,
    };
  }
}
