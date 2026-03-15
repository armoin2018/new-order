/**
 * New Order: Intelligence Reliability & Ghost Unit Engine — CNFL-0601
 *
 * Implements intelligence report reliability scoring, ghost unit spawning,
 * and false diplomatic pact generation. Low-reliability intelligence reports
 * may produce phantom units on the fog-of-war map or fabricated alliance
 * entries, simulating the uncertainty inherent in real-world intelligence.
 *
 * Ghost units have zero combat value and decay after a configurable number
 * of turns. False pacts are revealed once the observing faction's analysts
 * catch the discrepancy.
 *
 * @see FR-202 — Intelligence reports carry a Reliability stat (0-100%).
 *               Reports with reliability < 40% may generate Ghost Units or
 *               False Diplomatic Pacts on the map.
 * @see FR-204 — Diplomatic Investment (DI) can boost intelligence reliability.
 *
 * @module engine/intelligence-reliability
 */

import { UnitType } from '@/data/types';
import { GAME_CONFIG } from './config';
import { SeededRandom } from './rng';

import type { FactionId, HexId, TurnNumber, UnitId } from '@/data/types';
import type { IntelligenceCapabilities, Unit } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type
// ─────────────────────────────────────────────────────────

/**
 * Intelligence reliability configuration — sourced from
 * {@link GAME_CONFIG.intelReliability}.
 *
 * @see FR-202
 */
export type IntelReliabilityConfig = typeof GAME_CONFIG.intelReliability;

// ─────────────────────────────────────────────────────────
// Record Types
// ─────────────────────────────────────────────────────────

/**
 * A ghost unit record — a phantom unit perceived by the observing faction
 * but with no real combat presence.
 *
 * @see FR-202
 */
export interface GhostUnitRecord {
  /** The ghost unit entity. Always has `isGhost: true` and zero combat stats. */
  readonly unit: Unit;
  /** Faction that "sees" this ghost on its intelligence map. */
  readonly observingFaction: FactionId;
  /** Turn on which the ghost was spawned. */
  readonly spawnTurn: TurnNumber;
  /** Turn on which the ghost expires and should be removed. */
  readonly expiryTurn: TurnNumber;
}

/**
 * A false diplomatic pact record — an alleged alliance or pact between two
 * factions that does not actually exist.
 *
 * @see FR-202
 */
export interface FalsePactRecord {
  /** Unique identifier for this false pact entry. */
  readonly id: string;
  /** Faction that was fed the false intelligence. */
  readonly observingFaction: FactionId;
  /** The two factions allegedly forming the pact. */
  readonly allegedFactions: readonly [FactionId, FactionId];
  /** Turn on which the false pact was generated. */
  readonly spawnTurn: TurnNumber;
  /** Turn on which the false pact will be revealed as fabrication. */
  readonly revealTurn: TurnNumber;
  /** Whether this pact has been flagged as false to the observing faction. */
  revealed: boolean;
}

// ─────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────

/**
 * Result of processing ghost unit decay for a given turn.
 *
 * @see FR-202
 */
export interface GhostDecayResult {
  /** Ghost units whose expiry turn has passed — should be removed from the map. */
  readonly expired: readonly GhostUnitRecord[];
  /** Ghost units that are still active on the map. */
  readonly active: readonly GhostUnitRecord[];
}

/**
 * Result of processing false pact reveals for a given turn.
 *
 * @see FR-202
 */
export interface FalsePactRevealResult {
  /** Pacts whose reveal turn has passed — should be flagged to the player. */
  readonly revealed: readonly FalsePactRecord[];
  /** Pacts that remain hidden (not yet revealed). */
  readonly hidden: readonly FalsePactRecord[];
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/**
 * Subset of unit types that ghost units may impersonate.
 * Only conventional types are plausible for misidentified intel reports.
 */
const GHOST_UNIT_TYPES = [
  UnitType.Infantry,
  UnitType.Armor,
  UnitType.Naval,
  UnitType.Air,
] as const;

/** Counter for generating unique ghost unit IDs within a session. */
let ghostIdCounter = 0;

/** Counter for generating unique false pact IDs within a session. */
let falsePactIdCounter = 0;

// ─────────────────────────────────────────────────────────
// IntelligenceReliabilityEngine
// ─────────────────────────────────────────────────────────

/**
 * Core engine for intelligence reliability scoring, ghost unit lifecycle,
 * and false diplomatic pact management.
 *
 * All randomness is delegated to the injected {@link SeededRandom} instance,
 * ensuring full determinism under NFR-402. Configuration is sourced from
 * {@link GAME_CONFIG.intelReliability}.
 *
 * @see FR-202 — Intelligence reliability and ghost units
 * @see FR-204 — Diplomatic Investment reliability boost
 */
export class IntelligenceReliabilityEngine {
  /** Reliability configuration constants. */
  private readonly cfg: IntelReliabilityConfig;

