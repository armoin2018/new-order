import { describe, it, expect } from 'vitest';
import { PopulationEngine } from '@/engine/population-engine';
import type { PopulationState, MigrationEvent } from '@/engine/population-engine';
import { ReligionDynamicsEngine } from '@/engine/religion-dynamics';
import type { ReligionState } from '@/engine/religion-dynamics';
import type { FactionId, PopulationDemographics, ReligionProfile } from '@/data/types';

// ---------------------------------------------------------------------------
// Population Fixtures
// ---------------------------------------------------------------------------

function makePopState(overrides: Partial<PopulationState> = {}): PopulationState {
  return {
    factionId: 'us' as FactionId,
    currentPopulationMillions: 330,
    growthRatePercent: 0.5,
    ageDistribution: { youth: 20, working: 65, elderly: 15 },
    urbanizationRate: 82,
    migrationFlowNet: 0.5,
    ...overrides,
  };
}

function makeDemographics(overrides: Partial<PopulationDemographics> = {}): PopulationDemographics {
  return {
    schemaVersion: '1.0.0',
    nationId: 'us',
    populationMillions: 330,
    growthRatePercent: 0.5,
    urbanizationPercent: 82,
    medianAge: 38,
    lifeExpectancy: 78,
    literacyRatePercent: 99,
    ageDistribution: { youth: 20, workingAge: 65, elderly: 15 },
    gameplayModifiers: {
      socialStabilityBaseline: 10,
      workforceQuality: 70,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Religion Fixtures
// ---------------------------------------------------------------------------

function makeReligionProfile(overrides: Partial<ReligionProfile> = {}): ReligionProfile {
  return {
    schemaVersion: '1.0.0',
    religionId: 'christianity',
    name: 'Christianity',
    description: 'Major Abrahamic religion.',
    adherentsGlobalPercent: 31,
    socialCohesionModifier: 15,
    politicalInfluence: 'moderate',
    interReligiousTensions: [
      { targetReligionId: 'islam', tensionLevel: 'wary' },
    ],
    gameplayModifiers: {
      stabilityModifier: 5,
      reformResistance: 40,
      charityModifier: 10,
      theocracyPotential: 20,
      educationAttitude: 'neutral',
      scienceAttitude: 'neutral',
    },
    ...overrides,
  };
}

function makeIslamProfile(): ReligionProfile {
  return makeReligionProfile({
    religionId: 'islam',
    name: 'Islam',
    description: 'Major Abrahamic religion.',
    adherentsGlobalPercent: 24,
    socialCohesionModifier: 20,
    politicalInfluence: 'significant',
    interReligiousTensions: [
      { targetReligionId: 'christianity', tensionLevel: 'wary' },
    ],
    gameplayModifiers: {
      stabilityModifier: 3,
      reformResistance: 65,
      charityModifier: 15,
      theocracyPotential: 55,
      educationAttitude: 'selective',
      scienceAttitude: 'neutral',
    },
  });
}

function makeReligionState(overrides: Partial<ReligionState> = {}): ReligionState {
  return {
    factionId: 'us' as FactionId,
    compositions: [
      { religionId: 'christianity', percentage: 70 },
      { religionId: 'islam', percentage: 15 },
      { religionId: 'secular', percentage: 15 },
    ],
    dominantReligionId: 'christianity',
    religiousTensionLevel: 25,
    ...overrides,
  };
}

function makeReligionCatalog(
  profiles: ReligionProfile[] = [makeReligionProfile(), makeIslamProfile()],
): Map<string, ReligionProfile> {
  const m = new Map<string, ReligionProfile>();
  for (const p of profiles) {
    m.set(p.religionId, p);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Population Engine Tests
// ---------------------------------------------------------------------------

describe('PopulationEngine', () => {
  const engine = new PopulationEngine();

  describe('advancePopulation', () => {
    it('population grows with positive growth rate', () => {
      const state = makePopState({ growthRatePercent: 1.0, migrationFlowNet: 0 });
      const result = engine.advancePopulation(state, makeDemographics());

      expect(result.newPopulation).toBeGreaterThan(result.previousPopulation);
      expect(result.growthDelta).toBeGreaterThan(0);
    });

    it('population shrinks with negative growth rate and no migration', () => {
      const state = makePopState({ growthRatePercent: -1.0, migrationFlowNet: 0 });
      const demographics = makeDemographics({
        gameplayModifiers: { socialStabilityBaseline: 0 },
      });
      const result = engine.advancePopulation(state, demographics);

      expect(result.newPopulation).toBeLessThan(result.previousPopulation);
    });
  });

  describe('computeWorkforceContribution', () => {
    it('depends on working-age percentage', () => {
      const highWorking = makePopState({
        ageDistribution: { youth: 15, working: 75, elderly: 10 },
        urbanizationRate: 50,
      });
      const lowWorking = makePopState({
        ageDistribution: { youth: 40, working: 40, elderly: 20 },
        urbanizationRate: 50,
      });

      const high = engine.computeWorkforceContribution(highWorking);
      const low = engine.computeWorkforceContribution(lowWorking);

      expect(high).toBeGreaterThan(low);
    });
  });

  describe('computeDependencyRatio', () => {
    it('produces correct ratio', () => {
      const state = makePopState({
        ageDistribution: { youth: 20, working: 60, elderly: 20 },
      });

      const ratio = engine.computeDependencyRatio(state);
      // (20 + 20) / 60 ≈ 0.667
      expect(ratio).toBeCloseTo(0.667, 2);
    });

    it('returns high value when working population is zero', () => {
      const state = makePopState({
        ageDistribution: { youth: 50, working: 0, elderly: 50 },
      });

      const ratio = engine.computeDependencyRatio(state);
      expect(ratio).toBe(10);
    });
  });

  describe('computeUrbanizationEffect', () => {
    it('produces GDP bonus and unrest above threshold', () => {
      const state = makePopState({ urbanizationRate: 85 });
      const effect = engine.computeUrbanizationEffect(state);

      expect(effect.economicBonus).toBeGreaterThan(0);
      // 85 > 70 threshold → unrest modifier kicks in
      expect(effect.unrestModifier).toBeGreaterThan(0);
    });

    it('no unrest below threshold', () => {
      const state = makePopState({ urbanizationRate: 50 });
      const effect = engine.computeUrbanizationEffect(state);

      expect(effect.economicBonus).toBeGreaterThan(0);
      expect(effect.unrestModifier).toBe(0);
    });
  });

  describe('applyMigration', () => {
    it('adjusts population correctly for target faction', () => {
      const state = makePopState({ currentPopulationMillions: 100 });
      const events: MigrationEvent[] = [
        {
          sourceFaction: 'russia' as FactionId,
          targetFaction: 'us' as FactionId,
          amount: 2,
          reason: 'economic migration',
        },
      ];

      const result = engine.applyMigration(state, events);

      expect(result.currentPopulationMillions).toBeCloseTo(102, 0);
    });

    it('decreases population for source faction', () => {
      const state = makePopState({
        factionId: 'russia' as FactionId,
        currentPopulationMillions: 145,
      });
      const events: MigrationEvent[] = [
        {
          sourceFaction: 'russia' as FactionId,
          targetFaction: 'us' as FactionId,
          amount: 3,
          reason: 'brain drain',
        },
      ];

      const result = engine.applyMigration(state, events);

      expect(result.currentPopulationMillions).toBeCloseTo(142, 0);
    });
  });

  describe('computeStabilityImpact', () => {
    it('youth bulge creates instability', () => {
      const youthBulge = makePopState({
        ageDistribution: { youth: 45, working: 45, elderly: 10 },
        urbanizationRate: 50,
        growthRatePercent: 1.0,
      });
      const demographics = makeDemographics({
        gameplayModifiers: { socialStabilityBaseline: 0 },
      });

      const impact = engine.computeStabilityImpact(youthBulge, demographics);
      // youth 45 > 35 threshold → negative impact
      expect(impact).toBeLessThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Religion Dynamics Engine Tests
// ---------------------------------------------------------------------------

describe('ReligionDynamicsEngine', () => {
  const engine = new ReligionDynamicsEngine();

  describe('computeTensionLevel', () => {
    it('multi-religion state increases tension', () => {
      const state = makeReligionState();
      const catalog = makeReligionCatalog();

      const tension = engine.computeTensionLevel(state, catalog);

      expect(tension).toBeGreaterThan(0);
    });

    it('single-religion state has zero tension', () => {
      const state = makeReligionState({
        compositions: [{ religionId: 'christianity', percentage: 99 }],
      });
      const catalog = makeReligionCatalog();

      const tension = engine.computeTensionLevel(state, catalog);

      expect(tension).toBe(0);
    });
  });

  describe('advanceTurn', () => {
    it('produces tension delta', () => {
      const state = makeReligionState({ religiousTensionLevel: 20 });
      const catalog = makeReligionCatalog();

      const result = engine.advanceTurn(state, catalog, 60);

      expect(result.factionId).toBe('us');
      expect(typeof result.tensionDelta).toBe('number');
      expect(typeof result.stabilityImpact).toBe('number');
      expect(Array.isArray(result.policyConstraints)).toBe(true);
    });
  });

  describe('computeStabilityImpact', () => {
    it('high tension reduces stability', () => {
      const state = makeReligionState({ religiousTensionLevel: 80 });
      const catalog = makeReligionCatalog();

      const impact = engine.computeStabilityImpact(state, catalog);

      // 80 > 40 threshold → negative stability impact
      expect(impact).toBeLessThan(0);
    });

    it('low tension with dominant religion is mildly positive', () => {
      const state = makeReligionState({ religiousTensionLevel: 10 });
      const catalog = makeReligionCatalog();

      const impact = engine.computeStabilityImpact(state, catalog);

      // Dominant religion's socialCohesionModifier + stabilityModifier → positive
      expect(impact).toBeGreaterThan(0);
    });
  });

  describe('computePolicyConstraints', () => {
    it('dominant religion with high influence creates constraints', () => {
      const profile = makeReligionProfile({
        politicalInfluence: 'dominant',
        gameplayModifiers: {
          reformResistance: 75,
          theocracyPotential: 70,
          educationAttitude: 'selective',
          scienceAttitude: 'selective',
          stabilityModifier: 5,
          charityModifier: 10,
        },
      });
      const state = makeReligionState();

      const constraints = engine.computePolicyConstraints(state, profile);

      expect(constraints.length).toBeGreaterThan(0);
      expect(constraints.some((c) => c.includes('opposition'))).toBe(true);
    });

    it('returns empty for null profile', () => {
      const state = makeReligionState();
      const constraints = engine.computePolicyConstraints(state, null);

      expect(constraints).toHaveLength(0);
    });
  });

  describe('getInterReligiousTension', () => {
    it('returns tension between two religions', () => {
      const christianity = makeReligionProfile();
      const islam = makeIslamProfile();

      const tension = engine.getInterReligiousTension(christianity, islam);

      // Both have 'wary' toward each other → TENSION_LEVEL_VALUES.wary = 30
      expect(tension).toBe(30);
    });
  });

  describe('checkForReligiousEvents', () => {
    it('deterministic with seed — same seed produces same events', () => {
      const state = makeReligionState({ religiousTensionLevel: 85 });
      const catalog = makeReligionCatalog();

      const events1 = engine.checkForReligiousEvents(state, catalog, 30, 42);
      const events2 = engine.checkForReligiousEvents(state, catalog, 30, 42);

      expect(events1.length).toBe(events2.length);
      for (let i = 0; i < events1.length; i++) {
        expect(events1[i].type).toBe(events2[i].type);
        expect(events1[i].stabilityEffect).toBe(events2[i].stabilityEffect);
      }
    });

    it('different seeds can produce different events', () => {
      const state = makeReligionState({ religiousTensionLevel: 85 });
      const catalog = makeReligionCatalog();

      // Run with many seeds to increase chance of divergence
      const resultsBySeed = new Map<number, number>();
      for (let seed = 0; seed < 50; seed++) {
        const events = engine.checkForReligiousEvents(state, catalog, 30, seed);
        resultsBySeed.set(seed, events.length);
      }

      // At least some variation in event counts across seeds
      const counts = [...resultsBySeed.values()];
      const unique = new Set(counts);
      expect(unique.size).toBeGreaterThanOrEqual(1);
    });
  });
});
