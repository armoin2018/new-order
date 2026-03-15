/**
 * Tech–Research Integration Tests — CNFL-4303
 *
 * @see FR-3500 — Technology Module Generation
 * @see CNFL-4303 — Tech Factory → Research System Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TechResearchIntegration,
  type TechResearchIntegrationInput,
} from '../tech-research-integration';
import type { FactionId, NationState, TechnologyModel } from '@/data/types';
import type {
  TechModuleRegistryState,
} from '@/data/types/model.types';
import type { NationRnDState, ResearchTurnResult } from '../research-system';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNation(overrides?: Partial<NationState>): NationState {
  return {
    factionId: 'us' as FactionId,
    stability: 75,
    treasury: 500,
    gdp: 2100,
    inflation: 3,
    militaryReadiness: 80,
    nuclearThreshold: 20,
    diplomaticInfluence: 70,
    popularity: 60,
    allianceCredibility: 65,
    techLevel: 85,
    ...overrides,
  };
}

function makeTech(overrides?: Partial<TechnologyModel>): TechnologyModel {
  return {
    schemaVersion: '1.0.0',
    techId: 'quantum-computing-v1',
    name: 'Quantum Computing v1',
    domain: 'quantum',
    description: 'First-generation quantum computing capability.',
    researchCost: 500,
    researchDurationTurns: 6,
    impactLevel: 'breakthrough',
    ...overrides,
  };
}

function makeResearchResult(
  completedTechs: readonly string[],
  overrides?: Partial<ResearchTurnResult>,
): ResearchTurnResult {
  return {
    factionId: 'us' as FactionId,
    activeProjects: [],
    completedTechs,
    newlyAvailable: [],
    totalExpenditure: 100,
    budgetRemaining: 0,
    events: [],
    ...overrides,
  };
}

function makeRnDState(overrides?: Partial<NationRnDState>): NationRnDState {
  return {
    factionId: 'us' as FactionId,
    completedTechIds: [],
    activeResearch: [
      {
        techId: 'quantum-computing-v1',
        factionId: 'us' as FactionId,
        investedSoFar: 480,
        totalCost: 500,
        turnsSpent: 5,
        estimatedTurnsRemaining: 1,
        speedMultiplier: 1.0,
      },
    ],
    domainLevels: { quantum: 3 },
    totalInvestment: 2000,
    ...overrides,
  };
}

function makeIntegrationInput(
  overrides?: Partial<TechResearchIntegrationInput>,
): TechResearchIntegrationInput {
  return {
    researchResult: makeResearchResult(['quantum-computing-v1']),
    nation: makeNation(),
    turn: 10,
    scenarioId: 'test-scenario-001',
    domainLevels: { quantum: 3 },
    researchEfficiency: 0.85,
    techCatalog: [makeTech()],
    rndState: makeRnDState(),
    currentRegistry: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TechResearchIntegration', () => {
  let integration: TechResearchIntegration;

  beforeEach(() => {
    integration = new TechResearchIntegration();
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance', () => {
      expect(integration).toBeDefined();
    });
  });

  // ── processCompletions ──────────────────────────────────────────────

  describe('processCompletions', () => {
    it('generates a module for each completed tech', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      expect(result.newModules).toHaveLength(1);
      expect(result.newModules[0]?.techId).toBe('quantum-computing-v1');
    });

    it('creates discovery log entries', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      expect(result.newDiscoveries).toHaveLength(1);
      expect(result.newDiscoveries[0]?.techId).toBe('quantum-computing-v1');
      expect(result.newDiscoveries[0]?.turnDiscovered).toBe(10);
    });

    it('populates the registry with generated modules', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      const key = 'quantum-computing-v1-us';
      expect(result.updatedRegistry.modules[key]).toBeDefined();
      expect(result.updatedRegistry.modules[key]?.name).toBe('Quantum Computing v1');
    });

    it('produces events describing module generation', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0]).toContain('Tech module generated');
    });

    it('returns empty results when no techs completed', () => {
      const input = makeIntegrationInput({
        researchResult: makeResearchResult([]),
      });
      const result = integration.processCompletions(input);
      expect(result.newModules).toHaveLength(0);
      expect(result.newDiscoveries).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    });

    it('skips techs not found in catalog', () => {
      const input = makeIntegrationInput({
        researchResult: makeResearchResult(['nonexistent-tech']),
      });
      const result = integration.processCompletions(input);
      expect(result.newModules).toHaveLength(0);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toContain('not found in catalog');
    });

    it('handles multiple completions in a single turn', () => {
      const secondTech = makeTech({
        techId: 'ai-reasoning-v1',
        name: 'AI Reasoning v1',
        domain: 'ai',
      });
      const input = makeIntegrationInput({
        researchResult: makeResearchResult(['quantum-computing-v1', 'ai-reasoning-v1']),
        techCatalog: [makeTech(), secondTech],
        rndState: makeRnDState({
          activeResearch: [
            {
              techId: 'quantum-computing-v1',
              factionId: 'us' as FactionId,
              investedSoFar: 480,
              totalCost: 500,
              turnsSpent: 5,
              estimatedTurnsRemaining: 1,
              speedMultiplier: 1.0,
            },
            {
              techId: 'ai-reasoning-v1',
              factionId: 'us' as FactionId,
              investedSoFar: 300,
              totalCost: 350,
              turnsSpent: 4,
              estimatedTurnsRemaining: 0,
              speedMultiplier: 1.2,
            },
          ],
        }),
      });
      const result = integration.processCompletions(input);
      expect(result.newModules).toHaveLength(2);
      expect(result.updatedRegistry.discoveryLog).toHaveLength(2);
    });

    it('preserves existing registry when adding new modules', () => {
      const existingRegistry: TechModuleRegistryState = {
        modules: {
          'old-tech-us': {
            techId: 'old-tech',
            name: 'Old Tech',
            domain: 'cyber',
            generatedBy: 'us',
            generatedOnTurn: 3,
            scenarioId: 'test-scenario-001',
            actualCostPaid: 200,
            effectiveDurationTurns: 4,
            synergyBonuses: [],
            exportable: true,
          },
        },
        discoveryLog: [{
          techId: 'old-tech',
          factionId: 'us',
          turnDiscovered: 3,
          actualCost: 200,
          actualDuration: 4,
        }],
      };
      const input = makeIntegrationInput({ currentRegistry: existingRegistry });
      const result = integration.processCompletions(input);
      // Should have both old and new modules
      expect(Object.keys(result.updatedRegistry.modules)).toHaveLength(2);
      expect(result.updatedRegistry.modules['old-tech-us']).toBeDefined();
      expect(result.updatedRegistry.modules['quantum-computing-v1-us']).toBeDefined();
    });

    it('stores actual cost from R&D state project', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      const module = result.newModules[0];
      // The project had investedSoFar=480
      expect(module?.actualCostPaid).toBe(480);
    });

    it('stores actual duration from R&D state project', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      const module = result.newModules[0];
      // The project had turnsSpent=5
      expect(module?.effectiveDurationTurns).toBe(5);
    });

    it('sets module domain from technology model', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      expect(result.newModules[0]?.domain).toBe('quantum');
    });

    it('marks module as exportable', () => {
      const input = makeIntegrationInput();
      const result = integration.processCompletions(input);
      expect(result.newModules[0]?.exportable).toBe(true);
    });
  });

  // ── computeEffectiveResearchSpeed ─────────────────────────────────

  describe('computeEffectiveResearchSpeed', () => {
    it('returns base speed when no modifiers', () => {
      const result = integration.computeEffectiveResearchSpeed({
        baseSpeed: 1.0,
        indexSpeedMultiplier: 1.0,
      });
      expect(result).toBe(1.0);
    });

    it('increases speed when index multiplier > 1', () => {
      const result = integration.computeEffectiveResearchSpeed({
        baseSpeed: 1.0,
        indexSpeedMultiplier: 1.1,
      });
      expect(result).toBeGreaterThan(1.0);
    });

    it('decreases speed when index multiplier < 1', () => {
      const result = integration.computeEffectiveResearchSpeed({
        baseSpeed: 1.0,
        indexSpeedMultiplier: 0.9,
      });
      expect(result).toBeLessThan(1.0);
    });

    it('adds education bonus to speed', () => {
      const withBonus = integration.computeEffectiveResearchSpeed({
        baseSpeed: 1.0,
        indexSpeedMultiplier: 1.0,
        educationBonusPercent: 50,
      });
      const without = integration.computeEffectiveResearchSpeed({
        baseSpeed: 1.0,
        indexSpeedMultiplier: 1.0,
      });
      expect(withBonus).toBeGreaterThan(without);
    });

    it('floors at 0.5 minimum', () => {
      const result = integration.computeEffectiveResearchSpeed({
        baseSpeed: 0.1,
        indexSpeedMultiplier: 0.5,
      });
      expect(result).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ── getModulesForFaction ──────────────────────────────────────────

  describe('getModulesForFaction', () => {
    it('returns modules for the specified faction', () => {
      const registry: TechModuleRegistryState = {
        modules: {
          'tech-a-us': {
            techId: 'tech-a', name: 'Tech A', domain: 'ai',
            generatedBy: 'us', generatedOnTurn: 5, scenarioId: 's1',
            actualCostPaid: 100, effectiveDurationTurns: 3,
            synergyBonuses: [], exportable: true,
          },
          'tech-b-china': {
            techId: 'tech-b', name: 'Tech B', domain: 'cyber',
            generatedBy: 'china', generatedOnTurn: 7, scenarioId: 's1',
            actualCostPaid: 200, effectiveDurationTurns: 5,
            synergyBonuses: [], exportable: true,
          },
        },
        discoveryLog: [],
      };
      const usModules = integration.getModulesForFaction(registry, 'us' as FactionId);
      expect(usModules).toHaveLength(1);
      expect(usModules[0]?.techId).toBe('tech-a');
    });

    it('returns empty array for faction with no modules', () => {
      const registry: TechModuleRegistryState = {
        modules: {},
        discoveryLog: [],
      };
      const result = integration.getModulesForFaction(registry, 'us' as FactionId);
      expect(result).toHaveLength(0);
    });
  });

  // ── getModuleCountsByFaction ──────────────────────────────────────

  describe('getModuleCountsByFaction', () => {
    it('counts modules per faction', () => {
      const registry: TechModuleRegistryState = {
        modules: {
          'a-us': {
            techId: 'a', name: 'A', domain: 'ai',
            generatedBy: 'us', generatedOnTurn: 1, scenarioId: 's1',
            actualCostPaid: 100, effectiveDurationTurns: 2,
            synergyBonuses: [], exportable: true,
          },
          'b-us': {
            techId: 'b', name: 'B', domain: 'cyber',
            generatedBy: 'us', generatedOnTurn: 3, scenarioId: 's1',
            actualCostPaid: 150, effectiveDurationTurns: 3,
            synergyBonuses: [], exportable: true,
          },
          'c-china': {
            techId: 'c', name: 'C', domain: 'space',
            generatedBy: 'china', generatedOnTurn: 5, scenarioId: 's1',
            actualCostPaid: 200, effectiveDurationTurns: 4,
            synergyBonuses: [], exportable: true,
          },
        },
        discoveryLog: [],
      };
      const counts = integration.getModuleCountsByFaction(registry);
      expect(counts['us']).toBe(2);
      expect(counts['china']).toBe(1);
    });
  });

  // ── hasModule ────────────────────────────────────────────────────

  describe('hasModule', () => {
    it('returns true when module exists', () => {
      const registry: TechModuleRegistryState = {
        modules: {
          'tech-a-us': {
            techId: 'tech-a', name: 'A', domain: 'ai',
            generatedBy: 'us', generatedOnTurn: 1, scenarioId: 's1',
            actualCostPaid: 100, effectiveDurationTurns: 2,
            synergyBonuses: [], exportable: true,
          },
        },
        discoveryLog: [],
      };
      expect(integration.hasModule(registry, 'tech-a', 'us')).toBe(true);
    });

    it('returns false when module does not exist', () => {
      const registry: TechModuleRegistryState = {
        modules: {},
        discoveryLog: [],
      };
      expect(integration.hasModule(registry, 'tech-a', 'us')).toBe(false);
    });
  });
});
