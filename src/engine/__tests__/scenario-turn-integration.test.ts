/**
 * Tests for ScenarioTurnIntegration — CNFL-4404
 *
 * @see src/engine/scenario-turn-integration.ts
 */

import { describe, it, expect } from 'vitest';
import { ScenarioTurnIntegration } from '../scenario-turn-integration';
import type {
  RecordTurnInput,
  CompleteScenarioInput,
} from '../scenario-turn-integration';
import type { ScenarioHistoryArchive } from '../scenario-history-recorder';
import type { GameState } from '@/data/types/gamestate.types';
import type { FactionId, TurnNumber } from '@/data/types';
import type { MarketEventLogEntry } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal GameState stub with nation states for testing.
 */
function makeGameState(overrides?: Partial<GameState>): GameState {
  const factions: FactionId[] = ['us', 'china', 'russia'] as FactionId[];

  const nationStates: Record<string, any> = {};
  for (const fid of factions) {
    nationStates[fid] = {
      factionId: fid,
      stability: 70,
      treasury: 200,
      gdp: 5000,
      inflation: 3,
      militaryReadiness: 65,
      nuclearThreshold: 20,
      diplomaticInfluence: 55,
      popularity: 60,
      allianceCredibility: 50,
      techLevel: 40,
    };
  }

  const relationshipMatrix: Record<string, Record<string, number>> = {};
  for (const a of factions) {
    relationshipMatrix[a] = {};
    for (const b of factions) {
      if (a === b) continue;
      relationshipMatrix[a][b] = 50;
    }
  }

  const civilUnrestComponents: Record<string, any> = {};
  for (const fid of factions) {
    civilUnrestComponents[fid] = {
      factionId: fid,
      turn: 1,
      civilUnrest: 15,
      inflation: 0,
      inequality: 0,
      repressionBacklash: 0,
      ethnicTension: 0,
      foreignPropaganda: 0,
      escalationStage: 'Grumbling',
    };
  }

  return {
    scenarioMeta: { id: 'test-scenario', name: 'Test', version: '1.0', author: 'test', description: 'test', maxTurns: 60 },
    currentTurn: 1 as TurnNumber,
    playerFaction: 'us' as FactionId,
    randomSeed: 42,
    gameOver: false,
    gameEndReason: null,
    nationStates: nationStates as GameState['nationStates'],
    relationshipMatrix: relationshipMatrix as GameState['relationshipMatrix'],
    hexMap: {},
    unitRegistry: {},
    eventLog: [],
    headlineArchive: [],
    leaderProfiles: {} as GameState['leaderProfiles'],
    intelligenceCapabilities: {} as GameState['intelligenceCapabilities'],
    militaryForceStructures: {} as GameState['militaryForceStructures'],
    geographicPostures: {} as GameState['geographicPostures'],
    civilUnrestComponents: civilUnrestComponents as GameState['civilUnrestComponents'],
    nationFaultLines: {} as GameState['nationFaultLines'],
    currentViability: null,
    stateTrendHistory: [],
    actionPredictionCache: [],
    strategicConsistency: null,
    postGameAnalysis: null,
    emotionalStates: {} as GameState['emotionalStates'],
    cognitiveBiasRegistry: { definitions: [], assignments: {} as GameState['cognitiveBiasRegistry']['assignments'] },
    interpersonalChemistry: [],
    grudgeLedgers: {} as GameState['grudgeLedgers'],
    massPsychology: {} as GameState['massPsychology'],
    personalityDriftLogs: {} as GameState['personalityDriftLogs'],
    internationalLegitimacy: {} as GameState['internationalLegitimacy'],
    narrativeCampaignLogs: {} as GameState['narrativeCampaignLogs'],
    viralityQueue: { turn: 0 as TurnNumber, events: [] },
    sanctionsRegistry: [],
    financialNetworkState: { nations: {} as GameState['financialNetworkState']['nations'], gfsi: 75, currencyAttacks: [] },
    technologyIndices: {} as GameState['technologyIndices'],
    techBlocAlignmentMap: { nations: {} as GameState['techBlocAlignmentMap']['nations'], exportControlCoalitions: [], decouplingStatus: 0 as any },
    resourceSecurity: {} as GameState['resourceSecurity'],
    climateEventQueue: { upcoming: [], historical: [] },
    refugeeFlowTracker: { turn: 0 as TurnNumber, activeFlows: [] },
    proxyNetworkGraph: [],
    armsBazaarLog: [],
    globalFinancialStability: { turn: 0 as TurnNumber, gfsi: 75, contributingFactors: { sanctions: 0, tradeWars: 0, currencyAttacks: 0, debtCrises: 0 }, contagionActive: false, affectedNations: [], recoveryTrajectory: 'Stable' },
    dualUseTechAccords: { signatories: [], violations: [], nationCompliance: {} as GameState['dualUseTechAccords']['nationCompliance'] },
    mediaEcosystems: {} as GameState['mediaEcosystems'],
    nonStateActorRegistry: {},
    marketState: null,
    techModuleRegistry: null,
    ...overrides,
  } as GameState;
}

