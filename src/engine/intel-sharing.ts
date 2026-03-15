/**
 * Alliance Intelligence Sharing Engine
 *
 * Implements FR-905 — Alliance Intel Sharing agreements add +10 to +15 to the
 * weaker partner's lowest intelligence sub-score for the duration of the pact.
 *
 * The "weaker" partner is the faction with the lower composite intel score
 * (sum of HUMINT + SIGINT + CYBER + COVERT). When two factions enter an
 * intel-sharing pact the weaker partner's lowest sub-score receives a bonus
 * whose magnitude scales with the strength gap between the two partners.
 *
 * All functions are pure — no mutation of inputs.
 *
 * @see FR-905 — Alliance Intelligence Sharing
 */

import { GAME_CONFIG } from '@/engine/config';
import { IntelSubScore } from '@/data/types';
import type { FactionId } from '@/data/types';
import type { IntelCapability } from '@/engine/intel-capability';

// ── Alias ────────────────────────────────────────────────────────────────────
const ISS = IntelSubScore;

// ── Config type ──────────────────────────────────────────────────────────────

/** Resolved intelligence-sharing configuration shape. @see FR-905 */
export type IntelSharingConfig = typeof GAME_CONFIG.intelligence.sharing;

// ── Domain types ─────────────────────────────────────────────────────────────

/**
 * An active intel-sharing pact between two factions.
 *
 * @see FR-905
 */
export interface IntelSharingPact {
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly active: boolean;
}

/**
 * The computed bonus for a single faction from one pact.
 *
 * @see FR-905
 */
export interface SharingBonus {
  readonly beneficiaryFaction: FactionId;
  readonly partnerFaction: FactionId;
  readonly targetSubScore: IntelSubScore;
  readonly bonusAmount: number;
  readonly reason: string;
}

/**
 * Input for computing sharing bonuses.
 *
 * @see FR-905
 */
export interface SharingInput {
  readonly pacts: readonly IntelSharingPact[];
  readonly capabilities: ReadonlyMap<FactionId, IntelCapability>;
}

/**
 * Result of applying all sharing bonuses.
 *
 * @see FR-905
 */
export interface SharingResult {
  readonly bonuses: readonly SharingBonus[];
  readonly adjustedCapabilities: ReadonlyMap<FactionId, IntelCapability>;
}

/**
 * Clarity bonus aggregation for Fog of War calculation.
 *
 * @see FR-905
 */
