import { describe, it, expect } from 'vitest';
import {
  hexIdFromAxial,
  axialFromHexId,
  offsetToAxial,
  axialToOffset,
  createDefaultHexState,
  HexGrid,
} from '@/engine/hex-map';
import { TerrainType, FactionId } from '@/data/types';

import type { HexId } from '@/data/types';
import type { HexMap } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const hid = (q: number, r: number): HexId => hexIdFromAxial(q, r);

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('Coordinate Utilities', () => {
  it('hexIdFromAxial creates "q:r" string', () => {
    expect(hexIdFromAxial(3, -2)).toBe('3:-2');
    expect(hexIdFromAxial(0, 0)).toBe('0:0');
  });

  it('axialFromHexId parses q and r correctly', () => {
    const coord = axialFromHexId('5:-3' as HexId);
    expect(coord.q).toBe(5);
    expect(coord.r).toBe(-3);
  });

  it('offsetToAxial converts even row correctly', () => {
    // Row 0 (even): q = col - 0 = col, r = row
    const { q, r } = offsetToAxial(3, 0);
    expect(q).toBe(3);
    expect(r).toBe(0);
  });

  it('offsetToAxial → axialToOffset roundtrip (even row)', () => {
    const { q, r } = offsetToAxial(4, 2);
    const { col, row } = axialToOffset(q, r);
    expect(col).toBe(4);
    expect(row).toBe(2);
  });

  it('offsetToAxial → axialToOffset roundtrip (odd row)', () => {
    const { q, r } = offsetToAxial(3, 3);
    const { col, row } = axialToOffset(q, r);
    expect(col).toBe(3);
    expect(row).toBe(3);
  });
});

describe('createDefaultHexState', () => {
  it('defaults to Plains terrain', () => {
    const hex = createDefaultHexState('0:0' as HexId);
    expect(hex.terrainType).toBe(TerrainType.Plains);
  });

  it('accepts terrain override', () => {
    const hex = createDefaultHexState('0:0' as HexId, TerrainType.Mountain);
    expect(hex.terrainType).toBe(TerrainType.Mountain);
  });

  it('has expected default values', () => {
    const hex = createDefaultHexState('1:2' as HexId);
    expect(hex.id).toBe('1:2');
    expect(hex.nationControl).toBeNull();
    expect(hex.terrainBonus).toBe(0);
    expect(hex.resourceYield).toBe(10);
    expect(hex.civilianUnrest).toBe(0);
    expect(hex.militaryPresence).toBe(0);
    expect(hex.infrastructureLevel).toBe(0);
  });
});