/**
 * Builds a RecordTurnInput with minimal defaults.
 */
function makeRecordInput(
  archive: ScenarioHistoryArchive,
  gameState: GameState,
  turn: number,
): RecordTurnInput {
  return {
    archive,
    gameState,
    turn,
    actions: [
      { actionId: 'a1', factionId: 'us' as FactionId, actionType: 'economic_stimulus', description: 'Stimulus package' },
    ],
    events: [
      { eventId: 'e1', turn, eventType: 'policy', description: 'Trade deal signed', affectedFactions: ['us' as FactionId] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioTurnIntegration', () => {
  // --- Constructor -------------------------------------------------------
  describe('constructor', () => {
    it('creates with default config', () => {
      const engine = new ScenarioTurnIntegration();
      expect(engine).toBeDefined();
    });

    it('accepts partial config overrides', () => {
      const engine = new ScenarioTurnIntegration({ gameVersion: '2.0.0' });
      expect(engine).toBeDefined();
    });
  });

  // --- initialiseArchive -------------------------------------------------
  describe('initialiseArchive', () => {
    it('creates an empty archive with metadata', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive(
        'test-scenario',
        'us' as FactionId,
        'Test Scenario',
      );

      expect(archive.scenarioId).toBe('test-scenario');
      expect(archive.playerFaction).toBe('us');
      expect(archive.turnsPlayed).toBe(0);
      expect(archive.turnHistory).toHaveLength(0);
      expect(archive.metadata.scenarioName).toBe('Test Scenario');
      expect(archive.metadata.gameVersion).toBe('1.0.0');
    });

    it('generates a unique runId', () => {
      const engine = new ScenarioTurnIntegration();
      const a1 = engine.initialiseArchive('s1', 'us' as FactionId, 'S1');
      const a2 = engine.initialiseArchive('s2', 'us' as FactionId, 'S2');

      expect(a1.runId).toBeTruthy();
      expect(a1.runId).toMatch(/^run-/);
    });

    it('uses custom game version from config', () => {
      const engine = new ScenarioTurnIntegration({ gameVersion: '2.5.0' });
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'S1');
      expect(archive.metadata.gameVersion).toBe('2.5.0');
    });
  });

  // --- recordTurn --------------------------------------------------------
  describe('recordTurn', () => {
    it('appends turn data to archive', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));

      expect(result.archive.turnHistory).toHaveLength(1);
      expect(result.archive.turnsPlayed).toBe(1);
    });

    it('records multiple turns sequentially', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;
      archive = engine.recordTurn(makeRecordInput(archive, gs, 2)).archive;
      archive = engine.recordTurn(makeRecordInput(archive, gs, 3)).archive;

      expect(archive.turnHistory).toHaveLength(3);
      expect(archive.turnsPlayed).toBe(3);
    });

    it('extracts nation snapshots from game state', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));
      const turnRecord = result.archive.turnHistory[0]!;

      // Should have snapshots for all 3 factions
      expect(turnRecord.nationSnapshots.length).toBe(3);

      const usSnap = turnRecord.nationSnapshots.find((s) => s.factionId === 'us');
      expect(usSnap).toBeDefined();
      expect(usSnap!.stability).toBe(70);
      expect(usSnap!.gdp).toBe(5000);
      expect(usSnap!.treasury).toBe(200);
      expect(usSnap!.militaryReadiness).toBe(65);
    });

    it('records actions and events', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));
      const turnRecord = result.archive.turnHistory[0]!;

      expect(turnRecord.actions).toHaveLength(1);
      expect(turnRecord.actions[0]!.actionType).toBe('economic_stimulus');
      expect(turnRecord.events).toHaveLength(1);
      expect(turnRecord.events[0]!.description).toBe('Trade deal signed');
    });

    it('extracts civil unrest from civilUnrestComponents', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));
      const usSnap = result.archive.turnHistory[0]!.nationSnapshots.find(
        (s) => s.factionId === 'us',
      )!;

      expect(usSnap.civilUnrest).toBe(15);
    });

    it('records market data when marketState is null', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState({ marketState: null });

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));
      const marketData = result.archive.turnHistory[0]!.marketData;

      expect(marketData.tickerCount).toBe(0);
      expect(Object.keys(marketData.exchangeComposites)).toHaveLength(0);
    });

    it('does not mutate the input archive', () => {
      const engine = new ScenarioTurnIntegration();
      const archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      const result = engine.recordTurn(makeRecordInput(archive, gs, 1));

      expect(archive.turnHistory).toHaveLength(0);
      expect(result.archive.turnHistory).toHaveLength(1);
    });
  });

  // --- completeScenario --------------------------------------------------
  describe('completeScenario', () => {
    it('computes a composite score and finalises the archive', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      // Record a few turns
      for (let t = 1; t <= 5; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      const result = engine.completeScenario({
        archive,
        gameState: gs,
        endReason: 'Economic Victory',
      });

      expect(result.archive.completedAt).toBeTruthy();
      expect(result.archive.victoryCondition).toBe('Economic Victory');
      expect(result.archive.finalScores).toBeDefined();
      expect(result.score.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.score.totalScore).toBeLessThanOrEqual(1000);
    });

    it('returns per-dimension scores in the result', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      for (let t = 1; t <= 3; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      const result = engine.completeScenario({
        archive,
        gameState: gs,
        endReason: 'Max turns reached',
      });

      expect(result.dimensionScores).toBeDefined();
      expect(typeof result.dimensionScores['stability']).toBe('number');
      expect(typeof result.dimensionScores['economic']).toBe('number');
      expect(typeof result.dimensionScores['military']).toBe('number');
    });

    it('score has all 7 dimensions', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;

      const result = engine.completeScenario({
        archive,
        gameState: gs,
        endReason: 'Defeat',
      });

      expect(result.score.dimensions).toHaveLength(7);
      const dims = result.score.dimensions.map((d) => d.dimension);
      expect(dims).toContain('stability');
      expect(dims).toContain('economic');
      expect(dims).toContain('military');
      expect(dims).toContain('diplomatic');
      expect(dims).toContain('technology');
      expect(dims).toContain('market');
      expect(dims).toContain('strategic');
    });

    it('higher stability produces higher stability dimension score', () => {
      const engine = new ScenarioTurnIntegration();

      // High stability scenario
      const gsHigh = makeGameState();
      (gsHigh.nationStates['us' as FactionId] as any).stability = 95;
      let archiveHigh = engine.initialiseArchive('high', 'us' as FactionId, 'High');
      archiveHigh = engine.recordTurn(makeRecordInput(archiveHigh, gsHigh, 1)).archive;
      const resultHigh = engine.completeScenario({ archive: archiveHigh, gameState: gsHigh, endReason: 'Win' });

      // Low stability scenario
      const gsLow = makeGameState();
      (gsLow.nationStates['us' as FactionId] as any).stability = 15;
      let archiveLow = engine.initialiseArchive('low', 'us' as FactionId, 'Low');
      archiveLow = engine.recordTurn(makeRecordInput(archiveLow, gsLow, 1)).archive;
      const resultLow = engine.completeScenario({ archive: archiveLow, gameState: gsLow, endReason: 'Lose' });

      expect(resultHigh.dimensionScores['stability']).toBeGreaterThan(
        resultLow.dimensionScores['stability']!,
      );
    });
  });

  // --- extractGameMetrics ------------------------------------------------
  describe('extractGameMetrics', () => {
    it('extracts correct faction and turns played', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      for (let t = 1; t <= 5; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      const metrics = engine.extractGameMetrics(gs, archive);

      expect(metrics.factionId).toBe('us');
      expect(metrics.turnsPlayed).toBe(5);
    });

    it('computes stability metrics from turn history', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      for (let t = 1; t <= 3; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      const metrics = engine.extractGameMetrics(gs, archive);

      expect(metrics.averageStability).toBe(70);
      expect(metrics.lowestStability).toBe(70);
      expect(metrics.stabilityTrend).toBe(0);
    });

    it('computes GDP growth percent', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      for (let t = 1; t <= 3; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      const metrics = engine.extractGameMetrics(gs, archive);

      // GDP is constant (5000) across all turns, so 0% growth
      expect(metrics.gdpGrowthPercent).toBe(0);
    });

    it('extracts economic metrics from nation state', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;

      const metrics = engine.extractGameMetrics(gs, archive);

      expect(metrics.finalTreasury).toBe(200);
      expect(metrics.averageInflation).toBe(3);
    });

    it('counts alliances from relationship matrix', () => {
      const engine = new ScenarioTurnIntegration();
      const gs = makeGameState();
      // Set china as ally (>70)
      (gs.relationshipMatrix as any)['us']['china'] = 85;
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;

      const metrics = engine.extractGameMetrics(gs, archive);

      expect(metrics.allianceCount).toBe(1);
    });

    it('extracts tech modules count from registry', () => {
      const engine = new ScenarioTurnIntegration();
      const gs = makeGameState({
        techModuleRegistry: {
          modules: {
            'mod-1': { techId: 't1', name: 'M1', domain: 'cyber', tier: 1, generatedBy: 'us' as FactionId, generatedOnTurn: 1, scenarioId: 's1', actualCostPaid: 100, effectiveDurationTurns: 5, synergyBonuses: [], exportable: true },
            'mod-2': { techId: 't2', name: 'M2', domain: 'ai', tier: 2, generatedBy: 'china' as FactionId, generatedOnTurn: 2, scenarioId: 's1', actualCostPaid: 200, effectiveDurationTurns: 6, synergyBonuses: [], exportable: false },
          },
          discoveryLog: [],
        },
      } as any);
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;

      const metrics = engine.extractGameMetrics(gs, archive);

      // Only US modules count
      expect(metrics.techModulesGenerated).toBe(1);
    });

    it('handles missing nation state gracefully', () => {
      const engine = new ScenarioTurnIntegration();
      const gs = makeGameState();
      delete (gs.nationStates as any)['us'];

      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      archive = engine.recordTurn({
        archive,
        gameState: makeGameState(), // Use normal state for recording
        turn: 1,
        actions: [],
        events: [],
      }).archive;

      // Extract from gs that has no US nation
      const metrics = engine.extractGameMetrics(gs, archive);

      expect(metrics.finalTreasury).toBe(0);
      expect(metrics.averageInflation).toBe(5); // default
    });

    it('computes market crash event count', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive('s1', 'us' as FactionId, 'Test');
      const gs = makeGameState();

      // Record turn with no market events
      archive = engine.recordTurn(makeRecordInput(archive, gs, 1)).archive;

      const metrics = engine.extractGameMetrics(gs, archive);
      expect(metrics.marketCrashEvents).toBe(0);
    });
  });

  // --- Full lifecycle ----------------------------------------------------
  describe('full lifecycle', () => {
    it('initialise -> record 10 turns -> complete', () => {
      const engine = new ScenarioTurnIntegration();
      let archive = engine.initialiseArchive(
        'lifecycle-test',
        'us' as FactionId,
        'Full Lifecycle Test',
      );
      const gs = makeGameState();

      // Record 10 turns
      for (let t = 1; t <= 10; t++) {
        archive = engine.recordTurn(makeRecordInput(archive, gs, t)).archive;
      }

      expect(archive.turnHistory).toHaveLength(10);
      expect(archive.turnsPlayed).toBe(10);
      expect(archive.completedAt).toBeUndefined();

      // Complete
      const result = engine.completeScenario({
        archive,
        gameState: gs,
        endReason: 'Diplomatic Victory',
      });

      expect(result.archive.turnHistory).toHaveLength(10);
      expect(result.archive.completedAt).toBeTruthy();
      expect(result.archive.victoryCondition).toBe('Diplomatic Victory');
      expect(result.archive.finalScores).toBeDefined();
      expect(result.score.totalScore).toBeGreaterThan(0);
      expect(result.score.dimensions).toHaveLength(7);
    });

    it('different game states produce different scores', () => {
      const engine = new ScenarioTurnIntegration();

      // Strong scenario
      const gsStrong = makeGameState();
      const usStrong = gsStrong.nationStates['us' as FactionId] as any;
      usStrong.stability = 95;
      usStrong.gdp = 30000;
      usStrong.treasury = 2000;
      usStrong.militaryReadiness = 90;
      usStrong.diplomaticInfluence = 85;
      usStrong.techLevel = 80;

      let archiveStrong = engine.initialiseArchive('strong', 'us' as FactionId, 'Strong');
      for (let t = 1; t <= 5; t++) {
        archiveStrong = engine.recordTurn(makeRecordInput(archiveStrong, gsStrong, t)).archive;
      }
      const resultStrong = engine.completeScenario({ archive: archiveStrong, gameState: gsStrong, endReason: 'Victory' });

      // Weak scenario
      const gsWeak = makeGameState();
      const usWeak = gsWeak.nationStates['us' as FactionId] as any;
      usWeak.stability = 15;
      usWeak.gdp = 500;
      usWeak.treasury = -100;
      usWeak.militaryReadiness = 20;
      usWeak.diplomaticInfluence = 10;
      usWeak.techLevel = 5;

      let archiveWeak = engine.initialiseArchive('weak', 'us' as FactionId, 'Weak');
      for (let t = 1; t <= 5; t++) {
        archiveWeak = engine.recordTurn(makeRecordInput(archiveWeak, gsWeak, t)).archive;
      }
      const resultWeak = engine.completeScenario({ archive: archiveWeak, gameState: gsWeak, endReason: 'Defeat' });

      expect(resultStrong.score.totalScore).toBeGreaterThan(resultWeak.score.totalScore);
    });
  });
});
