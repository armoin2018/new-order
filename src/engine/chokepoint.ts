/**
 * Chokepoint System — CNFL-0303, FR-1103
 *
 * Defines strategic maritime chokepoints, their controllers, blockade /
 * transit-fee status, and trade-disruption calculations.
 *
 * Pure module — no side effects, no DOM access.
 *
 * @module engine/chokepoint
 */

import { FactionId } from '@/data/types';

import type { HexId } from '@/data/types';

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

/** Branded string identifier for chokepoints. */
export type ChokepointId = string & { readonly __brand: 'ChokepointId' };

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Static + mutable definition of a strategic chokepoint. */
export interface ChokepointDefinition {
  /** Unique chokepoint identifier. */
  readonly id: ChokepointId;
  /** Human-readable name (e.g. "Strait of Hormuz"). */
  readonly name: string;
  /** Hexes that constitute this chokepoint on the map. */
  readonly hexIds: HexId[];
  /** Faction that historically controls this chokepoint (null = contested). */
  readonly defaultController: FactionId | null;
  /** Current controlling faction (null = contested / no single controller). */
  currentController: FactionId | null;
  /** Operational status. */
  status: 'open' | 'transit-fee' | 'blockaded';
  /** Percentage tax on trade value when status is 'transit-fee'. 0–100. */
  transitFeePercent: number;
  /** Strategic importance rating. 0–100. */
  readonly strategicValue: number;
  /** Whether this chokepoint sits on a major energy transport route. */
  readonly affectsEnergyRoutes: boolean;
}

// ---------------------------------------------------------------------------
// Default Chokepoints
// ---------------------------------------------------------------------------

/**
 * The five canonical chokepoints at game start.
 *
 * Hex IDs are placeholders (`cp-*:0`) until the scenario hex map assigns
 * real coordinates.
 */
export const DEFAULT_CHOKEPOINTS: readonly ChokepointDefinition[] = [
  {
    id: 'chokepoint-hormuz' as ChokepointId,
    name: 'Strait of Hormuz',
    hexIds: ['cp-hormuz:0' as HexId, 'cp-hormuz:1' as HexId],
    defaultController: FactionId.Iran,
    currentController: FactionId.Iran,
    status: 'open',
    transitFeePercent: 0,
    strategicValue: 95,
    affectsEnergyRoutes: true,
  },
  {
    id: 'chokepoint-malacca' as ChokepointId,
    name: 'Malacca Strait',
    hexIds: ['cp-malacca:0' as HexId, 'cp-malacca:1' as HexId],
    defaultController: null,
    currentController: null,
    status: 'open',
    transitFeePercent: 0,
    strategicValue: 90,
    affectsEnergyRoutes: true,
  },
  {
    id: 'chokepoint-suez' as ChokepointId,
    name: 'Suez Canal',
    hexIds: ['cp-suez:0' as HexId, 'cp-suez:1' as HexId],
    defaultController: FactionId.EU,
    currentController: FactionId.EU,
    status: 'open',
    transitFeePercent: 0,
    strategicValue: 85,
    affectsEnergyRoutes: false,
  },
  {
    id: 'chokepoint-panama' as ChokepointId,
    name: 'Panama Canal',
    hexIds: ['cp-panama:0' as HexId, 'cp-panama:1' as HexId],
    defaultController: FactionId.US,
    currentController: FactionId.US,
    status: 'open',
    transitFeePercent: 0,
    strategicValue: 80,
    affectsEnergyRoutes: false,
  },
  {
    id: 'chokepoint-taiwan' as ChokepointId,
    name: 'Taiwan Strait',
    hexIds: ['cp-taiwan:0' as HexId, 'cp-taiwan:1' as HexId],
    defaultController: null,
    currentController: null,
    status: 'open',
    transitFeePercent: 0,
    strategicValue: 88,
    affectsEnergyRoutes: false,
  },
] as const;

// ---------------------------------------------------------------------------
// ChokepointManager
// ---------------------------------------------------------------------------

/**
 * Mutable manager for querying and mutating chokepoint state.
 *
 * Backed by a `Map<ChokepointId, ChokepointDefinition>` for O(1) lookup.
 */
export class ChokepointManager {
  private readonly chokepoints: Map<ChokepointId, ChokepointDefinition>;

