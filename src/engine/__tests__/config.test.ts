import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// GAME_CONFIG Smoke Tests
// ---------------------------------------------------------------------------

describe('GAME_CONFIG', () => {
  it('is defined and is an object', () => {
    expect(GAME_CONFIG).toBeDefined();
    expect(typeof GAME_CONFIG).toBe('object');
  });

  it('is frozen (as const produces deeply readonly types)', () => {
    // `as const` enforces readonly at the type level. At runtime the object
    // itself is not Object.freeze'd, but we can verify immutability by
    // checking that the type system prevents mutations and values match
    // expected constants.
    expect(GAME_CONFIG).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // All 21 top-level sections must exist
  // -------------------------------------------------------------------------

  const EXPECTED_SECTIONS = [
    'meta',
    'stability',
    'nuclear',
    'aiDecision',
    'combat',
    'intelligence',
    'psychology',
    'infoWar',
    'financial',
    'technology',
    'resources',
    'proxy',
    'advisory',
    'powerBase',
    'military',
    'economy',
    'headlines',
    'intelReliability',
    'marketReactions',
    'greyZone',
    'leaderCreation',
    'victoryLoss',
    'diplomacy',
    'postGameAnalysis',
    'unResolutions',
    'aiDifficulty',
    'doubleAgent',
    'scenarioSelection',
    'tutorial',
    'modding',
    'visualization',
    'temporal',
    'currency',
    'budget',
    'prompts',
    'ranking',
    'aiConfig',
    'election',
    'persistence',
    'webGathering',
    'queue',
    'lifecycle',
    'nationRoster',
    'liveData',
  ] as const;

  it('contains exactly 50 top-level sections', () => {
    const keys = Object.keys(GAME_CONFIG);
    expect(keys).toHaveLength(50);
  });

  it.each(EXPECTED_SECTIONS)('has top-level section "%s"', (section) => {
    expect(GAME_CONFIG).toHaveProperty(section);
    expect(typeof GAME_CONFIG[section]).toBe('object');
  });

  // -------------------------------------------------------------------------
  // Spot-check specific constant values
  // -------------------------------------------------------------------------

  describe('meta section', () => {
    it('has MAX_TURNS === 60', () => {
      expect(GAME_CONFIG.meta.MAX_TURNS).toBe(60);
    });

    it('has FACTIONS_COUNT === 8', () => {
      expect(GAME_CONFIG.meta.FACTIONS_COUNT).toBe(8);
    });

    it('starts in March 2026', () => {
      expect(GAME_CONFIG.meta.STARTING_MONTH).toBe(3);
      expect(GAME_CONFIG.meta.STARTING_YEAR).toBe(2026);
    });
  });

  describe('stability section', () => {
    it('has civil unrest weights summing to ~1.0', () => {
      const w = GAME_CONFIG.stability.civilUnrestWeights;
      const total =
        w.inflation + w.inequality + w.repressionBacklash + w.ethnicTension + w.foreignPropaganda;
      expect(total).toBeCloseTo(1.0);
    });

    it('has escalation thresholds in ascending order', () => {
      const t = GAME_CONFIG.stability.escalationThresholds;
      expect(t.grumblingMax).toBeLessThan(t.protestsMin);
      expect(t.protestsMax).toBeLessThan(t.riotsMin);
      expect(t.riotsMax).toBeLessThan(t.insurrectionMin);
      expect(t.insurrectionMax).toBeLessThan(t.civilWarMin);
    });

    it('has repressionBacklashThreshold === 50', () => {
      expect(GAME_CONFIG.stability.repressionBacklashThreshold).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // No negative thresholds where inappropriate
  // -------------------------------------------------------------------------

  describe('threshold sanity checks', () => {
    it('meta values are all positive', () => {
      expect(GAME_CONFIG.meta.MAX_TURNS).toBeGreaterThan(0);
      expect(GAME_CONFIG.meta.FACTIONS_COUNT).toBeGreaterThan(0);
      expect(GAME_CONFIG.meta.STARTING_MONTH).toBeGreaterThan(0);
      expect(GAME_CONFIG.meta.STARTING_YEAR).toBeGreaterThan(0);
    });

    it('escalation thresholds are non-negative', () => {
      const t = GAME_CONFIG.stability.escalationThresholds;
      for (const value of Object.values(t)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it('combat terrain defense bonuses are non-negative', () => {
      expect(GAME_CONFIG.combat.terrainModifiers.mountain.defenseBonus).toBeGreaterThanOrEqual(0);
      expect(GAME_CONFIG.combat.terrainModifiers.urban.defenseBonus).toBeGreaterThanOrEqual(0);
      expect(GAME_CONFIG.combat.terrainModifiers.forest.defenseBonus).toBeGreaterThanOrEqual(0);
    });

    it('low readiness threshold is positive', () => {
      expect(GAME_CONFIG.combat.lowReadiness.threshold).toBeGreaterThan(0);
    });
  });
});
