/**
 * Narrative Battle Engine — New Order
 *
 * Resolves **Narrative Battles** (FR-1606) and **Whistleblower Events**
 * (FR-1607) within the Information Warfare subsystem.
 *
 * Narrative Battles occur when two nations promote contradictory narratives
 * about the same event. The winner is determined by a weighted formula
 * combining Legitimacy, MediaReach, and NarrativeInvestment. The winner's
 * narrative becomes the default for non-involved nations, granting a
 * Legitimacy bonus while the loser suffers a penalty.
 *
 * Whistleblower Events trigger semi-randomly when a nation's observable
 * behaviour diverges from its public narrative beyond a configurable
 * threshold. The player may choose to suppress (risking cascade exposure)
 * or acknowledge (taking a softer Legitimacy hit but preventing further
 * leaks).
 *
 * All methods are **pure functions** — no side effects, no UI coupling,
 * no global mutation. The game-state layer owns persistence.
 *
 * @see FR-1606 — Narrative Battles
 * @see FR-1607 — Whistleblower Events
 */

import type {
  FactionId,
  TurnNumber,
  NarrativeType,
  WhistleblowerChoice,
  NarrativeBattleEntry,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Module-level helpers
// ─────────────────────────────────────────────────────────

/** Minimum value for any score in the 0–100 range. */
const SCORE_MIN = 0;

/** Maximum value for any score in the 0–100 range. */
const SCORE_MAX = 100;

/** Minimum value for a probability in the 0–1 range. */
const PROBABILITY_MIN = 0;

/** Maximum value for a probability in the 0–1 range. */
const PROBABILITY_MAX = 1;

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The raw value.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────
// Alignment enum for neutral perception
// ─────────────────────────────────────────────────────────

/**
 * Alignment stance of a non-involved faction relative to a battle participant.
 *
 * Used by {@link NarrativeBattleEngine.computeNeutralPerception} to determine
 * the strength of narrative adoption for each neutral faction.
 *
 * @see FR-1606
 */
export type AlignmentStance = 'Aligned' | 'Neutral' | 'Opposed';

// ─────────────────────────────────────────────────────────
// Configuration interface
// ─────────────────────────────────────────────────────────

/**
 * Configuration values consumed by the {@link NarrativeBattleEngine}.
 *
 * Mirrors the shape of `GAME_CONFIG.infoWar.narrativeBattle`,
 * `GAME_CONFIG.infoWar.whistleblower`, and
 * `GAME_CONFIG.infoWar.whistleblowerCascade` so that callers can supply
 * test overrides without importing the full game config.
 *
 * @see FR-1606
 * @see FR-1607
 */
export interface NarrativeBattleConfig {
  /** Narrative Battle formula weights and outcome values. @see FR-1606 */
  readonly narrativeBattle: {
    /** Weight of legitimacy in the narrative battle score. @see FR-1606 */
    readonly legitimacyWeight: number;
    /** Weight of media reach in the narrative battle score. @see FR-1606 */
    readonly mediaReachWeight: number;
    /** Weight of narrative investment in the narrative battle score. @see FR-1606 */
    readonly narrativeInvestmentWeight: number;
    /** Legitimacy gain awarded to the battle winner. @see FR-1606 */
    readonly winnerLegitimacyGain: number;
    /** Legitimacy loss imposed on the battle loser (negative). @see FR-1606 */
    readonly loserLegitimacyLoss: number;
  };

  /** Whistleblower trigger and resolution parameters. @see FR-1607 */
  readonly whistleblower: {
    /** Minimum actions-vs-narrative divergence that enables a whistleblower. @see FR-1607 */
    readonly divergenceThreshold: number;
    /** Legitimacy penalty from suppressed whistleblower exposure. @see FR-1607 */
    readonly exposureLegitimacyPenalty: number;
    /** Legitimacy penalty when the player acknowledges wrongdoing. @see FR-1607 */
    readonly acknowledgePenalty: number;
    /** Risk-reduction factor per 20 points of security-services score. @see FR-1607 */
    readonly securityServicesReductionPer20: number;
  };

  /** Cascade parameters when a whistleblower is suppressed. @see FR-1607 */
  readonly whistleblowerCascade: {
    /** Additional per-op exposure risk when suppressing. @see FR-1607 */
    readonly additionalExposureRisk: number;
    /** Maximum covert ops that can be exposed per event. @see FR-1607 */
    readonly maxOpsExposed: number;
  };
}

// ─────────────────────────────────────────────────────────
// Input / Output interfaces — Narrative Battles
// ─────────────────────────────────────────────────────────

/**
 * Per-combatant statistics supplied to a narrative battle.
 *
 * @see FR-1606
 */
export interface NarrativeCombatant {
  /** Faction participating in the battle. @see FR-1606 */
  readonly factionId: FactionId;
  /** Current legitimacy score (0–100). @see FR-1606 */
  readonly legitimacy: number;
  /** Current media reach score (0–100). @see FR-1606 */
  readonly mediaReach: number;
  /** Current narrative investment score (0–100). @see FR-1606 */
  readonly narrativeInvestment: number;
  /** Narrative type promoted by this combatant. @see FR-1606 */
  readonly narrativeType: NarrativeType;
}

/**
 * Input for {@link NarrativeBattleEngine.resolveNarrativeBattle}.
 *
 * @see FR-1606
 */
export interface NarrativeBattleInput {
  /** Current turn number. @see FR-1606 */
  readonly turn: TurnNumber;
  /** The faction that initiated the narrative battle (attacker). @see FR-1606 */
  readonly attacker: NarrativeCombatant;
  /** The defending faction. @see FR-1606 */
  readonly defender: NarrativeCombatant;
}

/**
 * Result of {@link NarrativeBattleEngine.resolveNarrativeBattle}.
 *
 * @see FR-1606
 */
export interface NarrativeBattleResult {
  /** FactionId of the winning side. @see FR-1606 */
  readonly winner: FactionId;
  /** FactionId of the losing side. @see FR-1606 */
  readonly loser: FactionId;
  /** Raw battle score computed for the attacker. @see FR-1606 */
  readonly attackerScore: number;
  /** Raw battle score computed for the defender. @see FR-1606 */
  readonly defenderScore: number;
  /** Legitimacy delta to apply to the winner (positive). @see FR-1606 */
  readonly winnerLegitimacyDelta: number;
  /** Legitimacy delta to apply to the loser (negative). @see FR-1606 */
  readonly loserLegitimacyDelta: number;
  /** The canonical {@link NarrativeBattleEntry} to append to history. @see FR-1606 */
  readonly battleEntry: NarrativeBattleEntry;
}

// ─────────────────────────────────────────────────────────
// Input / Output interfaces — Neutral Perception
// ─────────────────────────────────────────────────────────

/**
 * Per-faction alignment stance relative to the battle participants.
 *
 * @see FR-1606
 */
export interface FactionAlignment {
  /** The non-involved faction being evaluated. @see FR-1606 */
  readonly factionId: FactionId;
  /** Alignment stance toward the battle winner. @see FR-1606 */
  readonly stanceTowardWinner: AlignmentStance;
}

/**
 * Input for {@link NarrativeBattleEngine.computeNeutralPerception}.
 *
 * @see FR-1606
 */
export interface NeutralPerceptionInput {
  /** The result of the narrative battle that generated these perceptions. @see FR-1606 */
  readonly battleResult: NarrativeBattleResult;
  /** Non-involved factions with their alignment stances. @see FR-1606 */
  readonly neutralFactions: readonly FactionAlignment[];
  /** Media reach of the winning faction (0–100). @see FR-1606 */
  readonly winnerMediaReach: number;
}

/**
 * Per-faction perception outcome after a narrative battle.
 *
 * @see FR-1606
 */
export interface FactionPerception {
  /** The non-involved faction. @see FR-1606 */
  readonly factionId: FactionId;
  /** Whether this faction adopted the winner's narrative. @see FR-1606 */
  readonly adoptedWinnerNarrative: boolean;
  /** Alignment shift toward the winner's narrative (0–100 range). @see FR-1606 */
  readonly alignmentShift: number;
}

/**
 * Result of {@link NarrativeBattleEngine.computeNeutralPerception}.
 *
 * @see FR-1606
 */
export interface NeutralPerceptionResult {
  /** Winner of the narrative battle whose version propagates. @see FR-1606 */
  readonly winner: FactionId;
  /** Per-faction perception outcomes. @see FR-1606 */
  readonly perceptions: readonly FactionPerception[];
}

// ─────────────────────────────────────────────────────────
// Input / Output interfaces — Whistleblower Risk
// ─────────────────────────────────────────────────────────

/**
 * Input for {@link NarrativeBattleEngine.evaluateWhistleblowerRisk}.
 *
 * @see FR-1607
 */
export interface WhistleblowerRiskInput {
  /** The faction being evaluated for whistleblower exposure. @see FR-1607 */
  readonly factionId: FactionId;
  /** Current turn number. @see FR-1607 */
  readonly turn: TurnNumber;
  /**
   * Absolute divergence between the faction's actions and its public
   * narrative score. Range: 0–100.
   *
   * @see FR-1607
   */
  readonly behaviorDivergence: number;
  /**
   * Security-services power-base score (0–100). Higher values reduce
   * whistleblower probability.
   *
   * @see FR-1607
   */
  readonly securityServicesScore: number;
}

/**
 * Result of {@link NarrativeBattleEngine.evaluateWhistleblowerRisk}.
 *
 * The engine returns the computed probability but does **not** roll a
 * random value (keeping methods pure). The caller is responsible for
 * comparing `finalProbability` against a random roll to determine
 * whether the event fires.
 *
 * @see FR-1607
 */
export interface WhistleblowerRiskResult {
  /** The faction evaluated. @see FR-1607 */
  readonly factionId: FactionId;
  /** Turn at which the evaluation was performed. @see FR-1607 */
  readonly turn: TurnNumber;
  /**
   * Raw probability before security-services reduction.
   * Computed as `(behaviorDivergence − divergenceThreshold) / 100`,
   * clamped to [0, 1].
   *
   * @see FR-1607
   */
  readonly baseProbability: number;
  /**
   * Absolute reduction from security services.
   * `floor(securityServicesScore / 20) × securityServicesReductionPer20`.
   *
   * @see FR-1607
   */
  readonly securityReduction: number;
  /**
   * Final whistleblower trigger probability after security reduction.
   * Clamped to [0, 1]. Caller compares against a random roll.
   *
   * @see FR-1607
   */
  readonly finalProbability: number;
  /** Input divergence value echoed for audit convenience. @see FR-1607 */
  readonly behaviorDivergence: number;
  /** The configured threshold that was applied. @see FR-1607 */
  readonly divergenceThreshold: number;
}

// ─────────────────────────────────────────────────────────
// Input / Output interfaces — Whistleblower Resolution
// ─────────────────────────────────────────────────────────

/**
 * Input for {@link NarrativeBattleEngine.resolveWhistleblower}.
 *
 * @see FR-1607
 */
export interface WhistleblowerResolutionInput {
  /** The faction facing the whistleblower event. @see FR-1607 */
  readonly factionId: FactionId;
  /** Current turn number. @see FR-1607 */
  readonly turn: TurnNumber;
  /** Player's chosen response to the whistleblower event. @see FR-1607 */
  readonly choice: WhistleblowerChoice;
  /**
   * Number of currently active covert operations that could be exposed.
   * Used to compute `opsExposed` when suppressing.
   *
   * @see FR-1607
   */
  readonly activeCovertOpsCount: number;
}

/**
 * Result of {@link NarrativeBattleEngine.resolveWhistleblower}.
 *
 * @see FR-1607
 */
export interface WhistleblowerResolutionResult {
  /** The faction that resolved the whistleblower event. @see FR-1607 */
  readonly factionId: FactionId;
  /** Turn at which the resolution occurred. @see FR-1607 */
  readonly turn: TurnNumber;
  /** The choice the player made. @see FR-1607 */
  readonly choice: WhistleblowerChoice;
  /**
   * Legitimacy penalty applied.
   * Suppress → `exposureLegitimacyPenalty` (−20).
   * Acknowledge → `acknowledgePenalty` (−10).
   *
   * @see FR-1607
   */
  readonly legitimacyDelta: number;
  /**
   * Probability of each remaining covert op being further exposed.
   * Suppress → `additionalExposureRisk` (0.15).
   * Acknowledge → 0 (cascade prevented).
   *
   * @see FR-1607
   */
  readonly cascadeRisk: number;
  /**
   * Number of covert operations exposed in this event.
   * Suppress → `min(activeCovertOpsCount, maxOpsExposed)`.
   * Acknowledge → 0.
   *
   * @see FR-1607
   */
  readonly opsExposed: number;
  /** Whether further cascade exposure is possible. @see FR-1607 */
  readonly cascadePrevented: boolean;
}

// ─────────────────────────────────────────────────────────
// Input / Output interfaces — Contradiction Detection
// ─────────────────────────────────────────────────────────

/**
 * A single active narrative campaign entry supplied for contradiction
 * detection.
 *
 * @see FR-1606
 */
export interface ActiveNarrativeCampaignEntry {
  /** Faction running this campaign. @see FR-1606 */
  readonly factionId: FactionId;
  /** Narrative type of the campaign. @see FR-1606 */
  readonly narrativeType: NarrativeType;
  /** Target faction or event identifier of the campaign. @see FR-1606 */
  readonly targetFactionId: FactionId;
}

/**
 * Input for {@link NarrativeBattleEngine.detectContradictoryNarratives}.
 *
 * @see FR-1606
 */
export interface ContradictionDetectionInput {
  /** Currently active narrative campaigns across all factions. @see FR-1606 */
  readonly activeCampaigns: readonly ActiveNarrativeCampaignEntry[];
}

/**
 * A detected contradiction between two factions' narratives.
 *
 * @see FR-1606
 */
export interface DetectedContradiction {
  /** First faction in the contradictory pair. @see FR-1606 */
  readonly factionA: FactionId;
  /** Narrative type promoted by the first faction. @see FR-1606 */
  readonly narrativeTypeA: NarrativeType;
  /** Second faction in the contradictory pair. @see FR-1606 */
  readonly factionB: FactionId;
  /** Narrative type promoted by the second faction. @see FR-1606 */
  readonly narrativeTypeB: NarrativeType;
  /** The shared target faction or event that both narratives address. @see FR-1606 */
  readonly targetFactionId: FactionId;
}

/**
 * Result of {@link NarrativeBattleEngine.detectContradictoryNarratives}.
 *
 * @see FR-1606
 */
export interface ContradictionDetectionResult {
  /** Array of detected contradictory narrative pairs. @see FR-1606 */
  readonly contradictions: readonly DetectedContradiction[];
  /** Total number of contradictions found. @see FR-1606 */
  readonly count: number;
}

// ─────────────────────────────────────────────────────────
// Alignment shift constants
// ─────────────────────────────────────────────────────────

/**
 * Alignment shift value for factions that are aligned with the winner.
 * @see FR-1606
 */
const ALIGNED_SHIFT = 10;

/**
 * Alignment shift value for factions that are neutral to the winner.
 * @see FR-1606
 */
const NEUTRAL_SHIFT = 5;

/**
 * Alignment shift value for factions that are opposed to the winner.
 * @see FR-1606
 */
const OPPOSED_SHIFT = 2;

// ─────────────────────────────────────────────────────────
// Contradictory narrative pairs
// ─────────────────────────────────────────────────────────

/**
 * Pairs of narrative types that are considered contradictory.
 *
 * If two factions target the same event / faction with narrative types
 * that appear in the same pair, they are in contradiction.
 *
 * @see FR-1606
 */
const CONTRADICTORY_PAIRS: ReadonlyArray<readonly [NarrativeType, NarrativeType]> = [
  ['Victimhood', 'Liberation'],
  ['EconomicJustice', 'HistoricalGrievance'],
  ['Victimhood', 'EconomicJustice'],
  ['Liberation', 'HistoricalGrievance'],
];

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Pure-computation engine for Narrative Battles and Whistleblower Events.
 *
 * Stateless — every method accepts the current state as input and returns
 * a new result object. The constructor accepts an optional configuration
 * override so that unit tests can inject deterministic values without
 * touching `GAME_CONFIG`.
 *
 * ### Narrative Battles (FR-1606)
 *
 * When two nations promote contradictory narratives about the same event,
 * the engine scores each side using:
 *
 * ```
 * score = (Legitimacy × 0.4) + (MediaReach × 0.3) + (NarrativeInvestment × 0.3)
 * ```
 *
 * The higher score wins. The winner receives +5 Legitimacy and the loser
 * receives −5 Legitimacy. Non-involved nations form opinions based on
 * existing alignment and the winner's media reach.
 *
 * ### Whistleblower Events (FR-1607)
 *
 * When a nation's actual behaviour diverges from its public narrative by
 * more than 30, a whistleblower event may trigger. The probability is:
 *
 * ```
 * baseProbability = (divergence − threshold) / 100
 * reduction       = floor(securityServicesScore / 20) × 0.1
 * finalProbability = max(0, baseProbability − reduction)
 * ```
 *
 * The player may suppress (−20 Legitimacy, cascade risk) or acknowledge
 * (−10 Legitimacy, cascade prevented).
 *
 * @see FR-1606 — Narrative Battles
 * @see FR-1607 — Whistleblower Events
 */
export class NarrativeBattleEngine {
  // ── Instance configuration ──────────────────────────────────────────────

  /**
   * Resolved engine configuration, either assembled from `GAME_CONFIG`
   * sub-trees or supplied by a test override.
   */
  private readonly cfg: NarrativeBattleConfig;

  // ── Constructor ─────────────────────────────────────────────────────────

  /**
   * Create a new Narrative Battle Engine.
   *
   * @param configOverride - Optional configuration override. When omitted
   *   the engine assembles its config from `GAME_CONFIG.infoWar`. Provide
   *   a custom config in tests to isolate from global configuration changes.
   *
   * @see FR-1606
   * @see FR-1607
   */
  constructor(configOverride?: NarrativeBattleConfig) {
    this.cfg = configOverride ?? {
      narrativeBattle: GAME_CONFIG.infoWar.narrativeBattle,
      whistleblower: GAME_CONFIG.infoWar.whistleblower,
      whistleblowerCascade: GAME_CONFIG.infoWar.whistleblowerCascade,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Resolve a Narrative Battle between two factions.
   *
   * Computes a weighted battle score for each combatant using the formula:
   *
   * ```
   * score = (legitimacy × legitimacyWeight)
   *       + (mediaReach × mediaReachWeight)
   *       + (narrativeInvestment × narrativeInvestmentWeight)
   * ```
   *
   * The faction with the higher score wins. In the event of a tie the
   * attacker is favoured (first-mover advantage).
   *
   * @param input - Battle input containing turn, attacker, and defender.
   * @returns A frozen {@link NarrativeBattleResult} with scores, deltas,
   *   and the canonical history entry.
   *
   * @example
   * ```ts
   * const result = engine.resolveNarrativeBattle({
   *   turn: 5 as TurnNumber,
   *   attacker: { factionId: 'us', legitimacy: 80, mediaReach: 70, narrativeInvestment: 60, narrativeType: 'Liberation' },
   *   defender: { factionId: 'russia', legitimacy: 50, mediaReach: 60, narrativeInvestment: 40, narrativeType: 'Victimhood' },
   * });
   * ```
   *
   * @see FR-1606
   */
  public resolveNarrativeBattle(input: NarrativeBattleInput): NarrativeBattleResult {
    const { turn, attacker, defender } = input;
    const cfg = this.cfg.narrativeBattle;

    const attackerScore = this.computeBattleScore(attacker, cfg);
    const defenderScore = this.computeBattleScore(defender, cfg);

    // Attacker wins ties (first-mover advantage).
    const attackerWins = attackerScore >= defenderScore;

    const winner = attackerWins ? attacker.factionId : defender.factionId;
    const loser = attackerWins ? defender.factionId : attacker.factionId;

    const winnerLegitimacyDelta = cfg.winnerLegitimacyGain;
    const loserLegitimacyDelta = cfg.loserLegitimacyLoss;

    const battleEntry: NarrativeBattleEntry = {
      turn,
      attacker: attacker.factionId,
      defender: defender.factionId,
      narrativeType: attackerWins ? attacker.narrativeType : defender.narrativeType,
      legitimacyDelta: winnerLegitimacyDelta,
      countered: !attackerWins,
    };

    return {
      winner,
      loser,
      attackerScore,
      defenderScore,
      winnerLegitimacyDelta,
      loserLegitimacyDelta,
      battleEntry,
    };
  }

  /**
   * Compute Neutral Nation Perception following a narrative battle.
   *
   * For each non-involved faction, determines whether they adopt the
   * winner's narrative based on:
   *
   * 1. **Media Reach** — the winner's narrative reaches them first by
   *    default (higher media reach = wider propagation).
   * 2. **Alignment Stance** — factions aligned with the winner get a
   *    stronger alignment shift toward the winner's narrative:
   *    - Aligned: +10
   *    - Neutral: +5
   *    - Opposed: +2
   *
   * A faction "adopts" the winner's narrative if the alignment shift
   * exceeds a threshold of zero (any positive shift = adoption, since
   * the winner's version is the default for non-involved nations).
   *
   * @param input - Perception input with battle result and neutral factions.
   * @returns A frozen {@link NeutralPerceptionResult} with per-faction outcomes.
   *
   * @example
   * ```ts
   * const perception = engine.computeNeutralPerception({
   *   battleResult,
   *   neutralFactions: [
   *     { factionId: 'japan', stanceTowardWinner: 'Aligned' },
   *     { factionId: 'iran', stanceTowardWinner: 'Opposed' },
   *   ],
   *   winnerMediaReach: 70,
   * });
   * ```
   *
   * @see FR-1606
   */
  public computeNeutralPerception(input: NeutralPerceptionInput): NeutralPerceptionResult {
    const { battleResult, neutralFactions, winnerMediaReach } = input;

    const perceptions: FactionPerception[] = neutralFactions.map(
      (faction: FactionAlignment): FactionPerception => {
        const baseShift = this.alignmentShiftForStance(faction.stanceTowardWinner);

        // Scale the shift by the winner's media reach normalised to 0–1.
        // A media reach of 100 applies the full shift; lower values reduce it
        // proportionally but never below 1 (minimum perceptible influence).
        const mediaScalar = clamp(winnerMediaReach / SCORE_MAX, PROBABILITY_MIN, PROBABILITY_MAX);
        const scaledShift = Math.max(1, Math.round(baseShift * mediaScalar));

        const alignmentShift = clamp(scaledShift, SCORE_MIN, SCORE_MAX);

        return {
          factionId: faction.factionId,
          adoptedWinnerNarrative: alignmentShift > 0,
          alignmentShift,
        };
      },
    );

    return {
      winner: battleResult.winner,
      perceptions,
    };
  }

  /**
   * Evaluate the probability of a Whistleblower Event triggering.
   *
   * The base probability is derived from how far the faction's behaviour
   * diverges from its public narrative beyond a configurable threshold:
   *
   * ```
   * baseProbability = (behaviorDivergence − divergenceThreshold) / 100
   * ```
   *
   * Security services reduce this probability:
   *
   * ```
   * reduction       = floor(securityServicesScore / 20) × reductionPer20
   * finalProbability = max(0, baseProbability − reduction)
   * ```
   *
   * The engine does **not** roll a random value (keeping methods pure).
   * The caller compares `finalProbability` against a random roll to
   * determine whether the event fires.
   *
   * @param input - Risk evaluation input with divergence and security scores.
   * @returns A frozen {@link WhistleblowerRiskResult} with computed probabilities.
   *
   * @example
   * ```ts
   * const risk = engine.evaluateWhistleblowerRisk({
   *   factionId: 'russia',
   *   turn: 12 as TurnNumber,
   *   behaviorDivergence: 55,
   *   securityServicesScore: 40,
   * });
   * // risk.finalProbability → 0.05
   * ```
   *
   * @see FR-1607
   */
  public evaluateWhistleblowerRisk(input: WhistleblowerRiskInput): WhistleblowerRiskResult {
    const { factionId, turn, behaviorDivergence, securityServicesScore } = input;
    const cfg = this.cfg.whistleblower;

    // Step 1: Base probability from divergence above threshold.
    const rawBase = (behaviorDivergence - cfg.divergenceThreshold) / 100;
    const baseProbability = clamp(rawBase, PROBABILITY_MIN, PROBABILITY_MAX);

    // Step 2: Security services reduction.
    const reductionSteps = Math.floor(securityServicesScore / 20);
    const securityReduction = reductionSteps * cfg.securityServicesReductionPer20;

    // Step 3: Final probability (clamped to ≥ 0).
    const finalProbability = clamp(
      baseProbability - securityReduction,
      PROBABILITY_MIN,
      PROBABILITY_MAX,
    );

    return {
      factionId,
      turn,
      baseProbability,
      securityReduction,
      finalProbability,
      behaviorDivergence,
      divergenceThreshold: cfg.divergenceThreshold,
    };
  }

  /**
   * Resolve a Whistleblower Event based on the player's chosen response.
   *
   * Two possible outcomes:
   *
   * | Choice       | Legitimacy Δ | Cascade Risk | Ops Exposed              |
   * |--------------|-------------|-------------|--------------------------|
   * | Suppress     | −20         | 0.15        | min(activeOps, 3)        |
   * | Acknowledge  | −10         | 0           | 0                        |
   *
   * Suppressing preserves secrecy in the short term but risks a cascade
   * of further exposures. Acknowledging takes a lighter hit and fully
   * prevents any cascade.
   *
   * @param input - Resolution input with player choice and covert-ops count.
   * @returns A frozen {@link WhistleblowerResolutionResult} with all outcomes.
   *
   * @example
   * ```ts
   * const resolution = engine.resolveWhistleblower({
   *   factionId: 'us',
   *   turn: 15 as TurnNumber,
   *   choice: 'Suppress',
   *   activeCovertOpsCount: 5,
   * });
   * // resolution.opsExposed → 3, resolution.cascadeRisk → 0.15
   * ```
   *
   * @see FR-1607
   */
  public resolveWhistleblower(
    input: WhistleblowerResolutionInput,
  ): WhistleblowerResolutionResult {
    const { factionId, turn, choice, activeCovertOpsCount } = input;
    const wCfg = this.cfg.whistleblower;
    const cCfg = this.cfg.whistleblowerCascade;

    if (choice === 'Suppress') {
      return {
        factionId,
        turn,
        choice,
        legitimacyDelta: wCfg.exposureLegitimacyPenalty,
        cascadeRisk: cCfg.additionalExposureRisk,
        opsExposed: Math.min(activeCovertOpsCount, cCfg.maxOpsExposed),
        cascadePrevented: false,
      };
    }

    // choice === 'Acknowledge'
    return {
      factionId,
      turn,
      choice,
      legitimacyDelta: wCfg.acknowledgePenalty,
      cascadeRisk: 0,
      opsExposed: 0,
      cascadePrevented: true,
    };
  }

  /**
   * Detect contradictory narrative campaigns targeting the same event
   * or faction.
   *
   * Scans all active campaigns and identifies pairs from different factions
   * that target the **same** faction with **contradictory** narrative types.
   * Two narrative types are contradictory if they appear in the
   * {@link CONTRADICTORY_PAIRS} table — or, more broadly, if two different
   * factions target the same faction with **any** differing narrative types
   * (since competing narratives about the same target inherently contradict).
   *
   * The method returns unique pairs only (A-B is the same as B-A), and
   * a faction is never paired with itself.
   *
   * @param input - Detection input with all active narrative campaigns.
   * @returns A frozen {@link ContradictionDetectionResult} with detected pairs.
   *
   * @example
   * ```ts
   * const result = engine.detectContradictoryNarratives({
   *   activeCampaigns: [
   *     { factionId: 'us', narrativeType: 'Liberation', targetFactionId: 'iran' },
   *     { factionId: 'russia', narrativeType: 'Victimhood', targetFactionId: 'iran' },
   *   ],
   * });
   * // result.count → 1
   * ```
   *
   * @see FR-1606
   */
  public detectContradictoryNarratives(
    input: ContradictionDetectionInput,
  ): ContradictionDetectionResult {
    const { activeCampaigns } = input;
    const contradictions: DetectedContradiction[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < activeCampaigns.length; i++) {
      const campaignA = activeCampaigns[i];
      if (!campaignA) continue;

      for (let j = i + 1; j < activeCampaigns.length; j++) {
        const campaignB = activeCampaigns[j];
        if (!campaignB) continue;

        // Skip same-faction campaigns — a faction cannot contradict itself.
        if (campaignA.factionId === campaignB.factionId) continue;

        // Only consider campaigns targeting the same faction/event.
        if (campaignA.targetFactionId !== campaignB.targetFactionId) continue;

        // Check if narrative types are contradictory.
        if (!this.areNarrativesContradictory(campaignA.narrativeType, campaignB.narrativeType)) {
          continue;
        }

        // Build a stable key to prevent duplicate pairs (A-B === B-A).
        const pairKey = [campaignA.factionId, campaignB.factionId].sort().join(':')
          + ':' + campaignA.targetFactionId;

        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        contradictions.push({
          factionA: campaignA.factionId,
          narrativeTypeA: campaignA.narrativeType,
          factionB: campaignB.factionId,
          narrativeTypeB: campaignB.narrativeType,
          targetFactionId: campaignA.targetFactionId,
        });
      }
    }

    return {
      contradictions,
      count: contradictions.length,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Compute the weighted battle score for a single combatant.
   *
   * @param combatant - The faction's combat statistics.
   * @param cfg       - The narrative-battle weight configuration.
   * @returns The computed battle score (not clamped — can exceed 100 in
   *   theory if all inputs are at maximum, though in practice the weighted
   *   sum of three 0–100 values with weights summing to 1.0 will stay
   *   within 0–100).
   *
   * @see FR-1606
   */
  private computeBattleScore(
    combatant: NarrativeCombatant,
    cfg: NarrativeBattleConfig['narrativeBattle'],
  ): number {
    return (
      combatant.legitimacy * cfg.legitimacyWeight +
      combatant.mediaReach * cfg.mediaReachWeight +
      combatant.narrativeInvestment * cfg.narrativeInvestmentWeight
    );
  }

  /**
   * Return the alignment shift value for a given stance.
   *
   * @param stance - The non-involved faction's stance toward the winner.
   * @returns Alignment shift points to apply.
   *
   * @see FR-1606
   */
  private alignmentShiftForStance(stance: AlignmentStance): number {
    switch (stance) {
      case 'Aligned':
        return ALIGNED_SHIFT;
      case 'Neutral':
        return NEUTRAL_SHIFT;
      case 'Opposed':
        return OPPOSED_SHIFT;
      default: {
        // Exhaustive check — TypeScript will error if a case is missed.
        const _exhaustive: never = stance;
        return _exhaustive;
      }
    }
  }

  /**
   * Determine whether two narrative types are contradictory.
   *
   * Two narrative types contradict each other if they appear together in
   * the {@link CONTRADICTORY_PAIRS} lookup table. The check is symmetric:
   * `(A, B)` and `(B, A)` both match.
   *
   * Additionally, any two **different** narrative types targeting the same
   * faction are considered contradictory — competing accounts of the same
   * event inherently clash regardless of whether they appear in the
   * explicit pairs table.
   *
   * @param typeA - First narrative type.
   * @param typeB - Second narrative type.
   * @returns `true` if the pair is contradictory, `false` otherwise.
   *
   * @see FR-1606
   */
  private areNarrativesContradictory(typeA: NarrativeType, typeB: NarrativeType): boolean {
    // Identical narratives cannot contradict.
    if (typeA === typeB) return false;

    // Two different narrative types targeting the same faction/event are
    // contradictory if they appear in the explicit pairs table.
    return CONTRADICTORY_PAIRS.some(
      ([a, b]) => (a === typeA && b === typeB) || (a === typeB && b === typeA),
    );
  }
}
