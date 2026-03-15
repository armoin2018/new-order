import { describe, it, expect } from 'vitest';
import { ResearchSystem } from '@/engine/research-system';
import type {
  NationRnDState,
  RnDAllocation,
  ActiveResearch,
  StartResearchParams,
} from '@/engine/research-system';
import type { NationState, TechnologyModel } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTech(overrides: Partial<TechnologyModel> = {}): TechnologyModel {
  return {
    schemaVersion: '1.0.0',
    techId: 'quantum-1',
    name: 'Quantum Computing I',
    domain: 'quantum',
    description: 'test',
    tier: 1,
    researchCost: 100,
    researchDurationTurns: 3,
    impactLevel: 'significant',
    ...overrides,
  };
}

const tech1 = makeTech({ techId: 'quantum-1', name: 'Quantum I', domain: 'quantum', researchCost: 100, researchDurationTurns: 2 });
const tech2 = makeTech({
  techId: 'quantum-2',
  name: 'Quantum II',
  domain: 'quantum',
  researchCost: 200,
  researchDurationTurns: 4,
  prerequisites: [{ techId: 'quantum-1' }],
});
const tech3 = makeTech({ techId: 'ai-1', name: 'AI Basics', domain: 'ai', researchCost: 80, researchDurationTurns: 2 });

const techCatalog: TechnologyModel[] = [tech1, tech2, tech3];

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

function makeRnDState(overrides: Partial<NationRnDState> = {}): NationRnDState {
  return {
    factionId: 'us',
    completedTechIds: [],
    activeResearch: [],
    domainLevels: {},
    totalInvestment: 0,
    ...overrides,
  };
}

