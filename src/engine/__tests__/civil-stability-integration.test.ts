import { describe, it, expect } from 'vitest';
import { CivilStabilityIntegration } from '@/engine/civil-stability-integration';
import type {
  StabilityTurnInput,
  CompositeStabilityAssessment,
} from '@/engine/civil-stability-integration';
import type { NationState } from '@/data/types';
import type { PopulationDemographics, ReligionProfile } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseNation: NationState = {
  factionId: 'us',
  stability: 75,
  treasury: 500,
  gdp: 2000,
  inflation: 3,
  militaryReadiness: 80,
  nuclearThreshold: 30,
  diplomaticInfluence: 70,
  popularity: 65,
  allianceCredibility: 80,
  techLevel: 60,
};

const usaPop: PopulationDemographics = {
  schemaVersion: '1.0.0',
  nationId: 'usa',
  populationMillions: 334,
  growthRatePercent: 0.5,
  urbanizationPercent: 83,
  medianAge: 38,
  lifeExpectancy: 77,
  literacyRatePercent: 99,
  ageDistribution: { youth: 18, workingAge: 65, elderly: 17 },
  socialIndicators: {
    giniCoefficient: 0.39,
    unemploymentRatePercent: 3.7,
  },
  gameplayModifiers: {
    workforceQuality: 75,
  },
};

const youthBulgePop: PopulationDemographics = {
  schemaVersion: '1.0.0',
  nationId: 'test',
  populationMillions: 100,
  growthRatePercent: 2.5,
  urbanizationPercent: 45,
  medianAge: 20,
  lifeExpectancy: 60,
  literacyRatePercent: 70,
  ageDistribution: { youth: 45, workingAge: 48, elderly: 7 },
  socialIndicators: {
    giniCoefficient: 0.55,
    unemploymentRatePercent: 22,
  },
};

const christianityProfile: ReligionProfile = {
  schemaVersion: '1.0.0',
  religionId: 'christianity-catholic',
  name: 'Catholic Christianity',
  description: 'test',
  adherentsGlobalPercent: 16,
  socialCohesionModifier: 3,
  politicalInfluence: 'moderate',
  gameplayModifiers: {
    reformResistance: 40,
    theocracyPotential: 15,
  },
};

const islamProfile: ReligionProfile = {
  schemaVersion: '1.0.0',
  religionId: 'islam-sunni',
  name: 'Sunni Islam',
  description: 'test',
  adherentsGlobalPercent: 25,
  socialCohesionModifier: 4,
  politicalInfluence: 'significant',
  interReligiousTensions: [
    {
      targetReligionId: 'christianity-catholic',
      tensionLevel: 'wary',
    },
  ],
  gameplayModifiers: {
    reformResistance: 65,
    theocracyPotential: 60,
  },
};

