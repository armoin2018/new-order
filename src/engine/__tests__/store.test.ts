import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/engine/store';

import type { ScenarioDefinition, AIProfileConfig } from '@/data/types/scenario.types';
import type { FactionId, ActorId, LeaderId, TurnNumber } from '@/data/types/enums';

// ---------------------------------------------------------------------------
// Minimal mock scenario — only the fields consumed by initializeFromScenario
// ---------------------------------------------------------------------------

function createMockScenario(): ScenarioDefinition {
  const factions: FactionId[] = ['us' as FactionId, 'china' as FactionId];

  return {
    meta: {
      id: 'test-scenario',
      name: 'Test Scenario',
      version: '0.1.0',
      author: 'Test',
      description: 'Minimal scenario for unit testing',
      maxTurns: 30,
    },
    factions,
    relationshipMatrix: {
      ['us' as FactionId]: { ['us' as FactionId]: 0, ['china' as FactionId]: 50 },
      ['china' as FactionId]: { ['us' as FactionId]: 50, ['china' as FactionId]: 0 },
    } as ScenarioDefinition['relationshipMatrix'],
    nationStates: {
      ['us' as FactionId]: {
        factionId: 'us' as FactionId,
        stability: 70,
        treasury: 5_000,
        gdp: 25_000,
        inflation: 3,
        militaryReadiness: 80,
        nuclearThreshold: 10,
        diplomaticInfluence: 90,
        popularity: 60,
        allianceCredibility: 85,
        techLevel: 85,
      },
      ['china' as FactionId]: {
        factionId: 'china' as FactionId,
        stability: 65,
        treasury: 4_000,
        gdp: 18_000,
        inflation: 2,
        militaryReadiness: 75,
        nuclearThreshold: 15,
        diplomaticInfluence: 70,
        popularity: 55,
        allianceCredibility: 60,
        techLevel: 80,
      },
    } as unknown as ScenarioDefinition['nationStates'],
    geographicPostures: {} as ScenarioDefinition['geographicPostures'],
    nationFaultLines: {} as ScenarioDefinition['nationFaultLines'],
    mapConfig: { width: 10, height: 10, defaultTerrain: 'Plains', hexOverrides: [] },
    units: [],
    militaryForceStructures: {} as ScenarioDefinition['militaryForceStructures'],
    intelligenceCapabilities: {} as ScenarioDefinition['intelligenceCapabilities'],
    aiProfiles: {} as ScenarioDefinition['aiProfiles'],
    cognitiveBiasDefinitions: [],
    interpersonalChemistry: [],
    massPsychology: {} as ScenarioDefinition['massPsychology'],
    mediaEcosystems: {} as ScenarioDefinition['mediaEcosystems'],
    technologyIndices: {} as ScenarioDefinition['technologyIndices'],
    techBlocInfo: {} as ScenarioDefinition['techBlocInfo'],
    resourceSecurity: {} as ScenarioDefinition['resourceSecurity'],
    climateEvents: [],
    nonStateActors: [],
    proxyRelationships: [],
    flashpoints: [],
    victoryConditions: [],
    lossConditions: [],
    eventTimeline: [],
  };
}

