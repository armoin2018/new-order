/**
 * Intelligence Capability & Fog of War Engine
 *
 * Implements per-nation intelligence sub-scores (HUMINT, SIGINT, CYBER, COVERT),
 * composite scoring with configurable weights, and the Fog of War clarity model
 * that drives Ghost Unit probability and headline reliability.
 *
 * All functions are pure — no mutation of inputs.
 *
 * @see FR-901 — Intelligence Capability Sub-Scores
 * @see FR-902 — Fog of War / Clarity Model
 */

import { GAME_CONFIG } from '@/engine/config';
import { IntelSubScore } from '@/data/types';
import type { FactionId } from '@/data/types';

// ── Alias ────────────────────────────────────────────────────────────────────
const ISS = IntelSubScore;

// ── Config type ──────────────────────────────────────────────────────────────

/** Resolved intelligence configuration shape. @see FR-901, FR-902 */
export type IntelConfig = typeof GAME_CONFIG.intelligence;

// ── Domain types ─────────────────────────────────────────────────────────────

/**
 * Per-nation intelligence capability sub-scores.
 *
 * Each value ranges 0-100 and represents a distinct intelligence discipline.
 *
 * @see FR-901
 */
export interface IntelCapability {
  readonly factionId: FactionId;
  /** Human intelligence — agents, assets, informants. 0-100. */
  readonly humint: number;
  /** Signals intelligence — comms intercepts, electronic surveillance. 0-100. */
  readonly sigint: number;
  /** Cyber intelligence — network exploitation, digital espionage. 0-100. */
  readonly cyber: number;
  /** Covert operations — clandestine action, counterintelligence. 0-100. */
  readonly covert: number;
}

/**
 * Computed composite intelligence score with per-weight breakdown.
 *
 * Composite = humint×w_h + sigint×w_s + cyber×w_c + covert×w_v
 *
 * @see FR-901
 */
export interface CompositeIntelScore {
  readonly factionId: FactionId;
  /** Weighted composite score (0-100 range). */
  readonly composite: number;
  /** Individual weighted contributions for UI display. */
  readonly breakdown: {
    readonly humintWeighted: number;
    readonly sigintWeighted: number;
    readonly cyberWeighted: number;
    readonly covertWeighted: number;
  };
}

/**
 * Per-rival Fog of War clarity result.
 *
 * Clarity = (OwnIntelCapability + AllyIntelSharing) − TargetCounterIntel,
 * clamped to [0, 100]. Low clarity triggers ghost units and degrades headline
 * reliability.
 *
 * @see FR-902
 */
export interface ClarityResult {
  /** The faction doing the observing. */
  readonly observerFaction: FactionId;
  /** The faction being observed. */
  readonly targetFaction: FactionId;
  /** Observer's composite intel score (before ally bonus). */
  readonly ownIntelCapability: number;
  /** Bonus clarity from ally intel-sharing pacts. */
  readonly allyIntelSharing: number;
  /** Target's covert sub-score acting as counter-intelligence. */
  readonly targetCounterIntel: number;
  /** Final clarity value, clamped 0-100. */
  readonly clarity: number;
  /** True when clarity falls below the ghost-unit threshold. */
  readonly ghostUnitRisk: boolean;
  /** Probability of ghost-unit spawns this turn (0 when no risk). */
  readonly ghostUnitProbability: number;
  /** True when clarity is high enough for reliable headline intel. */
  readonly headlineReliable: boolean;
  /** Scaling factor applied to headline confidence (0-1). */
  readonly headlineReliabilityFactor: number;
}

/**
 * Input bundle for computing clarity against a specific rival.
 *
 * @see FR-902
 */
export interface ClarityInput {
  /** Observer's intelligence capability. */
  readonly observer: IntelCapability;
  /** Target's intelligence capability. */
  readonly target: IntelCapability;
  /** Flat bonus from intel-sharing pacts with allies. */
  readonly allyIntelBonus: number;
}

/**
 * Full per-turn intelligence assessment for one faction.
 *
 * Contains the faction's composite score and clarity against every rival.
 *
 * @see FR-901, FR-902
 */
export interface IntelAssessment {
  readonly factionId: FactionId;
  readonly compositeScore: CompositeIntelScore;
  readonly clarityByRival: readonly ClarityResult[];
}

/**
 * Input bundle for {@link IntelligenceCapabilityEngine.assessFaction}.
 *
 * @see FR-901, FR-902
 */