  constructor(chokepoints?: ChokepointDefinition[]) {
    this.chokepoints = new Map<ChokepointId, ChokepointDefinition>();
    const source = chokepoints ?? DEFAULT_CHOKEPOINTS;
    for (const cp of source) {
      // Clone mutable fields so original array is not mutated.
      this.chokepoints.set(cp.id, { ...cp });
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  /** Retrieve a chokepoint by its ID. */
  getChokepoint(id: ChokepointId): ChokepointDefinition | undefined {
    return this.chokepoints.get(id);
  }

  /** Retrieve a chokepoint by its human-readable name (case-insensitive). */
  getByName(name: string): ChokepointDefinition | undefined {
    const lower = name.toLowerCase();
    for (const cp of this.chokepoints.values()) {
      if (cp.name.toLowerCase() === lower) {
        return cp;
      }
    }
    return undefined;
  }

  /** Return all chokepoints controlled by a given faction. */
  getByController(factionId: FactionId): ChokepointDefinition[] {
    const results: ChokepointDefinition[] = [];
    for (const cp of this.chokepoints.values()) {
      if (cp.currentController === factionId) {
        results.push(cp);
      }
    }
    return results;
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  /** Transfer control of a chokepoint to a faction (or set to null for contested). */
  setController(id: ChokepointId, controller: FactionId | null): void {
    const cp = this.chokepoints.get(id);
    if (!cp) return;
    cp.currentController = controller;
  }

  /**
   * Impose a transit fee on a chokepoint.
   * Sets status to `'transit-fee'` and records the fee percentage.
   */
  imposeTransitFee(id: ChokepointId, feePercent: number): void {
    const cp = this.chokepoints.get(id);
    if (!cp) return;
    cp.status = 'transit-fee';
    cp.transitFeePercent = Math.max(0, Math.min(100, feePercent));
  }

  /** Blockade a chokepoint — no trade passes through. */
  imposeBlockade(id: ChokepointId): void {
    const cp = this.chokepoints.get(id);
    if (!cp) return;
    cp.status = 'blockaded';
  }

  /** Open a chokepoint — unrestricted transit, fee reset to 0. */
  openChokepoint(id: ChokepointId): void {
    const cp = this.chokepoints.get(id);
    if (!cp) return;
    cp.status = 'open';
    cp.transitFeePercent = 0;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /** Whether the chokepoint is currently blockaded. */
  isBlockaded(id: ChokepointId): boolean {
    const cp = this.chokepoints.get(id);
    if (!cp) return false;
    return cp.status === 'blockaded';
  }

  /** Current transit fee percentage (0 if open or blockaded). */
  getTransitFee(id: ChokepointId): number {
    const cp = this.chokepoints.get(id);
    if (!cp) return 0;
    if (cp.status === 'transit-fee') return cp.transitFeePercent;
    return 0;
  }

  /**
   * Calculate trade value lost when goods traverse this chokepoint.
   *
   * - **open**: no loss.
   * - **transit-fee**: loss = tradeValue × (feePercent / 100).
   * - **blockaded**: full loss = tradeValue.
   */
  calculateTradeDisruption(chokepointId: ChokepointId, tradeValue: number): number {
    const cp = this.chokepoints.get(chokepointId);
    if (!cp) return 0;

    switch (cp.status) {
      case 'open':
        return 0;
      case 'transit-fee':
        return tradeValue * (cp.transitFeePercent / 100);
      case 'blockaded':
        return tradeValue;
    }
  }

  /** Return all chokepoints that sit on major energy routes. */
  getEnergyChokepoints(): ChokepointDefinition[] {
    const results: ChokepointDefinition[] = [];
    for (const cp of this.chokepoints.values()) {
      if (cp.affectsEnergyRoutes) {
        results.push(cp);
      }
    }
    return results;
  }

  /** Return all currently blockaded chokepoints. */
  getBlockadedChokepoints(): ChokepointDefinition[] {
    const results: ChokepointDefinition[] = [];
    for (const cp of this.chokepoints.values()) {
      if (cp.status === 'blockaded') {
        results.push(cp);
      }
    }
    return results;
  }

  // ── Serialisation ──────────────────────────────────────────────────────

  /** Serialize to a plain array. */
  toArray(): ChokepointDefinition[] {
    return [...this.chokepoints.values()];
  }

  /** Deserialize from a plain array. */
  static fromArray(chokepoints: ChokepointDefinition[]): ChokepointManager {
    return new ChokepointManager(chokepoints);
  }
}
