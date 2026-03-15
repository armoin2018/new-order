import { describe, it, expect, beforeEach } from 'vitest';
import { NationSelectionEngine } from '@/engine/nation-selection';
import { GAME_CONFIG } from '@/engine/config';
import { FactionId, DecisionStyle, StressResponse, Doctrine } from '@/data/types';

import type {
  FactionId as FactionIdType,
  LeaderId,
  TurnNumber,
  NationState,
  GeographicPosture,
  IntelligenceCapabilityMatrix,
  IntelligenceCapabilities,
  AIProfileConfig,
  ScenarioDefinition,
  LeaderProfile,
  LeaderIdentity,
  LeaderPsychology,
  LeaderMotivations,
  PowerBase,
  LeaderVulnerabilities,
  EmotionalStateSnapshot,
  MilitaryForceStructure,
} from '@/data/types';

// ---------------------------------------------------------------------------
// All 8 factions
// ---------------------------------------------------------------------------

const ALL_FACTION_IDS: FactionIdType[] = [
  FactionId.US,
  FactionId.China,
  FactionId.Russia,
  FactionId.Japan,
  FactionId.Iran,
  FactionId.DPRK,
  FactionId.EU,
  FactionId.Syria,
];

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

function makeMockLeader(
  factionId: FactionIdType,
  overrides?: Partial<LeaderProfile>,
): LeaderProfile {
  const identity: LeaderIdentity = {
    name: `Leader-${factionId}`,
    title: `President-${factionId}`,
    nation: factionId,
    age: 60,
    ideology: 'Pragmatist',
  };

  const psychology: LeaderPsychology = {
    decisionStyle: DecisionStyle.Analytical,
    stressResponse: StressResponse.Consolidate,
    riskTolerance: 50,
    paranoia: 40,
    narcissism: 30,
    pragmatism: 60,
    patience: 55,
    vengefulIndex: 35,
  };

  const motivations: LeaderMotivations = {
    primaryGoal: 'National Stability',
    ideologicalCore: 'Centrism',
    redLines: ['Nuclear attack on homeland'],
    legacyAmbition: 'Enduring peace',
  };

  const powerBase: PowerBase = {
    military: 60,
    oligarchs: 50,
    party: 55,
    clergy: 10,
    public: 50,
    securityServices: 55,
  };

  const vulnerabilities: LeaderVulnerabilities = {
    healthRisk: 10,
    successionClarity: 70,
    coupRisk: 5,
    personalScandal: 10,
  };

  return {
    id: `leader-${factionId}` as unknown as LeaderId,
    identity,
    psychology,
    motivations,
    powerBase,
    vulnerabilities,
    historicalAnalog: `Historical analog for ${factionId}`,
    ...overrides,
  };
}

function makeMockNationState(
  factionId: FactionIdType,
  overrides?: Partial<NationState>,
): NationState {
  return {
    factionId,
    stability: 65,
    treasury: 500,
    gdp: 2000,
    inflation: 3,
    militaryReadiness: 70,
    nuclearThreshold: 20,
    diplomaticInfluence: 55,
    popularity: 50,
    allianceCredibility: 60,
    techLevel: 75,
    ...overrides,
  };
}

function makeMockEmotionalState(
  leaderId: LeaderId,
): EmotionalStateSnapshot {
  return {
    leaderId,
    turn: 1 as unknown as TurnNumber,
    stress: 20,
    confidence: 60,
    anger: 10,
    fear: 15,
    resolve: 50,
    decisionFatigue: 5,
    stressInoculated: false,
  };
}

function makeMockAIProfile(
  factionId: FactionIdType,
  leader: LeaderProfile,
): AIProfileConfig {
  return {
    factionId,
    leader,
    initialEmotionalState: makeMockEmotionalState(leader.id),
    biasAssignments: [],
  };
}

function makeMockIntelMatrix(
  factionId: FactionIdType,
  overrides?: Partial<IntelligenceCapabilities>,
): IntelligenceCapabilityMatrix {
  return {
    factionId,
    capabilities: {
      humint: 50,
      sigint: 50,
      cyber: 50,
      covert: 50,
      counterIntel: 50,
      ...overrides,
    },
    operationsLog: [],
    assetRegistry: [],
  };
}

