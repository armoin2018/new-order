/**
 * Grey Zone Operations Engine — Maritime Militia Blockades & Cyber Operations
 *
 * Implements two categories of grey-zone escalation that fall below the
 * threshold of formal war declarations:
 *
 * 1. **Maritime Militia Blockades** (FR-402): "Fishing Fleet" units that
 *    disrupt trade in the China/Taiwan/Japan theatre without triggering
 *    automatic US war-state responses.
 * 2. **Cyber Operations** (FR-403): Targeted cyber attacks that degrade a
 *    rival nation's Military Readiness or GDP Growth for a configurable
 *    duration.
 *
 * All public methods are **pure** with respect to external game state —
 * they return delta objects rather than mutating {@link NationState} directly.
 * The caller (turn engine) is responsible for applying the deltas.
 *
 * @module grey-zone-ops
 * @see CNFL-0701 — Maritime militia & cyber operations implementation ticket
 * @see FR-402   — Maritime militia blockade requirements
 * @see FR-403   — Cyber operations requirements
 */

import type {
  FactionId,
  TurnNumber,
  HexId,
  NationState,
  IntelligenceCapabilities,
} from '@/data/types';
import { GAME_CONFIG } from './config';
import { SeededRandom } from './rng';

// ─────────────────────────────────────────────────────────
// Configuration Aliases
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing the entire grey-zone operations block.
 * Alias for the `greyZone` branch of {@link GAME_CONFIG}.
 *
 * @see FR-402
 * @see FR-403
 */
export type GreyZoneOpsConfig = typeof GAME_CONFIG.greyZone;

/**
 * Configuration subset governing maritime militia blockade mechanics.
 *
 * @see FR-402
 */
type MaritimeMilitiaConfig = typeof GAME_CONFIG.greyZone.maritimeMilitia;

/**
 * Configuration subset governing cyber operations mechanics.
 *
 * @see FR-403
 */
type CyberOpsConfig = typeof GAME_CONFIG.greyZone.cyberOps;

// ─────────────────────────────────────────────────────────
// Exported Types — Maritime Militia (FR-402)
// ─────────────────────────────────────────────────────────

/**
 * Persistent record tracking a single maritime militia blockade operation.
 *
 * Created by {@link GreyZoneOpsEngine.deployBlockade} and deactivated by
 * {@link GreyZoneOpsEngine.liftBlockade}.
 *
 * The `triggersWarState` field is a **literal `false`** — this is the core
 * invariant of FR-402: fishing fleet blockades never escalate to formal war.
 *
 * @see FR-402
 */
export interface BlockadeRecord {
  /** Unique identifier for this blockade operation. */
  readonly id: string;
  /** Faction sponsoring the fishing fleet blockade. */
  readonly sponsorFaction: FactionId;
  /** Faction whose trade is being disrupted. */
  readonly targetFaction: FactionId;
  /** Hex location where the fishing fleet is deployed. */
  readonly targetHex: HexId;
  /** Turn on which the blockade was initiated. */
  readonly startTurn: TurnNumber;
  /** Whether the blockade is currently active. */
  active: boolean;
  /** Turn on which the blockade was lifted, or `null` if still active. */
  endTurn: TurnNumber | null;
  /**
   * Literal `false` — fishing fleet blockades **never** trigger war-state.
   * This is the defining characteristic of FR-402.
   *
   * @see FR-402
   */
  readonly triggersWarState: false;
}

/**
 * Result of validating whether a faction may deploy a new blockade.
 *
 * @see FR-402
 */
export interface BlockadeValidation {
  /** `true` when all preconditions are met. */
  valid: boolean;
  /** Human-readable explanation (useful for UI tooltips). */
  reason: string;
}

/**
 * Per-blockade deltas produced by a single turn of processing.
 *
 * @see FR-402
 */
export interface BlockadeTurnResult {
  /** ID of the blockade that produced this result. */
  blockadeId: string;
  /** Trade disruption percentage applied to the target. */
  tradeDisruptionDelta: number;
  /** Bilateral tension increase this turn. */
  tensionDelta: number;
  /** Treasury cost charged to the sponsor this turn. */
  treasuryCost: number;
  /**
   * Literal `false` — FR-402 invariant: no war-state trigger.
   *
   * @see FR-402
   */
  triggersWarState: false;
}

// ─────────────────────────────────────────────────────────
// Exported Types — Cyber Operations (FR-403)
// ─────────────────────────────────────────────────────────

/**
 * The two nation-state stats that a cyber operation can target.
 *
 * @see FR-403
 */
export type CyberOpTarget = 'militaryReadiness' | 'gdpGrowth';

/**
 * Persistent record tracking a single cyber operation.
 *
 * Created by {@link GreyZoneOpsEngine.launchCyberOp}. Automatically
 * expires when `currentTurn` exceeds `expiryTurn`.
 *
 * @see FR-403
 */
