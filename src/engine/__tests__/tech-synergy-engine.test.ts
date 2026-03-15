import { describe, it, expect } from 'vitest';
import { TechSynergyEngine } from '@/engine/tech-synergy-engine';
import type { ResearchProject } from '@/engine/tech-synergy-engine';
import type { FactionId, TechnologyModel } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTech(overrides: Partial<TechnologyModel> = {}): TechnologyModel {
  return {
    schemaVersion: '1.0.0',
    techId: 'quantum-computing-1',
    name: 'Quantum Computing I',
    domain: 'quantum',
    description: 'Foundational quantum computing research.',
    tier: 2,
    researchCost: 150,
    researchDurationTurns: 8,
    impactLevel: 'significant',
    effects: {
      domainBoosts: { quantum: 10, cyber: 5 },
      economicModifiers: { gdpGrowthBonus: 2 },
      militaryModifiers: { defenseBonus: 3 },
    },
    ...overrides,
  };
}

function makePartnerTech(): TechnologyModel {
  return makeTech({
    techId: 'ai-deep-learning',
    name: 'AI Deep Learning',
    domain: 'ai',
    secondaryDomains: ['quantum', 'cyber'],
    tier: 3,
    researchCost: 200,
    effects: {
      domainBoosts: { ai: 15, quantum: 5 },
      economicModifiers: { gdpGrowthBonus: 3, tradeEfficiencyBonus: 1 },
      militaryModifiers: { attackBonus: 5, defenseBonus: 2 },
    },
    combinationBonuses: [
      {
        partnerTechId: 'quantum-computing-1',
        bonusDescription: 'Quantum-enhanced AI enables unprecedented compute.',
        bonusMultiplier: 1.5,
      },
    ],
    knowledgeTransfer: { espionageValue: 40 },
  });
}