export interface IntelAssessmentInput {
  /** The faction being assessed. */
  readonly faction: IntelCapability;
  /** All rival factions to evaluate clarity against. */
  readonly rivals: readonly IntelCapability[];
  /** Map of rival factionId → ally intel-sharing bonus for this faction. */
  readonly allyBonusByRival: ReadonlyMap<FactionId, number>;
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Stateless engine for intelligence capability scoring and Fog of War clarity.
 *
 * All public methods are **pure** — they read from the provided inputs and the
 * injected (or default) {@link IntelConfig} without side-effects.
 *
 * @see FR-901 — Intelligence Capability Sub-Scores
 * @see FR-902 — Fog of War / Clarity Model
 */
export class IntelligenceCapabilityEngine {
  /** Resolved intelligence configuration. */
  private readonly cfg: IntelConfig;

  /**
   * @param config — Optional override; defaults to `GAME_CONFIG.intelligence`.
   */
  constructor(config?: IntelConfig) {
    this.cfg = config ?? GAME_CONFIG.intelligence;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Create an {@link IntelCapability} record for a faction.
   *
   * @param factionId — Owning faction.
   * @param humint    — HUMINT sub-score (0-100).
   * @param sigint    — SIGINT sub-score (0-100).
   * @param cyber     — CYBER sub-score  (0-100).
   * @param covert    — COVERT sub-score (0-100).
   * @returns Frozen capability record.
   *
   * @see FR-901
   */
  static createCapability(
    factionId: FactionId,
    humint: number,
    sigint: number,
    cyber: number,
    covert: number,
  ): IntelCapability {
    return { factionId, humint, sigint, cyber, covert };
  }

  // ── Composite scoring ────────────────────────────────────────────────────

  /**
   * Compute the weighted composite intelligence score for a faction.
   *
   * Formula:
   *   composite = humint × w_h + sigint × w_s + cyber × w_c + covert × w_v
   *
   * This is a weighted **sum**, not an average.
   *
   * @param capability — The faction's sub-score record.
   * @returns Composite score with per-discipline breakdown.
   *
   * @see FR-901
   */
  computeComposite(capability: IntelCapability): CompositeIntelScore {
    const w = this.cfg.subScoreWeights;

    const humintWeighted = capability.humint * w.humint;
    const sigintWeighted = capability.sigint * w.sigint;
    const cyberWeighted = capability.cyber * w.cyber;
    const covertWeighted = capability.covert * w.covert;

    const composite = humintWeighted + sigintWeighted + cyberWeighted + covertWeighted;

    return {
      factionId: capability.factionId,
      composite,
      breakdown: {
        humintWeighted,
        sigintWeighted,
        cyberWeighted,
        covertWeighted,
      },
    };
  }

  // ── Sub-score helpers ────────────────────────────────────────────────────

  /**
   * Retrieve the numeric value for a named sub-score.
   *
   * Uses an exhaustive switch to guarantee type-safety if the enum grows.
   *
   * @param capability — The faction's sub-score record.
   * @param subScore   — Which discipline to read.
   * @returns The 0-100 value for that discipline.
   *
   * @see FR-901
   */
  getSubScoreValue(capability: IntelCapability, subScore: IntelSubScore): number {
    switch (subScore) {
      case ISS.HUMINT:
        return capability.humint;
      case ISS.SIGINT:
        return capability.sigint;
      case ISS.CYBER:
        return capability.cyber;
      case ISS.COVERT:
        return capability.covert;
      default: {
        // Exhaustive check — will error at compile time if a variant is added.
        const _exhaustive: never = subScore;
        throw new Error(`Unknown IntelSubScore: ${_exhaustive as string}`);
      }
    }
  }

  /**
   * Identify the **lowest** sub-score discipline and its value.
   *
   * Useful for determining which area to bolster or which ally bonus to apply.
   *
   * @param capability — The faction's sub-score record.
   * @returns The weakest discipline and its value.
   *
   * @see FR-901, FR-905
   */
  findLowestSubScore(capability: IntelCapability): { subScore: IntelSubScore; value: number } {
    const entries: readonly { subScore: IntelSubScore; value: number }[] = [
      { subScore: ISS.HUMINT, value: capability.humint },
      { subScore: ISS.SIGINT, value: capability.sigint },
      { subScore: ISS.CYBER, value: capability.cyber },
      { subScore: ISS.COVERT, value: capability.covert },
    ];

    let lowest = entries[0]!;
    for (const entry of entries) {
      if (entry.value < lowest.value) {
        lowest = entry;
      }
    }
    return lowest;
  }

  /**
   * Identify the **highest** sub-score discipline and its value.
   *
   * Useful for intel-sharing calculations and operation success bonuses.
   *
   * @param capability — The faction's sub-score record.
   * @returns The strongest discipline and its value.
   *
   * @see FR-901
   */
  findHighestSubScore(capability: IntelCapability): { subScore: IntelSubScore; value: number } {
    const entries: readonly { subScore: IntelSubScore; value: number }[] = [
      { subScore: ISS.HUMINT, value: capability.humint },
      { subScore: ISS.SIGINT, value: capability.sigint },
      { subScore: ISS.CYBER, value: capability.cyber },
      { subScore: ISS.COVERT, value: capability.covert },
    ];

    let highest = entries[0]!;
    for (const entry of entries) {
      if (entry.value > highest.value) {
        highest = entry;
      }
    }
    return highest;
  }

  // ── Fog of War clarity ───────────────────────────────────────────────────

  /**
   * Compute Fog of War clarity for one observer against one target.
   *
   * ### Formula
   *
   * ```
   * Clarity = (OwnIntelCapability + AllyIntelSharing) − TargetCounterIntel
   * ```
   *
   * Where:
   * - **OwnIntelCapability** = observer's composite intelligence score
   * - **AllyIntelSharing**   = flat bonus from intel-sharing pacts
   * - **TargetCounterIntel** = target's COVERT sub-score (counterintelligence)
   *
   * Result is clamped to [0, 100].
   *
   * ### Derived effects
   *
   * - **Ghost Unit Risk**: `clarity < ghostUnitThreshold` (default 30)
   *   - Probability = `ghostUnitProbabilityBase × (1 − clarity / threshold)`
   * - **Headline Reliability**: `clarity ≥ headlineReliabilityThreshold` (default 40)
   *   - Factor = reliable ? 1.0 : `1.0 − reduction × (1 − clarity / threshold)`
   *
   * @param input — Observer, target, and ally bonus data.
   * @returns Full clarity result with diagnostic fields.
   *
   * @see FR-902
   */
  computeClarity(input: ClarityInput): ClarityResult {
    const { observer, target, allyIntelBonus } = input;
    const c = this.cfg.clarity;

    // Compute observer's composite intel score.
    const observerComposite = this.computeComposite(observer);
    const ownIntelCapability = observerComposite.composite;

    // Target's counterintelligence is their COVERT sub-score.
    const targetCounterIntel = target.covert;

    // Raw clarity formula.
    const rawClarity = c.base + ownIntelCapability + allyIntelBonus - targetCounterIntel;
    const clarity = this.clamp(rawClarity);

    // Ghost Unit risk assessment.
    const ghostUnitRisk = clarity < c.ghostUnitThreshold;
    const ghostUnitProbability = ghostUnitRisk
      ? c.ghostUnitProbabilityBase * (1 - clarity / c.ghostUnitThreshold)
      : 0;

    // Headline reliability assessment.
    const headlineReliable = clarity >= c.headlineReliabilityThreshold;
    const headlineReliabilityFactor = headlineReliable
      ? 1.0
      : 1.0 - c.headlineReliabilityReduction * (1 - clarity / c.headlineReliabilityThreshold);

    return {
      observerFaction: observer.factionId,
      targetFaction: target.factionId,
      ownIntelCapability,
      allyIntelSharing: allyIntelBonus,
      targetCounterIntel,
      clarity,
      ghostUnitRisk,
      ghostUnitProbability,
      headlineReliable,
      headlineReliabilityFactor,
    };
  }

  // ── Full assessment ──────────────────────────────────────────────────────

  /**
   * Produce a full per-turn intelligence assessment for one faction.
   *
   * Computes the faction's composite score, then evaluates clarity against
   * every provided rival (looking up per-rival ally bonuses from the map).
   *
   * @param input — Faction capability, rival list, and ally bonus map.
   * @returns Assessment containing composite score and per-rival clarity.
   *
   * @see FR-901, FR-902
   */
  assessFaction(input: IntelAssessmentInput): IntelAssessment {
    const { faction, rivals, allyBonusByRival } = input;

    const compositeScore = this.computeComposite(faction);

    const clarityByRival: ClarityResult[] = rivals.map((rival) => {
      const allyIntelBonus = allyBonusByRival.get(rival.factionId) ?? 0;
      return this.computeClarity({
        observer: faction,
        target: rival,
        allyIntelBonus,
      });
    });

    return {
      factionId: faction.factionId,
      compositeScore,
      clarityByRival,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Clamp a value to the configured clarity bounds.
   *
   * @param value — Raw value to clamp.
   * @returns Value clamped to `[cfg.clarity.min, cfg.clarity.max]`.
   */
  private clamp(value: number): number {
    return Math.max(this.cfg.clarity.min, Math.min(this.cfg.clarity.max, value));
  }
}