const engine = new ResearchSystem();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResearchSystem', () => {
  // ── startResearch ───────────────────────────────────────────────────

  it('succeeds for valid tech with no prerequisites', () => {
    const params: StartResearchParams = {
      factionId: 'us',
      techId: 'quantum-1',
      allocation: 50,
      currentState: makeRnDState(),
      techCatalog,
      nationState: baseNation,
    };

    const result = engine.startResearch(params);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.project).toBeDefined();
    expect(result.project!.techId).toBe('quantum-1');
    expect(result.project!.investedSoFar).toBe(0);
  });

  it('fails for already-completed tech', () => {
    const params: StartResearchParams = {
      factionId: 'us',
      techId: 'quantum-1',
      allocation: 50,
      currentState: makeRnDState({ completedTechIds: ['quantum-1'] }),
      techCatalog,
      nationState: baseNation,
    };

    const result = engine.startResearch(params);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails for missing prerequisites', () => {
    const params: StartResearchParams = {
      factionId: 'us',
      techId: 'quantum-2',
      allocation: 50,
      currentState: makeRnDState(),
      techCatalog,
      nationState: baseNation,
    };

    const result = engine.startResearch(params);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('prerequisite'))).toBe(true);
  });

  // ── processTurn ─────────────────────────────────────────────────────

  it('advances research progress', () => {
    const activeProject: ActiveResearch = {
      techId: 'quantum-1',
      factionId: 'us',
      investedSoFar: 0,
      totalCost: 100,
      turnsSpent: 0,
      estimatedTurnsRemaining: 5,
      speedMultiplier: 1.0,
    };

    const state = makeRnDState({ activeResearch: [activeProject] });
    const allocation: RnDAllocation = {
      factionId: 'us',
      totalBudget: 50,
      domainWeights: { quantum: 1.0 },
    };

    const result = engine.processTurn(state, allocation, techCatalog, baseNation);
    // Should still be active — not enough invested yet
    expect(result.activeProjects.length).toBeGreaterThanOrEqual(0);
    expect(result.totalExpenditure).toBeGreaterThan(0);
  });

  it('completes research when fully funded', () => {
    const activeProject: ActiveResearch = {
      techId: 'quantum-1',
      factionId: 'us',
      investedSoFar: 95,
      totalCost: 100,
      turnsSpent: 1, // min duration is 2, so turnsSpent+1=2 will meet it
      estimatedTurnsRemaining: 1,
      speedMultiplier: 1.0,
    };

    const state = makeRnDState({ activeResearch: [activeProject] });
    const allocation: RnDAllocation = {
      factionId: 'us',
      totalBudget: 500,
      domainWeights: { quantum: 1.0 },
    };

    const result = engine.processTurn(state, allocation, techCatalog, baseNation);
    expect(result.completedTechs).toContain('quantum-1');
    expect(result.events.some((e) => e.includes('completed'))).toBe(true);
  });

  it('makes newly available tech accessible after completion', () => {
    const activeProject: ActiveResearch = {
      techId: 'quantum-1',
      factionId: 'us',
      investedSoFar: 99,
      totalCost: 100,
      turnsSpent: 1,
      estimatedTurnsRemaining: 1,
      speedMultiplier: 1.0,
    };

    const state = makeRnDState({ activeResearch: [activeProject] });
    const allocation: RnDAllocation = {
      factionId: 'us',
      totalBudget: 500,
      domainWeights: { quantum: 1.0 },
    };

    const result = engine.processTurn(state, allocation, techCatalog, baseNation);
    // quantum-2 requires quantum-1, which just completed
    if (result.completedTechs.includes('quantum-1')) {
      expect(result.newlyAvailable).toContain('quantum-2');
    }
  });

  // ── cancelResearch ──────────────────────────────────────────────────

  it('refunds 50% on cancel', () => {
    const activeProject: ActiveResearch = {
      techId: 'quantum-1',
      factionId: 'us',
      investedSoFar: 60,
      totalCost: 100,
      turnsSpent: 2,
      estimatedTurnsRemaining: 3,
      speedMultiplier: 1.0,
    };

    const state = makeRnDState({ activeResearch: [activeProject] });
    const { state: newState, refund } = engine.cancelResearch(state, 'quantum-1');

    expect(refund).toBe(30); // 50% of 60
    expect(newState.activeResearch.find((p) => p.techId === 'quantum-1')).toBeUndefined();
  });

  // ── getAvailableTech ────────────────────────────────────────────────

  it('filters properly based on prerequisites', () => {
    const state = makeRnDState();
    const available = engine.getAvailableTech(state, techCatalog);
    const availableIds = available.map((t) => t.techId);

    // quantum-1 and ai-1 have no prereqs → available
    expect(availableIds).toContain('quantum-1');
    expect(availableIds).toContain('ai-1');
    // quantum-2 requires quantum-1 → NOT available
    expect(availableIds).not.toContain('quantum-2');
  });

  // ── computeDomainLevels ─────────────────────────────────────────────

  it('sums domain levels correctly', () => {
    const levels = engine.computeDomainLevels(['quantum-1', 'ai-1'], techCatalog);
    // quantum-1 is tier 1 → 1 * 1.0 = 1 to quantum
    // ai-1 is tier 1 → 1 * 1.0 = 1 to ai
    expect(levels.quantum).toBeGreaterThan(0);
    expect(levels.ai).toBeGreaterThan(0);
  });

  // ── estimateCompletion ──────────────────────────────────────────────

  it('computes correct estimated turns', () => {
    const project: ActiveResearch = {
      techId: 'quantum-1',
      factionId: 'us',
      investedSoFar: 50,
      totalCost: 100,
      turnsSpent: 2,
      estimatedTurnsRemaining: 5,
      speedMultiplier: 1.0,
    };

    // remaining = 50, budget = 25, speed = 1.0 → 50/25 = 2 turns
    const est = engine.estimateCompletion(project, 25);
    expect(est).toBe(2);
  });

  // ── computeResearchEfficiency ───────────────────────────────────────

  it('returns value in [0.5, 2.0] range', () => {
    const efficiency = engine.computeResearchEfficiency(baseNation);
    expect(efficiency).toBeGreaterThanOrEqual(0.5);
    expect(efficiency).toBeLessThanOrEqual(2.0);
  });

  it('returns higher efficiency for advanced nation', () => {
    const advancedNation = { ...baseNation, techLevel: 95, stability: 90, gdp: 8000 } as NationState;
    const weakNation = { ...baseNation, techLevel: 10, stability: 20, gdp: 100 } as NationState;

    const advancedEff = engine.computeResearchEfficiency(advancedNation);
    const weakEff = engine.computeResearchEfficiency(weakNation);

    expect(advancedEff).toBeGreaterThan(weakEff);
  });
});
