import { describe, it, expect } from 'vitest';
import { PoliticalSystemEngine } from '@/engine/political-system-engine';
import type { PoliticalSystemProfile, NationState, FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDemocracyProfile(overrides: Partial<PoliticalSystemProfile> = {}): PoliticalSystemProfile {
  return {
    schemaVersion: '1.0.0',
    systemId: 'liberal-democracy',
    systemName: 'Liberal Democracy',
    description: 'Representative democratic system with civil liberties.',
    decisionSpeedModifier: -20,
    stabilityBaseline: 12,
    civilLibertyIndex: 90,
    pressFreedomIndex: 85,
    corruptionBaseline: 25,
    successionRisk: 10,
    reformCapacity: 80,
    ...overrides,
  };
}

function makeAutocracyProfile(overrides: Partial<PoliticalSystemProfile> = {}): PoliticalSystemProfile {
  return {
    schemaVersion: '1.0.0',
    systemId: 'authoritarian-republic',
    systemName: 'Authoritarian Republic',
    description: 'Centralized authority with limited civil liberties.',
    decisionSpeedModifier: 40,
    stabilityBaseline: 5,
    civilLibertyIndex: 10,
    pressFreedomIndex: 10,
    corruptionBaseline: 70,
    successionRisk: 60,
    reformCapacity: 20,
    ...overrides,
  };
}

function makeMockNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionId,
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
  } as NationState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PoliticalSystemEngine', () => {
  const engine = new PoliticalSystemEngine();

  // ── computeModifiers ────────────────────────────────────────────────────

  describe('computeModifiers', () => {
    it('democracy profile produces high civil liberty threshold and low decision speed', () => {
      const mods = engine.computeModifiers(makeDemocracyProfile());

      // decisionSpeedModifier -20 → multiplier = 1 + (-20/100) = 0.8
      expect(mods.decisionSpeedMultiplier).toBeCloseTo(0.8, 2);
      // civilLibertyIndex 90 → high threshold
      expect(mods.civilLibertyThreshold).toBeGreaterThan(20);
      // High reform capacity → low reform difficulty
      expect(mods.reformDifficulty).toBe(20);
    });

    it('autocracy profile produces opposite modifiers', () => {
      const mods = engine.computeModifiers(makeAutocracyProfile());

      // decisionSpeedModifier +40 → multiplier = 1.4
      expect(mods.decisionSpeedMultiplier).toBeCloseTo(1.4, 2);
      // Low civil liberty → low threshold
      expect(mods.civilLibertyThreshold).toBeLessThan(10);
      // Low reform capacity → high reform difficulty
      expect(mods.reformDifficulty).toBe(80);
      // High corruption → low economic efficiency
      expect(mods.economicEfficiencyModifier).toBeCloseTo(0.65, 2);
    });
  });

  // ── computeEffect ──────────────────────────────────────────────────────

  describe('computeEffect', () => {
    it('produces correct factionId, systemId, and modifier values', () => {
      const nation = makeMockNation({ factionId: 'eu' as FactionId });
      const profile = makeDemocracyProfile();

      const effect = engine.computeEffect(profile, nation);

      expect(effect.factionId).toBe('eu');
      expect(effect.systemId).toBe('liberal-democracy');
      expect(effect.modifiers.decisionSpeedMultiplier).toBeCloseTo(0.8, 2);
      expect(effect.successionRiskThisTurn).toBeGreaterThanOrEqual(0);
      expect(effect.successionRiskThisTurn).toBeLessThanOrEqual(1);
    });
  });

  // ── getActionDelay ─────────────────────────────────────────────────────

  describe('getActionDelay', () => {
    it('returns 1 for democracies on controversial actions', () => {
      const delay = engine.getActionDelay(makeDemocracyProfile(), true);
      expect(delay).toBe(1);
    });

    it('returns 0 for non-controversial actions regardless of system', () => {
      expect(engine.getActionDelay(makeDemocracyProfile(), false)).toBe(0);
      expect(engine.getActionDelay(makeAutocracyProfile(), false)).toBe(0);
    });

    it('returns 0 for autocracies on all actions', () => {
      expect(engine.getActionDelay(makeAutocracyProfile(), true)).toBe(0);
      expect(engine.getActionDelay(makeAutocracyProfile(), false)).toBe(0);
    });
  });

  // ── computeSuccessionRisk ──────────────────────────────────────────────

  describe('computeSuccessionRisk', () => {
    it('base risk from profile is normalised to per-turn probability', () => {
      const risk = engine.computeSuccessionRisk(makeDemocracyProfile());
      // successionRisk 10 → 10/1000 = 0.01
      expect(risk).toBeCloseTo(0.01, 4);
    });

    it('age amplifier increases risk beyond age 60', () => {
      const riskBase = engine.computeSuccessionRisk(makeDemocracyProfile(), 50);
      const riskOld = engine.computeSuccessionRisk(makeDemocracyProfile(), 75);
      expect(riskOld).toBeGreaterThan(riskBase);
    });

    it('low stability amplifies risk', () => {
      const riskStable = engine.computeSuccessionRisk(makeAutocracyProfile(), undefined, 80);
      const riskUnstable = engine.computeSuccessionRisk(makeAutocracyProfile(), undefined, 20);
      expect(riskUnstable).toBeGreaterThan(riskStable);
    });
  });

  // ── getStabilityModifier ───────────────────────────────────────────────

  describe('getStabilityModifier', () => {
    it('recovery mode favors democracies', () => {
      const demRecovery = engine.getStabilityModifier(makeDemocracyProfile(), true);
      const autRecovery = engine.getStabilityModifier(makeAutocracyProfile(), true);
      expect(demRecovery).toBeGreaterThan(autRecovery);
    });

    it('shock mode favors autocracies', () => {
      const demShock = engine.getStabilityModifier(makeDemocracyProfile(), false);
      const autShock = engine.getStabilityModifier(makeAutocracyProfile(), false);
      expect(autShock).toBeGreaterThan(demShock);
    });
  });

  // ── getIntelModifiers ──────────────────────────────────────────────────

  describe('getIntelModifiers', () => {
    it('closed society gets high counterIntel bonus', () => {
      const intel = engine.getIntelModifiers(makeAutocracyProfile());
      expect(intel.counterIntel).toBeGreaterThan(10);
    });

    it('open society gets high humintAbroad bonus', () => {
      const intel = engine.getIntelModifiers(makeDemocracyProfile());
      expect(intel.humintAbroad).toBeGreaterThan(5);
    });
  });

  // ── boundary: clamps values ────────────────────────────────────────────

  describe('boundary: clamps values', () => {
    it('clamps extreme decision speed modifier', () => {
      const extremeProfile = makeDemocracyProfile({ decisionSpeedModifier: 200 });
      const mods = engine.computeModifiers(extremeProfile);
      expect(mods.decisionSpeedMultiplier).toBeLessThanOrEqual(2.0);
    });

    it('succession risk is clamped between 0 and 1', () => {
      const risk = engine.computeSuccessionRisk(
        makeAutocracyProfile({ successionRisk: 100 }),
        95,
        5,
      );
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });
});