  /** Seeded PRNG for deterministic rolls. */
  private readonly rng: SeededRandom;

  // ── Constructor ──────────────────────────────────────────

  /**
   * Create an intelligence reliability engine.
   *
   * @param config - Intelligence reliability configuration block.
   * @param rng    - Seeded pseudo-random number generator.
   *
   * @see FR-202
   */
  constructor(config: IntelReliabilityConfig, rng: SeededRandom) {
    this.cfg = config;
    this.rng = rng;
  }

  // ── Reliability Scoring ──────────────────────────────────

  /**
   * Calculate the reliability of an intelligence report.
   *
   * Formula:
   * 1. Base = average of HUMINT and SIGINT scores.
   * 2. Boosted by DI investment: `base + diInvested × reliabilityBoostPerDI`.
   * 3. Reduced by the target's counter-intelligence capability.
   * 4. Clamped to `[minReliability, maxReliability]`.
   *
   * @param baseCapabilities  - Observing faction's intelligence capabilities.
   * @param diInvested        - Number of Diplomatic Investment points spent.
   * @param targetCounterIntel - Target faction's counter-intelligence score (0–100).
   * @returns Reliability score clamped to configured bounds.
   *
   * @see FR-202
   * @see FR-204
   */
  calculateReliability(
    baseCapabilities: IntelligenceCapabilities,
    diInvested: number,
    targetCounterIntel: number,
  ): number {
    const humintSigintAvg = (baseCapabilities.humint + baseCapabilities.sigint) / 2;
    const boosted = humintSigintAvg + diInvested * this.cfg.reliabilityBoostPerDI;
    const reduced = boosted - targetCounterIntel;

    return Math.max(
      this.cfg.minReliability,
      Math.min(this.cfg.maxReliability, reduced),
    );
  }

  // ── Ghost Unit Spawning ──────────────────────────────────

  /**
   * Determine whether a ghost unit should spawn for a given reliability score.
   *
   * If reliability is at or above the threshold, no ghost unit is possible.
   * Otherwise, the probability scales linearly with how far below the threshold
   * the reliability falls:
   *
   *   `effectiveProbability = ghostUnitSpawnProbability × (threshold - reliability) / threshold`
   *
   * @param reliability - Current intelligence reliability (0–100).
   * @returns `true` if a ghost unit should be spawned this evaluation.
   *
   * @see FR-202
   */
  shouldSpawnGhostUnit(reliability: number): boolean {
    if (reliability >= this.cfg.ghostUnitReliabilityThreshold) {
      return false;
    }

    const threshold = this.cfg.ghostUnitReliabilityThreshold;
    const unreliabilityFactor = (threshold - reliability) / threshold;
    const effectiveProbability = this.cfg.ghostUnitSpawnProbability * unreliabilityFactor;

    return this.rng.nextFloat(0, 1) < effectiveProbability;
  }

  /**
   * Create a ghost unit record perceived by the observing faction.
   *
   * The ghost unit has zero combat stats (`hp: 0`, `attackPower: 0`,
   * `defensePower: 0`) and is flagged with `isGhost: true`. It will persist
   * on the observing faction's intelligence map until its expiry turn.
   *
   * @param observingFaction - Faction that will "see" this ghost.
   * @param targetFaction    - Faction the ghost unit allegedly belongs to.
   * @param position         - Hex position where the ghost appears.
   * @param spawnTurn        - Current turn number.
   * @returns A complete ghost unit record with metadata.
   *
   * @see FR-202
   */
  createGhostUnit(
    observingFaction: FactionId,
    targetFaction: FactionId,
    position: HexId,
    spawnTurn: TurnNumber,
  ): GhostUnitRecord {
    ghostIdCounter += 1;
    const unitId = `ghost-${spawnTurn}-${ghostIdCounter}` as UnitId;

    // Pick a plausible unit type from the conventional subset
    const unitType = this.rng.pick(GHOST_UNIT_TYPES) ?? GHOST_UNIT_TYPES[0];

    const expiryTurn = ((spawnTurn as number) + this.cfg.ghostUnitDecayTurns) as TurnNumber;

    const unit: Unit = {
      id: unitId,
      factionId: targetFaction,
      unitType,
      hp: 0,
      attackPower: 0,
      defensePower: 0,
      movementRange: 0,
      specialAbilities: [],
      supplyStatus: 0,
      morale: 0,
      position,
      isGhost: true,
    };

    return {
      unit,
      observingFaction,
      spawnTurn,
      expiryTurn,
    };
  }

