/**
 * Narrative Campaign Engine — New Order
 *
 * Manages the deployment, evolution, and resolution of narrative campaigns
 * that factions run against each other (or on their own populations).
 * Narrative campaigns persist across turns until cancelled or replaced and
 * produce strategic effects on nationalism, sympathy, anger, legitimacy,
 * diplomatic penalties, and military legitimacy loss.
 *
 * Four campaign archetypes:
 *
 * | Type              | Primary Effect                                     |
 * |-------------------|----------------------------------------------------|
 * | Victimhood        | +nationalism, +sympathy, costs DI                  |
 * | Liberation        | Reduces legitimacy loss from military actions       |
 * | Economic Justice  | Reduces diplomatic penalty from economic coercion   |
 * | Historical Griev. | +nationalism, +anger, −legitimacy with neutrals     |
 *
 * Backfire mechanic: a Liberation campaign backfires (−15 Legitimacy) when
 * observable aggressive military actions contradict the humanitarian framing.
 *
 * Effectiveness decays by 5 % per turn, with a floor of 20 % of the initial
 * virality peak. This models the diminishing-returns of sustained propaganda
 * and the audience's growing scepticism over time.
 *
 * All methods are **pure functions** that return new objects; no side effects,
 * no UI coupling, no global mutation. The game-state layer owns persistence.
 *
 * @see FR-1602 — Narrative Campaign System
 */

