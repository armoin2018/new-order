import { describe, it, expect } from 'vitest';
import {
  ForceStructureEngine,
  type ForceStructure,
} from '@/engine/force-structure';
import { FactionId } from '@/data/types';

// ── Helper ──────────────────────────────────────────────────────────────────

const engine = new ForceStructureEngine();

function makeFS(overrides: Partial<ForceStructure> = {}): ForceStructure {
  return ForceStructureEngine.createForceStructure(
    overrides.factionId ?? FactionId.US,
    overrides.activeForces ?? 50,
    overrides.nuclearArsenal ?? 50,
    overrides.navalPower ?? 50,
    overrides.airPower ?? 50,
    overrides.specialCapabilities ?? [],
    overrides.forceProjection ?? 50,
    overrides.readiness ?? 50,
  );
}

// ── createForceStructure ────────────────────────────────────────────────────

describe('ForceStructureEngine.createForceStructure', () => {
  it('creates a structure with all correct fields', () => {
    const fs = ForceStructureEngine.createForceStructure(
      FactionId.US, 80, 90, 70, 85, ['HypersonicMissiles'], 60, 75,
    );
    expect(fs.factionId).toBe(FactionId.US);
    expect(fs.activeForces).toBe(80);
    expect(fs.nuclearArsenal).toBe(90);
    expect(fs.navalPower).toBe(70);
    expect(fs.airPower).toBe(85);
    expect(fs.forceProjection).toBe(60);
    expect(fs.readiness).toBe(75);
  });

  it('preserves the special capabilities array', () => {
    const caps = ['HypersonicMissiles', 'CyberWarfare'];
    const fs = ForceStructureEngine.createForceStructure(
      FactionId.China, 50, 50, 50, 50, caps, 50, 50,
    );
    expect(fs.specialCapabilities).toEqual(caps);
  });

  it('preserves the faction id', () => {
    const fs = ForceStructureEngine.createForceStructure(
      FactionId.Russia, 10, 20, 30, 40, [], 50, 60,
    );
    expect(fs.factionId).toBe(FactionId.Russia);
  });
});

// ── validateForceStructure ──────────────────────────────────────────────────

describe('ForceStructureEngine#validateForceStructure', () => {
  it('passes a valid structure', () => {
    const result = engine.validateForceStructure(makeFS());
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('produces a warning when a field is below 0', () => {
    const result = engine.validateForceStructure(makeFS({ activeForces: -1 }));
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes('activeForces'))).toBe(true);
  });

  it('produces a warning when a field is above 100', () => {
    const result = engine.validateForceStructure(makeFS({ navalPower: 101 }));
    expect(result.valid).toBe(false);
    expect(result.warnings.some((w) => w.includes('navalPower'))).toBe(true);
  });

  it('produces multiple warnings for multiple out-of-range fields', () => {
    const result = engine.validateForceStructure(
      makeFS({ activeForces: -5, airPower: 200, readiness: -10 }),
    );
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('passes a valid structure with empty special capabilities', () => {
    const result = engine.validateForceStructure(makeFS({ specialCapabilities: [] }));
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes when all values are zero (within bounds)', () => {
    const fs = makeFS({
      activeForces: 0,
      nuclearArsenal: 0,
      navalPower: 0,
      airPower: 0,
      forceProjection: 0,
      readiness: 0,
    });
    const result = engine.validateForceStructure(fs);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── computeProjection ───────────────────────────────────────────────────────

describe('ForceStructureEngine#computeProjection', () => {
  it('marks border-only when forceProjection < 30', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 20 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(true);
    expect(result.baseRange).toBe(1);
  });

  it('marks border-only when forceProjection is 29', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 29 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(true);
    expect(result.baseRange).toBe(1);
  });

  it('is NOT border-only at threshold boundary (forceProjection=30)', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 30 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(false);
    expect(result.baseRange).toBe(3); // floor(30/10)
  });

  it('computes standard projection for forceProjection=50', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 50 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(false);
    expect(result.baseRange).toBe(5);
    expect(result.totalRange).toBe(5);
  });

  it('adds overseas base bonus correctly (2 bases × 2 = +4)', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 50 }),
      overseasBases: 2,
      carrierDeployments: 0,
    });
    expect(result.overseasBaseBonus).toBe(4);
    expect(result.totalRange).toBe(9); // 5 + 4
  });

  it('adds carrier deployment bonus correctly (1 carrier × 3 = +3)', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 50 }),
      overseasBases: 0,
      carrierDeployments: 1,
    });
    expect(result.carrierBonus).toBe(3);
    expect(result.totalRange).toBe(8); // 5 + 3
  });

  it('combines base + carrier bonuses: fp=50, 2 bases, 1 carrier → 5+4+3=12', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 50 }),
      overseasBases: 2,
      carrierDeployments: 1,
    });
    expect(result.baseRange).toBe(5);
    expect(result.overseasBaseBonus).toBe(4);
    expect(result.carrierBonus).toBe(3);
    expect(result.totalRange).toBe(12);
  });

  it('clamps total range to max of 15', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 100 }),
      overseasBases: 2,
      carrierDeployments: 2,
    });
    // floor(100/10) + (2×2) + (2×3) = 10 + 4 + 6 = 20 → clamped to 15
    expect(result.totalRange).toBe(15);
  });

  it('border-only with zero bases and carriers yields min range 1', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 0 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(true);
    expect(result.totalRange).toBe(1);
  });

  it('border-only + overseas base bonuses: fp=20, 3 bases → 1+6=7', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ forceProjection: 20 }),
      overseasBases: 3,
      carrierDeployments: 0,
    });
    expect(result.isBorderOnly).toBe(true);
    expect(result.baseRange).toBe(1);
    expect(result.overseasBaseBonus).toBe(6);
    expect(result.totalRange).toBe(7);
  });

  it('returns the correct factionId on the result', () => {
    const result = engine.computeProjection({
      forceStructure: makeFS({ factionId: FactionId.Japan, forceProjection: 40 }),
      overseasBases: 0,
      carrierDeployments: 0,
    });
    expect(result.factionId).toBe(FactionId.Japan);
  });
});