describe('HexGrid', () => {
  // ── Factories ──────────────────────────────────────────

  describe('create', () => {
    it('produces correct number of hexes', () => {
      const grid = HexGrid.create(5, 5);
      expect(grid.size).toBe(25);
    });

    it('makes all hexes accessible by ID', () => {
      const grid = HexGrid.create(3, 3);
      // Row 0: (0,0), (1,0), (2,0)
      // Row 1: (0,1), (1,1), (2,1)
      // Row 2: (-1,2), (0,2), (1,2)
      expect(grid.has(hid(0, 0))).toBe(true);
      expect(grid.has(hid(2, 1))).toBe(true);
      expect(grid.has(hid(-1, 2))).toBe(true);
    });

    it('applies custom defaults to every hex', () => {
      const grid = HexGrid.create(2, 2, { terrainBonus: 5 });
      const hex = grid.get(hid(0, 0));
      expect(hex?.terrainBonus).toBe(5);
    });
  });

  describe('fromHexMap', () => {
    it('loads all hexes from a plain record', () => {
      const map: HexMap = {
        ['0:0' as HexId]: createDefaultHexState('0:0' as HexId),
        ['1:0' as HexId]: createDefaultHexState('1:0' as HexId),
      } as HexMap;

      const grid = HexGrid.fromHexMap(map);
      expect(grid.size).toBe(2);
      expect(grid.has('0:0' as HexId)).toBe(true);
      expect(grid.has('1:0' as HexId)).toBe(true);
    });
  });

  // ── Accessors ──────────────────────────────────────────

  describe('get / set / has', () => {
    it('get returns hex state for existing ID', () => {
      const grid = HexGrid.create(3, 3);
      const hex = grid.get(hid(0, 0));
      expect(hex).toBeDefined();
      expect(hex?.id).toBe('0:0');
    });

    it('get returns undefined for missing ID', () => {
      const grid = HexGrid.create(3, 3);
      expect(grid.get('99:99' as HexId)).toBeUndefined();
    });

    it('set inserts a new hex', () => {
      const grid = HexGrid.create(1, 1);
      const newHex = createDefaultHexState('10:10' as HexId);
      grid.set('10:10' as HexId, newHex);
      expect(grid.has('10:10' as HexId)).toBe(true);
      expect(grid.size).toBe(2);
    });

    it('has returns false for absent hex', () => {
      const grid = HexGrid.create(2, 2);
      expect(grid.has('50:50' as HexId)).toBe(false);
    });
  });

  describe('getByCoord', () => {
    it('retrieves hex by axial coordinates', () => {
      const grid = HexGrid.create(5, 5);
      const hex = grid.getByCoord(1, 1);
      expect(hex).toBeDefined();
      expect(hex?.id).toBe(hid(1, 1));
    });
  });

  // ── Topology ───────────────────────────────────────────

  describe('neighbors', () => {
    it('interior hex on 5×5 grid has 6 neighbors', () => {
      const grid = HexGrid.create(5, 5);
      // (1,1) is well inside the grid
      const nbrs = grid.neighbors(hid(1, 1));
      expect(nbrs).toHaveLength(6);
    });

    it('corner hex has fewer than 6 neighbors', () => {
      const grid = HexGrid.create(5, 5);
      // (0,0) is at the top-left corner
      const nbrs = grid.neighbors(hid(0, 0));
      expect(nbrs.length).toBeLessThan(6);
      expect(nbrs.length).toBeGreaterThan(0);
    });
  });

  describe('distance', () => {
    it('same hex has distance 0', () => {
      const grid = HexGrid.create(5, 5);
      expect(grid.distance(hid(1, 1), hid(1, 1))).toBe(0);
    });

    it('adjacent hexes have distance 1', () => {
      const grid = HexGrid.create(5, 5);
      expect(grid.distance(hid(0, 0), hid(1, 0))).toBe(1);
    });

    it('distant hexes return correct count', () => {
      const grid = HexGrid.create(10, 10);
      // (0,0) to (3,0): distance should be 3
      expect(grid.distance(hid(0, 0), hid(3, 0))).toBe(3);
    });
  });

  // ── Ring & Spiral ──────────────────────────────────────

  describe('ring', () => {
    it('radius 0 returns only the center hex', () => {
      const grid = HexGrid.create(5, 5);
      const r = grid.ring(hid(1, 2), 0);
      expect(r).toHaveLength(1);
      expect(r[0]).toBe(hid(1, 2));
    });

    it('radius 1 around an interior hex returns 6 hexes', () => {
      const grid = HexGrid.create(5, 5);
      const r = grid.ring(hid(1, 2), 1);
      expect(r).toHaveLength(6);
    });
  });

  describe('spiral', () => {
    it('radius 0 returns 1 hex (center)', () => {
      const grid = HexGrid.create(5, 5);
      const s = grid.spiral(hid(1, 2), 0);
      expect(s).toHaveLength(1);
    });

    it('radius 1 returns 7 hexes (center + ring)', () => {
      const grid = HexGrid.create(5, 5);
      const s = grid.spiral(hid(1, 2), 1);
      expect(s).toHaveLength(7);
    });
  });

  // ── Pathfinding ────────────────────────────────────────

  describe('findPath', () => {
    it('start === end returns single-element path', () => {
      const grid = HexGrid.create(3, 3);
      const path = grid.findPath(hid(0, 0), hid(0, 0), () => true);
      expect(path).toEqual([hid(0, 0)]);
    });

    it('finds direct path on a straight line', () => {
      // 4×1 grid: only row 0
      const grid = HexGrid.create(4, 1);
      const path = grid.findPath(hid(0, 0), hid(3, 0), () => true);
      expect(path).toEqual([hid(0, 0), hid(1, 0), hid(2, 0), hid(3, 0)]);
    });

    it('avoids impassable hexes', () => {
      // 3×3 grid, block (1,0)
      const grid = HexGrid.create(3, 3);
      const blocked = new Set<string>([hid(1, 0)]);
      const path = grid.findPath(
        hid(0, 0),
        hid(2, 0),
        (hex) => !blocked.has(hex.id),
      );
      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(3); // detour required
      expect(path).not.toContain(hid(1, 0));
    });

    it('returns null when no path exists', () => {
      // 3×1 grid, block middle hex
      const grid = HexGrid.create(3, 1);
      const blocked = new Set<string>([hid(1, 0)]);
      const path = grid.findPath(
        hid(0, 0),
        hid(2, 0),
        (hex) => !blocked.has(hex.id),
      );
      expect(path).toBeNull();
    });
  });

  // ── Line of Sight ──────────────────────────────────────

  describe('lineOfSight', () => {
    it('includes both endpoints', () => {
      const grid = HexGrid.create(5, 1);
      const los = grid.lineOfSight(hid(0, 0), hid(3, 0));
      expect(los[0]).toBe(hid(0, 0));
      expect(los[los.length - 1]).toBe(hid(3, 0));
    });

    it('returns correct intermediate hexes on a straight line', () => {
      const grid = HexGrid.create(5, 1);
      const los = grid.lineOfSight(hid(0, 0), hid(3, 0));
      expect(los).toHaveLength(4);
      expect(los).toEqual([hid(0, 0), hid(1, 0), hid(2, 0), hid(3, 0)]);
    });
  });

  // ── Queries ────────────────────────────────────────────

  describe('getHexesByFaction', () => {
    it('returns hexes controlled by the given faction', () => {
      const grid = HexGrid.create(3, 3);
      const hex = grid.get(hid(0, 0))!;
      (hex as { nationControl: string | null }).nationControl = FactionId.US;

      const result = grid.getHexesByFaction(FactionId.US);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(hid(0, 0));
    });
  });

  describe('getHexesByTerrain', () => {
    it('returns hexes matching terrain type', () => {
      const grid = HexGrid.create(3, 3);
      // All hexes default to Plains
      const plains = grid.getHexesByTerrain(TerrainType.Plains);
      expect(plains).toHaveLength(9);

      const mountains = grid.getHexesByTerrain(TerrainType.Mountain);
      expect(mountains).toHaveLength(0);
    });
  });

  // ── Serialization ──────────────────────────────────────

  describe('toHexMap / fromHexMap roundtrip', () => {
    it('preserves all hexes through serialization', () => {
      const grid1 = HexGrid.create(4, 4);
      const hexMap = grid1.toHexMap();
      const grid2 = HexGrid.fromHexMap(hexMap);

      expect(grid2.size).toBe(grid1.size);
      expect(grid2.get(hid(0, 0))?.terrainType).toBe(TerrainType.Plains);
    });
  });

  // ── Iteration ──────────────────────────────────────────

  describe('forEach', () => {
    it('iterates over every hex in the grid', () => {
      const grid = HexGrid.create(3, 3);
      let count = 0;
      grid.forEach(() => {
        count++;
      });
      expect(count).toBe(9);
    });
  });

  describe('size', () => {
    it('returns the total number of hexes', () => {
      const grid = HexGrid.create(10, 10);
      expect(grid.size).toBe(100);
    });
  });
});