import type {
  FactionId,
  NarrativeType,
  NarrativeCampaign,
  NarrativeCampaignLog,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/** Minimum value for any score in the 0–100 range. */
const SCORE_MIN = 0;

/** Maximum value for any score in the 0–100 range. */
const SCORE_MAX = 100;

/** Minimum value for a 0–1 multiplier. */
const MULTIPLIER_MIN = 0;

/** Maximum value for a 0–1 multiplier. */
const MULTIPLIER_MAX = 1;

/**
 * Per-turn decay factor applied to campaign effectiveness.
 * Each turn the effectiveness loses 5 % of its current value.
 *
 * @see FR-1602
 */
const EFFECTIVENESS_DECAY_RATE = 0.05;

/**
 * Floor for effectiveness decay, expressed as a fraction of the campaign's
 * virality peak. Effectiveness will never drop below 20 % of peak.
 *
 * @see FR-1602
 */
const EFFECTIVENESS_FLOOR_FRACTION = 0.2;

// ─────────────────────────────────────────────────────────
// Exported types & interfaces
// ─────────────────────────────────────────────────────────

/**
 * The per-turn effects produced by an active narrative campaign.
 *
 * Positive deltas are beneficial to the campaigner; negative deltas
 * are costs or penalties. Reduction multipliers are in the range [0, 1]
 * where 0 = no reduction and 1 = full reduction.
 *
 * @see FR-1602
 */
export interface CampaignEffects {
  /** Change in nationalism score (positive = more nationalist). */
  readonly nationalismDelta: number;
  /** Change in international sympathy score. */
  readonly sympathyDelta: number;
  /** Change in population anger score. */
  readonly angerDelta: number;
  /** Change in legitimacy score (can be negative). */
  readonly legitimacyDelta: number;
  /** Diplomatic Influence spent this turn (typically negative). */
  readonly diCost: number;
  /**
   * Multiplicative reduction applied to diplomatic penalties from
   * economic coercion. Range: 0–1 where 0 = no reduction.
   */
  readonly diplomaticPenaltyReduction: number;
  /**
   * Multiplicative reduction applied to legitimacy losses from
   * military actions. Range: 0–1 where 0 = no reduction.
   */
  readonly militaryLegitimacyReduction: number;
}

/**
 * Contextual information required for backfire evaluation.
 *
 * The calling code is responsible for deriving these booleans from the
 * current turn's actions and observable evidence.
 *
 * @see FR-1602
 */
export interface BackfireContext {
  /** Whether the faction carried out aggressive military actions this turn. */
  readonly hasAggressiveMilitaryAction: boolean;
  /** Whether the faction imposed sanctions, tariffs, or similar coercion. */
  readonly hasEconomicCoercion: boolean;
  /** Whether contradictory evidence was published or discovered. */
  readonly hasContradictoryEvidence: boolean;
}

/**
 * Result of a backfire check for a single campaign.
 *
 * @see FR-1602
 */
export interface BackfireResult {
  /** Whether the campaign backfired this turn. */
  readonly backfired: boolean;
  /** Legitimacy penalty applied if backfired (≤ 0), otherwise 0. */
  readonly legitimacyPenalty: number;
  /** Human-readable explanation of the backfire (or lack thereof). */
  readonly reason: string;
}

/**
 * Outcome of deploying a new narrative campaign.
 *
 * @see FR-1602
 */
export interface DeployCampaignResult {
  /** Updated campaign log with the new campaign inserted. */
  readonly log: NarrativeCampaignLog;
  /** The newly created campaign instance. */
  readonly campaign: NarrativeCampaign;
}

/**
 * Turn-level context required by {@link NarrativeCampaignEngine.advanceTurn}.
 *
 * Callers must supply backfire contexts keyed by narrative type so the
 * engine can evaluate each active campaign independently.
 *
 * @see FR-1602
 */
export interface TurnContext {
  /**
   * Per-narrative-type backfire context. If a narrative type is absent
   * from the map, the engine assumes no backfire conditions are met.
   */
  readonly backfireContexts: Map<NarrativeType, BackfireContext>;
  /**
   * Current-turn virality factor used to update campaign effectiveness.
   * Range: 0–100.
   */
  readonly currentVirality: number;
}

/**
 * Aggregated result returned by {@link NarrativeCampaignEngine.advanceTurn}.
 *
 * @see FR-1602
 */
export interface AdvanceTurnResult {
  /** Updated campaign log after advancing all active campaigns. */
  readonly log: NarrativeCampaignLog;
  /** Sum of all campaign effects for this turn. */
  readonly aggregatedEffects: CampaignEffects;
  /** Backfire results for every active campaign (even those that didn't fire). */
  readonly backfires: BackfireResult[];
}

/**
 * Shape of the `GAME_CONFIG.infoWar.narrativeCampaigns` sub-tree.
 *
 * Exposed so callers can supply test overrides without importing the
 * full game config.
 *
 * @see FR-1602
 */
export interface NarrativeCampaignConfig {
  readonly victimhood: {
    readonly nationalismBoost: number;
    readonly sympathyBoost: number;
    readonly diCost: number;
  };
  readonly liberation: {
    readonly legitimacyLossReduction: number;
    readonly backfirePenalty: number;
  };
  readonly economicJustice: {
    readonly diplomaticPenaltyReduction: number;
  };
  readonly historicalGrievance: {
    readonly nationalismBoost: number;
    readonly angerBoost: number;
    readonly legitimacyPenalty: number;
  };
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Pure-computation engine for narrative campaigns.
 *
 * Stateless — every method accepts the current state as input and returns
 * a new state. The constructor accepts an optional configuration override
 * so that unit tests can inject deterministic values without touching
 * `GAME_CONFIG`.
 *
 * ### Typical call-flow per turn
 * ```
 * 1. Player chooses "Deploy Campaign" → deployCampaign()
 * 2. Player chooses "Cancel Campaign" → cancelCampaign()
 * 3. End-of-turn processing          → advanceTurn()
 * 4. UI reads effects to apply        → (caller responsibility)
 * ```
 *
 * @see FR-1602 — Narrative Campaign System
 */
export class NarrativeCampaignEngine {
  // ── Instance configuration ──────────────────────────────────────────────

  /** Resolved campaign config, either from GAME_CONFIG or the test override. */
  private readonly cfg: NarrativeCampaignConfig;

  // ── Constructor ─────────────────────────────────────────────────────────

  /**
   * Create a new Narrative Campaign Engine.
   *
   * @param configOverride - Optional configuration override. When omitted the
   *   engine reads from `GAME_CONFIG.infoWar.narrativeCampaigns`. Provide a
   *   custom config in tests to isolate from global configuration changes.
   */
  constructor(configOverride?: NarrativeCampaignConfig) {
    this.cfg =
      configOverride ?? GAME_CONFIG.infoWar.narrativeCampaigns;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Compute the per-turn effects produced by a single active campaign.
   *
   * Effects are scaled by the campaign's current `effectivenessScore`
   * (a 0–100 value that decays each turn). A campaign at 100 %
   * effectiveness applies the full config value; at 50 % it applies half.
   *
   * @param campaign - The active narrative campaign to evaluate.
   * @returns A frozen {@link CampaignEffects} object with all deltas.
   *
   * @example
   * ```ts
   * const effects = engine.computeEffects(activeCampaign);
   * nationState.nationalism += effects.nationalismDelta;
   * ```
   *
   * @see FR-1602
   */
  public computeEffects(campaign: NarrativeCampaign): CampaignEffects {
    const scale = this.effectivenessScale(campaign.effectivenessScore);
    const effects = this.createEmptyEffects();

    switch (campaign.type) {
      case 'Victimhood':
        return {
          ...effects,
          nationalismDelta: this.cfg.victimhood.nationalismBoost * scale,
          sympathyDelta: this.cfg.victimhood.sympathyBoost * scale,
          diCost: this.cfg.victimhood.diCost,
        };

      case 'Liberation':
        return {
          ...effects,
          militaryLegitimacyReduction: NarrativeCampaignEngine.clamp(
            this.cfg.liberation.legitimacyLossReduction * scale,
            MULTIPLIER_MIN,
            MULTIPLIER_MAX,
          ),
        };

      case 'EconomicJustice':
        return {
          ...effects,
          diplomaticPenaltyReduction: NarrativeCampaignEngine.clamp(
            this.cfg.economicJustice.diplomaticPenaltyReduction * scale,
            MULTIPLIER_MIN,
            MULTIPLIER_MAX,
          ),
        };

      case 'HistoricalGrievance':
        return {
          ...effects,
          nationalismDelta: this.cfg.historicalGrievance.nationalismBoost * scale,
          angerDelta: this.cfg.historicalGrievance.angerBoost * scale,
          legitimacyDelta: this.cfg.historicalGrievance.legitimacyPenalty * scale,
        };

      default: {
        // Exhaustive check — TypeScript will error if a case is missed.
        const _exhaustive: never = campaign.type;
        return _exhaustive;
      }
    }
  }

  /**
   * Determine whether a narrative campaign should backfire this turn.
   *
   * Currently only the **Liberation** narrative has a backfire trigger:
   * it fires when the faction has carried out observable aggressive
   * military actions, directly contradicting the humanitarian framing.
   *
   * Future narrative types may gain backfire conditions; the switch
   * structure accommodates that growth.
   *
   * @param campaign - The campaign to evaluate.
   * @param context  - Observable actions/evidence from this turn.
   * @returns A frozen {@link BackfireResult} indicating outcome and reason.
   *
   * @see FR-1602
   */
  public checkBackfire(
    campaign: NarrativeCampaign,
    context: BackfireContext,
  ): BackfireResult {
    switch (campaign.type) {
      case 'Liberation': {
        if (context.hasAggressiveMilitaryAction || context.hasContradictoryEvidence) {
          return {
            backfired: true,
            legitimacyPenalty: this.cfg.liberation.backfirePenalty,
            reason:
              'Liberation narrative contradicted by observable aggressive military actions' +
              (context.hasContradictoryEvidence ? ' and contradictory evidence' : ''),
          };
        }
        return {
          backfired: false,
          legitimacyPenalty: 0,
          reason: 'No contradictory actions detected for Liberation narrative',
        };
      }

      case 'Victimhood': {
        // Victimhood has no standard backfire trigger.
        return {
          backfired: false,
          legitimacyPenalty: 0,
          reason: 'Victimhood narrative has no backfire condition',
        };
      }

      case 'EconomicJustice': {
        // Economic Justice has no standard backfire trigger.
        return {
          backfired: false,
          legitimacyPenalty: 0,
          reason: 'EconomicJustice narrative has no backfire condition',
        };
      }

      case 'HistoricalGrievance': {
        // Historical Grievance has no standard backfire trigger.
        return {
          backfired: false,
          legitimacyPenalty: 0,
          reason: 'HistoricalGrievance narrative has no backfire condition',
        };
      }

      default: {
        const _exhaustive: never = campaign.type;
        return _exhaustive;
      }
    }
  }

  /**
   * Deploy a new narrative campaign for a faction.
   *
   * If the faction already has an active campaign of the **same type**
   * targeting the **same faction**, the existing campaign is moved to the
   * historical log and replaced with the new one.
   *
   * Virality determines the initial `effectivenessScore` (clamped 0–100).
   *
   * @param log      - The faction's current campaign log.
   * @param type     - The narrative type to deploy.
   * @param target   - The faction to target with the campaign.
   * @param virality - Initial virality / effectiveness (0–100).
   * @returns A {@link DeployCampaignResult} with updated log and the new campaign.
   *
   * @example
   * ```ts
   * const result = engine.deployCampaign(factionLog, 'Victimhood', 'china', 80);
   * applyToState(result.log, result.campaign);
   * ```
   *
   * @see FR-1602
   */
  public deployCampaign(
    log: NarrativeCampaignLog,
    type: NarrativeType,
    target: FactionId,
    virality: number,
  ): DeployCampaignResult {
    const clampedVirality = NarrativeCampaignEngine.clamp(virality, SCORE_MIN, SCORE_MAX);

    // Build the new campaign record.
    const newCampaign: NarrativeCampaign = {
      sourceFaction: log.factionId,
      type,
      target,
      turnsActive: 0,
      effectivenessScore: clampedVirality,
      discovered: false,
      viralityPeak: clampedVirality,
    };

    // Check for an existing campaign of the same type against the same target.
    const existingIndex = log.activeCampaigns.findIndex(
      (c) => c.type === type && c.target === target,
    );

    let updatedActive: NarrativeCampaign[];
    let updatedHistorical: NarrativeCampaign[];

    if (existingIndex !== -1) {
      // Move the replaced campaign to historical and swap in the new one.
      const replaced = log.activeCampaigns[existingIndex];
      updatedActive = [
        ...log.activeCampaigns.slice(0, existingIndex),
        newCampaign,
        ...log.activeCampaigns.slice(existingIndex + 1),
      ];
      updatedHistorical = replaced
        ? [...log.historicalCampaigns, replaced]
        : [...log.historicalCampaigns];
    } else {
      // No existing campaign — simply append.
      updatedActive = [...log.activeCampaigns, newCampaign];
      updatedHistorical = [...log.historicalCampaigns];
    }

    const updatedLog: NarrativeCampaignLog = {
      factionId: log.factionId,
      activeCampaigns: updatedActive,
      historicalCampaigns: updatedHistorical,
    };

    return { log: updatedLog, campaign: newCampaign };
  }

  /**
   * Cancel an active narrative campaign and retire it to history.
   *
   * If no active campaign matches the given type and target, the log is
   * returned unchanged (idempotent).
   *
   * @param log    - The faction's current campaign log.
   * @param type   - The narrative type to cancel.
   * @param target - The target faction of the campaign to cancel.
   * @returns An updated {@link NarrativeCampaignLog} with the campaign moved.
   *
   * @see FR-1602
   */
  public cancelCampaign(
    log: NarrativeCampaignLog,
    type: NarrativeType,
    target: FactionId,
  ): NarrativeCampaignLog {
    const cancelIndex = log.activeCampaigns.findIndex(
      (c) => c.type === type && c.target === target,
    );

    // Nothing to cancel — return log as-is.
    if (cancelIndex === -1) {
      return log;
    }

    const cancelled = log.activeCampaigns[cancelIndex];
    const updatedActive = [
      ...log.activeCampaigns.slice(0, cancelIndex),
      ...log.activeCampaigns.slice(cancelIndex + 1),
    ];
    const updatedHistorical = cancelled
      ? [...log.historicalCampaigns, cancelled]
      : [...log.historicalCampaigns];

    return {
      factionId: log.factionId,
      activeCampaigns: updatedActive,
      historicalCampaigns: updatedHistorical,
    };
  }

  /**
   * Advance all active narrative campaigns by one turn.
   *
   * For each active campaign the engine:
   *
   * 1. Increments `turnsActive`.
   * 2. Decays `effectivenessScore` by {@link EFFECTIVENESS_DECAY_RATE}
   *    (5 % per turn), with a floor of {@link EFFECTIVENESS_FLOOR_FRACTION}
   *    × `viralityPeak` (20 % of peak).
   * 3. Updates `viralityPeak` if the current virality exceeds it.
   * 4. Checks for backfire conditions.
   * 5. Computes this turn's effects and aggregates them.
   *
   * Campaigns that backfire are **not** automatically cancelled; the caller
   * may choose to cancel them based on the returned {@link BackfireResult}.
   *
   * @param log     - The faction's current campaign log.
   * @param context - Turn-level context (backfire data, current virality).
   * @returns An {@link AdvanceTurnResult} with updated log, summed effects,
   *   and per-campaign backfire results.
   *
   * @example
   * ```ts
   * const turnResult = engine.advanceTurn(factionLog, turnCtx);
   * applyAggregatedEffects(turnResult.aggregatedEffects);
   * for (const bf of turnResult.backfires) {
   *   if (bf.backfired) handleBackfire(bf);
   * }
   * ```
   *
   * @see FR-1602
   */
  public advanceTurn(
    log: NarrativeCampaignLog,
    context: TurnContext,
  ): AdvanceTurnResult {
    const aggregated = this.createMutableEffects();
    const backfires: BackfireResult[] = [];
    const advancedCampaigns: NarrativeCampaign[] = [];

    for (const campaign of log.activeCampaigns) {
      // 1. Increment turnsActive.
      const newTurnsActive = campaign.turnsActive + 1;

      // 2. Decay effectiveness.
      const floor = EFFECTIVENESS_FLOOR_FRACTION * campaign.viralityPeak;
      const decayed = campaign.effectivenessScore * (1 - EFFECTIVENESS_DECAY_RATE);
      const newEffectiveness = NarrativeCampaignEngine.clamp(
        Math.max(decayed, floor),
        SCORE_MIN,
        SCORE_MAX,
      );

      // 3. Update virality peak if current virality exceeds it.
      const clampedVirality = NarrativeCampaignEngine.clamp(
        context.currentVirality,
        SCORE_MIN,
        SCORE_MAX,
      );
      const newViralityPeak = Math.max(campaign.viralityPeak, clampedVirality);

      // Build the advanced campaign.
      const advancedCampaign: NarrativeCampaign = {
        ...campaign,
        turnsActive: newTurnsActive,
        effectivenessScore: newEffectiveness,
        viralityPeak: newViralityPeak,
      };

      // 4. Backfire check.
      const backfireCtx = context.backfireContexts.get(campaign.type);
      const backfireResult = this.checkBackfire(
        advancedCampaign,
        backfireCtx ?? NarrativeCampaignEngine.NO_BACKFIRE_CONTEXT,
      );
      backfires.push(backfireResult);

      // 5. Compute effects and aggregate.
      const effects = this.computeEffects(advancedCampaign);

      // Apply backfire penalty to the aggregated legitimacy delta.
      if (backfireResult.backfired) {
        aggregated.legitimacyDelta += backfireResult.legitimacyPenalty;
      }

      NarrativeCampaignEngine.accumulateEffects(aggregated, effects);
      advancedCampaigns.push(advancedCampaign);
    }

    const updatedLog: NarrativeCampaignLog = {
      factionId: log.factionId,
      activeCampaigns: advancedCampaigns,
      historicalCampaigns: [...log.historicalCampaigns],
    };

    return {
      log: updatedLog,
      aggregatedEffects: NarrativeCampaignEngine.freezeEffects(aggregated),
      backfires,
    };
  }

  /**
   * Retrieve the first active campaign of the given narrative type.
   *
   * Useful for UI display ("is this faction running a Liberation campaign?")
   * or guard checks before deploying a new one.
   *
   * @param log  - The faction's current campaign log.
   * @param type - The narrative type to search for.
   * @returns The matching {@link NarrativeCampaign} or `undefined` if none.
   *
   * @see FR-1602
   */
  public getActiveCampaignByType(
    log: NarrativeCampaignLog,
    type: NarrativeType,
  ): NarrativeCampaign | undefined {
    return log.activeCampaigns.find((c) => c.type === type);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to an inclusive [min, max] range.
   *
   * Static so it can be called without an instance where convenient.
   *
   * @param value - The raw value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value, guaranteed to be within [min, max].
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Compute a 0–1 linear scale from a 0–100 effectiveness score.
   *
   * @param effectiveness - Campaign effectiveness in 0–100.
   * @returns A multiplier in the range [0, 1].
   */
  private effectivenessScale(effectiveness: number): number {
    return NarrativeCampaignEngine.clamp(effectiveness / SCORE_MAX, MULTIPLIER_MIN, MULTIPLIER_MAX);
  }

  /**
   * Create a frozen {@link CampaignEffects} with all fields zeroed.
   *
   * Used as a baseline for `computeEffects` — individual narrative
   * handlers override only the fields they affect.
   *
   * @returns A zero-initialised, frozen effects object.
   */
  private createEmptyEffects(): CampaignEffects {
    return {
      nationalismDelta: 0,
      sympathyDelta: 0,
      angerDelta: 0,
      legitimacyDelta: 0,
      diCost: 0,
      diplomaticPenaltyReduction: 0,
      militaryLegitimacyReduction: 0,
    };
  }

  /**
   * Create a mutable effects accumulator for aggregation during
   * {@link advanceTurn}. Identical shape to {@link CampaignEffects}
   * but without `readonly` so we can accumulate in-place.
   *
   * @returns A zero-initialised mutable effects record.
   */
  private createMutableEffects(): MutableCampaignEffects {
    return {
      nationalismDelta: 0,
      sympathyDelta: 0,
      angerDelta: 0,
      legitimacyDelta: 0,
      diCost: 0,
      diplomaticPenaltyReduction: 0,
      militaryLegitimacyReduction: 0,
    };
  }

  /**
   * Accumulate a single campaign's effects into a running total.
   *
   * Reduction multipliers are combined via the complement product:
   *   combinedReduction = 1 − (1 − existing)(1 − incoming)
   * so that stacking two 30 % reductions yields 51 % rather than 60 %.
   *
   * @param acc    - Mutable accumulator (mutated in place).
   * @param source - Read-only effects to add.
   */
  private static accumulateEffects(
    acc: MutableCampaignEffects,
    source: CampaignEffects,
  ): void {
    acc.nationalismDelta += source.nationalismDelta;
    acc.sympathyDelta += source.sympathyDelta;
    acc.angerDelta += source.angerDelta;
    acc.legitimacyDelta += source.legitimacyDelta;
    acc.diCost += source.diCost;

    // Complement-product stacking for reduction multipliers.
    acc.diplomaticPenaltyReduction = NarrativeCampaignEngine.clamp(
      1 - (1 - acc.diplomaticPenaltyReduction) * (1 - source.diplomaticPenaltyReduction),
      MULTIPLIER_MIN,
      MULTIPLIER_MAX,
    );
    acc.militaryLegitimacyReduction = NarrativeCampaignEngine.clamp(
      1 - (1 - acc.militaryLegitimacyReduction) * (1 - source.militaryLegitimacyReduction),
      MULTIPLIER_MIN,
      MULTIPLIER_MAX,
    );
  }

  /**
   * Convert a mutable accumulator into a frozen {@link CampaignEffects}.
   *
   * @param mutable - The mutable accumulator.
   * @returns A frozen, read-only copy.
   */
  private static freezeEffects(mutable: MutableCampaignEffects): CampaignEffects {
    return {
      nationalismDelta: mutable.nationalismDelta,
      sympathyDelta: mutable.sympathyDelta,
      angerDelta: mutable.angerDelta,
      legitimacyDelta: mutable.legitimacyDelta,
      diCost: mutable.diCost,
      diplomaticPenaltyReduction: mutable.diplomaticPenaltyReduction,
      militaryLegitimacyReduction: mutable.militaryLegitimacyReduction,
    };
  }

  // ── Static defaults ─────────────────────────────────────────────────────

  /**
   * Default no-op backfire context.
   *
   * Used when `TurnContext.backfireContexts` does not contain an entry
   * for a given narrative type — assumes no backfire conditions are met.
   */
  private static readonly NO_BACKFIRE_CONTEXT: BackfireContext = {
    hasAggressiveMilitaryAction: false,
    hasEconomicCoercion: false,
    hasContradictoryEvidence: false,
  };
}

// ─────────────────────────────────────────────────────────
// Internal types (not exported — implementation detail)
// ─────────────────────────────────────────────────────────

/**
 * Mutable mirror of {@link CampaignEffects} used internally for
 * in-place aggregation during `advanceTurn`.
 */
interface MutableCampaignEffects {
  nationalismDelta: number;
  sympathyDelta: number;
  angerDelta: number;
  legitimacyDelta: number;
  diCost: number;
  diplomaticPenaltyReduction: number;
  militaryLegitimacyReduction: number;
}