// ── checkRange ──────────────────────────────────────────────────────────────

describe('ForceStructureEngine#checkRange', () => {
  const projection = engine.computeProjection({
    forceStructure: makeFS({ forceProjection: 50 }),
    overseasBases: 1,
    carrierDeployments: 1,
  });
  // totalRange = 5 + 2 + 3 = 10

  it('returns true when distance is within range', () => {
    const result = engine.checkRange({ projection, distanceFromBorder: 5 });
    expect(result.withinRange).toBe(true);
  });

  it('returns true when distance equals exact range', () => {
    const result = engine.checkRange({ projection, distanceFromBorder: 10 });
    expect(result.withinRange).toBe(true);
  });

  it('returns false when distance exceeds range', () => {
    const result = engine.checkRange({ projection, distanceFromBorder: 11 });
    expect(result.withinRange).toBe(false);
  });

  it('returns true when distance is 0', () => {
    const result = engine.checkRange({ projection, distanceFromBorder: 0 });
    expect(result.withinRange).toBe(true);
  });

  it('includes a correct human-readable reason', () => {
    const within = engine.checkRange({ projection, distanceFromBorder: 5 });
    expect(within.reason).toContain('within');
    expect(within.reason).toContain('5');

    const beyond = engine.checkRange({ projection, distanceFromBorder: 11 });
    expect(beyond.reason).toContain('exceeds');
    expect(beyond.reason).toContain('11');
  });

  it('reports maxRange and distanceFromBorder on the result', () => {
    const result = engine.checkRange({ projection, distanceFromBorder: 7 });
    expect(result.maxRange).toBe(10);
    expect(result.distanceFromBorder).toBe(7);
  });
});

// ── computeMilitaryPower ────────────────────────────────────────────────────

describe('ForceStructureEngine#computeMilitaryPower', () => {
  it('computes balanced scores correctly (all 50 → power 50)', () => {
    const result = engine.computeMilitaryPower(makeFS());
    // 50×0.3 + 50×0.2 + 50×0.2 + 50×0.2 + 50×0.1 = 15+10+10+10+5 = 50
    expect(result.power).toBeCloseTo(50, 5);
  });

  it('computes max scores correctly (all 100 → power 100)', () => {
    const fs = makeFS({
      activeForces: 100,
      nuclearArsenal: 100,
      navalPower: 100,
      airPower: 100,
      readiness: 100,
    });
    const result = engine.computeMilitaryPower(fs);
    expect(result.power).toBeCloseTo(100, 5);
  });

  it('computes skewed scores (activeForces=100, rest 0 → power 30)', () => {
    const fs = makeFS({
      activeForces: 100,
      nuclearArsenal: 0,
      navalPower: 0,
      airPower: 0,
      readiness: 0,
    });
    const result = engine.computeMilitaryPower(fs);
    expect(result.power).toBeCloseTo(30, 5);
  });

  it('computes zero power when all scores are 0', () => {
    const fs = makeFS({
      activeForces: 0,
      nuclearArsenal: 0,
      navalPower: 0,
      airPower: 0,
      readiness: 0,
    });
    const result = engine.computeMilitaryPower(fs);
    expect(result.power).toBeCloseTo(0, 5);
  });

  it('returns correct per-component breakdown values', () => {
    const fs = makeFS({
      activeForces: 80,
      nuclearArsenal: 60,
      navalPower: 70,
      airPower: 90,
      readiness: 40,
    });
    const result = engine.computeMilitaryPower(fs);

    expect(result.breakdown.activeForces).toBeCloseTo(80 * 0.3, 5);   // 24
    expect(result.breakdown.navalPower).toBeCloseTo(70 * 0.2, 5);     // 14
    expect(result.breakdown.airPower).toBeCloseTo(90 * 0.2, 5);       // 18
    expect(result.breakdown.readiness).toBeCloseTo(40 * 0.2, 5);      // 8
    expect(result.breakdown.nuclearDeterrent).toBeCloseTo(60 * 0.1, 5); // 6

    const expectedPower = 24 + 14 + 18 + 8 + 6; // 70
    expect(result.power).toBeCloseTo(expectedPower, 5);
  });

  it('returns the correct factionId', () => {
    const fs = makeFS({ factionId: FactionId.Iran });
    const result = engine.computeMilitaryPower(fs);
    expect(result.factionId).toBe(FactionId.Iran);
  });
});

// ── hasCapability ───────────────────────────────────────────────────────────

describe('ForceStructureEngine.hasCapability', () => {
  it('returns true when capability exists', () => {
    const fs = makeFS({ specialCapabilities: ['HypersonicMissiles', 'CyberWarfare'] });
    expect(ForceStructureEngine.hasCapability(fs, 'CyberWarfare')).toBe(true);
  });

  it('returns false when capability is missing', () => {
    const fs = makeFS({ specialCapabilities: ['HypersonicMissiles'] });
    expect(ForceStructureEngine.hasCapability(fs, 'SpaceDenial')).toBe(false);
  });

  it('returns false with an empty capabilities array', () => {
    const fs = makeFS({ specialCapabilities: [] });
    expect(ForceStructureEngine.hasCapability(fs, 'CyberWarfare')).toBe(false);
  });
});
