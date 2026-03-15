/**
 * Hex Grid Data Model & Engine — CNFL-0300, FR-801
 *
 * Pure data-model hex engine with axial coordinate system,
 * O(1) lookup, neighbor/ring/spiral iterators, BFS pathfinding,
 * and line-of-sight. No rendering, no DOM access.
 *
 * Coordinate conventions:
 * - Internal: axial coordinates (q, r)
 * - External: offset "odd-r" coordinates (col, row) — odd rows shifted right
 * - HexId format: `"q:r"` cast to the branded HexId type
 *
 * @see FR-801  — Hex-grid map with ≤10,000 hexes
 * @see FR-804  — Terrain modifiers (config.ts)
 * @see DR-102  — HexState data requirements
 *
 * @module engine/hex-map
 */

import { TerrainType } from '@/data/types';

import type { FactionId, HexId } from '@/data/types';
import type { HexState, HexMap } from '@/data/types';

// ---------------------------------------------------------------------------
// Coordinate Types
// ---------------------------------------------------------------------------

/** Axial hex coordinate (q = column-ish, r = row-ish). */
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

// ---------------------------------------------------------------------------
// Axial Direction Vectors
// ---------------------------------------------------------------------------

/**
 * The six axial direction vectors for hex neighbors, in clockwise order
 * starting from east (+q).
 */
const AXIAL_DIRECTIONS: readonly Readonly<HexCoord>[] = [
  { q: 1, r: 0 },   // E
  { q: 1, r: -1 },  // NE
  { q: 0, r: -1 },  // NW
  { q: -1, r: 0 },  // W
  { q: -1, r: 1 },  // SW
  { q: 0, r: 1 },   // SE
] as const;

// ---------------------------------------------------------------------------
// Coordinate Utilities
// ---------------------------------------------------------------------------

/**
 * Create a HexId from axial coordinates.
 * Format: `"q:r"` cast to the branded HexId type.
 */
export function hexIdFromAxial(q: number, r: number): HexId {
  return `${q}:${r}` as HexId;
}

/**
 * Extract axial coordinates from a HexId.
 */
export function axialFromHexId(id: HexId): HexCoord {
  const parts = (id as string).split(':');
  const qStr = parts[0];
  const rStr = parts[1];
  const q = Number(qStr ?? 0);
  const r = Number(rStr ?? 0);
  return { q, r };
}

/**
 * Convert offset coordinates (col, row) to axial (q, r).
 * Uses "odd-r" offset layout (odd rows shifted right).
 */
export function offsetToAxial(col: number, row: number): HexCoord {
  const q = col - Math.floor((row - (row & 1)) / 2);
  const r = row;
  return { q, r };
}

/**
 * Convert axial coordinates (q, r) to offset (col, row).
 * Uses "odd-r" offset layout (odd rows shifted right).
 */
export function axialToOffset(q: number, r: number): { col: number; row: number } {
  const col = q + Math.floor((r - (r & 1)) / 2);
  const row = r;
  return { col, row };
}

// ---------------------------------------------------------------------------
// Default Hex Factory
// ---------------------------------------------------------------------------

/**
 * Create a HexState with sensible defaults.
 *
 * @param id      — The HexId for this cell.
 * @param terrain — Optional terrain type (defaults to Plains).
 */