export interface CyberOpRecord {
  /** Unique identifier for this cyber operation. */
  readonly id: string;
  /** Faction launching the cyber attack. */
  readonly sponsorFaction: FactionId;
  /** Faction being targeted. */
  readonly targetFaction: FactionId;
  /** Which nation stat is degraded by this operation. */
  readonly targetStat: CyberOpTarget;
  /** Turn on which the operation was launched. */
  readonly startTurn: TurnNumber;
  /** Last turn on which the effect is active (inclusive). */
  readonly expiryTurn: TurnNumber;
  /** Whether the operation is still producing effects. */
  active: boolean;
}

/**
 * Result of validating whether a faction may launch a new cyber operation.
 *
 * @see FR-403
 */
export interface CyberOpValidation {
  /** `true` when all preconditions are met. */
  valid: boolean;
  /** Human-readable explanation (useful for UI tooltips). */
  reason: string;
}

/**
 * Per-operation deltas produced by a single turn of cyber-op processing.
 *
 * @see FR-403
 */
export interface CyberOpTurnResult {
  /** ID of the cyber operation that produced this result. */
  opId: string;
  /** Faction receiving the stat degradation. */
  targetFaction: FactionId;
  /** Which stat is being degraded. */
  targetStat: CyberOpTarget;
  /** Numeric delta applied to the target stat (negative or zero). */
  statDelta: number;
  /** Whether the operation has expired this turn. */
  expired: boolean;
}

/**
 * Aggregated results of processing every active cyber operation in a
 * single turn.
 *
 * @see FR-403
 */
export interface AllCyberOpsTurnResult {
  /** Individual results for each processed operation. */
  results: CyberOpTurnResult[];
  /** Operations that expired during this processing pass. */
  expired: CyberOpRecord[];
  /** Operations that remain active after this processing pass. */
  active: CyberOpRecord[];
  /**
   * Aggregate per-target stat deltas. Keyed by FactionId string.
   * Each value contains the summed `militaryReadinessDelta` and
   * `gdpGrowthDelta` from all active ops targeting that faction.
   */
  perTargetEffects: Record<string, {
    militaryReadinessDelta: number;
    gdpGrowthDelta: number;
  }>;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of maritime militia blockades and cyber operations:
 * validation, deployment/launch, per-turn effect processing, and termination.
 *
 * All public methods are **pure** with respect to external game state —
 * they return delta objects rather than mutating {@link NationState} directly.
 * The caller (turn engine) is responsible for applying the deltas.
 *
 * @see FR-402 — Maritime militia blockades
 * @see FR-403 — Cyber operations
 */
export class GreyZoneOpsEngine {
  private readonly maritimeConfig: MaritimeMilitiaConfig;
  private readonly cyberConfig: CyberOpsConfig;
  private readonly rng: SeededRandom;

  /**
   * @param config  Grey-zone configuration constants (entire greyZone block).
   * @param rng     Seeded PRNG instance for deterministic ID generation.
   *
   * @see FR-402
   * @see FR-403
   */
  constructor(config: GreyZoneOpsConfig, rng: SeededRandom) {
    this.maritimeConfig = config.maritimeMilitia;
    this.cyberConfig = config.cyberOps;
    this.rng = rng;
  }

  // ═══════════════════════════════════════════════════════
  // MARITIME MILITIA — FR-402
  // ═══════════════════════════════════════════════════════

  // ── Validation ──────────────────────────────────────────

  /**
   * Determine whether a sponsoring nation meets all preconditions to
   * deploy a new fishing fleet blockade.
   *
   * Checks (in order):
   * 1. Treasury ≥ {@link MaritimeMilitiaConfig.treasuryCostPerTurn}
   * 2. Active fleet count < {@link MaritimeMilitiaConfig.maxFleetUnits}
   *
   * @param sponsor          Current nation state of the would-be sponsor.
   * @param activeFleetCount Number of fishing fleet blockades already active.
   * @returns                Validation result with success flag and reason.
   *
   * @see FR-402
   */
  canDeployBlockade(
    sponsor: NationState,
    activeFleetCount: number,
  ): BlockadeValidation {
    if (sponsor.treasury < this.maritimeConfig.treasuryCostPerTurn) {
      return {
        valid: false,
        reason: `Treasury (${String(sponsor.treasury)}B) is insufficient to cover the per-turn cost of ${String(this.maritimeConfig.treasuryCostPerTurn)}B.`,
      };
    }

    if (activeFleetCount >= this.maritimeConfig.maxFleetUnits) {
      return {
        valid: false,
        reason: `Maximum fleet units (${String(this.maritimeConfig.maxFleetUnits)}) already deployed.`,
      };
    }

    return {
      valid: true,
      reason: 'All preconditions met.',
    };
  }

