/**
 * Covert Insurgency Funding Engine — Grey Zone Operations
 *
 * Allows factions to fund covert insurgencies in rival nations, lowering
 * target Stability without triggering a formal Declaration of War.
 *
 * Key design invariant: insurgency effects **never** set a war-state flag.
 * This is the core distinguishing trait of grey-zone operations.
 *
 * @module covert-insurgency
 * @see CNFL-0700 — Covert insurgency funding implementation ticket
 * @see FR-401  — Covert insurgency funding requirements
 */

import type { FactionId, TurnNumber, NationState } from '@/data/types';
import { GAME_CONFIG } from './config';
import { SeededRandom } from './rng';

// ─────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing insurgency mechanics.
 * Alias for the `greyZone.insurgency` branch of {@link GAME_CONFIG}.
 *
 * @see FR-401
 */
export type InsurgencyConfig = typeof GAME_CONFIG.greyZone.insurgency;

/**
 * Persistent record tracking a single covert insurgency operation.
 *
 * Created by {@link CovertInsurgencyEngine.initiateInsurgency} and mutated
 * (immutably) by turn processing and cancellation helpers.
 *
 * @see FR-401
 */
export interface InsurgencyRecord {
  /** Unique identifier for this insurgency operation. */
  readonly id: string;
  /** Faction funding the insurgency. */
  readonly sponsorFaction: FactionId;
  /** Faction whose stability is being undermined. */
  readonly targetFaction: FactionId;
  /** Turn on which the insurgency was initiated. */
  readonly startTurn: TurnNumber;
  /** First turn on which effects apply (after ramp-up period). */
  readonly effectiveTurn: TurnNumber;
  /** Whether the insurgency is currently active. */
  active: boolean;
  /** Turn on which the insurgency was cancelled, or `null` if still active. */
  endTurn: TurnNumber | null;
  /** Running total of stability points drained from the target. */
  cumulativeStabilityDamage: number;
}

/**
 * Result of validating whether a faction may initiate a new insurgency.
 *
 * @see FR-401
 */
export interface InsurgencyValidation {
  /** `true` when all preconditions are met. */
  valid: boolean;
  /** Human-readable explanation (useful for UI tooltips). */
  reason: string;
}

/**
 * Per-insurgency deltas produced by a single turn of processing.
 *
 * @see FR-401
 */
export interface InsurgencyTurnResult {
  /** ID of the insurgency that produced this result. */
  insurgencyId: string;
  /** Target faction receiving the stability hit. */
  targetFaction: FactionId;
  /** Stability change applied to the target (negative or zero). */
  stabilityDelta: number;
  /** Treasury cost charged to the sponsor this turn. */
  treasuryCost: number;
  /** Whether the insurgency is still in its ramp-up period. */
  inRampUp: boolean;
}

/**
 * Aggregated results of processing every active insurgency in a single turn.
 *
 * @see FR-401
 */
export interface AllInsurgenciesTurnResult {
  /** Individual results for each active insurgency. */
  results: InsurgencyTurnResult[];
  /** Net stability delta per target faction (keyed by FactionId string). */
  perTargetStabilityDelta: Record<string, number>;
  /** Net treasury cost per sponsor faction (keyed by FactionId string). */
  perSponsorTreasuryCost: Record<string, number>;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of covert insurgency operations: validation,
 * initiation, per-turn effect processing, and cancellation.
 *
 * All public methods are **pure** with respect to external game state —
 * they return delta objects rather than mutating {@link NationState} directly.
 * The caller (turn engine) is responsible for applying the deltas.
 *
 * @see FR-401 — Covert insurgency funding
 */
export class CovertInsurgencyEngine {
  private readonly config: InsurgencyConfig;
  private readonly rng: SeededRandom;

  /**
   * @param config  Insurgency-specific configuration constants.
   * @param rng     Seeded PRNG instance for deterministic randomness.
   *
   * @see FR-401
   */
  constructor(config: InsurgencyConfig, rng: SeededRandom) {
    this.config = config;
    this.rng = rng;
  }

  // ── Validation ──────────────────────────────────────────

  /**
   * Determine whether a sponsoring nation meets all preconditions to
   * initiate a new covert insurgency.
   *
   * Checks (in order):
   * 1. Diplomatic Influence ≥ {@link InsurgencyConfig.minDIToInitiate}
   * 2. Treasury ≥ {@link InsurgencyConfig.treasuryCostPerTurn}
   * 3. Active insurgency count < {@link InsurgencyConfig.maxConcurrentInsurgencies}
   *
   * @param sponsor     Current nation state of the would-be sponsor.
   * @param activeCount Number of insurgencies already funded by this sponsor.
   * @returns           Validation result with success flag and human-readable reason.
   *
   * @see FR-401
   */
  canInitiateInsurgency(
    sponsor: NationState,
    activeCount: number,
  ): InsurgencyValidation {
    if (sponsor.diplomaticInfluence < this.config.minDIToInitiate) {
      return {
        valid: false,
        reason: `Diplomatic Influence (${String(sponsor.diplomaticInfluence)}) is below the minimum threshold of ${String(this.config.minDIToInitiate)}.`,
      };
    }

    if (sponsor.treasury < this.config.treasuryCostPerTurn) {
      return {
        valid: false,
        reason: `Treasury (${String(sponsor.treasury)}B) is insufficient to cover the per-turn cost of ${String(this.config.treasuryCostPerTurn)}B.`,
      };
    }

    if (activeCount >= this.config.maxConcurrentInsurgencies) {
      return {
        valid: false,
        reason: `Maximum concurrent insurgencies (${String(this.config.maxConcurrentInsurgencies)}) already reached.`,
      };
    }

    return {
      valid: true,
      reason: 'All preconditions met.',
    };
  }