export function createDefaultHexState(id: HexId, terrain?: TerrainType): HexState {
  return {
    id,
    nationControl: null,
    terrainType: terrain ?? TerrainType.Plains,
    terrainBonus: 0,
    resourceYield: 10,
    civilianUnrest: 0,
    militaryPresence: 0,
    infrastructureLevel: 0,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers (cube coordinates)
// ---------------------------------------------------------------------------

/** Convert axial → cube coordinates. s (or y) = −q − r. */
function axialToCube(q: number, r: number): { x: number; y: number; z: number } {
  const x = q;
  const z = r;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Round fractional cube coordinates to the nearest integer hex.
 * Adjusts the component with the largest rounding error to satisfy x+y+z=0.
 */
function cubeRound(fx: number, fy: number, fz: number): HexCoord {
  let rx = Math.round(fx);
  let ry = Math.round(fy);
  let rz = Math.round(fz);

  const xDiff = Math.abs(rx - fx);
  const yDiff = Math.abs(ry - fy);
  const zDiff = Math.abs(rz - fz);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

/** Hex distance via cube coordinate max-abs. */
function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const a = axialToCube(q1, r1);
  const b = axialToCube(q2, r2);
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}

/** Linear interpolation between two values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// HexGrid Class
// ---------------------------------------------------------------------------

/**
 * In-memory hex grid backed by a `Map<HexId, HexState>` for O(1) lookup.
 *
 * Provides topology queries (neighbors, ring, spiral), hex distance,
 * BFS pathfinding, line-of-sight, and faction/terrain queries.
 * All coordinate math uses axial (q, r) internally.
 */
export class HexGrid {
  private readonly hexes: Map<HexId, HexState>;

  /** Use static factories (`create`, `fromHexMap`) to construct instances. */
  private constructor(hexes: Map<HexId, HexState>) {
    this.hexes = hexes;
  }

  // ── Factories ──────────────────────────────────────────────────────────────

  /**
   * Create a rectangular hex grid of the given dimensions.
   * Uses offset coordinates (col 0..width−1, row 0..height−1)
   * internally converted to axial for storage.
   *
   * @param width    — Number of columns.
   * @param height   — Number of rows.
   * @param defaults — Optional partial overrides applied to every hex.
   */
  static create(width: number, height: number, defaults?: Partial<HexState>): HexGrid {
    const hexes = new Map<HexId, HexState>();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const { q, r } = offsetToAxial(col, row);
        const id = hexIdFromAxial(q, r);
        const hex: HexState = {
          ...createDefaultHexState(id),
          ...defaults,
          id, // id is readonly — always wins
        };
        hexes.set(id, hex);
      }
    }

    return new HexGrid(hexes);
  }

  /**
   * Create a HexGrid from an existing HexMap record
   * (e.g., loaded from a scenario or save file).
   */
  static fromHexMap(hexMap: HexMap): HexGrid {
    const hexes = new Map<HexId, HexState>();

    for (const key of Object.keys(hexMap)) {
      const id = key as HexId;
      const state = hexMap[id];
      if (state) {
        hexes.set(id, state);
      }
    }

    return new HexGrid(hexes);
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** Total number of hexes in the grid. */
  get size(): number {
    return this.hexes.size;
  }

  /** Retrieve a hex by its ID. Returns `undefined` if not present. */
  get(id: HexId): HexState | undefined {
    return this.hexes.get(id);
  }

  /** Insert or replace a hex state. */
  set(id: HexId, state: HexState): void {
    this.hexes.set(id, state);
  }

  /** Check whether a hex ID exists in the grid. */
  has(id: HexId): boolean {
    return this.hexes.has(id);
  }

  /** Retrieve a hex by axial coordinates. */
  getByCoord(q: number, r: number): HexState | undefined {
    return this.hexes.get(hexIdFromAxial(q, r));
  }

  /** Iterate over every hex in the grid. */
  forEach(callback: (hex: HexState, id: HexId) => void): void {
    this.hexes.forEach((hex, id) => {
      callback(hex, id);
    });
  }

  // ── Topology ───────────────────────────────────────────────────────────────

  /**
   * Return the IDs of all neighbors of the given hex that exist in the grid.
   * A hex has at most 6 neighbors.
   */
  neighbors(id: HexId): HexId[] {
    const { q, r } = axialFromHexId(id);
    const result: HexId[] = [];

    for (const dir of AXIAL_DIRECTIONS) {
      const nId = hexIdFromAxial(q + dir.q, r + dir.r);
      if (this.hexes.has(nId)) {
        result.push(nId);
      }
    }

    return result;
  }

  /**
   * Calculate the hex distance between two hex IDs.
   * Returns the minimum number of hex-steps between the two cells.
   */
  distance(a: HexId, b: HexId): number {
    const ca = axialFromHexId(a);
    const cb = axialFromHexId(b);
    return hexDistance(ca.q, ca.r, cb.q, cb.r);
  }

  /**
   * Return all hex IDs at exactly `radius` distance from `center`.
   *
   * Results are in ring-walk order starting from the hex at
   * `center + radius × direction[4]` (the SW starting position in the
   * standard hex ring algorithm).
   *
   * When `radius` is 0, returns the center hex (if it exists).
   */
  ring(center: HexId, radius: number): HexId[] {
    if (radius <= 0) {
      return this.hexes.has(center) ? [center] : [];
    }

    const { q, r } = axialFromHexId(center);
    const results: HexId[] = [];

    // Direction index 4 = SW; we start there and walk the six sides.
    const startDir = AXIAL_DIRECTIONS[4]!;
    let curQ = q + startDir.q * radius;
    let curR = r + startDir.r * radius;

    for (let side = 0; side < 6; side++) {
      const dir = AXIAL_DIRECTIONS[side]!;
      for (let step = 0; step < radius; step++) {
        const id = hexIdFromAxial(curQ, curR);
        if (this.hexes.has(id)) {
          results.push(id);
        }
        curQ += dir.q;
        curR += dir.r;
      }
    }

    return results;
  }

  /**
   * Return all hex IDs within `radius` distance (inclusive) from `center`.
   * Ordered center-first, then expanding outward ring by ring.
   */
  spiral(center: HexId, radius: number): HexId[] {
    const results: HexId[] = [];
    for (let k = 0; k <= radius; k++) {
      const ringHexes = this.ring(center, k);
      for (const id of ringHexes) {
        results.push(id);
      }
    }
    return results;
  }

  // ── Pathfinding & Line-of-Sight ────────────────────────────────────────────

  /**
   * BFS pathfinding from `start` to `end`.
   *
   * The `passable` predicate determines which hexes can be traversed.
   * Both `start` and `end` must themselves be passable.
   *
   * @returns The path as an ordered array of HexIds (including both
   *          `start` and `end`), or `null` if no path exists.
   */
  findPath(
    start: HexId,
    end: HexId,
    passable: (hex: HexState) => boolean,
  ): HexId[] | null {
    if (start === end) {
      return [start];
    }

    const startHex = this.hexes.get(start);
    const endHex = this.hexes.get(end);

    if (!startHex || !endHex) {
      return null;
    }

    if (!passable(startHex) || !passable(endHex)) {
      return null;
    }

    const visited = new Set<HexId>([start]);
    const parent = new Map<HexId, HexId>();
    const queue: HexId[] = [start];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const neighborId of this.neighbors(current)) {
        if (visited.has(neighborId)) {
          continue;
        }

        const neighborHex = this.hexes.get(neighborId);
        if (!neighborHex || !passable(neighborHex)) {
          continue;
        }

        parent.set(neighborId, current);

        if (neighborId === end) {
          // Reconstruct the path from end → start, then reverse
          const path: HexId[] = [end];
          let step: HexId | undefined = end;

          while (step !== undefined && step !== start) {
            step = parent.get(step);
            if (step !== undefined) {
              path.push(step);
            }
          }

          path.reverse();
          return path;
        }

        visited.add(neighborId);
        queue.push(neighborId);
      }
    }

    return null;
  }

  /**
   * Compute the hex line from `a` to `b` using cube-coordinate
   * linear interpolation (Bresenham-style for hex grids).
   *
   * Returns the list of hex IDs along the line (including both endpoints).
   * Useful for line-of-sight checks — callers can test each hex for blockage.
   */
  lineOfSight(a: HexId, b: HexId): HexId[] {
    const ca = axialFromHexId(a);
    const cb = axialFromHexId(b);
    const dist = hexDistance(ca.q, ca.r, cb.q, cb.r);

    if (dist === 0) {
      return [a];
    }

    const cubeA = axialToCube(ca.q, ca.r);
    const cubeB = axialToCube(cb.q, cb.r);
    const results: HexId[] = [];

    // Small epsilon nudge avoids ambiguous results when the line
    // passes exactly through a hex edge.
    const EPSILON = 1e-6;

    for (let i = 0; i <= dist; i++) {
      const t = i / dist;
      const x = lerp(cubeA.x + EPSILON, cubeB.x + EPSILON, t);
      const y = lerp(cubeA.y + EPSILON, cubeB.y + EPSILON, t);
      const z = lerp(cubeA.z - 2 * EPSILON, cubeB.z - 2 * EPSILON, t);
      const { q, r } = cubeRound(x, y, z);
      results.push(hexIdFromAxial(q, r));
    }

    return results;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Return all hex IDs controlled by the given faction. */
  getHexesByFaction(factionId: FactionId): HexId[] {
    const results: HexId[] = [];
    this.hexes.forEach((hex, id) => {
      if (hex.nationControl === factionId) {
        results.push(id);
      }
    });
    return results;
  }

  /** Return all hex IDs with the given terrain type. */
  getHexesByTerrain(terrainType: TerrainType): HexId[] {
    const results: HexId[] = [];
    this.hexes.forEach((hex, id) => {
      if (hex.terrainType === terrainType) {
        results.push(id);
      }
    });
    return results;
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serialize the grid back to a plain `HexMap` (Record<HexId, HexState>)
   * suitable for storage in GameState, save files, etc.
   */
  toHexMap(): HexMap {
    const record = {} as Record<string, HexState>;
    this.hexes.forEach((hex, id) => {
      record[id as string] = hex;
    });
    return record as HexMap;
  }
}
