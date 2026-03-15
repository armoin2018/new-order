import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceDisruptionEngine } from '@/engine/resource-disruption';
import type {
  ResourceDisruption,
  RareEarthRestriction,
} from '@/engine/resource-disruption';
import { FactionId } from '@/data/types';
import type { FactionId as FactionIdType, NationState } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionIdType,
    stability: 55,
    treasury: 800,
    gdp: 28_000,
    inflation: 6,
    militaryReadiness: 85,
    nuclearThreshold: 25,
    diplomaticInfluence: 80,
    popularity: 48,
    allianceCredibility: 65,
    techLevel: 90,
    ...overrides,
  };
}

function makeNationsRecord(
  entries: Array<Partial<NationState> & { factionId: FactionIdType }>,
): Record<FactionIdType, NationState> {
  const record = {} as Record<FactionIdType, NationState>;
  for (const entry of entries) {
    record[entry.factionId] = makeMockNation(entry);
  }
  return record;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResourceDisruptionEngine', () => {
  let engine: ResourceDisruptionEngine;

  beforeEach(() => {
    engine = new ResourceDisruptionEngine(GAME_CONFIG.economy);
  });

  // ── addDisruption / removeDisruption / getActiveDisruptions ───────────

  describe('addDisruption / removeDisruption', () => {
    it('addDisruption sets turnsActive to 0', () => {
      engine.addDisruption({
        resourceType: 'oil',
        sourceChokepointId: 'hormuz',
        disruptionLevel: 80,
        affectedFactions: [FactionId.Japan as FactionIdType],
      });

      const disruptions = engine.getActiveDisruptions();
      expect(disruptions).toHaveLength(1);
      expect(disruptions[0]!.turnsActive).toBe(0);
      expect(disruptions[0]!.disruptionLevel).toBe(80);
    });

    it('removeDisruption returns true when disruption exists', () => {
      engine.addDisruption({
        resourceType: 'oil',
        sourceChokepointId: 'hormuz',
        disruptionLevel: 50,
        affectedFactions: [],
      });
      expect(engine.removeDisruption('oil', 'hormuz')).toBe(true);
      expect(engine.getActiveDisruptions()).toHaveLength(0);
    });

    it('removeDisruption returns false when no matching disruption exists', () => {
      expect(engine.removeDisruption('oil', 'hormuz')).toBe(false);
    });

    it('getActiveDisruptions returns correct list after multiple adds', () => {
      engine.addDisruption({
        resourceType: 'oil',
        sourceChokepointId: 'hormuz',
        disruptionLevel: 50,
        affectedFactions: [],
      });
      engine.addDisruption({
        resourceType: 'rare-earth',
        sourceChokepointId: 'malacca',
        disruptionLevel: 30,
        affectedFactions: [],
      });
      expect(engine.getActiveDisruptions()).toHaveLength(2);
    });

    it('removeDisruption only removes the matching disruption', () => {
      engine.addDisruption({
        resourceType: 'oil',
        sourceChokepointId: 'hormuz',
        disruptionLevel: 50,
        affectedFactions: [],
      });
      engine.addDisruption({
        resourceType: 'gas',
        sourceChokepointId: 'suez',
        disruptionLevel: 40,
        affectedFactions: [],
      });
      engine.removeDisruption('oil', 'hormuz');
      const remaining = engine.getActiveDisruptions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.resourceType).toBe('gas');
    });
  });

  // ── calculateCascadingDecay ───────────────────────────────────────────

  describe('calculateCascadingDecay', () => {
    const cascadeDelay = GAME_CONFIG.economy.chokepointResources.cascadeDelayTurns; // 1

    it('returns no decay when disruption turnsActive < cascadeDelayTurns', () => {
      const disruptions: ResourceDisruption[] = [
        {
          resourceType: 'oil',
          sourceChokepointId: 'hormuz',
          disruptionLevel: 80,
          turnsActive: 0,
          affectedFactions: [FactionId.Japan as FactionIdType],
        },
      ];
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType },
      ]);

      const results = engine.calculateCascadingDecay(disruptions, nations);
      expect(results).toHaveLength(0);
    });

    it('returns decay after cascadeDelayTurns', () => {
      const disruptions: ResourceDisruption[] = [
        {
          resourceType: 'oil',
          sourceChokepointId: 'hormuz',
          disruptionLevel: 100,
          turnsActive: cascadeDelay,
          affectedFactions: [FactionId.Japan as FactionIdType],
        },
      ];
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType },
      ]);

      const results = engine.calculateCascadingDecay(disruptions, nations);
      expect(results).toHaveLength(1);
      expect(results[0]!.factionId).toBe(FactionId.Japan);
      // severity = 100/100 = 1.0, milDecay = -3 × 1.0 = -3
      expect(results[0]!.militaryReadinessDelta).toBeCloseTo(-3, 5);
      // industrialDecay = -2 × 1.0 = -2
      expect(results[0]!.industrialStabilityDelta).toBeCloseTo(-2, 5);
    });

    it('severity-weights the decay by disruptionLevel', () => {
      const disruptions: ResourceDisruption[] = [
        {
          resourceType: 'oil',
          sourceChokepointId: 'hormuz',
          disruptionLevel: 50, // severity = 0.5
          turnsActive: cascadeDelay,
          affectedFactions: [FactionId.US as FactionIdType],
        },
      ];
      const nations = makeNationsRecord([
        { factionId: FactionId.US as FactionIdType },
      ]);

      const results = engine.calculateCascadingDecay(disruptions, nations);
      expect(results).toHaveLength(1);
      // -3 × 0.5 = -1.5
      expect(results[0]!.militaryReadinessDelta).toBeCloseTo(-1.5, 5);
      // -2 × 0.5 = -1.0
      expect(results[0]!.industrialStabilityDelta).toBeCloseTo(-1.0, 5);
    });

    it('accumulates decay from multiple qualifying disruptions', () => {
      const disruptions: ResourceDisruption[] = [
        {
          resourceType: 'oil',
          sourceChokepointId: 'hormuz',
          disruptionLevel: 100,
          turnsActive: cascadeDelay,
          affectedFactions: [FactionId.EU as FactionIdType],
        },
        {
          resourceType: 'gas',
          sourceChokepointId: 'suez',
          disruptionLevel: 100,
          turnsActive: cascadeDelay,
          affectedFactions: [FactionId.EU as FactionIdType],
        },
      ];
      const nations = makeNationsRecord([
        { factionId: FactionId.EU as FactionIdType },
      ]);

      const results = engine.calculateCascadingDecay(disruptions, nations);
      expect(results).toHaveLength(1);
      // Two full-severity disruptions: -3 + -3 = -6
      expect(results[0]!.militaryReadinessDelta).toBeCloseTo(-6, 5);
      expect(results[0]!.industrialStabilityDelta).toBeCloseTo(-4, 5);
    });

    it('skips faction not present in nations record', () => {
      const disruptions: ResourceDisruption[] = [
        {
          resourceType: 'oil',
          sourceChokepointId: 'hormuz',
          disruptionLevel: 100,
          turnsActive: cascadeDelay,
          affectedFactions: ['unknown' as FactionIdType],
        },
      ];
      const nations = makeNationsRecord([
        { factionId: FactionId.US as FactionIdType },
      ]);

      const results = engine.calculateCascadingDecay(disruptions, nations);
      expect(results).toHaveLength(0);
    });
  });

  // ── advanceTurn ───────────────────────────────────────────────────────

  describe('advanceTurn', () => {
    it('increments turnsActive on disruptions', () => {
      engine.addDisruption({
        resourceType: 'oil',
        sourceChokepointId: 'hormuz',
        disruptionLevel: 80,
        affectedFactions: [],
      });
      engine.advanceTurn();
      expect(engine.getActiveDisruptions()[0]!.turnsActive).toBe(1);
      engine.advanceTurn();
      expect(engine.getActiveDisruptions()[0]!.turnsActive).toBe(2);
    });

    it('increments turnsActive on rare earth restrictions', () => {
      engine.imposeRareEarthRestriction(
        FactionId.China as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      engine.advanceTurn();
      const restrictions = engine.getRareEarthRestrictions();
      expect(restrictions[0]!.turnsActive).toBe(1);
    });

    it('advances alternate sourcing progress when active', () => {
      engine.imposeRareEarthRestriction(
        FactionId.China as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      engine.beginAlternateSourcing(
        FactionId.Japan as FactionIdType,
        FactionId.US as FactionIdType,
        1000,
      );
      engine.advanceTurn();
      const restrictions = engine.getRareEarthRestrictions();
      expect(restrictions[0]!.alternateSourceProgress).toBe(1);
    });
  });

  // ── calculateHormuzDisruption ─────────────────────────────────────────

  describe('calculateHormuzDisruption', () => {
    it('open status yields 0 disruption and 0 inflation', () => {
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType, inflation: 5 },
      ]);
      const energyDeps = { [FactionId.Japan]: 80 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('open', 0, nations, energyDeps);

      expect(result.oilSupplyDisruption).toBe(0);
      expect(result.globalInflationDelta).toBe(0);
    });

    it('transit-fee yields percentage-based disruption', () => {
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType },
      ]);
      const energyDeps = { [FactionId.Japan]: 50 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('transit-fee', 30, nations, energyDeps);

      expect(result.oilSupplyDisruption).toBe(30);
      // inflationDelta = 0.15 × 30 = 4.5
      expect(result.globalInflationDelta).toBeCloseTo(4.5, 5);
    });

    it('blockaded yields maxDisruption (100)', () => {
      const nations = makeNationsRecord([
        { factionId: FactionId.US as FactionIdType },
      ]);
      const energyDeps = { [FactionId.US]: 20 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('blockaded', 0, nations, energyDeps);

      expect(result.oilSupplyDisruption).toBe(100);
      // inflationDelta = 0.15 × 100 = 15
      expect(result.globalInflationDelta).toBeCloseTo(15, 5);
    });

    it('per-nation stability deltas based on energy dependency', () => {
      // Japan: inflation = 5, energyDep = 80
      // globalInflationDelta = 0.15 × 100 = 15
      // effectiveInflation = 5 + 15 × (80/100) = 5 + 12 = 17
      // excess = 17 - 10 = 7, penaltyUnits = floor(7/10) = 0 → delta = 0
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType, inflation: 5 },
      ]);
      const energyDeps = { [FactionId.Japan]: 80 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('blockaded', 0, nations, energyDeps);
      // Math.floor produces -0 for negative fractions; use toBeCloseTo to treat -0 as 0
      expect(result.perNationStabilityDeltas[FactionId.Japan as FactionIdType]).toBeCloseTo(0, 5);
    });

    it('high-dependency nation gets stability penalty from blockade', () => {
      // Japan: inflation = 15, energyDep = 100
      // globalInflationDelta = 0.15 × 100 = 15
      // effectiveInflation = 15 + 15 × (100/100) = 30
      // excess = 30 - 10 = 20, penaltyUnits = floor(20/10) = 2
      // delta = 2 × -2 = -4
      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType, inflation: 15 },
      ]);
      const energyDeps = { [FactionId.Japan]: 100 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('blockaded', 0, nations, energyDeps);
      expect(result.perNationStabilityDeltas[FactionId.Japan as FactionIdType]).toBe(-4);
    });

    it('nations below inflation threshold get 0 stability delta', () => {
      // US: inflation = 2, energyDep = 10
      // effectiveInflation = 2 + 15 × 0.10 = 3.5 → below threshold (10)
      const nations = makeNationsRecord([
        { factionId: FactionId.US as FactionIdType, inflation: 2 },
      ]);
      const energyDeps = { [FactionId.US]: 10 } as Record<FactionIdType, number>;

      const result = engine.calculateHormuzDisruption('blockaded', 0, nations, energyDeps);
      expect(result.perNationStabilityDeltas[FactionId.US as FactionIdType]).toBe(0);
    });
  });

  // ── imposeRareEarthRestriction ────────────────────────────────────────

  describe('imposeRareEarthRestriction', () => {
    it('creates restriction with turnsActive = 0', () => {
      engine.imposeRareEarthRestriction(
        FactionId.China as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      const restrictions = engine.getRareEarthRestrictions();
      expect(restrictions).toHaveLength(1);
      expect(restrictions[0]!.imposer).toBe(FactionId.China);
      expect(restrictions[0]!.target).toBe(FactionId.Japan);
      expect(restrictions[0]!.turnsActive).toBe(0);
      expect(restrictions[0]!.alternateSourceActive).toBe(false);
      expect(restrictions[0]!.alternateSourceProgress).toBe(0);
      expect(restrictions[0]!.alternateSourceProvider).toBeNull();
    });
  });

  // ── beginAlternateSourcing ────────────────────────────────────────────

  describe('beginAlternateSourcing', () => {
    beforeEach(() => {
      engine.imposeRareEarthRestriction(
        FactionId.China as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
    });

    it('fails if target cannot afford cost (returns shortfall)', () => {
      const result = engine.beginAlternateSourcing(
        FactionId.Japan as FactionIdType,
        FactionId.US as FactionIdType,
        10, // insufficient
      );
      expect(result.success).toBe(false);
      expect(result.remainingTreasury).toBe(10);
      // cost = 50, shortfall = 50 - 10 = 40
      expect(result.shortfall).toBeCloseTo(40, 5);
    });

    it('succeeds and deducts cost from treasury', () => {
      const result = engine.beginAlternateSourcing(
        FactionId.Japan as FactionIdType,
        FactionId.US as FactionIdType,
        200,
      );
      expect(result.success).toBe(true);
      // cost = 50, remaining = 200 - 50 = 150
      expect(result.remainingTreasury).toBeCloseTo(150, 5);
      expect(result.shortfall).toBe(0);
    });

    it('activates alternate sourcing on the restriction', () => {
      engine.beginAlternateSourcing(
        FactionId.Japan as FactionIdType,
        FactionId.US as FactionIdType,
        200,
      );
      const restrictions = engine.getRareEarthRestrictions();
      expect(restrictions[0]!.alternateSourceActive).toBe(true);
      expect(restrictions[0]!.alternateSourceProvider).toBe(FactionId.US);
    });
  });

  // ── processRareEarthTurn ──────────────────────────────────────────────

  describe('processRareEarthTurn', () => {
    it('applies full penalty when no alternate sourcing', () => {
      const restriction: RareEarthRestriction = {
        imposer: FactionId.China as FactionIdType,
        target: FactionId.Japan as FactionIdType,
        turnsActive: 2,
        alternateSourceActive: false,
        alternateSourceProgress: 0,
        alternateSourceProvider: null,
      };

      const result = engine.processRareEarthTurn(restriction);
      // techProductionPenalty = -20, stabilityDecayPerTurn = -2
      expect(result.techLevelDelta).toBe(-20);
      expect(result.stabilityDelta).toBe(-2);
      expect(result.alternateSourceComplete).toBe(false);
      expect(result.mitigated).toBe(false);
    });

    it('applies mitigated penalty during active sourcing', () => {
      const restriction: RareEarthRestriction = {
        imposer: FactionId.China as FactionIdType,
        target: FactionId.Japan as FactionIdType,
        turnsActive: 3,
        alternateSourceActive: true,
        alternateSourceProgress: 2, // not yet complete (need 4)
        alternateSourceProvider: FactionId.US as FactionIdType,
      };

      const result = engine.processRareEarthTurn(restriction);
      // mitigated: -20 × 0.5 = -10, -2 × 0.5 = -1
      expect(result.techLevelDelta).toBeCloseTo(-10, 5);
      expect(result.stabilityDelta).toBeCloseTo(-1, 5);
      expect(result.alternateSourceComplete).toBe(false);
      expect(result.mitigated).toBe(true);
    });

    it('applies no penalty when alternate sourcing is complete', () => {
      const restriction: RareEarthRestriction = {
        imposer: FactionId.China as FactionIdType,
        target: FactionId.Japan as FactionIdType,
        turnsActive: 6,
        alternateSourceActive: true,
        alternateSourceProgress: 4, // equals alternateSourceTurns
        alternateSourceProvider: FactionId.US as FactionIdType,
      };

      const result = engine.processRareEarthTurn(restriction);
      expect(result.techLevelDelta).toBe(0);
      expect(result.stabilityDelta).toBe(0);
      expect(result.alternateSourceComplete).toBe(true);
      expect(result.mitigated).toBe(false);
    });
  });

  // ── isRareEarthRestricted ─────────────────────────────────────────────

  describe('isRareEarthRestricted', () => {
    it('returns true when faction is under restriction', () => {
      engine.imposeRareEarthRestriction(
        FactionId.China as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      expect(engine.isRareEarthRestricted(FactionId.Japan as FactionIdType)).toBe(true);
    });

    it('returns false when faction is not restricted', () => {
      expect(engine.isRareEarthRestricted(FactionId.US as FactionIdType)).toBe(false);
    });
  });
});