  // ── False Pact Spawning ──────────────────────────────────

  /**
   * Determine whether a false diplomatic pact should spawn for a given
   * reliability score.
   *
   * Uses the same linear-scaling logic as ghost unit spawning, but keyed
   * to {@link IntelReliabilityConfig.falsePactSpawnProbability}.
   *
   * @param reliability - Current intelligence reliability (0–100).
   * @returns `true` if a false pact should be generated this evaluation.
   *
   * @see FR-202
   */
  shouldSpawnFalsePact(reliability: number): boolean {
    if (reliability >= this.cfg.ghostUnitReliabilityThreshold) {
      return false;
    }

    const threshold = this.cfg.ghostUnitReliabilityThreshold;
    const unreliabilityFactor = (threshold - reliability) / threshold;
    const effectiveProbability = this.cfg.falsePactSpawnProbability * unreliabilityFactor;

    return this.rng.nextFloat(0, 1) < effectiveProbability;
  }

  /**
   * Create a false diplomatic pact record.
   *
   * The pact is initially hidden (`revealed: false`) and will be automatically
   * flagged when the current turn reaches the reveal turn.
   *
   * @param observingFaction - Faction that was fed false intelligence.
   * @param allegedFactions  - The two factions allegedly forming the pact.
   * @param spawnTurn        - Current turn number.
   * @returns A false pact record with reveal metadata.
   *
   * @see FR-202
   */
  createFalsePact(
    observingFaction: FactionId,
    allegedFactions: [FactionId, FactionId],
    spawnTurn: TurnNumber,
  ): FalsePactRecord {
    falsePactIdCounter += 1;
    const id = `false-pact-${spawnTurn}-${falsePactIdCounter}`;

    const revealTurn = ((spawnTurn as number) + this.cfg.falsePactRevealTurns) as TurnNumber;

    return {
      id,
      observingFaction,
      allegedFactions,
      spawnTurn,
      revealTurn,
      revealed: false,
    };
  }

  // ── Decay & Reveal Processing ────────────────────────────

  /**
   * Process ghost unit decay for the current turn.
   *
   * Partitions the ghost unit list into expired (past expiry turn) and still
   * active. This is a **pure function** — it does not mutate the input array.
   *
   * @param ghosts      - All currently tracked ghost unit records.
   * @param currentTurn - The current game turn.
   * @returns Partition of expired and active ghost records.
   *
   * @see FR-202
   */
  processGhostDecay(
    ghosts: readonly GhostUnitRecord[],
    currentTurn: TurnNumber,
  ): GhostDecayResult {
    const expired: GhostUnitRecord[] = [];
    const active: GhostUnitRecord[] = [];

    for (const ghost of ghosts) {
      if ((currentTurn as number) >= (ghost.expiryTurn as number)) {
        expired.push(ghost);
      } else {
        active.push(ghost);
      }
    }

    return { expired, active };
  }

  /**
   * Process false pact reveals for the current turn.
   *
   * Partitions the pact list into those that should be revealed (past reveal
   * turn) and those still hidden. Revealed pacts have their `revealed` flag
   * set to `true`. This is a **pure function** — it returns new records
   * rather than mutating in place.
   *
   * @param pacts       - All currently tracked false pact records.
   * @param currentTurn - The current game turn.
   * @returns Partition of revealed and hidden pact records.
   *
   * @see FR-202
   */
  processFalsePactReveal(
    pacts: readonly FalsePactRecord[],
    currentTurn: TurnNumber,
  ): FalsePactRevealResult {
    const revealed: FalsePactRecord[] = [];
    const hidden: FalsePactRecord[] = [];

    for (const pact of pacts) {
      if ((currentTurn as number) >= (pact.revealTurn as number)) {
        revealed.push({ ...pact, revealed: true });
      } else {
        hidden.push(pact);
      }
    }

    return { revealed, hidden };
  }

  // ── Diplomatic Investment ────────────────────────────────

  /**
   * Invest Diplomatic Investment (DI) points to increase intelligence
   * reliability for a region or operation.
   *
   * Each DI point increases reliability by {@link IntelReliabilityConfig.reliabilityBoostPerDI}.
   * The result is clamped to {@link IntelReliabilityConfig.maxReliability}.
   *
   * @param currentReliability - Current reliability score (0–100).
   * @param diSpent            - Number of DI points being invested.
   * @returns Updated reliability, clamped to maxReliability.
   *
   * @see FR-204
   */
  investInIntelligence(currentReliability: number, diSpent: number): number {
    const boosted = currentReliability + diSpent * this.cfg.reliabilityBoostPerDI;
    return Math.min(this.cfg.maxReliability, boosted);
  }
}