// ---------------------------------------------------------------------------
// Store Smoke Tests
// ---------------------------------------------------------------------------

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    localStorage.clear();
  });

  // -----------------------------------------------------------------------
  // Initial / default state
  // -----------------------------------------------------------------------

  describe('initial state (before initialization)', () => {
    it('has gameOver === false', () => {
      expect(useGameStore.getState().gameOver).toBe(false);
    });

    it('has currentTurn === 0', () => {
      expect(useGameStore.getState().currentTurn).toBe(0);
    });

    it('has empty playerFaction', () => {
      expect(useGameStore.getState().playerFaction).toBe('');
    });

    it('has gameEndReason === null', () => {
      expect(useGameStore.getState().gameEndReason).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // initializeFromScenario
  // -----------------------------------------------------------------------

  describe('initializeFromScenario', () => {
    it('sets scenario meta, turn, and playerFaction', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const state = useGameStore.getState();
      expect(state.scenarioMeta.id).toBe('test-scenario');
      expect(state.scenarioMeta.maxTurns).toBe(30);
      expect(state.currentTurn).toBe(1);
      expect(state.playerFaction).toBe('us');
      expect(state.gameOver).toBe(false);
    });

    it('sets a non-zero randomSeed', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      expect(useGameStore.getState().randomSeed).not.toBe(0);
    });

    it('populates nationStates from the scenario', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const ns = useGameStore.getState().nationStates;
      expect(ns['us' as FactionId]).toBeDefined();
      expect(ns['china' as FactionId]).toBeDefined();
    });

    it('builds hexMap from mapConfig.hexOverrides when hexMap is not provided', () => {
      const scenario = createMockScenario();
      // Ensure hexMap is not set so the else branch runs
      delete scenario.hexMap;
      // Add actual hex overrides to cover the for loop
      scenario.mapConfig.hexOverrides = [
        { id: 'hex-1', terrain: 'Mountain' } as unknown as ScenarioDefinition['mapConfig']['hexOverrides'][number],
        { id: 'hex-2', terrain: 'Plains' } as unknown as ScenarioDefinition['mapConfig']['hexOverrides'][number],
      ];
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      const hexMap = useGameStore.getState().hexMap;
      expect(hexMap).toBeDefined();
      expect(Object.keys(hexMap).length).toBe(2);
    });

    it('uses scenario.hexMap directly when provided', () => {
      const scenario = createMockScenario();
      const mockHexMap = { ['hex-1' as string]: { id: 'hex-1' } } as unknown as NonNullable<ScenarioDefinition['hexMap']>;
      scenario.hexMap = mockHexMap;
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      expect(useGameStore.getState().hexMap).toBeDefined();
    });

    it('populates unit registry from scenario units', () => {
      const scenario = createMockScenario();
      scenario.units = [
        { id: 'unit-1', type: 'Infantry', factionId: 'us' } as unknown as ScenarioDefinition['units'][number],
        { id: 'unit-2', type: 'Armor', factionId: 'china' } as unknown as ScenarioDefinition['units'][number],
      ];
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      const registry = useGameStore.getState().unitRegistry;
      expect(Object.keys(registry).length).toBe(2);
    });

    it('initializes civil unrest components per faction', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const unrest = useGameStore.getState().civilUnrestComponents;
      expect(unrest['us' as FactionId]).toBeDefined();
      expect(unrest['us' as FactionId]?.civilUnrest).toBe(0);
      expect(unrest['us' as FactionId]?.escalationStage).toBe('Grumbling');
    });

    it('initializes international legitimacy per faction at 50', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const legit = useGameStore.getState().internationalLegitimacy;
      expect(legit['us' as FactionId]?.legitimacy).toBe(50);
    });

    it('initializes empty event log and headline archive', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      expect(useGameStore.getState().eventLog).toEqual([]);
      expect(useGameStore.getState().headlineArchive).toEqual([]);
    });

    it('initializes advisory subsystems as null/empty', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const state = useGameStore.getState();
      expect(state.currentViability).toBeNull();
      expect(state.stateTrendHistory).toEqual([]);
      expect(state.actionPredictionCache).toEqual([]);
      expect(state.strategicConsistency).toBeNull();
      expect(state.postGameAnalysis).toBeNull();
    });

    it('initializes financial network state per faction', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const fin = useGameStore.getState().financialNetworkState;
      expect(fin.gfsi).toBe(75);
      expect(fin.nations['us' as FactionId]?.swiftStatus).toBe('Connected');
    });

    it('initializes sanctions registry as empty', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      expect(useGameStore.getState().sanctionsRegistry).toEqual([]);
    });

    it('handles techBlocInfo with ethicsAccordSignatory flag', () => {
      const scenario = createMockScenario();
      scenario.techBlocInfo = {
        ['us' as FactionId]: {
          ethicsAccordSignatory: true,
        },
        ['china' as FactionId]: {
          ethicsAccordSignatory: false,
        },
      } as unknown as ScenarioDefinition['techBlocInfo'];

      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const accords = useGameStore.getState().dualUseTechAccords;
      expect(accords.signatories).toContain('us');
      expect(accords.nationCompliance['us' as FactionId]?.signed).toBe(true);
      expect(accords.nationCompliance['china' as FactionId]?.signed).toBe(false);
    });

    it('populates nonStateActorRegistry from scenario', () => {
      const scenario = createMockScenario();
      scenario.nonStateActors = [
        { id: 'actor-1', name: 'Test Actor' } as unknown as ScenarioDefinition['nonStateActors'][number],
      ];
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const registry = useGameStore.getState().nonStateActorRegistry;
      expect(registry['actor-1' as ActorId]).toBeDefined();
    });

    it('populates leader profiles, emotional states, biases, grudges, and drift logs from aiProfiles', () => {
      const scenario = createMockScenario();

      const leaderId = 'leader-us' as LeaderId;
      const usProfile: AIProfileConfig = {
        factionId: 'us' as FactionId,
        leader: {
          id: leaderId,
          identity: {
            name: 'Test Leader',
            title: 'President',
            nation: 'us' as FactionId,
            age: 60,
            ideology: 'Pragmatist',
          },
          psychology: {
            decisionStyle: 'Transactional' as const,
            stressResponse: 'Escalate' as const,
            riskTolerance: 50,
            paranoia: 30,
            narcissism: 40,
            pragmatism: 70,
            patience: 50,
            vengefulIndex: 20,
          },
          motivations: {
            primaryGoal: 'Economic Dominance',
            ideologicalCore: 'Nationalism',
            redLines: ['Nuclear attack'],
            legacyAmbition: 'Greatest economy',
          },
          powerBase: {
            military: 80,
            oligarchs: 60,
            party: 70,
            clergy: 10,
            public: 55,
            securityServices: 75,
          },
          vulnerabilities: {
            healthRisk: 5,
            successionClarity: 60,
            coupRisk: 2,
            personalScandal: 15,
          },
          historicalAnalog: 'FDR',
        },
        initialEmotionalState: {
          leaderId,
          turn: 0 as TurnNumber,
          stress: 20,
          confidence: 70,
          anger: 10,
          fear: 15,
          resolve: 60,
          decisionFatigue: 5,
          stressInoculated: false,
        },
        biasAssignments: [
          { biasType: 'ConfirmationBias' as const, intensity: 40 },
        ],
      } as unknown as AIProfileConfig;

      scenario.aiProfiles = {
        ['us' as FactionId]: usProfile,
      } as unknown as ScenarioDefinition['aiProfiles'];

      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const state = useGameStore.getState();

      // DR-108: Leader profile extracted
      expect(state.leaderProfiles[leaderId]).toBeDefined();
      expect(state.leaderProfiles[leaderId]?.identity.name).toBe('Test Leader');

      // DR-119: Emotional state initialized
      expect(state.emotionalStates[leaderId]).toBeDefined();
      expect(state.emotionalStates[leaderId]?.stress).toBe(20);
      expect(state.emotionalStates[leaderId]?.turn).toBe(1);

      // DR-120: Bias assignments
      const assignments = state.cognitiveBiasRegistry.assignments[leaderId];
      expect(assignments).toBeDefined();
      expect(assignments).toHaveLength(1);

      // DR-122: Empty grudge ledger
      expect(state.grudgeLedgers[leaderId]).toBeDefined();
      expect(state.grudgeLedgers[leaderId]?.grudges).toEqual([]);

      // DR-124: Personality drift log
      expect(state.personalityDriftLogs[leaderId]).toBeDefined();
      expect(state.personalityDriftLogs[leaderId]?.currentDriftMagnitude).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // advanceTurn
  // -----------------------------------------------------------------------

  describe('advanceTurn', () => {
    it('increments currentTurn by 1', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      expect(useGameStore.getState().currentTurn).toBe(1);

      useGameStore.getState().advanceTurn();
      expect(useGameStore.getState().currentTurn).toBe(2);

      useGameStore.getState().advanceTurn();
      expect(useGameStore.getState().currentTurn).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // setGameOver
  // -----------------------------------------------------------------------

  describe('setGameOver', () => {
    it('sets gameOver flag and reason', () => {
      useGameStore.getState().setGameOver('Nuclear annihilation');

      const state = useGameStore.getState();
      expect(state.gameOver).toBe(true);
      expect(state.gameEndReason).toBe('Nuclear annihilation');
    });
  });

  // -----------------------------------------------------------------------
  // resetGame
  // -----------------------------------------------------------------------

  describe('resetGame', () => {
    it('returns to initial default state', () => {
      // Initialize and mutate
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      useGameStore.getState().advanceTurn();
      useGameStore.getState().setGameOver('Test over');

      // Reset
      useGameStore.getState().resetGame();

      const state = useGameStore.getState();
      expect(state.currentTurn).toBe(0);
      expect(state.playerFaction).toBe('');
      expect(state.gameOver).toBe(false);
      expect(state.gameEndReason).toBeNull();
      expect(state.scenarioMeta.id).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Persist / checksum storage layer
  // -----------------------------------------------------------------------

  describe('localStorage persistence (NFR-401)', () => {
    it('persists state to localStorage on mutation', () => {
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      const raw = localStorage.getItem('new-order-save');
      expect(raw).not.toBeNull();
      if (raw) {
        const envelope = JSON.parse(raw) as { checksum?: string };
        expect(envelope.checksum).toBeDefined();
        expect(typeof envelope.checksum).toBe('string');
      }
    });

    it('rehydrates from localStorage with valid checksum', async () => {
      // Write state via store action (triggers setItem with checksum)
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      // Force persist rehydration — this triggers getItem → checksum validation
      await useGameStore.persist.rehydrate();

      // State should still be intact
      expect(useGameStore.getState().scenarioMeta.id).toBe('test-scenario');
    });

    it('warns on checksum mismatch during rehydration', async () => {
      // Write valid state first
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);

      // Tamper with the checksum in localStorage
      const raw = localStorage.getItem('new-order-save');
      expect(raw).not.toBeNull();
      if (raw) {
        const envelope = JSON.parse(raw) as Record<string, unknown>;
        envelope['checksum'] = 'tampered-value';
        localStorage.setItem('new-order-save', JSON.stringify(envelope));
      }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force rehydration — triggers getItem with mismatched checksum
      await useGameStore.persist.rehydrate();

      expect(warnSpy).toHaveBeenCalledWith(
        '[New Order]',
        expect.stringContaining('checksum mismatch'),
        expect.any(Object),
      );
      warnSpy.mockRestore();
    });

    it('warns and returns null on corrupt localStorage data', async () => {
      // Write corrupt JSON directly
      localStorage.setItem('new-order-save', 'not-valid-json{{{');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force rehydration — triggers getItem catch branch
      await useGameStore.persist.rehydrate();

      expect(warnSpy).toHaveBeenCalledWith(
        '[New Order]',
        expect.stringContaining('Failed to parse save data'),
        '',
      );
      warnSpy.mockRestore();
    });

    it('returns null when localStorage has no save data', async () => {
      // Clear localStorage — getItem(!raw) branch
      localStorage.clear();

      // Force rehydration
      await useGameStore.persist.rehydrate();

      // Store should still have default state
      expect(useGameStore.getState().currentTurn).toBe(0);
    });

    it('handles save without checksum field', async () => {
      // Write state without checksum
      const stateData = {
        state: { ...useGameStore.getState() },
        version: 0,
        // No checksum field — typeof envelope.checksum !== 'string' branch
      };
      localStorage.setItem('new-order-save', JSON.stringify(stateData));

      // Force rehydration — should not warn about mismatch
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await useGameStore.persist.rehydrate();

      expect(warnSpy).not.toHaveBeenCalledWith(
        '[New Order]',
        expect.stringContaining('checksum mismatch'),
        expect.any(Object),
      );
      warnSpy.mockRestore();
    });

    it('clearStorage removes save from localStorage', () => {
      // Write state
      const scenario = createMockScenario();
      useGameStore.getState().initializeFromScenario(scenario, 'us' as FactionId);
      expect(localStorage.getItem('new-order-save')).not.toBeNull();

      // Clear via persist API — triggers removeItem
      useGameStore.persist.clearStorage();
      expect(localStorage.getItem('new-order-save')).toBeNull();
    });
  });
});