const engine = new CivilStabilityIntegration();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CivilStabilityIntegration', () => {
  // ── computeCompositeAssessment ──────────────────────────────────────

  it('returns valid composite structure', () => {
    const input: StabilityTurnInput = {
      factionId: 'us',
      nation: baseNation,
      population: usaPop,
      religions: [christianityProfile],
      religiousComposition: { 'christianity-catholic': 70 },
    };

    const result = engine.computeCompositeAssessment(input);

    expect(result.factionId).toBe('us');
    expect(result.populationFactors).toBeDefined();
    expect(result.religionFactors).toBeDefined();
    expect(result.economicFactors).toBeDefined();
    expect(typeof result.compositeModifier).toBe('number');
    expect(result.compositeModifier).toBeGreaterThanOrEqual(-50);
    expect(result.compositeModifier).toBeLessThanOrEqual(30);
    expect(['low', 'moderate', 'high', 'critical']).toContain(result.riskLevel);
    expect(typeof result.summary).toBe('string');
    expect(result.weights).toBeDefined();
  });

  // ── computePopulationStabilityFactors ───────────────────────────────

  it('detects youth bulge', () => {
    const factors = engine.computePopulationStabilityFactors(
      'iran',
      youthBulgePop,
      { ...baseNation, factionId: 'iran' } as NationState,
    );

    // youth 45% > 30 AND unemployment 22 > 15 → high youth bulge pressure
    expect(factors.youthBulgePressure).toBeGreaterThan(0);
    expect(factors.factionId).toBe('iran');
  });

  it('handles normal demographics without extreme pressure', () => {
    const factors = engine.computePopulationStabilityFactors(
      'us',
      usaPop,
      baseNation,
    );

    // youth 18% < 30, unemployment 3.7% < 15 → no youth bulge pressure
    expect(factors.youthBulgePressure).toBe(0);
    expect(factors.urbanizationStress).toBeGreaterThanOrEqual(0);
    expect(factors.dependencyBurden).toBeGreaterThanOrEqual(0);
  });

  // ── computeReligionStabilityFactors ─────────────────────────────────

  it('handles single religion (no inter-religious tension)', () => {
    const factors = engine.computeReligionStabilityFactors(
      'us',
      [christianityProfile],
      { 'christianity-catholic': 80 },
    );

    expect(factors.factionId).toBe('us');
    expect(factors.interReligiousTension).toBe(0);
    expect(factors.socialCohesion).toBeGreaterThanOrEqual(0);
    expect(factors.socialCohesion).toBeLessThanOrEqual(100);
  });

  it('handles multi-religion tension', () => {
    const factors = engine.computeReligionStabilityFactors(
      'syria',
      [christianityProfile, islamProfile],
      { 'christianity-catholic': 30, 'islam-sunni': 60 },
    );

    expect(factors.factionId).toBe('syria');
    // There IS an inter-religious tension entry (wary level)
    expect(factors.interReligiousTension).toBeGreaterThan(0);
    expect(factors.theocraticPressure).toBeGreaterThan(0);
  });

  // ── computeEconomicStabilityFactors ─────────────────────────────────

  it('responds to high inflation', () => {
    const highInflationNation = { ...baseNation, inflation: 40 } as NationState;
    const factors = engine.computeEconomicStabilityFactors(
      'us',
      highInflationNation,
      usaPop,
    );

    // inflation 40 > 30 → high inflation stress
    expect(factors.inflationStress).toBeGreaterThan(50);
  });

  it('responds to good economy', () => {
    const factors = engine.computeEconomicStabilityFactors(
      'us',
      baseNation,
      usaPop,
    );

    // inflation 3 < 10 → no inflation stress
    expect(factors.inflationStress).toBe(0);
    // unemployment 3.7 → good employment health
    expect(factors.employmentHealth).toBeGreaterThan(80);
  });

  // ── applyStabilityModifier ──────────────────────────────────────────

  it('clamps stability to 0-100', () => {
    const highStabilityNation = { ...baseNation, stability: 98 } as NationState;
    const positiveAssessment = {
      compositeModifier: 10,
    } as CompositeStabilityAssessment;

    const result = engine.applyStabilityModifier(highStabilityNation, positiveAssessment);
    expect(result.stability).toBeLessThanOrEqual(100);
    expect(result.stability).toBeGreaterThanOrEqual(0);

    const lowStabilityNation = { ...baseNation, stability: 2 } as NationState;
    const negativeAssessment = {
      compositeModifier: -20,
    } as CompositeStabilityAssessment;

    const result2 = engine.applyStabilityModifier(lowStabilityNation, negativeAssessment);
    expect(result2.stability).toBe(0);
  });

  // ── classifyRiskLevel ───────────────────────────────────────────────

  it('returns correct risk levels', () => {
    expect(engine.classifyRiskLevel(10)).toBe('low');
    expect(engine.classifyRiskLevel(0)).toBe('moderate');
    expect(engine.classifyRiskLevel(-10)).toBe('high');
    expect(engine.classifyRiskLevel(-25)).toBe('critical');
  });

  // ── Composite weights ──────────────────────────────────────────────

  it('weights sum to approximately 1.0', () => {
    const input: StabilityTurnInput = {
      factionId: 'us',
      nation: baseNation,
      population: usaPop,
      religions: [christianityProfile],
      religiousComposition: { 'christianity-catholic': 70 },
    };

    const result = engine.computeCompositeAssessment(input);
    const weightSum =
      result.weights.population +
      result.weights.religion +
      result.weights.economic;

    expect(weightSum).toBeCloseTo(1.0, 5);
  });
});
