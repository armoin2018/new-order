/**
 * Virality & Deepfake Operations Engine — New Order
 *
 * Models the Social Media Virality Engine (FR-1603) and Deepfake Operations
 * (FR-1604) subsystems of the information warfare layer. Virality governs
 * how fast and how far information events propagate across the global media
 * landscape, while deepfake operations allow high-risk fabrication attacks
 * that can devastate a rival's legitimacy — or catastrophically backfire.
 *
 * ## Social Media Virality (FR-1603)
 *
 * Every information event receives a **virality score** (0–100) that
 * determines its spread speed and downstream Mass Psychology impact.
 * The score is driven by:
 *
 * | Factor                  | Effect                                        |
 * |-------------------------|-----------------------------------------------|
 * | Emotional intensity     | +20 Violence, +15 Scandal, +10 Triumph        |
 * | Platform penetration    | US 0.9, EU 0.85, Japan 0.8 … DPRK 0.05       |
 * | Censorship effectiveness| China 70 %, DPRK 95 %, US 5 %                |
 * | Counter-narrative       | Halves virality if deployed within 1 turn     |
 *
 * ## Deepfake Operations (FR-1604)
 *
 * Three deepfake attack types, each gated behind CYBER ≥ 60 and a
 * Treasury cost of −10:
 *
 * | Type                    | On Success                          | On Detection (backfire)           |
 * |-------------------------|-------------------------------------|-----------------------------------|
 * | Fabricate Statements    | Target Legitimacy −15               | Deployer Legitimacy −25, Trust −15|
 * | Fake Atrocity Evidence  | Target Legitimacy −20, Unrest +10   | Deployer Legitimacy −25, Trust −15|
 * | Synthetic Intelligence  | Persists 3 turns in target pipeline | Deployer Legitimacy −25, Trust −15|
 *
 * Detection risk is proportional to the target's CYBER score:
 * `detectionProbability = targetCyber / 100`, clamped to [0.05, 0.95].
 *
 * All methods are **pure functions** that return new objects; no side effects,
 * no UI coupling, no global mutation. The game-state layer owns persistence.
 *
 * @see FR-1603 — Social Media Virality Engine
 * @see FR-1604 — Deepfake Operations
 */

