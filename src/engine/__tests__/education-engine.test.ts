import { describe, it, expect } from 'vitest';
import { EducationEngine } from '@/engine/education-engine';
import type {
  EducationPortfolio,
  EducationInvestment,
  InvestmentChange,
} from '@/engine/education-engine';
import type { FactionId, EducationType } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEducationType(overrides: Partial<EducationType> = {}): EducationType {
  return {
    schemaVersion: '1.0.0',
    educationId: 'national-stem-initiative',
    name: 'National STEM Initiative',
    category: 'stem',
    description: 'Nationwide push for science, technology, engineering and mathematics.',
    annualCostPerCapita: 120,
    implementationTurns: 6,
    effects: {
      technologyDomainBoosts: { ai: 10, cyber: 5, quantum: 3 },
      workforceQuality: 25,
      innovationRate: 30,
      stabilityModifier: 2,
      militaryReadinessModifier: 0,
    },
    ...overrides,
  };
}

function makeInvestment(overrides: Partial<EducationInvestment> = {}): EducationInvestment {
  return {
    educationId: 'national-stem-initiative',
    annualBudget: 5.0,
    turnsActive: 3,
    effectMultiplier: 0.55,
    ...overrides,
  };
}

function makePortfolio(
  investments: EducationInvestment[] = [makeInvestment()],
  factionId: FactionId = 'us' as FactionId,
): EducationPortfolio {
  const totalBudget = investments.reduce((s, i) => s + i.annualBudget, 0);
  return {
    factionId,
    investments,
    totalBudget,
    literacyRate: 85,
  };
}

function makeCatalog(types: EducationType[]): Map<string, EducationType> {
  const m = new Map<string, EducationType>();
  for (const t of types) {
    m.set(t.educationId, t);
  }
  return m;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EducationEngine', () => {
  const engine = new EducationEngine();

  // ── computeEffects ────────────────────────────────────────────────────

  describe('computeEffects', () => {
    it('produces non-zero effects with active investments', () => {
      const catalog = makeCatalog([makeEducationType()]);
      const portfolio = makePortfolio();

      const effects = engine.computeEffects(portfolio, catalog);

      expect(effects.techResearchSpeedBonus).toBeGreaterThan(0);
      expect(effects.economicGrowthBonus).toBeGreaterThan(0);
      expect(effects.stabilityBonus).toBeGreaterThan(0);
      expect(effects.innovationCapacity).toBeGreaterThan(0);
      expect(Object.keys(effects.techDomainBoosts).length).toBeGreaterThan(0);
    });

    it('returns zero effects with empty portfolio', () => {
      const catalog = makeCatalog([makeEducationType()]);
      const portfolio = makePortfolio([]);

      const effects = engine.computeEffects(portfolio, catalog);

      expect(effects.techResearchSpeedBonus).toBe(0);
      expect(effects.economicGrowthBonus).toBe(0);
      expect(effects.stabilityBonus).toBe(0);
      expect(effects.innovationCapacity).toBe(0);
    });
  });

  // ── investInEducation ─────────────────────────────────────────────────

  describe('investInEducation', () => {
    it('succeeds within budget', () => {
      const portfolio = makePortfolio([]);
      const change: InvestmentChange = {
        educationId: 'national-stem-initiative',
        newBudget: 3.0,
      };

      const result = engine.investInEducation(
        portfolio,
        change,
        10.0,
        makeEducationType(),
      );

      expect(result.success).toBe(true);
      expect(result.newTotalBudget).toBeCloseTo(3.0, 2);
      expect(result.errors).toHaveLength(0);
    });

    it('fails with insufficient treasury', () => {
      const portfolio = makePortfolio([]);
      const change: InvestmentChange = {
        educationId: 'national-stem-initiative',
        newBudget: 20.0,
      };

      const result = engine.investInEducation(
        portfolio,
        change,
        5.0,
        makeEducationType(),
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Insufficient treasury');
    });
  });

  // ── advanceTurn ───────────────────────────────────────────────────────

  describe('advanceTurn', () => {
    it('ramps effect multiplier', () => {
      const investment = makeInvestment({ turnsActive: 2, effectMultiplier: 0.4 });
      const portfolio = makePortfolio([investment]);
      const catalog = makeCatalog([makeEducationType({ implementationTurns: 6 })]);

      const advanced = engine.advanceTurn(portfolio, catalog);

      // turnsActive goes 2 → 3, multiplier should increase
      expect(advanced.investments[0].turnsActive).toBe(3);
      expect(advanced.investments[0].effectMultiplier).toBeGreaterThan(
        investment.effectMultiplier,
      );
    });

    it('prunes zero-budget investments', () => {
      const investment = makeInvestment({ annualBudget: 0 });
      const portfolio = makePortfolio([investment]);
      const catalog = makeCatalog([makeEducationType()]);

      const advanced = engine.advanceTurn(portfolio, catalog);

      expect(advanced.investments).toHaveLength(0);
    });
  });

  // ── computeEffectMultiplier ───────────────────────────────────────────

  describe('computeEffectMultiplier', () => {
    it('returns 0.1 at start (turnsActive = 0)', () => {
      const multiplier = engine.computeEffectMultiplier(0, 10);
      expect(multiplier).toBeCloseTo(0.1, 4);
    });

    it('returns 1.0 after full implementation', () => {
      const multiplier = engine.computeEffectMultiplier(10, 10);
      expect(multiplier).toBeCloseTo(1.0, 4);
    });

    it('returns intermediate value mid-implementation', () => {
      const multiplier = engine.computeEffectMultiplier(5, 10);
      // 0.1 + 0.9 × (5/10) = 0.1 + 0.45 = 0.55
      expect(multiplier).toBeCloseTo(0.55, 4);
    });
  });

  // ── computeLiteracyRate ───────────────────────────────────────────────

  describe('computeLiteracyRate', () => {
    it('non-zero with investments', () => {
      const portfolio = makePortfolio([
        makeInvestment({ annualBudget: 5.0, effectMultiplier: 0.8 }),
      ]);

      const rate = engine.computeLiteracyRate(portfolio, 100);
      expect(rate).toBeGreaterThan(0);
    });

    it('capped at 99', () => {
      const portfolio = makePortfolio([
        makeInvestment({ annualBudget: 5000, effectMultiplier: 1.0 }),
      ]);

      const rate = engine.computeLiteracyRate(portfolio, 1);
      expect(rate).toBeLessThanOrEqual(99);
    });
  });

  // ── getTechDomainBoosts ───────────────────────────────────────────────

  describe('getTechDomainBoosts', () => {
    it('aggregates from education types', () => {
      const catalog = makeCatalog([
        makeEducationType({
          effects: {
            technologyDomainBoosts: { ai: 10, cyber: 5 },
            workforceQuality: 20,
            innovationRate: 25,
          },
        }),
      ]);
      const portfolio = makePortfolio([
        makeInvestment({ effectMultiplier: 1.0 }),
      ]);

      const boosts = engine.getTechDomainBoosts(portfolio, catalog);

      expect(boosts['ai']).toBe(10);
      expect(boosts['cyber']).toBe(5);
    });

    it('scales by effect multiplier', () => {
      const catalog = makeCatalog([
        makeEducationType({
          effects: {
            technologyDomainBoosts: { ai: 10 },
            workforceQuality: 20,
            innovationRate: 25,
          },
        }),
      ]);
      const portfolio = makePortfolio([
        makeInvestment({ effectMultiplier: 0.5 }),
      ]);

      const boosts = engine.getTechDomainBoosts(portfolio, catalog);

      expect(boosts['ai']).toBeCloseTo(5, 2);
    });
  });
});