  // ── Lifecycle ───────────────────────────────────────────

  /**
   * Create a new insurgency record targeting a rival nation.
   *
   * The insurgency enters a ramp-up period of
   * {@link InsurgencyConfig.rampUpTurns} turns before effects begin.
   * A unique ID is generated using the seeded PRNG to maintain determinism.
   *
   * @param sponsorFaction  Faction funding the operation.
   * @param targetFaction   Faction whose stability will be undermined.
   * @param currentTurn     Turn on which the insurgency is initiated.
   * @returns               A fresh {@link InsurgencyRecord}.
   *
   * @see FR-401
   */
  initiateInsurgency(
    sponsorFaction: FactionId,
    targetFaction: FactionId,
    currentTurn: TurnNumber,
  ): InsurgencyRecord {
    const id = `ins-${String(sponsorFaction)}-${String(targetFaction)}-${String(currentTurn)}-${String(this.rng.nextInt(1000, 9999))}`;
    const effectiveTurn = (currentTurn + this.config.rampUpTurns) as TurnNumber;

    return {
      id,
      sponsorFaction,
      targetFaction,
      startTurn: currentTurn,
      effectiveTurn,
      active: true,
      endTurn: null,
      cumulativeStabilityDamage: 0,
    };
  }

  // ── Per-Turn Processing ─────────────────────────────────

  /**
   * Compute the effects of a single insurgency for the current turn.
   *
   * - During the **ramp-up period** (`currentTurn < effectiveTurn`):
   *   returns zero deltas with `inRampUp: true`.
   * - Once effective: returns `stabilityDelta = -stabilityReductionPerTurn`
   *   and `treasuryCost = treasuryCostPerTurn`.
   *
   * **FR-401 invariant**: no war-state is triggered — the returned deltas
   * never include a war-state flag.
   *
   * @param insurgency  The insurgency record to process.
   * @param currentTurn The current game turn.
   * @returns           Deltas for this turn (stability hit + treasury cost).
   *
   * @see FR-401
   */
  processTurnEffects(
    insurgency: InsurgencyRecord,
    currentTurn: TurnNumber,
  ): InsurgencyTurnResult {
    // Still in ramp-up period — no effects yet.
    if (currentTurn < insurgency.effectiveTurn) {
      return {
        insurgencyId: insurgency.id,
        targetFaction: insurgency.targetFaction,
        stabilityDelta: 0,
        treasuryCost: this.config.treasuryCostPerTurn,
        inRampUp: true,
      };
    }

    // Active effect phase — stability drain + treasury cost.
    const stabilityDelta = -this.config.stabilityReductionPerTurn;
    insurgency.cumulativeStabilityDamage += this.config.stabilityReductionPerTurn;

    return {
      insurgencyId: insurgency.id,
      targetFaction: insurgency.targetFaction,
      stabilityDelta,
      treasuryCost: this.config.treasuryCostPerTurn,
      inRampUp: false,
    };
  }

  /**
   * Process all active insurgencies for a single turn, aggregating
   * per-target stability deltas and per-sponsor treasury costs.
   *
   * Inactive insurgencies are silently skipped.
   *
   * @param insurgencies All tracked insurgency records (active and inactive).
   * @param currentTurn  The current game turn.
   * @returns            Aggregated results with per-target and per-sponsor breakdowns.
   *
   * @see FR-401
   */
  processAllInsurgencies(
    insurgencies: InsurgencyRecord[],
    currentTurn: TurnNumber,
  ): AllInsurgenciesTurnResult {
    const results: InsurgencyTurnResult[] = [];
    const perTargetStabilityDelta: Record<string, number> = {};
    const perSponsorTreasuryCost: Record<string, number> = {};

    for (const insurgency of insurgencies) {
      if (!insurgency.active) continue;

      const result = this.processTurnEffects(insurgency, currentTurn);
      results.push(result);

      // Aggregate per-target stability delta (use ?? 0 for noUncheckedIndexedAccess)
      const targetKey = String(insurgency.targetFaction);
      perTargetStabilityDelta[targetKey] =
        (perTargetStabilityDelta[targetKey] ?? 0) + result.stabilityDelta;

      // Aggregate per-sponsor treasury cost
      const sponsorKey = String(insurgency.sponsorFaction);
      perSponsorTreasuryCost[sponsorKey] =
        (perSponsorTreasuryCost[sponsorKey] ?? 0) + result.treasuryCost;
    }

    return { results, perTargetStabilityDelta, perSponsorTreasuryCost };
  }

  // ── Cancellation ────────────────────────────────────────

  /**
   * Cancel an active insurgency, marking it as inactive and recording
   * the turn of cancellation.
   *
   * Returns a **new** record (pure function) rather than mutating in-place,
   * preserving immutability for the store/event-sourcing layer.
   *
   * @param insurgency  The insurgency to cancel.
   * @param currentTurn The turn on which cancellation occurs.
   * @returns           A new {@link InsurgencyRecord} with `active: false`.
   *
   * @see FR-401
   */
  cancelInsurgency(
    insurgency: InsurgencyRecord,
    currentTurn: TurnNumber,
  ): InsurgencyRecord {
    return {
      ...insurgency,
      active: false,
      endTurn: currentTurn,
    };
  }

  // ── Affordability Check ─────────────────────────────────

  /**
   * Quick check whether a faction's treasury can cover at least one turn
   * of insurgency funding.
   *
   * @param treasury Current treasury balance (billions).
   * @returns        `true` if the faction can afford the per-turn cost.
   *
   * @see FR-401
   */
  canSponsorAfford(treasury: number): boolean {
    return treasury >= this.config.treasuryCostPerTurn;
  }
}