  // ── Deployment ──────────────────────────────────────────

  /**
   * Create a new blockade record: a fishing fleet deployed at the target hex.
   *
   * **FR-402 invariant**: the returned record's `triggersWarState` is always
   * `false`. Fishing fleet blockades do NOT escalate to formal war.
   *
   * @param sponsorFaction Faction deploying the fishing fleet.
   * @param targetFaction  Faction whose maritime trade is being disrupted.
   * @param targetHex      Hex where the fleet is deployed.
   * @param currentTurn    Turn on which the blockade begins.
   * @returns              A fresh {@link BlockadeRecord}.
   *
   * @see FR-402
   */
  deployBlockade(
    sponsorFaction: FactionId,
    targetFaction: FactionId,
    targetHex: HexId,
    currentTurn: TurnNumber,
  ): BlockadeRecord {
    const id = `blk-${String(sponsorFaction)}-${String(targetFaction)}-${String(currentTurn)}-${String(this.rng.nextInt(1000, 9999))}`;

    return {
      id,
      sponsorFaction,
      targetFaction,
      targetHex,
      startTurn: currentTurn,
      active: true,
      endTurn: null,
      triggersWarState: false,
    };
  }

  // ── Per-Turn Processing ─────────────────────────────────

  /**
   * Compute the per-turn effects of a single active blockade.
   *
   * Returns:
   * - `tradeDisruptionDelta`: percentage of target trade disrupted.
   * - `tensionDelta`: bilateral tension increase.
   * - `treasuryCost`: treasury cost to the sponsor.
   * - `triggersWarState`: **always `false`** (FR-402 core invariant).
   *
   * @param blockade The active blockade record to process.
   * @returns        Deltas for this turn.
   *
   * @see FR-402
   */
  processBlockadeTurn(blockade: BlockadeRecord): BlockadeTurnResult {
    return {
      blockadeId: blockade.id,
      tradeDisruptionDelta: this.maritimeConfig.tradeDisruptionPercent,
      tensionDelta: this.maritimeConfig.tensionIncreasePerTurn,
      treasuryCost: this.maritimeConfig.treasuryCostPerTurn,
      triggersWarState: false,
    };
  }

  // ── Lifting ─────────────────────────────────────────────

