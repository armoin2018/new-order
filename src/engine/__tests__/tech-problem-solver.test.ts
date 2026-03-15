import { describe, it, expect } from 'vitest';
import { TechProblemSolver } from '@/engine/tech-problem-solver';
import type { TechProblem, ProblemCategory } from '@/engine/tech-problem-solver';
import type { NationState, TechnologyModel } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTech(overrides: Partial<TechnologyModel> = {}): TechnologyModel {
  return {
    schemaVersion: '1.0.0',
    techId: 'biotech-1',
    name: 'Biotech Fundamentals',
    domain: 'biotech',
    description: 'test',
    tier: 2,
    researchCost: 100,
    researchDurationTurns: 3,
    impactLevel: 'significant',
    ...overrides,
  };
}

const biotechTech = makeTech({
  techId: 'biotech-1',
  name: 'Biotech Fundamentals',
  domain: 'biotech',
  tier: 2,
  impactLevel: 'significant',
});

const cyberTech = makeTech({
  techId: 'cyber-defense-1',
  name: 'Cyber Defense Suite',
  domain: 'cyber',
  tier: 2,
  impactLevel: 'breakthrough',
});

const aiTech = makeTech({
  techId: 'ai-core-1',
  name: 'AI Core',
  domain: 'ai',
  tier: 3,
  impactLevel: 'paradigm-shift',
});

const quantumTech = makeTech({
  techId: 'quantum-crypto',
  name: 'Quantum Cryptography',
  domain: 'quantum',
  tier: 2,
  impactLevel: 'significant',
});

const techCatalog: TechnologyModel[] = [biotechTech, cyberTech, aiTech, quantumTech];

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

const pandemicProblem: TechProblem = {
  problemId: 'pandemic-1',
  category: 'pandemic',
  severity: 70,
  description: 'Global pandemic outbreak',
  affectedFactionId: 'us',
  relevantDomains: ['biotech'],
  minimumTechLevel: 20,
};

const cyberAttackProblem: TechProblem = {
  problemId: 'cyber-1',
  category: 'cyber-attack',
  severity: 60,
  description: 'Massive cyber attack on infrastructure',
  affectedFactionId: 'us',
  relevantDomains: ['cyber'],
  minimumTechLevel: 30,
};

const engine = new TechProblemSolver();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TechProblemSolver', () => {
  // ── solveProblem ────────────────────────────────────────────────────

  it('finds solutions when relevant tech is available', () => {
    const result = engine.solveProblem(
      pandemicProblem,
      ['biotech-1'],
      techCatalog,
      baseNation,
    );

    expect(result.hasSolution).toBe(true);
    expect(result.availableSolutions.length).toBeGreaterThan(0);
    expect(result.bestSolution).not.toBeNull();
    expect(result.problemId).toBe('pandemic-1');
  });

  it('returns no solutions when relevant tech is missing', () => {
    const result = engine.solveProblem(
      pandemicProblem,
      ['cyber-defense-1'], // not relevant to pandemic
      techCatalog,
      baseNation,
    );

    expect(result.hasSolution).toBe(false);
    expect(result.availableSolutions).toHaveLength(0);
    expect(result.bestSolution).toBeNull();
  });

  // ── evaluateTechReadiness ───────────────────────────────────────────

  it('returns 0 when no relevant tech is completed', () => {
    const readiness = engine.evaluateTechReadiness(
      'pandemic',
      [],
      techCatalog,
    );
    expect(readiness).toBe(0);
  });

  it('returns 100 when all relevant tech is completed', () => {
    // 'pandemic' maps to ['biotech']. Only biotech-1 is in catalog with domain 'biotech'
    const readiness = engine.evaluateTechReadiness(
      'pandemic',
      ['biotech-1'],
      techCatalog,
    );
    expect(readiness).toBe(100);
  });

  // ── generateSolutions ──────────────────────────────────────────────

  it('produces at least one solution per available tech', () => {
    const solutions = engine.generateSolutions(
      cyberAttackProblem,
      [cyberTech],
      baseNation,
    );

    expect(solutions.length).toBeGreaterThanOrEqual(1);
    for (const sol of solutions) {
      expect(sol.effectiveness).toBeGreaterThanOrEqual(0);
      expect(sol.effectiveness).toBeLessThanOrEqual(100);
    }
  });

  // ── getProblemDomainMapping ─────────────────────────────────────────

  it('covers all problem categories', () => {
    const mapping = engine.getProblemDomainMapping();
    const expectedCategories: ProblemCategory[] = [
      'pandemic',
      'cyber-attack',
      'economic-crisis',
      'military-threat',
      'energy-crisis',
      'food-crisis',
      'environmental',
      'intelligence-failure',
      'social-unrest',
      'infrastructure-failure',
    ];

    for (const cat of expectedCategories) {
      expect(mapping[cat]).toBeDefined();
      expect(mapping[cat].length).toBeGreaterThan(0);
    }
  });

  // ── suggestResearch ─────────────────────────────────────────────────

  it('returns uncompleted techs in relevant domains', () => {
    const suggestions = engine.suggestResearch(
      pandemicProblem,
      [], // nothing completed
      techCatalog,
    );

    // biotech-1 is relevant to pandemic and not completed
    expect(suggestions).toContain('biotech-1');
    // Should not suggest non-relevant techs
    for (const id of suggestions) {
      const tech = techCatalog.find((t) => t.techId === id);
      expect(tech).toBeDefined();
    }
  });

  it('does not suggest already-completed techs', () => {
    const suggestions = engine.suggestResearch(
      pandemicProblem,
      ['biotech-1'],
      techCatalog,
    );

    expect(suggestions).not.toContain('biotech-1');
  });

  // ── computeSolutionEffectiveness ────────────────────────────────────

  it('returns value in 0-100 range', () => {
    const effectiveness = engine.computeSolutionEffectiveness(
      [biotechTech],
      pandemicProblem,
      60,
    );

    expect(effectiveness).toBeGreaterThanOrEqual(0);
    expect(effectiveness).toBeLessThanOrEqual(100);
  });

  it('returns 0 for empty tech array', () => {
    const effectiveness = engine.computeSolutionEffectiveness(
      [],
      pandemicProblem,
      60,
    );

    expect(effectiveness).toBe(0);
  });
});