function makeMockGeoPosture(factionId: FactionIdType): GeographicPosture {
  return {
    factionId,
    strategicDepth: 60,
    naturalDefenses: ['Mountains', 'Rivers'],
    keyVulnerabilities: ['Coastal exposure'],
    chokepointControl: ['Strait A'],
    terrainAdvantage: 10,
    energyDependency: 40,
  };
}

function makeMockMilitaryForceStructure(
  factionId: FactionIdType,
): MilitaryForceStructure {
  return {
    factionId,
    activeForces: 500,
    nuclearArsenal: 100,
    navalPower: 60,
    airPower: 65,
    specialCapability: ['Hypersonic Missiles'],
    forceProjection: 55,
    readiness: 70,
    doctrine: Doctrine.Hybrid,
    techLevel: 75,
  };
}

function makeMockScenario(
  factionIds: FactionIdType[] = ALL_FACTION_IDS,
  overrides?: Partial<ScenarioDefinition>,
): ScenarioDefinition {
  // Build relationship matrix — default all pairs to 50
  const relationshipMatrix: Record<string, Record<string, number>> = {};
  for (const a of factionIds) {
    relationshipMatrix[a] = {};
    for (const b of factionIds) {
      relationshipMatrix[a]![b] = a === b ? 0 : 50;
    }
  }

  // Build per-faction records
  const nationStates: Record<string, NationState> = {};
  const geographicPostures: Record<string, GeographicPosture> = {};
  const militaryForceStructures: Record<string, MilitaryForceStructure> = {};
  const intelligenceCapabilities: Record<string, IntelligenceCapabilityMatrix> = {};
  const aiProfiles: Record<string, AIProfileConfig> = {};

  for (const fId of factionIds) {
    const leader = makeMockLeader(fId);
    nationStates[fId] = makeMockNationState(fId);
    geographicPostures[fId] = makeMockGeoPosture(fId);
    militaryForceStructures[fId] = makeMockMilitaryForceStructure(fId);
    intelligenceCapabilities[fId] = makeMockIntelMatrix(fId);
    aiProfiles[fId] = makeMockAIProfile(fId, leader);
  }

  return {
    meta: {
      id: 'test-scenario',
      name: 'Test Scenario',
      version: '1.0.0',
      author: 'Test Author',
      description: 'A test scenario for nation selection',
      maxTurns: 60,
    },
    factions: factionIds,
    relationshipMatrix: relationshipMatrix as ScenarioDefinition['relationshipMatrix'],
    nationStates: nationStates as ScenarioDefinition['nationStates'],
    geographicPostures: geographicPostures as ScenarioDefinition['geographicPostures'],
    nationFaultLines: {} as ScenarioDefinition['nationFaultLines'],
    mapConfig: {} as ScenarioDefinition['mapConfig'],
    units: [],
    militaryForceStructures: militaryForceStructures as ScenarioDefinition['militaryForceStructures'],
    intelligenceCapabilities: intelligenceCapabilities as ScenarioDefinition['intelligenceCapabilities'],
    aiProfiles: aiProfiles as ScenarioDefinition['aiProfiles'],
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
    ...overrides,
  } as ScenarioDefinition;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NationSelectionEngine', () => {
  let engine: NationSelectionEngine;
  let scenario: ScenarioDefinition;

  beforeEach(() => {
    engine = new NationSelectionEngine(GAME_CONFIG.meta);
    scenario = makeMockScenario();
  });

  // ─────────────────────────────────────────────────────────
  // validateSelection
  // ─────────────────────────────────────────────────────────

  describe('validateSelection', () => {
    it('returns valid for a faction present in the scenario', () => {
      const result = engine.validateSelection(FactionId.US, scenario);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('Selection is valid');
    });

    it('returns invalid when faction is not in scenario factions', () => {
      // Remove US from factions list and add a duplicate to keep count at 8
      const factions = scenario.factions.filter((f) => f !== FactionId.US);
      factions.push(FactionId.China); // duplicate to keep length 8
      const modified = makeMockScenario(factions);

      const result = engine.validateSelection(FactionId.US, modified);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not available');
    });

    it('returns invalid when scenario has wrong faction count', () => {
      // Only 4 factions
      const shortFactions: FactionIdType[] = [
        FactionId.US,
        FactionId.China,
        FactionId.Russia,
        FactionId.Japan,
      ];
      const modified = makeMockScenario(shortFactions);

      const result = engine.validateSelection(FactionId.US, modified);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('4');
      expect(result.reason).toContain('8');
    });

    it('returns invalid when faction is missing nationState data', () => {
      // Delete the nationState entry for US
      const modified = makeMockScenario();
       
      delete (modified.nationStates as Record<string, NationState>)[FactionId.US];

      const result = engine.validateSelection(FactionId.US, modified);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing nation-state data');
    });

    it('returns invalid when faction is missing aiProfile data', () => {
      // Delete the aiProfile entry for US
      const modified = makeMockScenario();
       
      delete (modified.aiProfiles as Record<string, AIProfileConfig>)[FactionId.US];

      const result = engine.validateSelection(FactionId.US, modified);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing an AI profile');
    });
  });

  // ─────────────────────────────────────────────────────────
  // buildNationSummaries
  // ─────────────────────────────────────────────────────────

  describe('buildNationSummaries', () => {
    it('returns 8 summaries for a valid 8-faction scenario', () => {
      const summaries = engine.buildNationSummaries(scenario);
      expect(summaries).toHaveLength(8);
    });

    it('each summary has correct factionId, leaderName, stability, and treasury', () => {
      const summaries = engine.buildNationSummaries(scenario);

      for (const summary of summaries) {
        const nationState = scenario.nationStates[summary.factionId];
        const aiProfile = scenario.aiProfiles[summary.factionId];

        expect(nationState).toBeDefined();
        expect(aiProfile).toBeDefined();

        expect(summary.leaderName).toBe(aiProfile!.leader.identity.name);
        expect(summary.stability).toBe(nationState!.stability);
        expect(summary.treasury).toBe(nationState!.treasury);
      }
    });

    it('derives specialCapability from highest intelligence capability score', () => {
      // Set US intel matrix with sigint as dominant capability
      const modified = makeMockScenario();
      (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.US] =
        makeMockIntelMatrix(FactionId.US, {
          humint: 30,
          sigint: 95,
          cyber: 40,
          covert: 20,
          counterIntel: 10,
        });

      const summaries = engine.buildNationSummaries(modified);
      const usSummary = summaries.find((s) => s.factionId === FactionId.US);

      expect(usSummary).toBeDefined();
      expect(usSummary!.specialCapability).toBe('SIGINT Dominance');
    });

    it('returns "Unknown" specialCapability when intel matrix is missing', () => {
      const modified = makeMockScenario();
      // Remove the intel matrix for US
       
      delete (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.US];

      const summaries = engine.buildNationSummaries(modified);
      const usSummary = summaries.find((s) => s.factionId === FactionId.US);

      expect(usSummary).toBeDefined();
      expect(usSummary!.specialCapability).toBe('Unknown');
    });

    it('skips factions missing nationState', () => {
      const modified = makeMockScenario();
      // Remove nationState for US
       
      delete (modified.nationStates as Record<string, NationState>)[FactionId.US];

      const summaries = engine.buildNationSummaries(modified);
      expect(summaries).toHaveLength(7);
      expect(summaries.find((s) => s.factionId === FactionId.US)).toBeUndefined();
    });

    it('skips factions missing aiProfile', () => {
      const modified = makeMockScenario();
      // Remove aiProfile for Russia
       
      delete (modified.aiProfiles as Record<string, AIProfileConfig>)[FactionId.Russia];

      const summaries = engine.buildNationSummaries(modified);
      expect(summaries).toHaveLength(7);
      expect(summaries.find((s) => s.factionId === FactionId.Russia)).toBeUndefined();
    });

    it('derives HUMINT Dominance when humint is highest', () => {
      const modified = makeMockScenario();
      (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.China] =
        makeMockIntelMatrix(FactionId.China, {
          humint: 90,
          sigint: 30,
          cyber: 40,
          covert: 20,
          counterIntel: 10,
        });

      const summaries = engine.buildNationSummaries(modified);
      const chinaSummary = summaries.find((s) => s.factionId === FactionId.China);
      expect(chinaSummary).toBeDefined();
      expect(chinaSummary!.specialCapability).toBe('HUMINT Dominance');
    });

    it('derives Cyber Dominance when cyber is highest', () => {
      const modified = makeMockScenario();
      (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.DPRK] =
        makeMockIntelMatrix(FactionId.DPRK, {
          humint: 10,
          sigint: 20,
          cyber: 95,
          covert: 30,
          counterIntel: 15,
        });

      const summaries = engine.buildNationSummaries(modified);
      const dprkSummary = summaries.find((s) => s.factionId === FactionId.DPRK);
      expect(dprkSummary).toBeDefined();
      expect(dprkSummary!.specialCapability).toBe('Cyber Dominance');
    });

    it('derives Covert Ops Dominance when covert is highest', () => {
      const modified = makeMockScenario();
      (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.Iran] =
        makeMockIntelMatrix(FactionId.Iran, {
          humint: 20,
          sigint: 30,
          cyber: 10,
          covert: 85,
          counterIntel: 40,
        });

      const summaries = engine.buildNationSummaries(modified);
      const iranSummary = summaries.find((s) => s.factionId === FactionId.Iran);
      expect(iranSummary).toBeDefined();
      expect(iranSummary!.specialCapability).toBe('Covert Ops Dominance');
    });

    it('derives Counter-Intel Dominance when counterIntel is highest', () => {
      const modified = makeMockScenario();
      (modified.intelligenceCapabilities as Record<string, IntelligenceCapabilityMatrix>)[FactionId.Russia] =
        makeMockIntelMatrix(FactionId.Russia, {
          humint: 30,
          sigint: 20,
          cyber: 40,
          covert: 10,
          counterIntel: 90,
        });

      const summaries = engine.buildNationSummaries(modified);
      const russiaSummary = summaries.find((s) => s.factionId === FactionId.Russia);
      expect(russiaSummary).toBeDefined();
      expect(russiaSummary!.specialCapability).toBe('Counter-Intel Dominance');
    });

    it('includes correct gdp, militaryReadiness, techLevel, diplomaticInfluence', () => {
      const modified = makeMockScenario();
      (modified.nationStates as Record<string, NationState>)[FactionId.Japan] =
        makeMockNationState(FactionId.Japan, {
          gdp: 5000,
          militaryReadiness: 80,
          techLevel: 95,
          diplomaticInfluence: 70,
        });

      const summaries = engine.buildNationSummaries(modified);
      const japanSummary = summaries.find((s) => s.factionId === FactionId.Japan);

      expect(japanSummary).toBeDefined();
      expect(japanSummary!.gdp).toBe(5000);
      expect(japanSummary!.militaryReadiness).toBe(80);
      expect(japanSummary!.techLevel).toBe(95);
      expect(japanSummary!.diplomaticInfluence).toBe(70);
    });

    it('includes leaderTitle and ideology from leader identity', () => {
      const summaries = engine.buildNationSummaries(scenario);
      const usSummary = summaries.find((s) => s.factionId === FactionId.US);

      expect(usSummary).toBeDefined();
      expect(usSummary!.leaderTitle).toBe(`President-${FactionId.US}`);
      expect(usSummary!.ideology).toBe('Pragmatist');
    });
  });

  // ─────────────────────────────────────────────────────────
  // resolveDefaultLeader
  // ─────────────────────────────────────────────────────────

  describe('resolveDefaultLeader', () => {
    it('returns the correct leader for a valid faction', () => {
      const leader = engine.resolveDefaultLeader(FactionId.US, scenario);
      expect(leader).toBeDefined();
      expect(leader.id).toBe(`leader-${FactionId.US}` as unknown as LeaderId);
    });

    it('throws when faction has no aiProfile', () => {
      const modified = makeMockScenario();
       
      delete (modified.aiProfiles as Record<string, AIProfileConfig>)[FactionId.EU];

      expect(() => engine.resolveDefaultLeader(FactionId.EU, modified)).toThrow(
        /No AI profile found/,
      );
    });

    it('returned leader has correct identity fields', () => {
      const leader = engine.resolveDefaultLeader(FactionId.China, scenario);

      expect(leader.identity.name).toBe(`Leader-${FactionId.China}`);
      expect(leader.identity.title).toBe(`President-${FactionId.China}`);
      expect(leader.identity.nation).toBe(FactionId.China);
      expect(leader.identity.age).toBe(60);
      expect(leader.identity.ideology).toBe('Pragmatist');
    });

    it('returned leader has psychology, motivations, powerBase, vulnerabilities', () => {
      const leader = engine.resolveDefaultLeader(FactionId.Russia, scenario);

      expect(leader.psychology).toBeDefined();
      expect(leader.psychology.decisionStyle).toBe(DecisionStyle.Analytical);
      expect(leader.motivations).toBeDefined();
      expect(leader.motivations.primaryGoal).toBe('National Stability');
      expect(leader.powerBase).toBeDefined();
      expect(leader.powerBase.military).toBe(60);
      expect(leader.vulnerabilities).toBeDefined();
      expect(leader.vulnerabilities.healthRisk).toBe(10);
    });

    it('returned leader has historicalAnalog string', () => {
      const leader = engine.resolveDefaultLeader(FactionId.Japan, scenario);
      expect(typeof leader.historicalAnalog).toBe('string');
      expect(leader.historicalAnalog).toContain(FactionId.Japan);
    });
  });

  // ─────────────────────────────────────────────────────────
  // createSelectionResult
  // ─────────────────────────────────────────────────────────

  describe('createSelectionResult', () => {
    it('returns a valid result for a valid player selection', () => {
      const result = engine.createSelectionResult(FactionId.US, scenario);

      expect(result).toBeDefined();
      expect(result.playerFaction).toBe(FactionId.US);
      expect(result.playerLeader).toBeDefined();
      expect(result.assignments).toBeDefined();
      expect(result.allSummaries).toBeDefined();
    });

    it('throws when the selection is invalid', () => {
      // Build a scenario with only 4 factions so validation fails
      const shortFactions: FactionIdType[] = [
        FactionId.US,
        FactionId.China,
        FactionId.Russia,
        FactionId.Japan,
      ];
      const modified = makeMockScenario(shortFactions);

      expect(() => engine.createSelectionResult(FactionId.US, modified)).toThrow(
        /Invalid nation selection/,
      );
    });

    it('assignments has exactly 8 entries', () => {
      const result = engine.createSelectionResult(FactionId.China, scenario);
      expect(result.assignments).toHaveLength(8);
    });

    it('marks the player faction with isPlayer: true', () => {
      const result = engine.createSelectionResult(FactionId.Russia, scenario);
      const playerAssignment = result.assignments.find(
        (a) => a.factionId === FactionId.Russia,
      );

      expect(playerAssignment).toBeDefined();
      expect(playerAssignment!.isPlayer).toBe(true);
    });

    it('marks all non-player factions with isPlayer: false', () => {
      const result = engine.createSelectionResult(FactionId.Japan, scenario);
      const nonPlayerAssignments = result.assignments.filter(
        (a) => a.factionId !== FactionId.Japan,
      );

      expect(nonPlayerAssignments).toHaveLength(7);
      for (const assignment of nonPlayerAssignments) {
        expect(assignment.isPlayer).toBe(false);
      }
    });

    it('playerLeader matches the leader resolved for the player faction', () => {
      const result = engine.createSelectionResult(FactionId.Iran, scenario);
      const expectedLeader = engine.resolveDefaultLeader(FactionId.Iran, scenario);

      expect(result.playerLeader.id).toBe(expectedLeader.id);
      expect(result.playerLeader.identity.name).toBe(expectedLeader.identity.name);
      expect(result.playerLeader.identity.nation).toBe(FactionId.Iran);
    });

    it('allSummaries has exactly 8 entries', () => {
      const result = engine.createSelectionResult(FactionId.EU, scenario);
      expect(result.allSummaries).toHaveLength(8);
    });

    it('each assignment has a leaderId', () => {
      const result = engine.createSelectionResult(FactionId.US, scenario);

      for (const assignment of result.assignments) {
        expect(assignment.leaderId).toBeDefined();
        expect(typeof assignment.leaderId).toBe('string');
      }
    });

    it('playerFaction equals the faction passed to createSelectionResult', () => {
      const result = engine.createSelectionResult(FactionId.DPRK, scenario);
      expect(result.playerFaction).toBe(FactionId.DPRK);
    });

    it('throws when the player faction has no aiProfile', () => {
      const modified = makeMockScenario();
       
      delete (modified.aiProfiles as Record<string, AIProfileConfig>)[FactionId.Syria];

      expect(() => engine.createSelectionResult(FactionId.Syria, modified)).toThrow();
    });
  });
});