  /**
   * Deactivate a blockade, marking it as lifted and recording the turn
   * of deactivation.
   *
   * Returns a **new** record (pure function) rather than mutating in-place,
   * preserving immutability for the store/event-sourcing layer.
   *
   * @param blockade    The blockade to lift.
   * @param currentTurn The turn on which the blockade is lifted.
   * @returns           A new {@link BlockadeRecord} with `active: false`.
   *
   * @see FR-402
   */
  liftBlockade(
    blockade: BlockadeRecord,
    currentTurn: TurnNumber,
  ): BlockadeRecord {
    return {
      ...blockade,
      active: false,
      endTurn: currentTurn,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CYBER OPERATIONS — FR-403
  // ═══════════════════════════════════════════════════════

  // ── Validation ──────────────────────────────────────────

  /**
   * Determine whether a sponsoring nation meets all preconditions to
   * launch a new cyber operation.
   *
   * Checks (in order):
   * 1. Treasury ≥ {@link CyberOpsConfig.treasuryCost}
   * 2. Cyber capability ≥ {@link CyberOpsConfig.minCyberCapability}
   * 3. Active cyber ops count < {@link CyberOpsConfig.maxConcurrentOps}
   *
   * @param sponsor              Current nation state of the would-be sponsor.
   * @param sponsorCapabilities  Intelligence capabilities of the sponsor.
   * @param activeCyberOps       Number of cyber ops already active for this sponsor.
   * @returns                    Validation result with success flag and reason.
   *
   * @see FR-403
   */
  canLaunchCyberOp(
    sponsor: NationState,
    sponsorCapabilities: IntelligenceCapabilities,
    activeCyberOps: number,
  ): CyberOpValidation {
    if (sponsor.treasury < this.cyberConfig.treasuryCost) {
      return {
        valid: false,
        reason: `Treasury (${String(sponsor.treasury)}B) is insufficient to cover the cyber op cost of ${String(this.cyberConfig.treasuryCost)}B.`,
      };
    }

    if (sponsorCapabilities.cyber < this.cyberConfig.minCyberCapability) {
      return {
        valid: false,
        reason: `Cyber capability (${String(sponsorCapabilities.cyber)}) is below the minimum threshold of ${String(this.cyberConfig.minCyberCapability)}.`,
      };
    }

    if (activeCyberOps >= this.cyberConfig.maxConcurrentOps) {
      return {
        valid: false,
        reason: `Maximum concurrent cyber ops (${String(this.cyberConfig.maxConcurrentOps)}) already reached.`,
      };
    }

    return {
      valid: true,
      reason: 'All preconditions met.',
    };
  }

  // ── Launch ──────────────────────────────────────────────

  /**
   * Create a new cyber operation record targeting a rival nation's
   * Military Readiness or GDP Growth.
   *
   * The operation is active from `currentTurn` through `expiryTurn`
   * (inclusive), which is `currentTurn + effectDurationTurns`.
   *
   * @param sponsorFaction Faction launching the cyber attack.
   * @param targetFaction  Faction being targeted.
   * @param targetStat     Which stat to degrade: 'militaryReadiness' or 'gdpGrowth'.
   * @param currentTurn    Turn on which the operation is launched.
   * @returns              A fresh {@link CyberOpRecord}.
   *
   * @see FR-403
   */
  launchCyberOp(
    sponsorFaction: FactionId,
    targetFaction: FactionId,
    targetStat: CyberOpTarget,
    currentTurn: TurnNumber,
  ): CyberOpRecord {
    const id = `cyb-${String(sponsorFaction)}-${String(targetFaction)}-${String(currentTurn)}-${String(this.rng.nextInt(1000, 9999))}`;
    const expiryTurn = (currentTurn + this.cyberConfig.effectDurationTurns) as TurnNumber;

    return {
      id,
      sponsorFaction,
      targetFaction,
      targetStat,
      startTurn: currentTurn,
      expiryTurn,
      active: true,
    };
  }

  // ── Per-Turn Processing ─────────────────────────────────

  /**
   * Compute the per-turn effects of a single cyber operation.
   *
   * - If `currentTurn > expiryTurn` → the op has expired; returns zero delta
   *   with `expired: true`.
   * - If `targetStat` is `'militaryReadiness'` → delta = −militaryReadinessReduction.
   * - If `targetStat` is `'gdpGrowth'` → delta = −gdpGrowthReduction.
   *
   * @param op          The cyber operation record to process.
   * @param currentTurn The current game turn.
   * @returns           Per-operation delta for this turn.
   *
   * @see FR-403
   */
  processCyberOpTurn(
    op: CyberOpRecord,
    currentTurn: TurnNumber,
  ): CyberOpTurnResult {
    // Operation has expired — no further effect.
    if (currentTurn > op.expiryTurn) {
      return {
        opId: op.id,
        targetFaction: op.targetFaction,
        targetStat: op.targetStat,
        statDelta: 0,
        expired: true,
      };
    }

    // Active — compute the appropriate stat delta.
    const statDelta = op.targetStat === 'militaryReadiness'
      ? -this.cyberConfig.militaryReadinessReduction
      : -this.cyberConfig.gdpGrowthReduction;

    return {
      opId: op.id,
      targetFaction: op.targetFaction,
      targetStat: op.targetStat,
      statDelta,
      expired: false,
    };
  }

  /**
   * Process all cyber operations for a single turn, partitioning them into
   * active and expired sets and aggregating per-target stat effects.
   *
   * Inactive operations (already deactivated prior to this call) are
   * silently skipped.
   *
   * @param ops         All tracked cyber operation records (active and inactive).
   * @param currentTurn The current game turn.
   * @returns           Aggregated results with active/expired partitions and
   *                    per-target effect breakdowns.
   *
   * @see FR-403
   */
  processAllCyberOps(
    ops: CyberOpRecord[],
    currentTurn: TurnNumber,
  ): AllCyberOpsTurnResult {
    const results: CyberOpTurnResult[] = [];
    const expiredOps: CyberOpRecord[] = [];
    const activeOps: CyberOpRecord[] = [];
    const perTargetEffects: Record<string, {
      militaryReadinessDelta: number;
      gdpGrowthDelta: number;
    }> = {};

    for (const op of ops) {
      if (!op.active) continue;

      const result = this.processCyberOpTurn(op, currentTurn);
      results.push(result);

      if (result.expired) {
        // Mark the operation as inactive and file into expired list.
        op.active = false;
        expiredOps.push(op);
      } else {
        activeOps.push(op);

        // Aggregate per-target effects (use ?? for noUncheckedIndexedAccess).
        const targetKey = String(op.targetFaction);
        const existing = perTargetEffects[targetKey] ?? {
          militaryReadinessDelta: 0,
          gdpGrowthDelta: 0,
        };

        if (op.targetStat === 'militaryReadiness') {
          existing.militaryReadinessDelta += result.statDelta;
        } else {
          existing.gdpGrowthDelta += result.statDelta;
        }

        perTargetEffects[targetKey] = existing;
      }
    }

    return {
      results,
      expired: expiredOps,
      active: activeOps,
      perTargetEffects,
    };
  }
}