function makeCatalog(techs: TechnologyModel[]): Map<string, TechnologyModel> {
  const catalog = new Map<string, TechnologyModel>();
  for (const tech of techs) {
    catalog.set(tech.techId, tech);
  }
  return catalog;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TechSynergyEngine', () => {
  const engine = new TechSynergyEngine();

  // ── discoverSynergies ─────────────────────────────────────────────────

  describe('discoverSynergies', () => {
    it('finds synergies when both techs are researched', () => {
      const qc = makeTech();
      const ai = makePartnerTech();
      const catalog = makeCatalog([qc, ai]);

      const synergies = engine.discoverSynergies(
        ['quantum-computing-1', 'ai-deep-learning'],
        catalog,
      );

      expect(synergies.length).toBe(1);
      expect(synergies[0].sourceTechId).toBe('ai-deep-learning');
      expect(synergies[0].partnerTechId).toBe('quantum-computing-1');
      expect(synergies[0].bonusName).toContain('AI Deep Learning');
    });

    it('returns empty when prerequisites not met', () => {
      const ai = makePartnerTech();
      const catalog = makeCatalog([ai]);

      // Only ai researched, partner quantum-computing-1 not in researched list
      const synergies = engine.discoverSynergies(
        ['ai-deep-learning'],
        catalog,
      );

      expect(synergies).toHaveLength(0);
    });
  });

  // ── computeKnowledgeTransfer ──────────────────────────────────────────

  describe('computeKnowledgeTransfer', () => {
    it('produces spillover from secondary domains', () => {
      const ai = makePartnerTech();
      const transfers = engine.computeKnowledgeTransfer([ai]);

      // ai has secondaryDomains: ['quantum', 'cyber'], primary: 'ai'
      expect(transfers.length).toBeGreaterThan(0);
      expect(transfers.some((t) => t.targetDomain === 'quantum')).toBe(true);
      expect(transfers.some((t) => t.targetDomain === 'cyber')).toBe(true);
      // All have non-zero boost
      for (const t of transfers) {
        expect(t.effectiveBoost).toBeGreaterThan(0);
        expect(t.transferRate).toBeGreaterThan(0);
      }
    });
  });

  // ── aggregateEffects ──────────────────────────────────────────────────

  describe('aggregateEffects', () => {
    it('combines tech + synergy effects', () => {
      const qc = makeTech();
      const ai = makePartnerTech();
      const catalog = makeCatalog([qc, ai]);
      const synergies = engine.discoverSynergies(
        ['quantum-computing-1', 'ai-deep-learning'],
        catalog,
      );

      const effects = engine.aggregateEffects([qc, ai], synergies);

      // Both techs contribute to domain:quantum
      expect(effects['domain:quantum']).toBeGreaterThan(0);
      // Both techs contribute to economic:gdpGrowth
      expect(effects['economic:gdpGrowth']).toBeGreaterThan(0);
      // Synergy effects should add on top
      expect(effects['military:defense']).toBeGreaterThan(0);
    });
  });

  // ── analyzePortfolio ──────────────────────────────────────────────────

  describe('analyzePortfolio', () => {
    it('produces comprehensive analysis', () => {
      const qc = makeTech();
      const ai = makePartnerTech();
      const catalog = makeCatalog([qc, ai]);

      const analysis = engine.analyzePortfolio(
        'us' as FactionId,
        ['quantum-computing-1', 'ai-deep-learning'],
        catalog,
      );

      expect(analysis.factionId).toBe('us');
      expect(analysis.totalResearchedCount).toBe(2);
      expect(analysis.activeSynergies.length).toBeGreaterThanOrEqual(1);
      expect(analysis.portfolioStrength).toBeGreaterThan(0);
      expect(analysis.portfolioStrength).toBeLessThanOrEqual(100);
      expect(Object.keys(analysis.aggregateEffects).length).toBeGreaterThan(0);
    });
  });

  // ── advanceResearch ───────────────────────────────────────────────────

  describe('advanceResearch', () => {
    const project: ResearchProject = {
      techId: 'quantum-computing-1',
      turnsRemaining: 5,
      investmentPerTurn: 20,
      totalInvested: 60,
    };

    it('reduces turnsRemaining with sufficient budget', () => {
      const result = engine.advanceResearch(project, 50, 60);

      expect(result.turnsRemaining).toBeLessThan(project.turnsRemaining);
      expect(result.techId).toBe('quantum-computing-1');
    });

    it('stalls without sufficient budget', () => {
      const result = engine.advanceResearch(project, 5, 60);

      expect(result.turnsRemaining).toBe(project.turnsRemaining);
      expect(result.completed).toBe(false);
    });
  });

  // ── canResearch ───────────────────────────────────────────────────────

  describe('canResearch', () => {
    it('blocks with missing prereqs', () => {
      const tech = makeTech({
        techId: 'advanced-quantum',
        prerequisites: [{ techId: 'quantum-computing-1' }],
      });
      const catalog = makeCatalog([tech, makeTech()]);

      const result = engine.canResearch('advanced-quantum', [], catalog);

      expect(result.canResearch).toBe(false);
      expect(result.missingPrereqs).toContain('quantum-computing-1');
    });

    it('allows research when all prereqs met', () => {
      const tech = makeTech({
        techId: 'advanced-quantum',
        prerequisites: [{ techId: 'quantum-computing-1' }],
      });
      const catalog = makeCatalog([tech, makeTech()]);

      const result = engine.canResearch(
        'advanced-quantum',
        ['quantum-computing-1'],
        catalog,
      );

      expect(result.canResearch).toBe(true);
      expect(result.missingPrereqs).toHaveLength(0);
    });
  });

  // ── computeResearchCost ───────────────────────────────────────────────

  describe('computeResearchCost', () => {
    it('applies domain discount from existing techs', () => {
      const tech = makeTech({ researchCost: 200 });

      const fullCost = engine.computeResearchCost(tech, 0);
      const discountedCost = engine.computeResearchCost(tech, 5);

      expect(fullCost).toBe(200);
      // 5 × 0.05 = 0.25 → 200 × 0.75 = 150
      expect(discountedCost).toBeCloseTo(150, 2);
    });

    it('caps discount at 40%', () => {
      const tech = makeTech({ researchCost: 200 });

      const maxDiscounted = engine.computeResearchCost(tech, 100);
      // 200 × (1 - 0.40) = 120
      expect(maxDiscounted).toBeCloseTo(120, 2);
    });
  });
});
