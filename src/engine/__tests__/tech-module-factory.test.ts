import { describe, it, expect } from 'vitest';
import { TechModuleFactory } from '@/engine/tech-module-factory';
import type {
  DiscoveryContext,
  ComputedResearchFields,
  GeneratedTechModule,
  TechDiscoveryLogEntry,
} from '@/engine/tech-module-factory';
import type { TechnologyModel, NationState } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTech(overrides: Partial<TechnologyModel> = {}): TechnologyModel {
  return {
    schemaVersion: '1.0.0',
    techId: 'quantum-1',
    name: 'Quantum Computing I',
    domain: 'quantum',
    description: 'First-generation quantum computing technology',
    tier: 1,
    researchCost: 100,
    researchDurationTurns: 3,
    impactLevel: 'significant',
    ...overrides,
  };
}

function makeContext(overrides: Partial<DiscoveryContext> = {}): DiscoveryContext {
  return {
    factionId: 'us',
    turn: 10,
    scenarioId: 'scenario-01',
    nationTechLevels: { quantum: 30 },
    nationDomainLevels: { quantum: 30 },
    gdp: 2000,
    stability: 75,
    researchEfficiency: 0.8,
    ...overrides,
  };
}

function makeComputedFields(overrides: Partial<ComputedResearchFields> = {}): ComputedResearchFields {
  return {
    actualCostPaid: 90,
    effectiveDurationTurns: 3,
    synergyBonusesApplied: ['quantum-synergy'],
    educationBonusPercent: 15,
    efficiencyAtCompletion: 0.85,
    ...overrides,
  };
}

function makeGeneratedModule(overrides: Partial<GeneratedTechModule> = {}): GeneratedTechModule {
  return {
    schemaVersion: '1.0.0',
    techId: 'quantum-1',
    name: 'Quantum Computing I',
    domain: 'quantum',
    description: 'First-generation quantum computing technology',
    tier: 1,
    researchCost: 100,
    researchDurationTurns: 3,
    impactLevel: 'significant',
    generatedBy: 'us',
    generatedOnTurn: 10,
    scenarioId: 'scenario-01',
    computedFields: makeComputedFields(),
    discoveryContext: makeContext(),
    exportable: true,
    ...overrides,
  };
}