export interface ClarityBonus {
  readonly factionId: FactionId;
  readonly totalSharingBonus: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value to the [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Computes and applies alliance intelligence-sharing bonuses per FR-905.
 *
 * Stateless: every public method is pure and returns new objects rather than
 * mutating existing state.
 *
 * @see FR-905 — Alliance Intelligence Sharing
 */
export class IntelSharingEngine {
  private readonly cfg: IntelSharingConfig;

  constructor(config?: IntelSharingConfig) {
    this.cfg = config ?? GAME_CONFIG.intelligence.sharing;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Determine which faction is the "weaker" partner.
   *
   * Weaker = lower composite intel score (sum of all four sub-scores).
   * If composites are equal, `factionA` is treated as the weaker partner
   * for a deterministic tie-break.
   *
   * @see FR-905
   */
  identifyWeakerPartner(
    capA: IntelCapability,
    capB: IntelCapability,
  ): FactionId {
    const compositeA = this.computeComposite(capA);
    const compositeB = this.computeComposite(capB);

    // Strict less-than: A is weaker. Tie also goes to A (deterministic).
    return compositeA <= compositeB ? capA.factionId : capB.factionId;
  }

  /**
   * Find the lowest sub-score of a given intel capability.
   *
   * Returns the sub-score category and its value. In the case of a tie the
   * priority order is HUMINT → SIGINT → CYBER → COVERT.
   *
   * @see FR-905
   */
  findLowestSubScore(
    capability: IntelCapability,
  ): { subScore: IntelSubScore; value: number } {
    const entries: readonly { subScore: IntelSubScore; value: number }[] = [
      { subScore: ISS.HUMINT, value: capability.humint },
      { subScore: ISS.SIGINT, value: capability.sigint },
      { subScore: ISS.CYBER, value: capability.cyber },
      { subScore: ISS.COVERT, value: capability.covert },
    ];

    let lowest = entries[0]!;
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.value < lowest.value) {
        lowest = entry;
      }
    }
    return lowest;
  }

  /**
   * Calculate the sharing-bonus amount based on the strength gap.
   *
   * ```
   * strengthDiff = |compositeA − compositeB|
   * bonus = bonusMin + (strengthDiff / maxStrengthDiff) × (bonusMax − bonusMin)
   * ```
   *
   * The result is clamped to `[bonusMin, bonusMax]`.
   *
   * @see FR-905
   */
  calculateBonusAmount(
    capA: IntelCapability,
    capB: IntelCapability,
  ): number {
    const { bonusMin, bonusMax, maxStrengthDiff } = this.cfg;
    const strengthDiff = Math.abs(
      this.computeComposite(capA) - this.computeComposite(capB),
    );
    const raw =
      bonusMin + (strengthDiff / maxStrengthDiff) * (bonusMax - bonusMin);
    return clamp(raw, bonusMin, bonusMax);
  }

  /**
   * Compute a single pact's sharing bonus.
   *
   * Returns `null` when the pact is inactive or either faction's capability
   * data is missing.
   *
   * Identifies the weaker partner, finds their lowest sub-score, and
   * calculates the bonus amount to be applied.
   *
   * @see FR-905
   */
  computePactBonus(
    pact: IntelSharingPact,
    capabilities: ReadonlyMap<FactionId, IntelCapability>,
  ): SharingBonus | null {
    if (!pact.active) return null;

    const capA = capabilities.get(pact.factionA);
    const capB = capabilities.get(pact.factionB);
    if (!capA || !capB) return null;

    const weakerFaction = this.identifyWeakerPartner(capA, capB);
    const strongerFaction =
      weakerFaction === pact.factionA ? pact.factionB : pact.factionA;
    const weakerCap =
      weakerFaction === capA.factionId ? capA : capB;

    const { subScore } = this.findLowestSubScore(weakerCap);
    const bonusAmount = this.calculateBonusAmount(capA, capB);

    return {
      beneficiaryFaction: weakerFaction,
      partnerFaction: strongerFaction,
      targetSubScore: subScore,
      bonusAmount,
      reason:
        `Intel-sharing pact: +${bonusAmount.toFixed(1)} to ${subScore} ` +
        `(weaker partner ${String(weakerFaction)}, ` +
        `partner ${String(strongerFaction)})`,
    };
  }

  /**
   * Apply all active pacts and return adjusted capabilities.
   *
   * Processes each active pact, accumulates bonuses per faction, and builds
   * a new capabilities map with the bonuses applied. A faction can benefit
   * from multiple pacts — bonuses stack. Sub-scores are clamped to [0, 100].
   *
   * @see FR-905
   */
  applyAllPacts(input: SharingInput): SharingResult {
    const { pacts, capabilities } = input;

    // 1. Compute individual pact bonuses
    const bonuses: SharingBonus[] = [];
    for (const pact of pacts) {
      const bonus = this.computePactBonus(pact, capabilities);
      if (bonus) {
        bonuses.push(bonus);
      }
    }

    // 2. Aggregate bonuses per (faction, subScore)
    const aggregated = new Map<string, number>();
    for (const b of bonuses) {
      const key = `${String(b.beneficiaryFaction)}::${b.targetSubScore}`;
      aggregated.set(key, (aggregated.get(key) ?? 0) + b.bonusAmount);
    }

    // 3. Build adjusted capabilities map
    const adjusted = new Map<FactionId, IntelCapability>();
    for (const [factionId, cap] of capabilities) {
      const humintBonus = aggregated.get(`${String(factionId)}::${ISS.HUMINT}`) ?? 0;
      const sigintBonus = aggregated.get(`${String(factionId)}::${ISS.SIGINT}`) ?? 0;
      const cyberBonus = aggregated.get(`${String(factionId)}::${ISS.CYBER}`) ?? 0;
      const covertBonus = aggregated.get(`${String(factionId)}::${ISS.COVERT}`) ?? 0;

      adjusted.set(factionId, {
        factionId: cap.factionId,
        humint: clamp(cap.humint + humintBonus, 0, 100),
        sigint: clamp(cap.sigint + sigintBonus, 0, 100),
        cyber: clamp(cap.cyber + cyberBonus, 0, 100),
        covert: clamp(cap.covert + covertBonus, 0, 100),
      });
    }

    return { bonuses, adjustedCapabilities: adjusted };
  }

  /**
   * Revoke bonuses when a pact is terminated.
   *
   * Removes the terminated pact's bonuses, then recomputes the adjusted
   * capabilities from the remaining active bonuses. Bonuses from other
   * active pacts are preserved.
   *
   * @see FR-905
   */
  revokePact(
    pact: IntelSharingPact,
    currentBonuses: readonly SharingBonus[],
    capabilities: ReadonlyMap<FactionId, IntelCapability>,
  ): SharingResult {
    // Filter out bonuses that belong to the terminated pact
    const remainingBonuses = currentBonuses.filter(
      (b) =>
        !(
          (b.beneficiaryFaction === pact.factionA &&
            b.partnerFaction === pact.factionB) ||
          (b.beneficiaryFaction === pact.factionB &&
            b.partnerFaction === pact.factionA)
        ),
    );

    // Aggregate remaining bonuses per (faction, subScore)
    const aggregated = new Map<string, number>();
    for (const b of remainingBonuses) {
      const key = `${String(b.beneficiaryFaction)}::${b.targetSubScore}`;
      aggregated.set(key, (aggregated.get(key) ?? 0) + b.bonusAmount);
    }

    // Rebuild adjusted capabilities from base + remaining bonuses
    const adjusted = new Map<FactionId, IntelCapability>();
    for (const [factionId, cap] of capabilities) {
      const humintBonus = aggregated.get(`${String(factionId)}::${ISS.HUMINT}`) ?? 0;
      const sigintBonus = aggregated.get(`${String(factionId)}::${ISS.SIGINT}`) ?? 0;
      const cyberBonus = aggregated.get(`${String(factionId)}::${ISS.CYBER}`) ?? 0;
      const covertBonus = aggregated.get(`${String(factionId)}::${ISS.COVERT}`) ?? 0;

      adjusted.set(factionId, {
        factionId: cap.factionId,
        humint: clamp(cap.humint + humintBonus, 0, 100),
        sigint: clamp(cap.sigint + sigintBonus, 0, 100),
        cyber: clamp(cap.cyber + cyberBonus, 0, 100),
        covert: clamp(cap.covert + covertBonus, 0, 100),
      });
    }

    return { bonuses: remainingBonuses, adjustedCapabilities: adjusted };
  }

  /**
   * Get total clarity bonus for a faction from all sharing pacts.
   *
   * Sums every bonus amount where the given faction is the beneficiary.
   * Intended for integration with the Fog of War clarity model.
   *
   * @see FR-905
   */
  getClarityBonus(
    factionId: FactionId,
    bonuses: readonly SharingBonus[],
  ): ClarityBonus {
    let totalSharingBonus = 0;
    for (const b of bonuses) {
      if (b.beneficiaryFaction === factionId) {
        totalSharingBonus += b.bonusAmount;
      }
    }
    return { factionId, totalSharingBonus };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Compute composite intel score — simple sum of all four sub-scores.
   *
   * Used to determine the weaker/stronger partner and the strength
   * differential that drives bonus magnitude.
   *
   * @see FR-905
   */
  private computeComposite(cap: IntelCapability): number {
    return cap.humint + cap.sigint + cap.cyber + cap.covert;
  }
}
