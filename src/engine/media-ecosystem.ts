/**
 * Media Ecosystem Engine — New Order
 *
 * Models each nation's media landscape and its impact on information warfare.
 * Media ecosystems determine how viral content propagates, how effectively
 * governments can censor incoming narratives, and how susceptible populations
 * are to foreign or domestic propaganda.
 *
 * Four ecosystem archetypes:
 *
 * | Type          | Virality | Censorship | Propaganda Resist. | Narrative Ctrl |
 * |---------------|----------|------------|--------------------|----------------|
 * | Free Press    | High     | Very Low   | High               | Low            |
 * | State Media   | Low      | High       | Low                | High           |
 * | Closed System | V. Low   | V. High    | Very Low           | Very High      |
 * | Fragmented    | Med-High | Low-Med    | Medium             | Low-Med        |
 *
 * **Free Press** (US / EU / Japan): High virality makes content spread fast,
 * but the government has almost no ability to suppress unfavourable stories.
 * Propaganda campaigns against Free Press nations have low domestic effect
 * because the population is relatively media-literate.
 *
 * **State Media** (China / Russia): Low external virality — foreign content
 * barely penetrates the information firewall. Domestically, the government
 * controls the narrative with high effectiveness, but state media output is
 * broadly distrusted by international audiences.
 *
 * **Closed System** (DPRK): Near-zero external penetration and total
 * internal control. Extremely resilient to outside information warfare —
 * but brittle: if the system cracks, collapse is rapid and catastrophic.
 *
 * **Fragmented** (Iran / Syria): Competing factions each run their own
 * media operations. Virality is moderately high (social media bypasses
 * censors), trust is low, and the ecosystem is vulnerable to targeted
 * narratives that exploit factional divides.
 *
 * Media ecosystem types are loaded from the scenario JSON and modify all
 * virality, censorship, and propaganda calculations across the simulation.
 *
 * All methods are **pure functions** that return new objects; no side effects,
 * no UI coupling, no global mutation. The game-state layer owns persistence.
 *
 * @see FR-1605 — Media Ecosystem System
 * @see DR-139  — Media Ecosystem Configuration
 */