function makeLogEntry(overrides: Partial<TechDiscoveryLogEntry> = {}): TechDiscoveryLogEntry {
  return {
    techId: 'quantum-1',
    scenarioId: 'scenario-01',
    factionId: 'us',
    turnDiscovered: 10,
    actualCost: 90,
    actualDuration: 3,
    synergyBonuses: ['quantum-synergy'],
    discoveryContext: makeContext(),
    generatedModulePath: 'models/technology/generated/quantum-1-us.json',
    ...overrides,
  };
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TechModuleFactory', () => {
  const factory = new TechModuleFactory();

  // ── generateModule ───────────────────────────────────────────────────

  describe('generateModule', () => {
    it('creates valid module from tech and context', () => {
      const result = factory.generateModule(makeTech(), makeContext(), makeComputedFields());
      expect(result.success).toBe(true);
      expect(result.module).toBeDefined();
      expect(result.logEntry).toBeDefined();
    });

    it('includes all base tech fields', () => {
      const tech = makeTech({ techId: 'ai-2', name: 'AI Systems', domain: 'ai' });
      const result = factory.generateModule(tech, makeContext(), makeComputedFields());
      expect(result.module!.techId).toBe('ai-2');
      expect(result.module!.name).toBe('AI Systems');
      expect(result.module!.domain).toBe('ai');
      expect(result.module!.researchCost).toBe(100);
    });

    it('adds generated metadata', () => {
      const ctx = makeContext({ factionId: 'china', turn: 15, scenarioId: 'scn-02' });
      const result = factory.generateModule(makeTech(), ctx, makeComputedFields());
      expect(result.module!.generatedBy).toBe('china');
      expect(result.module!.generatedOnTurn).toBe(15);
      expect(result.module!.scenarioId).toBe('scn-02');
    });

    it('creates log entry with correct techId and factionId', () => {
      const ctx = makeContext({ factionId: 'japan' });
      const result = factory.generateModule(makeTech(), ctx, makeComputedFields());
      expect(result.logEntry!.techId).toBe('quantum-1');
      expect(result.logEntry!.factionId).toBe('japan');
    });

    it('fails with missing techId', () => {
      const tech = makeTech({ techId: '' });
      const result = factory.generateModule(tech, makeContext(), makeComputedFields());
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails with missing factionId', () => {
      const ctx = makeContext({ factionId: '' as any });
      const result = factory.generateModule(makeTech(), ctx, makeComputedFields());
      expect(result.success).toBe(false);
    });
  });

  // ── enrichWithComputedFields ─────────────────────────────────────────

  describe('enrichWithComputedFields', () => {
    it('maps all fields correctly', () => {
      const fields = factory.enrichWithComputedFields(
        makeTech(),
        95,
        4,
        ['bonus-a', 'bonus-b'],
        20,
        0.9,
      );
      expect(fields.actualCostPaid).toBe(95);
      expect(fields.effectiveDurationTurns).toBe(4);
      expect(fields.synergyBonusesApplied).toEqual(['bonus-a', 'bonus-b']);
      expect(fields.educationBonusPercent).toBe(20);
      expect(fields.efficiencyAtCompletion).toBe(0.9);
    });

    it('clamps negative cost to 0', () => {
      const fields = factory.enrichWithComputedFields(makeTech(), -10, 2, [], 0, 0.5);
      expect(fields.actualCostPaid).toBe(0);
    });

    it('clamps duration to minimum 1', () => {
      const fields = factory.enrichWithComputedFields(makeTech(), 50, 0, [], 0, 0.5);
      expect(fields.effectiveDurationTurns).toBe(1);
    });

    it('clamps education bonus to 0-100', () => {
      const fields = factory.enrichWithComputedFields(makeTech(), 50, 2, [], 150, 0.5);
      expect(fields.educationBonusPercent).toBe(100);
    });
  });

  // ── createDiscoveryContext ───────────────────────────────────────────

  describe('createDiscoveryContext', () => {
    it('captures nation state correctly', () => {
      const domainLevels = { quantum: 40, ai: 30 };
      const ctx = factory.createDiscoveryContext(baseNation, 12, 'scn-03', domainLevels, 0.85);
      expect(ctx.factionId).toBe('us');
      expect(ctx.turn).toBe(12);
      expect(ctx.scenarioId).toBe('scn-03');
      expect(ctx.gdp).toBe(2000);
      expect(ctx.stability).toBe(75);
      expect(ctx.researchEfficiency).toBe(0.85);
      expect(ctx.nationDomainLevels).toEqual({ quantum: 40, ai: 30 });
    });

    it('clamps efficiency to 0-1', () => {
      const ctx = factory.createDiscoveryContext(baseNation, 1, 'scn', {}, 1.5);
      expect(ctx.researchEfficiency).toBe(1);
    });
  });

  // ── exportSingleModule / importModule ────────────────────────────────

  describe('exportSingleModule', () => {
    it('returns valid JSON string', () => {
      const module = makeGeneratedModule();
      const json = factory.exportSingleModule(module);
      const parsed = JSON.parse(json);
      expect(parsed.techId).toBe('quantum-1');
    });
  });

  describe('importModule', () => {
    it('succeeds with valid JSON', () => {
      const module = makeGeneratedModule();
      const json = factory.exportSingleModule(module);
      const result = factory.importModule(json, []);
      expect(result.success).toBe(true);
      expect(result.techId).toBe('quantum-1');
    });

    it('fails for already-researched tech', () => {
      const module = makeGeneratedModule();
      const json = factory.exportSingleModule(module);
      const result = factory.importModule(json, ['quantum-1']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already been researched');
    });

    it('fails for invalid JSON', () => {
      const result = factory.importModule('not valid json', []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('fails for missing techId', () => {
      const result = factory.importModule(JSON.stringify({ name: 'foo' }), []);
      expect(result.success).toBe(false);
    });
  });

  // ── batchExport ──────────────────────────────────────────────────────

  describe('batchExport', () => {
    it('creates package with correct totals', () => {
      const m1 = makeGeneratedModule({ techId: 't1', computedFields: makeComputedFields({ actualCostPaid: 50, effectiveDurationTurns: 2 }) });
      const m2 = makeGeneratedModule({ techId: 't2', computedFields: makeComputedFields({ actualCostPaid: 75, effectiveDurationTurns: 4 }) });
      const pkg = factory.batchExport([m1, m2], 'scn-01', 'us', 'Test Package');
      expect(pkg.modules).toHaveLength(2);
      expect(pkg.totalCostPaid).toBe(125);
      expect(pkg.totalResearchTurns).toBe(6);
      expect(pkg.packageName).toBe('Test Package');
      expect(pkg.factionId).toBe('us');
    });
  });

  // ── recordDiscovery ──────────────────────────────────────────────────

  describe('recordDiscovery', () => {
    it('appends to log immutably', () => {
      const module = makeGeneratedModule();
      const originalLog: TechDiscoveryLogEntry[] = [makeLogEntry({ techId: 'old-tech' })];
      const newLog = factory.recordDiscovery(module, originalLog);
      expect(newLog).toHaveLength(2);
      expect(originalLog).toHaveLength(1); // original unchanged
      expect(newLog[1].techId).toBe('quantum-1');
    });
  });

  // ── queryByTech / queryByFaction ─────────────────────────────────────

  describe('queryByTech', () => {
    it('filters entries by techId', () => {
      const log = [
        makeLogEntry({ techId: 'quantum-1' }),
        makeLogEntry({ techId: 'ai-1' }),
        makeLogEntry({ techId: 'quantum-1', factionId: 'china' }),
      ];
      const results = factory.queryByTech(log, 'quantum-1');
      expect(results).toHaveLength(2);
    });
  });

  describe('queryByFaction', () => {
    it('filters entries by factionId', () => {
      const log = [
        makeLogEntry({ factionId: 'us' }),
        makeLogEntry({ factionId: 'china' }),
        makeLogEntry({ factionId: 'us' }),
      ];
      const results = factory.queryByFaction(log, 'us');
      expect(results).toHaveLength(2);
    });
  });

  // ── getLeaderboard ───────────────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('sorts by fastest (turnDiscovered ascending)', () => {
      const log = [
        makeLogEntry({ techId: 'quantum-1', factionId: 'us', turnDiscovered: 15 }),
        makeLogEntry({ techId: 'quantum-1', factionId: 'china', turnDiscovered: 10 }),
        makeLogEntry({ techId: 'quantum-1', factionId: 'japan', turnDiscovered: 20 }),
      ];
      const board = factory.getLeaderboard(log, 'quantum-1', 'fastest');
      expect(board).toHaveLength(3);
      expect(board[0].factionId).toBe('china');
      expect(board[1].factionId).toBe('us');
      expect(board[2].factionId).toBe('japan');
    });

    it('sorts by cheapest (actualCost ascending)', () => {
      const log = [
        makeLogEntry({ techId: 'quantum-1', factionId: 'us', actualCost: 100 }),
        makeLogEntry({ techId: 'quantum-1', factionId: 'china', actualCost: 50 }),
        makeLogEntry({ techId: 'quantum-1', factionId: 'japan', actualCost: 75 }),
      ];
      const board = factory.getLeaderboard(log, 'quantum-1', 'cheapest');
      expect(board[0].factionId).toBe('china');
      expect(board[1].factionId).toBe('japan');
      expect(board[2].factionId).toBe('us');
    });

    it('limits results to 10 entries', () => {
      const log = Array.from({ length: 15 }, (_, i) =>
        makeLogEntry({ techId: 'quantum-1', factionId: 'us', turnDiscovered: i }),
      );
      const board = factory.getLeaderboard(log, 'quantum-1', 'fastest');
      expect(board).toHaveLength(10);
    });

    it('returns empty for non-matching techId', () => {
      const log = [makeLogEntry({ techId: 'ai-1' })];
      const board = factory.getLeaderboard(log, 'quantum-1', 'fastest');
      expect(board).toHaveLength(0);
    });
  });
});
