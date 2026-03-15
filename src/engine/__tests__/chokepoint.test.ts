import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHOKEPOINTS,
  ChokepointManager,
} from '@/engine/chokepoint';
import { FactionId } from '@/data/types';

import type { ChokepointId } from '@/engine/chokepoint';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const HORMUZ = 'chokepoint-hormuz' as ChokepointId;
const MALACCA = 'chokepoint-malacca' as ChokepointId;
const SUEZ = 'chokepoint-suez' as ChokepointId;
const PANAMA = 'chokepoint-panama' as ChokepointId;
const TAIWAN = 'chokepoint-taiwan' as ChokepointId;

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('DEFAULT_CHOKEPOINTS', () => {
  it('contains exactly 5 chokepoints', () => {
    expect(DEFAULT_CHOKEPOINTS).toHaveLength(5);
  });

  it('includes Hormuz, Malacca, Suez, Panama, and Taiwan Strait', () => {
    const names = DEFAULT_CHOKEPOINTS.map((cp) => cp.name);
    expect(names).toContain('Strait of Hormuz');
    expect(names).toContain('Malacca Strait');
    expect(names).toContain('Suez Canal');
    expect(names).toContain('Panama Canal');
    expect(names).toContain('Taiwan Strait');
  });
});

describe('ChokepointManager', () => {
  describe('constructor', () => {
    it('loads all 5 default chokepoints when no argument provided', () => {
      const mgr = new ChokepointManager();
      expect(mgr.toArray()).toHaveLength(5);
    });
  });

  // ── Accessors ──────────────────────────────────────────

  describe('getChokepoint', () => {
    it('returns the chokepoint by ID', () => {
      const mgr = new ChokepointManager();
      const cp = mgr.getChokepoint(HORMUZ);
      expect(cp).toBeDefined();
      expect(cp?.name).toBe('Strait of Hormuz');
    });

    it('returns undefined for unknown ID', () => {
      const mgr = new ChokepointManager();
      expect(mgr.getChokepoint('nonexistent' as ChokepointId)).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('finds by exact name', () => {
      const mgr = new ChokepointManager();
      const cp = mgr.getByName('Suez Canal');
      expect(cp?.id).toBe(SUEZ);
    });

    it('is case-insensitive', () => {
      const mgr = new ChokepointManager();
      const cp = mgr.getByName('MALACCA STRAIT');
      expect(cp?.id).toBe(MALACCA);
    });

    it('returns undefined for unknown name', () => {
      const mgr = new ChokepointManager();
      expect(mgr.getByName('Bosphorus')).toBeUndefined();
    });
  });

  describe('getByController', () => {
    it('returns chokepoints controlled by Iran', () => {
      const mgr = new ChokepointManager();
      const result = mgr.getByController(FactionId.Iran);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Strait of Hormuz');
    });

    it('returns empty array for faction controlling nothing', () => {
      const mgr = new ChokepointManager();
      expect(mgr.getByController(FactionId.DPRK)).toHaveLength(0);
    });
  });

  // ── Mutations ──────────────────────────────────────────

  describe('setController', () => {
    it('changes the controlling faction', () => {
      const mgr = new ChokepointManager();
      mgr.setController(HORMUZ, FactionId.US);
      const cp = mgr.getChokepoint(HORMUZ);
      expect(cp?.currentController).toBe(FactionId.US);
    });
  });

  describe('imposeTransitFee', () => {
    it('sets status to transit-fee and records fee percent', () => {
      const mgr = new ChokepointManager();
      mgr.imposeTransitFee(HORMUZ, 25);
      const cp = mgr.getChokepoint(HORMUZ);
      expect(cp?.status).toBe('transit-fee');
      expect(cp?.transitFeePercent).toBe(25);
    });
  });

  describe('imposeBlockade', () => {
    it('sets status to blockaded', () => {
      const mgr = new ChokepointManager();
      mgr.imposeBlockade(SUEZ);
      expect(mgr.getChokepoint(SUEZ)?.status).toBe('blockaded');
    });
  });

  describe('openChokepoint', () => {
    it('clears status and fee', () => {
      const mgr = new ChokepointManager();
      mgr.imposeTransitFee(PANAMA, 50);
      mgr.openChokepoint(PANAMA);
      const cp = mgr.getChokepoint(PANAMA);
      expect(cp?.status).toBe('open');
      expect(cp?.transitFeePercent).toBe(0);
    });
  });

  // ── Queries ────────────────────────────────────────────

  describe('isBlockaded', () => {
    it('returns true when blockaded', () => {
      const mgr = new ChokepointManager();
      mgr.imposeBlockade(HORMUZ);
      expect(mgr.isBlockaded(HORMUZ)).toBe(true);
    });

    it('returns false when open', () => {
      const mgr = new ChokepointManager();
      expect(mgr.isBlockaded(HORMUZ)).toBe(false);
    });
  });

  describe('getTransitFee', () => {
    it('returns fee when transit-fee status', () => {
      const mgr = new ChokepointManager();
      mgr.imposeTransitFee(SUEZ, 15);
      expect(mgr.getTransitFee(SUEZ)).toBe(15);
    });

    it('returns 0 when open', () => {
      const mgr = new ChokepointManager();
      expect(mgr.getTransitFee(SUEZ)).toBe(0);
    });
  });

  describe('calculateTradeDisruption', () => {
    it('returns fee-proportional loss for transit-fee', () => {
      const mgr = new ChokepointManager();
      mgr.imposeTransitFee(HORMUZ, 20);
      expect(mgr.calculateTradeDisruption(HORMUZ, 1000)).toBe(200);
    });

    it('returns full loss for blockade', () => {
      const mgr = new ChokepointManager();
      mgr.imposeBlockade(HORMUZ);
      expect(mgr.calculateTradeDisruption(HORMUZ, 1000)).toBe(1000);
    });

    it('returns 0 when open', () => {
      const mgr = new ChokepointManager();
      expect(mgr.calculateTradeDisruption(HORMUZ, 1000)).toBe(0);
    });
  });

  describe('getEnergyChokepoints', () => {
    it('returns Hormuz and Malacca (affectsEnergyRoutes)', () => {
      const mgr = new ChokepointManager();
      const energy = mgr.getEnergyChokepoints();
      expect(energy).toHaveLength(2);
      const names = energy.map((cp) => cp.name);
      expect(names).toContain('Strait of Hormuz');
      expect(names).toContain('Malacca Strait');
    });
  });

  describe('getBlockadedChokepoints', () => {
    it('returns only blockaded chokepoints', () => {
      const mgr = new ChokepointManager();
      expect(mgr.getBlockadedChokepoints()).toHaveLength(0);

      mgr.imposeBlockade(TAIWAN);
      expect(mgr.getBlockadedChokepoints()).toHaveLength(1);
      expect(mgr.getBlockadedChokepoints()[0]?.name).toBe('Taiwan Strait');
    });
  });

  // ── Serialization ──────────────────────────────────────

  describe('toArray / fromArray roundtrip', () => {
    it('preserves state through serialization', () => {
      const mgr = new ChokepointManager();
      mgr.imposeBlockade(HORMUZ);
      mgr.imposeTransitFee(SUEZ, 30);

      const array = mgr.toArray();
      const mgr2 = ChokepointManager.fromArray(array);

      expect(mgr2.toArray()).toHaveLength(5);
      expect(mgr2.isBlockaded(HORMUZ)).toBe(true);
      expect(mgr2.getTransitFee(SUEZ)).toBe(30);
    });
  });
});