import type {
  FactionId,
  MediaEcosystemType,
  MediaEcosystemConfig,
  ViralityEvent,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/** Minimum value for any score in the 0–100 range. */
const SCORE_MIN = 0;

/** Maximum value for any score in the 0–100 range. */
const SCORE_MAX = 100;

/**
 * Per-turn virality decay rate.
 * Each surviving turn, virality is reduced by this fraction.
 *
 * @see FR-1605
 */
const VIRALITY_DECAY_RATE = 0.2;

/**
 * Counter-narrative divisor — halves the virality when a
 * counter-narrative is active against an event.
 *
 * @see FR-1605
 */
const COUNTER_NARRATIVE_DIVISOR = 2;

/**
 * Percentage denominator for converting 0–100 scores to 0–1 multipliers.
 */
const PERCENT = 100;

/**
 * Weight assigned to domestic effectiveness when computing the
 * net propaganda effect (weighted average with international credibility).
 *
 * @see FR-1605
 */
const DOMESTIC_WEIGHT = 0.6;

/**
 * Weight assigned to international credibility when computing the
 * net propaganda effect (weighted average with domestic effectiveness).
 *
 * @see FR-1605
 */
const INTERNATIONAL_WEIGHT = 0.4;

/**
 * Vulnerability threshold: scores at or above this are considered 'critical'.
 *
 * @see FR-1605
 */
const VULNERABILITY_CRITICAL = 75;

/**
 * Vulnerability threshold: scores at or above this are considered 'high'.
 *
 * @see FR-1605
 */
const VULNERABILITY_HIGH = 50;

/**
 * Vulnerability threshold: scores at or above this are considered 'medium'.
 *
 * @see FR-1605
 */
const VULNERABILITY_MEDIUM = 25;

// ─────────────────────────────────────────────────────────
// Exported types & interfaces
// ─────────────────────────────────────────────────────────

/**
 * Result of a propaganda effectiveness computation.
 *
 * Domestic effectiveness represents the reach of propaganda within
 * the nation's own population. International credibility captures how
 * much the rest of the world trusts (or distrusts) the propaganda output.
 * Net effect is a weighted average of both.
 *
 * @see FR-1605
 */
export interface PropagandaResult {
  /** Domestic propaganda effectiveness. Range: 0–100. */
  readonly domesticEffectiveness: number;
  /** International credibility of the propaganda. Range: 0–100. */
  readonly internationalCredibility: number;
  /** Weighted average of domestic and international. Range: 0–100. */
  readonly netEffect: number;
}

/**
 * Input parameters for computing a virality score from
 * emotional intensity factors.
 *
 * @see FR-1605
 */
export interface ViralityEventInput {
  /** Base virality before emotional bonuses. Range: 0–100. */
  readonly baseVirality: number;
  /** Whether the event involves violence imagery or reports. */
  readonly hasViolence: boolean;
  /** Whether the event involves political or personal scandal. */
  readonly hasScandal: boolean;
  /** Whether the event involves a military or diplomatic triumph. */
  readonly hasTriumph: boolean;
  /** Platform penetration rate in the target population. Range: 0–100. */
  readonly platformPenetration: number;
}

/**
 * Summary of a media ecosystem's vulnerability to external
 * information warfare attacks.
 *
 * @see FR-1605
 */
export interface EcosystemVulnerability {
  /**
   * How vulnerable the nation is to external narrative attacks.
   * Higher = more vulnerable. Range: 0–100.
   */
  readonly externalAttackVulnerability: number;
  /**
   * Risk of internal information ecosystem destabilisation.
   * Higher = more fragile. Range: 0–100.
   */
  readonly internalStabilityRisk: number;
  /**
   * Strength of the government's narrative control apparatus.
   * Higher = stronger control. Range: 0–100.
   */
  readonly narrativeControlStrength: number;
  /** Overall risk assessment label. */
  readonly overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Subset of `GAME_CONFIG.infoWar` consumed by MediaEcosystemEngine.
 * Enables constructor injection for testing without pulling the
 * full game config.
 *
 * @see FR-1605
 */
export interface MediaEcosystemEngineConfig {
  /** Censorship effectiveness by media type. Values are 0–1 fractions. */
  readonly censorshipEffectiveness: Readonly<Record<string, number>>;
  /** Emotional intensity bonuses applied to virality. */
  readonly viralityFactors: Readonly<{
    violenceBonus: number;
    scandalBonus: number;
    triumphBonus: number;
  }>;
  /** Default ecosystem parameters keyed by lowercase type name. */
  readonly mediaEcosystemDefaults: Readonly<
    Record<
      string,
      Readonly<{
        viralityMultiplier: number;
        censorshipEffectiveness: number;
        propagandaResistance: number;
        narrativeControlScore: number;
      }>
    >
  >;
  /** How many turns a counter-narrative remains effective. */
  readonly counterNarrativeEffectTurns: number;
}

// ─────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────

/**
 * Maps a `MediaEcosystemType` enum value to the lowercase config key
 * used in `GAME_CONFIG.infoWar.mediaEcosystemDefaults`.
 *
 * @internal
 */
const TYPE_TO_CONFIG_KEY: Readonly<Record<MediaEcosystemType, string>> = {
  FreePress: 'freePress',
  StateMedia: 'stateMedia',
  ClosedSystem: 'closedSystem',
  Fragmented: 'fragmented',
};

// ─────────────────────────────────────────────────────────
// MediaEcosystemEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for media ecosystem mechanics.
 *
 * Calculates virality, censorship, propaganda effectiveness, event
 * propagation and decay, and ecosystem vulnerability assessments.
 * Stateless — every method takes its inputs as parameters and returns
 * a fresh result object.
 *
 * @example
 * ```ts
 * const engine = new MediaEcosystemEngine();
 * const config = engine.getDefaultConfig('us', 'FreePress');
 * const eff = engine.computeEffectiveVirality(60, config);
 * ```
 *
 * @see FR-1605
 */
export class MediaEcosystemEngine {
  // ── Private state ──────────────────────────────────────

  /** Resolved configuration (game config or test override). */
  private readonly cfg: MediaEcosystemEngineConfig;

  // ── Constructor ────────────────────────────────────────

  /**
   * Creates a new `MediaEcosystemEngine`.
   *
   * @param configOverride - Optional partial config for testing.
   *   Merged on top of the live `GAME_CONFIG.infoWar` defaults.
   *   Omitted keys fall through to the production config.
   */
  constructor(configOverride?: Partial<MediaEcosystemEngineConfig>) {
    const base = GAME_CONFIG.infoWar;
    this.cfg = {
      censorshipEffectiveness:
        configOverride?.censorshipEffectiveness ?? base.censorshipEffectiveness,
      viralityFactors:
        configOverride?.viralityFactors ?? base.viralityFactors,
      mediaEcosystemDefaults:
        configOverride?.mediaEcosystemDefaults ?? base.mediaEcosystemDefaults,
      counterNarrativeEffectTurns:
        configOverride?.counterNarrativeEffectTurns ??
        base.counterNarrativeEffectTurns,
    };
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Returns the default {@link MediaEcosystemConfig} for a given faction
   * and ecosystem type, sourced from the engine configuration.
   *
   * @param factionId - The faction to build a config for.
   * @param type      - The media ecosystem classification.
   * @returns A fully-populated {@link MediaEcosystemConfig}.
   *
   * @throws {Error} If the ecosystem type has no matching default entry.
   *
   * @example
   * ```ts
   * const cfg = engine.getDefaultConfig('us', 'FreePress');
   * // cfg.viralityMultiplier === 1.5
   * ```
   *
   * @see FR-1605
   */
  public getDefaultConfig(
    factionId: FactionId,
    type: MediaEcosystemType,
  ): MediaEcosystemConfig {
    const key = TYPE_TO_CONFIG_KEY[type];
    const defaults = this.cfg.mediaEcosystemDefaults[key];

    if (!defaults) {
      throw new Error(
        `[MediaEcosystemEngine] No default config for ecosystem type "${type}" (key="${key}").`,
      );
    }

    return {
      factionId,
      type,
      viralityMultiplier: defaults.viralityMultiplier,
      censorshipEffectiveness: this.clamp(defaults.censorshipEffectiveness),
      propagandaResistance: this.clamp(defaults.propagandaResistance),
      narrativeControlScore: this.clamp(defaults.narrativeControlScore),
    };
  }

  /**
   * Applies the ecosystem's virality multiplier to a base virality score.
   *
   * A Free Press ecosystem amplifies content (multiplier > 1), while a
   * Closed System dampens it (multiplier < 1).
   *
   * @param baseVirality - Raw virality score before ecosystem adjustment. 0–100.
   * @param ecosystem    - The nation's media ecosystem configuration.
   * @returns Effective virality, clamped to [0, 100].
   *
   * @example
   * ```ts
   * // Free Press: 60 × 1.5 = 90
   * engine.computeEffectiveVirality(60, freePressConfig); // 90
   * // Closed System: 60 × 0.2 = 12
   * engine.computeEffectiveVirality(60, closedConfig);    // 12
   * ```
   *
   * @see FR-1605
   */
  public computeEffectiveVirality(
    baseVirality: number,
    ecosystem: MediaEcosystemConfig,
  ): number {
    return this.clamp(baseVirality * ecosystem.viralityMultiplier);
  }

  /**
   * Reduces a virality score by the ecosystem's censorship effectiveness.
   *
   * Censorship effectiveness is a 0–100 percentage. The surviving fraction
   * of virality is `virality × (1 − censorshipEffectiveness / 100)`.
   *
   * @param virality  - Current virality score. 0–100.
   * @param ecosystem - The nation's media ecosystem configuration.
   * @returns Post-censorship virality, clamped to [0, 100].
   *
   * @example
   * ```ts
   * // State Media censorship 70 %: 80 × 0.30 = 24
   * engine.applyCensorship(80, stateMediaConfig); // 24
   * // Free Press censorship 5 %: 80 × 0.95 = 76
   * engine.applyCensorship(80, freePressConfig);  // 76
   * ```
   *
   * @see FR-1605
   */
  public applyCensorship(
    virality: number,
    ecosystem: MediaEcosystemConfig,
  ): number {
    const survivalRate = 1 - ecosystem.censorshipEffectiveness / PERCENT;
    return this.clamp(virality * survivalRate);
  }

  /**
   * Computes the domestic and international propaganda effectiveness
   * for a given base propaganda effort within a media ecosystem.
   *
   * **Domestic effectiveness** is the propaganda score reduced by the
   * population's propaganda resistance: `base × (1 − resistance / 100)`.
   *
   * **International credibility** varies by ecosystem type:
   * - *State Media*: Domestic output is high but internationally distrusted.
   *   International credibility = domesticEffectiveness × 0.3.
   * - *Free Press*: Even weak propaganda gains international traction.
   *   International credibility = domesticEffectiveness × 1.2 (clamped).
   * - *Closed System*: Nearly invisible externally.
   *   International credibility = domesticEffectiveness × 0.15.
   * - *Fragmented*: Moderate external reach.
   *   International credibility = domesticEffectiveness × 0.7.
   *
   * **Net effect** is a weighted average:
   * `0.6 × domestic + 0.4 × international`.
   *
   * @param basePropaganda - Raw propaganda score. 0–100.
   * @param ecosystem      - The nation's media ecosystem configuration.
   * @returns A {@link PropagandaResult} with domestic, international, and net.
   *
   * @example
   * ```ts
   * const r = engine.computePropagandaEffectiveness(70, stateMediaConfig);
   * // r.domesticEffectiveness = 49  (70 × 0.7)
   * // r.internationalCredibility = 14.7  (49 × 0.3)
   * // r.netEffect = 35.28
   * ```
   *
   * @see FR-1605
   */
  public computePropagandaEffectiveness(
    basePropaganda: number,
    ecosystem: MediaEcosystemConfig,
  ): PropagandaResult {
    const resistanceFactor = 1 - ecosystem.propagandaResistance / PERCENT;
    const domesticEffectiveness = this.clamp(basePropaganda * resistanceFactor);

    const internationalMultiplier =
      this.getInternationalCredibilityMultiplier(ecosystem.type);
    const internationalCredibility = this.clamp(
      domesticEffectiveness * internationalMultiplier,
    );

    const netEffect = this.clamp(
      DOMESTIC_WEIGHT * domesticEffectiveness +
        INTERNATIONAL_WEIGHT * internationalCredibility,
    );

    return {
      domesticEffectiveness,
      internationalCredibility,
      netEffect,
    };
  }

  /**
   * Computes a composite virality score from emotional intensity factors,
   * platform penetration, and a base virality input.
   *
   * The formula:
   * ```
   * raw = baseVirality
   *     + (hasViolence  ? violenceBonus : 0)
   *     + (hasScandal   ? scandalBonus  : 0)
   *     + (hasTriumph   ? triumphBonus  : 0)
   * score = raw × (platformPenetration / 100)
   * ```
   *
   * Result is clamped to [0, 100].
   *
   * @param input - Virality input parameters.
   * @returns Final virality score. 0–100.
   *
   * @example
   * ```ts
   * engine.computeViralityScore({
   *   baseVirality: 40,
   *   hasViolence: true,   // +20
   *   hasScandal: false,
   *   hasTriumph: true,    // +10
   *   platformPenetration: 80,
   * });
   * // raw = 40 + 20 + 10 = 70
   * // score = 70 × 0.80 = 56
   * ```
   *
   * @see FR-1605
   */
  public computeViralityScore(input: ViralityEventInput): number {
    const { violenceBonus, scandalBonus, triumphBonus } =
      this.cfg.viralityFactors;

    let raw = input.baseVirality;
    if (input.hasViolence) raw += violenceBonus;
    if (input.hasScandal) raw += scandalBonus;
    if (input.hasTriumph) raw += triumphBonus;

    const penetrationFactor = input.platformPenetration / PERCENT;
    return this.clamp(raw * penetrationFactor);
  }

  /**
   * Applies a counter-narrative to a viral event.
   *
   * If `counterNarrativeActive` is already `true`, the event's virality
   * is halved. The updated event is returned as a new object (immutable).
   * If no counter-narrative is active, the event is returned unchanged.
   *
   * @param event - The virality event to counter.
   * @returns A new {@link ViralityEvent} with adjusted virality if countered,
   *   or the original event reference if no counter is active.
   *
   * @example
   * ```ts
   * const countered = engine.applyCounterNarrative(event);
   * // countered.virality === event.virality / 2  (if counter was active)
   * ```
   *
   * @see FR-1605
   */
  public applyCounterNarrative(event: ViralityEvent): ViralityEvent {
    if (!event.counterNarrativeActive) {
      return event;
    }

    return {
      ...event,
      virality: this.clamp(event.virality / COUNTER_NARRATIVE_DIVISOR),
    };
  }

  /**
   * Propagates a viral event across all nations in the provided ecosystem
   * map, updating each nation's penetration in the `spreadMap`.
   *
   * For each nation:
   * ```
   * penetration = virality × viralityMultiplier × (1 − censorshipEffectiveness / 100)
   * ```
   *
   * The source nation is included in the spread (domestic virality).
   * All values in the resulting `spreadMap` are clamped to [0, 100].
   *
   * @param event      - The viral event to propagate.
   * @param ecosystems - Ecosystem configs keyed by faction ID.
   * @returns A new {@link ViralityEvent} with an updated `spreadMap`.
   *
   * @example
   * ```ts
   * const spread = engine.propagateEvent(event, ecosystemMap);
   * // spread.spreadMap['us'] might be 85 (high virality, low censorship)
   * // spread.spreadMap['dprk'] might be 3  (low virality, high censorship)
   * ```
   *
   * @see FR-1605
   */
  public propagateEvent(
    event: ViralityEvent,
    ecosystems: ReadonlyMap<FactionId, MediaEcosystemConfig>,
  ): ViralityEvent {
    const spreadMap: Partial<Record<FactionId, number>> = {};

    for (const [factionId, eco] of ecosystems) {
      const survivalRate = 1 - eco.censorshipEffectiveness / PERCENT;
      const penetration = this.clamp(
        event.virality * eco.viralityMultiplier * survivalRate,
      );
      spreadMap[factionId] = penetration;
    }

    return {
      ...event,
      spreadMap,
    };
  }

  /**
   * Decays a viral event by one turn.
   *
   * - Decrements `turnsToDecay` by 1.
   * - If the result is ≤ 0, the event has expired and `null` is returned.
   * - Otherwise, virality is reduced by {@link VIRALITY_DECAY_RATE} (20 %)
   *   and the updated event is returned.
   *
   * @param event - The viral event to decay.
   * @returns A new {@link ViralityEvent} with reduced virality, or `null`
   *   if the event has fully expired.
   *
   * @example
   * ```ts
   * let ev = { virality: 80, turnsToDecay: 3 };
   * ev = engine.decayEvent(ev);
   * // ev.virality === 64, ev.turnsToDecay === 2
   *
   * // ...after enough turns:
   * ev = engine.decayEvent(ev); // null when turnsToDecay hits 0
   * ```
   *
   * @see FR-1605
   */
  public decayEvent(event: ViralityEvent): ViralityEvent | null {
    const remainingTurns = event.turnsToDecay - 1;

    if (remainingTurns <= 0) {
      return null;
    }

    return {
      ...event,
      virality: this.clamp(event.virality * (1 - VIRALITY_DECAY_RATE)),
      turnsToDecay: remainingTurns,
    };
  }

  /**
   * Assesses a media ecosystem's vulnerability to external information
   * warfare and internal destabilisation.
   *
   * **External attack vulnerability**: how easily foreign narratives
   * penetrate the ecosystem. Inversely correlated with censorship
   * effectiveness and directly correlated with virality multiplier.
   * ```
   * externalAttackVulnerability = (100 − censorshipEffectiveness) × viralityMultiplier
   * ```
   *
   * **Internal stability risk**: risk that the information ecosystem
   * destabilises from within. Closed systems are brittle; fragmented
   * systems are inherently unstable.
   * ```
   * internalStabilityRisk = (100 − narrativeControlScore)
   *                       + (100 − propagandaResistance) × 0.3
   * ```
   *
   * **Narrative control strength**: direct read of `narrativeControlScore`.
   *
   * **Overall risk**: derived from the average of external vulnerability
   * and internal stability risk:
   * - ≥ 75 → 'critical'
   * - ≥ 50 → 'high'
   * - ≥ 25 → 'medium'
   * - < 25 → 'low'
   *
   * @param ecosystem - The media ecosystem to assess.
   * @returns An {@link EcosystemVulnerability} assessment.
   *
   * @example
   * ```ts
   * const vuln = engine.assessEcosystemVulnerability(freePressConfig);
   * // vuln.externalAttackVulnerability ≈ 142.5 → clamped to 100
   * // vuln.overallRisk === 'high'
   * ```
   *
   * @see FR-1605
   */
  public assessEcosystemVulnerability(
    ecosystem: MediaEcosystemConfig,
  ): EcosystemVulnerability {
    // External: how easily can foreign content penetrate?
    const externalAttackVulnerability = this.clamp(
      (PERCENT - ecosystem.censorshipEffectiveness) *
        ecosystem.viralityMultiplier,
    );

    // Internal: how fragile is the information ecosystem?
    const controlGap = PERCENT - ecosystem.narrativeControlScore;
    const resistanceGap = PERCENT - ecosystem.propagandaResistance;
    const internalStabilityRisk = this.clamp(
      controlGap + resistanceGap * 0.3,
    );

    // Narrative control: straight pass-through
    const narrativeControlStrength = this.clamp(
      ecosystem.narrativeControlScore,
    );

    // Overall risk classification
    const avgRisk =
      (externalAttackVulnerability + internalStabilityRisk) / 2;
    const overallRisk = this.classifyRisk(avgRisk);

    return {
      externalAttackVulnerability,
      internalStabilityRisk,
      narrativeControlStrength,
      overallRisk,
    };
  }

  // ── Private helpers ────────────────────────────────────

  /**
   * Clamps a numeric value to the [0, 100] range.
   *
   * @param value - The value to clamp.
   * @returns The value constrained to [0, 100].
   */
  private clamp(value: number): number {
    return Math.max(SCORE_MIN, Math.min(SCORE_MAX, value));
  }

  /**
   * Returns the international credibility multiplier for a given
   * media ecosystem type.
   *
   * - **State Media**: domestically effective but internationally
   *   distrusted — multiplier 0.3.
   * - **Free Press**: even modest propaganda carries international
   *   weight due to press credibility — multiplier 1.2.
   * - **Closed System**: nearly invisible outside — multiplier 0.15.
   * - **Fragmented**: moderate external reach — multiplier 0.7.
   *
   * @param type - The media ecosystem type.
   * @returns A multiplier in the range [0, ∞) to apply to domestic
   *   effectiveness for computing international credibility.
   */
  private getInternationalCredibilityMultiplier(
    type: MediaEcosystemType,
  ): number {
    switch (type) {
      case 'StateMedia':
        return 0.3;
      case 'FreePress':
        return 1.2;
      case 'ClosedSystem':
        return 0.15;
      case 'Fragmented':
        return 0.7;
      default: {
        // Exhaustive check — TypeScript will flag unhandled cases.
        const _exhaustive: never = type;
        throw new Error(
          `[MediaEcosystemEngine] Unknown ecosystem type: ${_exhaustive as string}`,
        );
      }
    }
  }

  /**
   * Classifies a numeric risk value into a human-readable label.
   *
   * @param avgRisk - The average risk score (0–100).
   * @returns One of 'low', 'medium', 'high', or 'critical'.
   */
  private classifyRisk(
    avgRisk: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (avgRisk >= VULNERABILITY_CRITICAL) return 'critical';
    if (avgRisk >= VULNERABILITY_HIGH) return 'high';
    if (avgRisk >= VULNERABILITY_MEDIUM) return 'medium';
    return 'low';
  }
}
