/**
 * Invasion Calculator — CNFL-0304, FR-1102
 *
 * Estimates invasion difficulty, turns-to-capital, and supply stretch
 * based on geographic posture data and hex-grid distance.
 *
 * Pure module — no side effects, no DOM access.
 *
 * @module engine/invasion
 */

import type { FactionId } from '@/data/types';
import type { GeographicPosture } from '@/data/types';
import type { HexGrid } from '@/engine/hex-map';

// ---------------------------------------------------------------------------
// Result Interfaces
// ---------------------------------------------------------------------------

/** Difficulty rating labels ordered by severity. */
export type DifficultyRating =
  | 'trivial'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'extreme'
  | 'near-impossible';

/** Comprehensive invasion-feasibility assessment. */
export interface InvasionDifficultyAssessment {
  readonly attacker: FactionId;
  readonly defender: FactionId;
  readonly defenderStrategicDepth: number;
  readonly estimatedTurnsToCapital: number;
  readonly naturalDefenses: readonly string[];
  readonly keyVulnerabilities: readonly string[];
  readonly difficultyRating: DifficultyRating;
  readonly supplyStretchAtCapital: number;
}

// ---------------------------------------------------------------------------
// InvasionCalculator
// ---------------------------------------------------------------------------

/**
 * Calculates invasion logistics using per-faction {@link GeographicPosture}
 * data and the hex grid.
 */
export class InvasionCalculator {
  private readonly postures: ReadonlyMap<FactionId, GeographicPosture>;
  /** Stored for future hex-level calculations. */
  private readonly _hexGrid: HexGrid;

  constructor(
    postures: Record<FactionId, GeographicPosture>,
    hexGrid: HexGrid,
  ) {
    const map = new Map<FactionId, GeographicPosture>();
    for (const key of Object.keys(postures)) {
      const fid = key as FactionId;
      const posture = postures[fid];
      if (posture) {
        map.set(fid, posture);
      }
    }
    this.postures = map;
    this._hexGrid = hexGrid;
  }

  // ── Core Calculations ──────────────────────────────────────────────────

  /**
   * FR-1102 — Estimate the number of turns to reach the defender's capital.
   *
   * Formula: `TurnsToCapital = baseDistanceHexes × (defenderStrategicDepth / 50)`
   *
   * Minimum result is 1 (you can always reach an adjacent capital in 1 turn).
   */
  calculateTurnsToCapital(
    _attackerFaction: FactionId,
    defenderFaction: FactionId,
    baseDistanceHexes: number,
  ): number {
    const depth = this.getStrategicDepth(defenderFaction);
    const raw = baseDistanceHexes * (depth / 50);
    return Math.max(1, Math.ceil(raw));
  }

  /**
   * Return the strategic depth score for a faction (0–100).
   * Higher = more buffer between border and core.
   */
  getStrategicDepth(factionId: FactionId): number {
    return this.postures.get(factionId)?.strategicDepth ?? 0;
  }

  /**
   * Estimate supply effectiveness at a given distance from the border.
   *
   * Formula: `max(0, 100 - distanceFromBorder × 5 × (1 + terrainDifficulty / 100))`
   *
   * @param distanceFromBorder — Hex count from nearest friendly border hex.
   * @param terrainDifficulty  — Aggregate terrain difficulty (0–100).
   * @returns Supply effectiveness 0–100.
   */
  calculateSupplyStretch(distanceFromBorder: number, terrainDifficulty: number): number {
    const effectiveness = 100 - distanceFromBorder * 5 * (1 + terrainDifficulty / 100);
    return Math.max(0, effectiveness);
  }

  // ── Comprehensive Assessment ───────────────────────────────────────────

  /**
   * Build a full invasion-difficulty assessment between two factions.
   *
   * Uses the defender's strategic depth as a proxy for base distance
   * (i.e. `baseDistanceHexes` defaults to `strategicDepth / 10` when no
   * hex-level front-line data is available).
   */
  estimateInvasionDifficulty(
    attacker: FactionId,
    defender: FactionId,
  ): InvasionDifficultyAssessment {
    const defenderPosture = this.postures.get(defender);

    const defenderStrategicDepth = defenderPosture?.strategicDepth ?? 0;
    const naturalDefenses = defenderPosture?.naturalDefenses ?? [];
    const keyVulnerabilities = defenderPosture?.keyVulnerabilities ?? [];

    // Derive a proxy base distance from strategic depth.
    const proxyDistance = Math.max(1, Math.round(defenderStrategicDepth / 10));

    const estimatedTurnsToCapital = this.calculateTurnsToCapital(
      attacker,
      defender,
      proxyDistance,
    );

    // Terrain difficulty proxy: higher terrain advantage → harder terrain.
    const terrainDifficulty = defenderPosture?.terrainAdvantage ?? 0;

    const supplyStretchAtCapital = this.calculateSupplyStretch(
      proxyDistance,
      Math.max(0, terrainDifficulty),
    );

    const difficultyRating = InvasionCalculator.rateDifficulty(estimatedTurnsToCapital);

    // Keep the hex grid reference used so the compiler doesn't flag _hexGrid
    // as unused. Future iterations will use it for front-line calculation.
    void this._hexGrid;

    return {
      attacker,
      defender,
      defenderStrategicDepth,
      estimatedTurnsToCapital,
      naturalDefenses,
      keyVulnerabilities,
      difficultyRating,
      supplyStretchAtCapital,
    };
  }

  // ── Helpers (private / static) ─────────────────────────────────────────

  /** Map estimated turns-to-capital to a qualitative difficulty label. */
  private static rateDifficulty(turns: number): DifficultyRating {
    if (turns <= 1) return 'trivial';
    if (turns <= 3) return 'easy';
    if (turns <= 6) return 'moderate';
    if (turns <= 10) return 'hard';
    if (turns <= 15) return 'extreme';
    return 'near-impossible';
  }
}