import type {
  FactionId,
  ContentCategory,
  DeepfakeType,
  ViralityEvent,
  SocialMediaViralityQueue,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/** Minimum value for any score in the 0–100 range. */
const SCORE_MIN = 0;

/** Maximum value for any score in the 0–100 range. */
const SCORE_MAX = 100;

/** Floor for detection probability — even the worst target catches 5 %. @see FR-1604 */
const DETECTION_FLOOR = 0.05;

/** Ceiling for detection probability — even the best target caps at 95 %. @see FR-1604 */
const DETECTION_CEILING = 0.95;

/** Percentage denominator for converting 0–100 scores to 0–1 multipliers. */
const PERCENT = 100;

// ─────────────────────────────────────────────────────────
// Configuration Interface
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset consumed by {@link ViralityDeepfakeEngine}.
 *
 * Mirrors the relevant portions of `GAME_CONFIG.infoWar` so the engine
 * can be instantiated with test-friendly overrides without pulling the
 * full game config.
 *
 * @see FR-1603
 * @see FR-1604
 */
export interface ViralityDeepfakeConfig {
  /** Emotional intensity bonuses applied to base virality. @see FR-1603 */
  readonly viralityFactors: Readonly<{
    /** Bonus for violence-related content. */
    violenceBonus: number;
    /** Bonus for scandal-related content. */
    scandalBonus: number;
    /** Bonus for triumph-related content. */
    triumphBonus: number;
  }>;

  /** Censorship effectiveness by media ecosystem type (0–1 fractions). @see FR-1603 */
  readonly censorshipEffectiveness: Readonly<Record<string, number>>;

  /** How many turns a counter-narrative remains effective. @see FR-1603 */
  readonly counterNarrativeEffectTurns: number;

  /** Counter-narrative virality reduction multiplier (e.g. 0.5 = halve). @see FR-1603 */
  readonly counterNarrativeReductionFactor: number;

  /** Platform penetration per faction (0.0–1.0). @see FR-1603 */
  readonly platformPenetration: Readonly<Record<string, number>>;

  /** Absolute virality decay per turn. @see FR-1603 */
  readonly viralityDecayPerTurn: number;

  /** Deepfake operation thresholds, costs, and effect tables. @see FR-1604 */
  readonly deepfake: Readonly<{
    /** Minimum CYBER score required to launch a deepfake. */
    cyberThreshold: number;
    /** Treasury cost (negative) to deploy a deepfake operation. */
    treasuryCost: number;
    /** Fabricate rival leader statements effect table. */
    fabricateStatements: Readonly<{
      targetLegitimacyPenalty: number;
    }>;
    /** Fake atrocity evidence effect table. */
    fakeAtrocityEvidence: Readonly<{
      targetLegitimacyPenalty: number;
      targetUnrestBoost: number;
    }>;
    /** Synthetic intelligence planted reports. */
    syntheticIntelligence: Readonly<{
      persistenceTurns: number;
    }>;
    /** Backfire penalties when the deepfake is detected. */
    detectionBackfire: Readonly<{
      deployerLegitimacyPenalty: number;
      trustPenaltyAllNations: number;
    }>;
  }>;
}

// ─────────────────────────────────────────────────────────
// Input / Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Input for computing a base virality score from content categories.
 *
 * The caller supplies the emotional content flags (violence, scandal,
 * triumph) and an optional base score; the engine applies the configured
 * intensity bonuses and returns a clamped 0–100 value.
 *
 * @see FR-1603
 */
export interface ViralityComputeInput {
  /** Starting virality before emotional bonuses. Range: 0–100. */
  readonly baseVirality: number;
  /** Content categories present in this event. */
  readonly categories: readonly ContentCategory[];
}

/**
 * Input for computing per-nation effective virality after platform
 * penetration and censorship adjustments.
 *
 * @see FR-1603
 */
export interface EffectiveViralityInput {
  /** Base virality score (output of {@link ViralityDeepfakeEngine.computeBaseVirality}). */
  readonly baseVirality: number;
  /** Faction IDs of target nations to compute effective virality for. */
  readonly targetFactions: readonly FactionId[];
}

/**
 * Result of computing effective virality across target nations.
 *
 * Contains a per-faction breakdown of how the base virality is modified
 * by each nation's platform penetration rate and censorship apparatus.
 *
 * @see FR-1603
 */
export interface EffectiveViralityResult {
  /** Per-nation effective virality scores. Range: 0–100 per entry. */
  readonly perNation: Readonly<Partial<Record<FactionId, number>>>;
  /** Average effective virality across all target nations. Range: 0–100. */
  readonly averageVirality: number;
}

/**
 * Input for validating deepfake operation prerequisites.
 *
 * The engine checks the deploying faction's CYBER capability, available
 * treasury, and whether an operation slot is free.
 *
 * @see FR-1604
 */
export interface DeepfakePrereqInput {
  /** Deploying faction's CYBER technology score. Range: 0–100. */
  readonly deployerCyber: number;
  /** Deploying faction's current treasury value. */
  readonly deployerTreasury: number;
  /** Whether the deploying faction has a free CYBER operation slot. */
  readonly hasAvailableSlot: boolean;
}

/**
 * Result of a deepfake prerequisite validation.
 *
 * If `eligible` is `false`, the `reasons` array explains which checks
 * failed so the UI can present actionable feedback.
 *
 * @see FR-1604
 */
export interface DeepfakePrereqResult {
  /** Whether all prerequisites are satisfied. */
  readonly eligible: boolean;
  /** Human-readable reasons for any failed checks. Empty when eligible. */
  readonly reasons: readonly string[];
}

/**
 * Input for executing a deepfake operation.
 *
 * Contains everything the engine needs to resolve a deepfake attack:
 * the operation type, both factions' CYBER scores, and a deterministic
 * random roll for detection (0–1). Supplying a fixed `detectionRoll`
 * makes the function fully deterministic and testable.
 *
 * @see FR-1604
 */
export interface DeepfakeExecutionInput {
  /** The type of deepfake operation to execute. */
  readonly type: DeepfakeType;
  /** Deploying faction identifier. */
  readonly deployerFaction: FactionId;
  /** Target faction identifier. */
  readonly targetFaction: FactionId;
  /** Deployer's CYBER technology score. Range: 0–100. */
  readonly deployerCyber: number;
  /** Target's CYBER technology score. Range: 0–100. */
  readonly targetCyber: number;
  /**
   * Deterministic random roll for detection check (0–1).
   * If roll < detectionRisk → detected.
   */
  readonly detectionRoll: number;
}

/**
 * Outcome of a deepfake operation execution.
 *
 * Reports whether the operation was detected and enumerates all
 * effects that should be applied to the game state. Effects are
 * described declaratively so the state layer can apply them without
 * knowledge of the underlying formulas.
 *
 * @see FR-1604
 */
export interface DeepfakeExecutionResult {
  /** Whether the target nation detected the deepfake. */
  readonly detected: boolean;
  /** Detection probability that was used (for UI / logs). Range: 0.05–0.95. */
  readonly detectionRisk: number;
  /** The deepfake type that was attempted. */
  readonly type: DeepfakeType;
  /** Deploying faction. */
  readonly deployerFaction: FactionId;
  /** Target faction. */
  readonly targetFaction: FactionId;
  /** Legitimacy delta to apply to the target faction. */
  readonly targetLegitimacyDelta: number;
  /** Civil unrest delta to apply to the target faction. */
  readonly targetUnrestDelta: number;
  /** Legitimacy delta to apply to the deploying faction (backfire). */
  readonly deployerLegitimacyDelta: number;
  /** Trust penalty to apply to ALL nations towards deployer (backfire). */
  readonly allNationTrustDelta: number;
  /**
   * Number of turns planted synthetic intelligence persists.
   * Only relevant for `SyntheticIntelligence` type; 0 otherwise.
   */
  readonly syntheticPersistenceTurns: number;
  /** Treasury cost applied to the deployer. */
  readonly treasuryCost: number;
}

// ─────────────────────────────────────────────────────────
// ViralityDeepfakeEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for social media virality mechanics and
 * deepfake operations.
 *
 * Computes base and effective virality, applies counter-narratives and
 * per-turn decay, validates deepfake prerequisites, executes deepfake
 * attacks, and calculates detection risk. Stateless — every method takes
 * its inputs as parameters and returns a fresh result object.
 *
 * @example
 * ```ts
 * const engine = new ViralityDeepfakeEngine();
 *
 * // FR-1603: compute virality
 * const base = engine.computeBaseVirality({
 *   baseVirality: 30,
 *   categories: ['Violence', 'Scandal'],
 * });
 * // base === 65  (30 + 20 + 15)
 *
 * // FR-1604: execute a deepfake
 * const result = engine.executeDeepfake({
 *   type: 'FabricateStatements',
 *   deployerFaction: 'russia',
 *   targetFaction: 'us',
 *   deployerCyber: 70,
 *   targetCyber: 85,
 *   detectionRoll: 0.9,
 * });
 * ```
 *
 * @see FR-1603 — Social Media Virality Engine
 * @see FR-1604 — Deepfake Operations
 */
export class ViralityDeepfakeEngine {
  // ── Private state ──────────────────────────────────────

  /** Resolved configuration (game config or test override). */
  private readonly cfg: ViralityDeepfakeConfig;

  // ── Constructor ────────────────────────────────────────

  /**
   * Creates a new `ViralityDeepfakeEngine`.
   *
   * @param configOverride - Optional partial config for testing.
   *   Merged on top of the live `GAME_CONFIG.infoWar` defaults.
   *   Omitted keys fall through to the production config.
   *
   * @see FR-1603
   * @see FR-1604
   */
  constructor(configOverride?: Partial<ViralityDeepfakeConfig>) {
    const base = GAME_CONFIG.infoWar;
    this.cfg = {
      viralityFactors:
        configOverride?.viralityFactors ?? base.viralityFactors,
      censorshipEffectiveness:
        configOverride?.censorshipEffectiveness ?? base.censorshipEffectiveness,
      counterNarrativeEffectTurns:
        configOverride?.counterNarrativeEffectTurns ??
        base.counterNarrativeEffectTurns,
      counterNarrativeReductionFactor:
        configOverride?.counterNarrativeReductionFactor ??
        base.counterNarrativeReductionFactor,
      platformPenetration:
        configOverride?.platformPenetration ?? base.platformPenetration,
      viralityDecayPerTurn:
        configOverride?.viralityDecayPerTurn ?? base.viralityDecayPerTurn,
      deepfake:
        configOverride?.deepfake ?? base.deepfake,
    };
  }

  // ── Public API — Virality (FR-1603) ────────────────────

  /**
   * Computes the **base virality** score from content categories.
   *
   * Starting from the supplied `baseVirality`, each content category
   * present in the event adds an emotional intensity bonus:
   *
   * | Category  | Bonus |
   * |-----------|-------|
   * | Violence  | +20   |
   * | Scandal   | +15   |
   * | Triumph   | +10   |
   *
   * The result is clamped to [0, 100].
   *
   * @param input - The virality computation input.
   * @returns Base virality score, clamped 0–100.
   *
   * @example
   * ```ts
   * engine.computeBaseVirality({
   *   baseVirality: 30,
   *   categories: ['Violence', 'Scandal'],
   * });
   * // 30 + 20 + 15 = 65
   * ```
   *
   * @see FR-1603
   */
  public computeBaseVirality(input: ViralityComputeInput): number {
    const { violenceBonus, scandalBonus, triumphBonus } =
      this.cfg.viralityFactors;

    let raw = input.baseVirality;

    for (const category of input.categories) {
      switch (category) {
        case 'Violence':
          raw += violenceBonus;
          break;
        case 'Scandal':
          raw += scandalBonus;
          break;
        case 'Triumph':
          raw += triumphBonus;
          break;
        default: {
          // Exhaustive check — TypeScript flags unhandled variants.
          const _exhaustive: never = category;
          throw new Error(
            `[ViralityDeepfakeEngine] Unknown content category: ${_exhaustive as string}`,
          );
        }
      }
    }

    return this.clamp(raw);
  }

  /**
   * Computes **effective virality** per target nation after applying
   * platform penetration and censorship adjustments.
   *
   * For each target faction:
   * ```
   * effectiveVirality = baseVirality
   *                   × platformPenetration[faction]
   *                   × (1 − censorshipEffectiveness[ecosystemType])
   * ```
   *
   * Platform penetration is looked up from config by faction ID.
   * Censorship effectiveness is resolved per-nation via the
   * ecosystem-type → config-key mapping. When a faction's penetration
   * or censorship key is missing from config, a safe default of 0.5
   * penetration and 0.3 censorship is used.
   *
   * Also returns the arithmetic mean of all per-nation scores.
   *
   * @param input - Base virality and target faction list.
   * @returns Per-nation effective virality and the cross-nation average.
   *
   * @example
   * ```ts
   * const result = engine.computeEffectiveVirality({
   *   baseVirality: 65,
   *   targetFactions: ['us', 'china', 'dprk'],
   * });
   * // result.perNation['us']   ≈ 65 × 0.90 × (1 - 0.05) = 55.6
   * // result.perNation['china']≈ 65 × 0.30 × (1 - 0.70) =  5.85
   * // result.perNation['dprk'] ≈ 65 × 0.05 × (1 - 0.95) =  0.16
   * ```
   *
   * @see FR-1603
   */
  public computeEffectiveVirality(
    input: EffectiveViralityInput,
  ): EffectiveViralityResult {
    const perNation: Partial<Record<FactionId, number>> = {};
    let sum = 0;
    let count = 0;

    for (const factionId of input.targetFactions) {
      const penetration = this.getPlatformPenetration(factionId);
      const censorship = this.getCensorshipForFaction(factionId);
      const effective = this.clamp(
        input.baseVirality * penetration * (1 - censorship),
      );
      perNation[factionId] = effective;
      sum += effective;
      count += 1;
    }

    const averageVirality = count > 0
      ? this.clamp(sum / count)
      : 0;

    return { perNation, averageVirality };
  }

  /**
   * Applies a **counter-narrative** to a viral event.
   *
   * If the counter-narrative is being activated (or is already active),
   * the event's virality is multiplied by the configured
   * `counterNarrativeReductionFactor` (default 0.5, i.e. halved).
   * A new event object is returned with:
   * - `virality` reduced and clamped to [0, 100]
   * - `counterNarrativeActive` set to `true`
   *
   * Spread map entries are also proportionally reduced.
   *
   * @param event - The virality event to counter.
   * @returns A new {@link ViralityEvent} with reduced virality.
   *
   * @example
   * ```ts
   * const original = { virality: 80, counterNarrativeActive: false, ... };
   * const countered = engine.applyCounterNarrative(original);
   * // countered.virality === 40
   * // countered.counterNarrativeActive === true
   * ```
   *
   * @see FR-1603
   */
  public applyCounterNarrative(event: ViralityEvent): ViralityEvent {
    const factor = this.cfg.counterNarrativeReductionFactor;
    const newVirality = this.clamp(event.virality * factor);

    const newSpreadMap: Partial<Record<FactionId, number>> = {};
    for (const key of Object.keys(event.spreadMap) as FactionId[]) {
      const value = event.spreadMap[key];
      if (value !== undefined) {
        newSpreadMap[key] = this.clamp(value * factor);
      }
    }

    return {
      ...event,
      virality: newVirality,
      spreadMap: newSpreadMap,
      counterNarrativeActive: true,
    };
  }

  /**
   * Decays all events in a **virality queue** by one turn.
   *
   * For each event in the queue:
   * 1. Reduce `virality` by `viralityDecayPerTurn` (absolute subtraction).
   * 2. Decrement `turnsToDecay` by 1.
   * 3. Remove events where `turnsToDecay ≤ 0` or `virality ≤ 0`.
   *
   * Returns a new queue with the surviving events. The original queue
   * is not mutated.
   *
   * @param queue - The current turn's virality queue.
   * @returns A new {@link SocialMediaViralityQueue} with decayed events.
   *
   * @example
   * ```ts
   * const decayed = engine.decayViralityQueue(queue);
   * // Events with turnsToDecay <= 0 are removed.
   * // Remaining events have virality reduced by 15.
   * ```
   *
   * @see FR-1603
   */
  public decayViralityQueue(
    queue: SocialMediaViralityQueue,
  ): SocialMediaViralityQueue {
    const decayAmount = this.cfg.viralityDecayPerTurn;

    const surviving: ViralityEvent[] = [];

    for (const event of queue.events) {
      const newTurns = event.turnsToDecay - 1;
      const newVirality = event.virality - decayAmount;

      if (newTurns <= 0 || newVirality <= 0) {
        continue;
      }

      surviving.push({
        ...event,
        virality: this.clamp(newVirality),
        turnsToDecay: newTurns,
      });
    }

    return {
      turn: queue.turn,
      events: surviving,
    };
  }

  // ── Public API — Deepfake (FR-1604) ────────────────────

  /**
   * Validates that all **prerequisites** for a deepfake operation are met.
   *
   * Checks performed:
   * 1. **CYBER threshold**: `deployerCyber ≥ deepfake.cyberThreshold` (60).
   * 2. **Treasury**: `deployerTreasury ≥ |deepfake.treasuryCost|` (10).
   * 3. **Operation slot**: `hasAvailableSlot === true`.
   *
   * Returns a result indicating whether the faction is eligible, plus
   * a list of human-readable failure reasons when ineligible.
   *
   * @param input - The deploying faction's current capabilities.
   * @returns A {@link DeepfakePrereqResult} with eligibility and reasons.
   *
   * @example
   * ```ts
   * const result = engine.validateDeepfakePrerequisites({
   *   deployerCyber: 55,
   *   deployerTreasury: 8,
   *   hasAvailableSlot: true,
   * });
   * // result.eligible === false
   * // result.reasons === [
   * //   'CYBER score 55 is below the required threshold of 60.',
   * //   'Treasury 8 is insufficient; operation costs 10.',
   * // ]
   * ```
   *
   * @see FR-1604
   */
  public validateDeepfakePrerequisites(
    input: DeepfakePrereqInput,
  ): DeepfakePrereqResult {
    const reasons: string[] = [];
    const cfg = this.cfg.deepfake;
    const requiredTreasury = Math.abs(cfg.treasuryCost);

    if (input.deployerCyber < cfg.cyberThreshold) {
      reasons.push(
        `CYBER score ${input.deployerCyber} is below the required threshold of ${cfg.cyberThreshold}.`,
      );
    }

    if (input.deployerTreasury < requiredTreasury) {
      reasons.push(
        `Treasury ${input.deployerTreasury} is insufficient; operation costs ${requiredTreasury}.`,
      );
    }

    if (!input.hasAvailableSlot) {
      reasons.push(
        'No available CYBER operation slot. Complete or cancel an existing operation first.',
      );
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Executes a **deepfake operation** and resolves its outcome.
   *
   * The execution flow:
   * 1. Compute detection risk via {@link computeDetectionRisk}.
   * 2. Compare `detectionRoll` against the risk to determine if detected.
   * 3. If **not detected** → apply the intended effects per deepfake type:
   *    - `FabricateStatements`: target Legitimacy −15.
   *    - `FakeAtrocityEvidence`: target Legitimacy −20, target CivilUnrest +10.
   *    - `SyntheticIntelligence`: persist for 3 turns in target pipeline.
   * 4. If **detected** → backfire:
   *    - Deployer Legitimacy −25.
   *    - All-nation Trust towards deployer −15.
   *    - No effects on target.
   * 5. Treasury cost is always applied regardless of outcome.
   *
   * @param input - Deepfake execution parameters (includes deterministic roll).
   * @returns A {@link DeepfakeExecutionResult} describing all effects.
   *
   * @example
   * ```ts
   * const result = engine.executeDeepfake({
   *   type: 'FabricateStatements',
   *   deployerFaction: 'russia',
   *   targetFaction: 'us',
   *   deployerCyber: 75,
   *   targetCyber: 85,
   *   detectionRoll: 0.9, // > 0.85 risk → not detected
   * });
   * // result.detected === false
   * // result.targetLegitimacyDelta === -15
   * ```
   *
   * @see FR-1604
   */
  public executeDeepfake(
    input: DeepfakeExecutionInput,
  ): DeepfakeExecutionResult {
    const detectionRisk = this.computeDetectionRisk(
      input.deployerCyber,
      input.targetCyber,
    );
    const detected = input.detectionRoll < detectionRisk;

    const cfg = this.cfg.deepfake;

    // ── Detected: backfire ────────────────────────────────
    if (detected) {
      return {
        detected: true,
        detectionRisk,
        type: input.type,
        deployerFaction: input.deployerFaction,
        targetFaction: input.targetFaction,
        targetLegitimacyDelta: 0,
        targetUnrestDelta: 0,
        deployerLegitimacyDelta: cfg.detectionBackfire.deployerLegitimacyPenalty,
        allNationTrustDelta: cfg.detectionBackfire.trustPenaltyAllNations,
        syntheticPersistenceTurns: 0,
        treasuryCost: cfg.treasuryCost,
      };
    }

    // ── Not detected: apply intended effects ─────────────
    return this.resolveSuccessfulDeepfake(input, detectionRisk, cfg);
  }

  /**
   * Computes the **detection probability** for a deepfake operation.
   *
   * Detection risk is proportional to the target's CYBER capability:
   * ```
   * detectionProbability = targetCyber / 100
   * ```
   *
   * The result is clamped to [0.05, 0.95] so that even the weakest
   * target has a 5 % floor and the strongest has a 95 % ceiling.
   *
   * @param _deployerCyber - Deployer's CYBER score (reserved for future use).
   * @param targetCyber    - Target's CYBER score. Range: 0–100.
   * @returns Detection probability in [0.05, 0.95].
   *
   * @example
   * ```ts
   * engine.computeDetectionRisk(70, 85); // 0.85
   * engine.computeDetectionRisk(90, 2);  // 0.05 (floor)
   * engine.computeDetectionRisk(50, 99); // 0.95 (ceiling)
   * ```
   *
   * @see FR-1604
   */
  public computeDetectionRisk(
    _deployerCyber: number,
    targetCyber: number,
  ): number {
    const raw = targetCyber / PERCENT;
    return Math.max(DETECTION_FLOOR, Math.min(DETECTION_CEILING, raw));
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
   * Resolves the effects of a **successful** (undetected) deepfake
   * operation based on its type.
   *
   * @param input         - The original execution input.
   * @param detectionRisk - Computed detection risk (for inclusion in result).
   * @param cfg           - Deepfake config subset.
   * @returns A {@link DeepfakeExecutionResult} with intended effects.
   *
   * @see FR-1604
   */
  private resolveSuccessfulDeepfake(
    input: DeepfakeExecutionInput,
    detectionRisk: number,
    cfg: ViralityDeepfakeConfig['deepfake'],
  ): DeepfakeExecutionResult {
    const baseResult: DeepfakeExecutionResult = {
      detected: false,
      detectionRisk,
      type: input.type,
      deployerFaction: input.deployerFaction,
      targetFaction: input.targetFaction,
      targetLegitimacyDelta: 0,
      targetUnrestDelta: 0,
      deployerLegitimacyDelta: 0,
      allNationTrustDelta: 0,
      syntheticPersistenceTurns: 0,
      treasuryCost: cfg.treasuryCost,
    };

    switch (input.type) {
      case 'FabricateStatements':
        return {
          ...baseResult,
          targetLegitimacyDelta: cfg.fabricateStatements.targetLegitimacyPenalty,
        };

      case 'FakeAtrocityEvidence':
        return {
          ...baseResult,
          targetLegitimacyDelta: cfg.fakeAtrocityEvidence.targetLegitimacyPenalty,
          targetUnrestDelta: cfg.fakeAtrocityEvidence.targetUnrestBoost,
        };

      case 'SyntheticIntelligence':
        return {
          ...baseResult,
          syntheticPersistenceTurns: cfg.syntheticIntelligence.persistenceTurns,
        };

      default: {
        // Exhaustive check — TypeScript flags unhandled deepfake types.
        const _exhaustive: never = input.type;
        throw new Error(
          `[ViralityDeepfakeEngine] Unknown deepfake type: ${_exhaustive as string}`,
        );
      }
    }
  }

  /**
   * Retrieves the platform penetration rate for a given faction.
   *
   * Falls back to 0.5 if the faction has no explicit entry in config.
   *
   * @param factionId - The faction to look up.
   * @returns Platform penetration as a 0–1 multiplier.
   *
   * @see FR-1603
   */
  private getPlatformPenetration(factionId: FactionId): number {
    const value = this.cfg.platformPenetration[factionId];
    return value !== undefined ? value : 0.5;
  }

  /**
   * Retrieves the censorship effectiveness for a given faction.
   *
   * Uses the faction ID as a direct lookup key against the censorship
   * config (which is keyed by ecosystem type names in lowercase).
   * Falls back to 0.3 (fragmented default) if no match is found.
   *
   * For production use, the caller should map faction → ecosystem type
   * externally. This method provides a best-effort lookup that works
   * with the standard config structure where keys like 'freePress' map
   * to known censorship fractions.
   *
   * @param factionId - The faction to look up censorship for.
   * @returns Censorship effectiveness as a 0–1 fraction.
   *
   * @see FR-1603
   */
  private getCensorshipForFaction(factionId: FactionId): number {
    // Attempt direct faction-id lookup (works when config includes
    // per-faction overrides or when ecosystem keys match faction IDs).
    const direct = this.cfg.censorshipEffectiveness[factionId];
    if (direct !== undefined) {
      return direct;
    }

    // Map well-known factions to their default ecosystem types.
    const factionEcosystem = this.getDefaultEcosystemKey(factionId);
    if (factionEcosystem !== undefined) {
      const mapped = this.cfg.censorshipEffectiveness[factionEcosystem];
      if (mapped !== undefined) {
        return mapped;
      }
    }

    // Fallback: fragmented default
    return 0.3;
  }

  /**
   * Returns the default media ecosystem config key for well-known factions.
   *
   * This mapping reflects the standard game setup:
   * - US, EU, Japan → Free Press
   * - China, Russia → State Media
   * - DPRK → Closed System
   * - Iran, Syria → Fragmented
   *
   * @param factionId - The faction to look up.
   * @returns The ecosystem config key, or `undefined` for unknown factions.
   *
   * @see FR-1605
   */
  private getDefaultEcosystemKey(factionId: FactionId): string | undefined {
    const mapping: Readonly<Record<string, string>> = {
      us: 'freePress',
      eu: 'freePress',
      japan: 'freePress',
      china: 'stateMedia',
      russia: 'stateMedia',
      dprk: 'closedSystem',
      iran: 'fragmented',
      syria: 'fragmented',
    };
    return mapping[factionId];
  }
}
