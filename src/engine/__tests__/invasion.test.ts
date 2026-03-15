import { describe, it, expect } from 'vitest';
import { InvasionCalculator } from '@/engine/invasion';
import { HexGrid } from '@/engine/hex-map';
import { FactionId } from '@/data/types';

import type { GeographicPosture } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makePosture(
  factionId: string,
  strategicDepth: number,
  terrainAdvantage = 0,
): GeographicPosture {
  return {
    factionId: factionId as GeographicPosture['factionId'],
    strategicDepth,
    naturalDefenses: [],
    keyVulnerabilities: [],
    chokepointControl: [],
    terrainAdvantage,
    energyDependency: 0,
  };
}

/** Minimal 1×1 hex grid — InvasionCalculator stores it but doesn't use it yet. */
const TINY_GRID = HexGrid.create(1, 1);

function createCalculator(
  factions: Array<{ id: string; depth: number; terrain?: number }>,
): InvasionCalculator {
  const postures = {} as Record<string, GeographicPosture>;
  for (const f of factions) {
    postures[f.id] = makePosture(f.id, f.depth, f.terrain ?? 0);
  }
  return new InvasionCalculator(
    postures as Record<GeographicPosture['factionId'], GeographicPosture>,
    TINY_GRID,
  );
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('InvasionCalculator', () => {
  // ── calculateTurnsToCapital ────────────────────────────

  describe('calculateTurnsToCapital', () => {
    it('basic formula: distance × (depth / 50), minimum 1', () => {
      const calc = createCalculator([
        { id: FactionId.US, depth: 50 },
      ]);
      // 10 * (50/50) = 10
      const turns = calc.calculateTurnsToCapital(FactionId.China, FactionId.US, 10);
      expect(turns).toBe(10);
    });

    it('US attacking DPRK with low depth: few turns', () => {
      const calc = createCalculator([
        { id: FactionId.DPRK, depth: 15 },
      ]);
      // 5 * (15/50) = 1.5 → ceil(1.5) = 2
      const turns = calc.calculateTurnsToCapital(FactionId.US, FactionId.DPRK, 5);
      expect(turns).toBe(2);
    });

    it('DPRK attacking US with high depth: many turns', () => {
      const calc = createCalculator([
        { id: FactionId.US, depth: 90 },
      ]);
      // 20 * (90/50) = 36 → ceil(36) = 36
      const turns = calc.calculateTurnsToCapital(FactionId.DPRK, FactionId.US, 20);
      expect(turns).toBe(36);
    });

    it('minimum result is 1', () => {
      const calc = createCalculator([
        { id: FactionId.DPRK, depth: 5 },
      ]);
      // 1 * (5/50) = 0.1 → ceil(0.1) = 1, max(1, 1) = 1
      const turns = calc.calculateTurnsToCapital(FactionId.US, FactionId.DPRK, 1);
      expect(turns).toBe(1);
    });
  });

  // ── getStrategicDepth ──────────────────────────────────

  describe('getStrategicDepth', () => {
    it('returns correct depth for known faction', () => {
      const calc = createCalculator([
        { id: FactionId.Russia, depth: 80 },
      ]);
      expect(calc.getStrategicDepth(FactionId.Russia)).toBe(80);
    });

    it('returns 0 for unknown faction', () => {
      const calc = createCalculator([]);
      expect(calc.getStrategicDepth(FactionId.Syria)).toBe(0);
    });
  });

  // ── calculateSupplyStretch ─────────────────────────────

  describe('calculateSupplyStretch', () => {
    it('close distance with no terrain difficulty → high effectiveness', () => {
      const calc = createCalculator([]);
      // 100 - 2*5*(1+0) = 90
      expect(calc.calculateSupplyStretch(2, 0)).toBe(90);
    });

    it('far distance → 0 effectiveness', () => {
      const calc = createCalculator([]);
      // 100 - 20*5*1 = 0
      expect(calc.calculateSupplyStretch(20, 0)).toBe(0);
    });

    it('terrain difficulty increases supply degradation', () => {
      const calc = createCalculator([]);
      // 100 - 10*5*(1+50/100) = 100 - 75 = 25
      expect(calc.calculateSupplyStretch(10, 50)).toBe(25);
    });

    it('clamps to 0 for extreme distance', () => {
      const calc = createCalculator([]);
      expect(calc.calculateSupplyStretch(50, 100)).toBe(0);
    });
  });

  // ── estimateInvasionDifficulty ─────────────────────────

  describe('estimateInvasionDifficulty', () => {
    it('trivial for very low strategic depth', () => {
      const calc = createCalculator([
        { id: FactionId.DPRK, depth: 10 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.US, FactionId.DPRK);
      // proxyDistance = round(10/10) = 1, turns = max(1, ceil(1*0.2)) = 1 → trivial
      expect(result.difficultyRating).toBe('trivial');
    });

    it('easy for moderate depth', () => {
      const calc = createCalculator([
        { id: FactionId.Iran, depth: 30 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.US, FactionId.Iran);
      // proxyDistance = 3, turns = max(1, ceil(3*0.6)) = 2 → easy
      expect(result.difficultyRating).toBe('easy');
    });

    it('hard for high depth', () => {
      const calc = createCalculator([
        { id: FactionId.Russia, depth: 60 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.US, FactionId.Russia);
      // proxyDistance = 6, turns = max(1, ceil(6*1.2)) = ceil(7.2) = 8 → hard
      expect(result.difficultyRating).toBe('hard');
    });

    it('near-impossible for very high depth (US)', () => {
      const calc = createCalculator([
        { id: FactionId.US, depth: 90 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.DPRK, FactionId.US);
      // proxyDistance = 9, turns = max(1, ceil(9*1.8)) = 17 → near-impossible
      expect(result.difficultyRating).toBe('near-impossible');
      expect(result.estimatedTurnsToCapital).toBeGreaterThan(15);
    });

    it('includes defender posture data in assessment', () => {
      const calc = createCalculator([
        { id: FactionId.Japan, depth: 40, terrain: 10 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.China, FactionId.Japan);
      expect(result.defenderStrategicDepth).toBe(40);
      expect(result.attacker).toBe(FactionId.China);
      expect(result.defender).toBe(FactionId.Japan);
    });
  });

  // ── Difficulty rating thresholds ───────────────────────

  describe('difficulty rating thresholds (via estimateInvasionDifficulty)', () => {
    it('moderate for depth 50 → turns 5', () => {
      const calc = createCalculator([
        { id: FactionId.EU, depth: 50 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.US, FactionId.EU);
      // proxyDistance = 5, turns = ceil(5*1.0) = 5 → moderate
      expect(result.difficultyRating).toBe('moderate');
    });

    it('extreme for depth 75 → turns 12', () => {
      const calc = createCalculator([
        { id: FactionId.China, depth: 75 },
      ]);
      const result = calc.estimateInvasionDifficulty(FactionId.US, FactionId.China);
      // proxyDistance = round(7.5) = 8, turns = ceil(8*1.5) = 12 → extreme
      expect(result.difficultyRating).toBe('extreme');
    });
  });
});
