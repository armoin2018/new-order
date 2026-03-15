import { describe, it, expect, beforeEach } from 'vitest';
import { NationBriefingEngine } from '@/engine/nation-briefing';
import type {
  BriefingSectionId,
  RelationshipSummary,
  StrategicRecommendation,
  NationBriefing,
} from '@/engine/nation-briefing';
import type {
  FactionId as FactionIdType,
  LeaderId,
  TurnNumber,
  NationState,
  GeographicPosture,
  IntelligenceCapabilityMatrix,
  AIProfileConfig,
  ScenarioDefinition,
  LeaderProfile,
  MilitaryForceStructure,
} from '@/data/types';
import { FactionId, DecisionStyle, StressResponse, Doctrine } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers — Leader Factory
// ─────────────────────────────────────────────────────────

function makeLeader(
  factionId: FactionIdType,
  overrides: {
    name?: string;
    title?: string;
    ideology?: string;
    decisionStyle?: typeof DecisionStyle[keyof typeof DecisionStyle];
    primaryGoal?: string;
  } = {},
): LeaderProfile {
  return {
    id: `leader-${factionId}` as unknown as LeaderId,
    identity: {
      name: overrides.name ?? `Leader of ${factionId}`,
      title: overrides.title ?? 'President',
      nation: factionId,
      age: 62,
      ideology: overrides.ideology ?? 'Pragmatic Realism',
    },
    psychology: {
      decisionStyle: overrides.decisionStyle ?? DecisionStyle.Analytical,
      stressResponse: StressResponse.Consolidate,
      riskTolerance: 50,
      paranoia: 30,
      narcissism: 40,
      pragmatism: 70,
      patience: 60,
      vengefulIndex: 25,
    },
    motivations: {
      primaryGoal: overrides.primaryGoal ?? 'Global Leadership',
      ideologicalCore: 'Democratic Capitalism',
      redLines: ['Nuclear attack on homeland'],
      legacyAmbition: 'Remembered as a stabilising force',
    },
    powerBase: {
      military: 80,
      oligarchs: 55,
      party: 65,
      clergy: 20,
      public: 60,
      securityServices: 75,
    },
    vulnerabilities: {
      healthRisk: 15,
      successionClarity: 70,
      coupRisk: 5,
      personalScandal: 20,
    },
    historicalAnalog: 'Dwight D. Eisenhower',
  };
}

// ─────────────────────────────────────────────────────────
// Helpers — NationState Factory
// ─────────────────────────────────────────────────────────

function makeNationState(
  factionId: FactionIdType,
  overrides: Partial<NationState> = {},
): NationState {
  return {
    factionId,
    stability: 55,
    treasury: 500,
    gdp: 2000,
    inflation: 3,
    militaryReadiness: 60,
    nuclearThreshold: 20,
    diplomaticInfluence: 50,
    popularity: 55,
    allianceCredibility: 70,
    techLevel: 60,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Helpers — Intel, Geo, Military Factories
// ─────────────────────────────────────────────────────────

function makeIntelMatrix(factionId: FactionIdType): IntelligenceCapabilityMatrix {
  return {
    factionId,
    capabilities: {
      humint: 70,
      sigint: 80,
      cyber: 85,
      covert: 60,
      counterIntel: 75,
    },
    operationsLog: [],
    assetRegistry: [],
  };
}

function makeGeoPosture(factionId: FactionIdType): GeographicPosture {
  return {
    factionId,
    strategicDepth: 65,
    naturalDefenses: ['Oceans', 'Mountain ranges'],
    keyVulnerabilities: ['Long coastline'],
    chokepointControl: ['Panama Canal'],
    terrainAdvantage: 15,
    energyDependency: 30,
  };
}

function makeMilitaryForce(factionId: FactionIdType): MilitaryForceStructure {
  return {
    factionId,
    activeForces: 1400,
    nuclearArsenal: 5500,
    navalPower: 90,
    airPower: 95,
    specialCapability: ['Hypersonic Missiles', 'Space Weapons'],
    forceProjection: 95,
    readiness: 85,
    doctrine: Doctrine.Hybrid,
    techLevel: 90,
  };
}

// ─────────────────────────────────────────────────────────
// Helpers — AIProfileConfig Factory
// ─────────────────────────────────────────────────────────

function makeAIProfile(factionId: FactionIdType, leaderName?: string): AIProfileConfig {
  return {
    factionId,
    leader: makeLeader(factionId, { name: leaderName }),
    initialEmotionalState: {
      leaderId: `leader-${factionId}` as unknown as LeaderId,
      turn: 1 as unknown as TurnNumber,
      stress: 30,
      confidence: 60,
      anger: 10,
      fear: 15,
      resolve: 70,
      decisionFatigue: 5,
      stressInoculated: false,
    },
    biasAssignments: [],
  };
}

// ─────────────────────────────────────────────────────────
// Helpers — Complete Scenario Factory
// ─────────────────────────────────────────────────────────

const ALL_FACTIONS: FactionIdType[] = [
  FactionId.US,
  FactionId.China,
  FactionId.Russia,
  FactionId.Japan,
  FactionId.Iran,
  FactionId.DPRK,
  FactionId.EU,
  FactionId.Syria,
];

/** Leader names for relationship label tests. */
const LEADER_NAMES: Record<string, string> = {
  [FactionId.US]: 'James Hardin',
  [FactionId.China]: 'Xi Jinping',
  [FactionId.Russia]: 'Vladimir Putin',
  [FactionId.Japan]: 'Shigeru Ishiba',
  [FactionId.Iran]: 'Ali Khamenei',
  [FactionId.DPRK]: 'Kim Jong Un',
  [FactionId.EU]: 'Ursula von der Leyen',
  [FactionId.Syria]: 'Ahmad al-Sharaa',
};

/** Specific tensions from US to each other faction. */
const US_TENSIONS: Record<string, number> = {
  [FactionId.China]: 65,
  [FactionId.Russia]: 80,
  [FactionId.Japan]: 15,
  [FactionId.Iran]: 90,
  [FactionId.DPRK]: 85,
  [FactionId.EU]: 25,
  [FactionId.Syria]: 70,
};

function buildScenario(): ScenarioDefinition {
  // Build relationship matrix — every faction defaults to 50 for non-US rows
  const relationshipMatrix = {} as Record<FactionIdType, Record<FactionIdType, number>>;
  for (const f of ALL_FACTIONS) {
    const row = {} as Record<FactionIdType, number>;
    for (const g of ALL_FACTIONS) {
      if (f === g) {
        row[g] = 0;
      } else if (f === FactionId.US) {
        row[g] = US_TENSIONS[g] ?? 50;
      } else {
        row[g] = 50;
      }
    }
    relationshipMatrix[f] = row;
  }

  // Build per-faction record maps
  const nationStates = {} as Record<FactionIdType, NationState>;
  const geographicPostures = {} as Record<FactionIdType, GeographicPosture>;
  const militaryForceStructures = {} as Record<FactionIdType, MilitaryForceStructure>;
  const intelligenceCapabilities = {} as Record<FactionIdType, IntelligenceCapabilityMatrix>;
  const aiProfiles = {} as Record<FactionIdType, AIProfileConfig>;
  const nationFaultLines = {} as Record<FactionIdType, { factionId: FactionIdType; faultLines: never[] }>;

  for (const f of ALL_FACTIONS) {
    nationStates[f] =
      f === FactionId.US
        ? makeNationState(f, {
            stability: 35,
            treasury: 150,
            militaryReadiness: 85,
            diplomaticInfluence: 75,
            techLevel: 90,
          })
        : makeNationState(f);

    geographicPostures[f] = makeGeoPosture(f);
    militaryForceStructures[f] = makeMilitaryForce(f);
    intelligenceCapabilities[f] = makeIntelMatrix(f);
    aiProfiles[f] = makeAIProfile(f, LEADER_NAMES[f]);
    nationFaultLines[f] = { factionId: f, faultLines: [] } as unknown as (typeof nationFaultLines)[FactionIdType];
  }

  return {
    meta: {
      id: 'test-scenario',
      name: 'Test Scenario',
      version: '1.0.0',
      author: 'test',
      description: 'Test scenario for nation briefing',
      maxTurns: 30,
    },
    factions: [...ALL_FACTIONS],
    relationshipMatrix,
    nationStates,
    geographicPostures,
    nationFaultLines,
    mapConfig: { width: 20, height: 20, defaultTerrain: 'Plains', hexOverrides: [] },
    units: [],
    militaryForceStructures,
    intelligenceCapabilities,
    aiProfiles,
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
  } as ScenarioDefinition;
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('NationBriefingEngine', () => {
  let engine: NationBriefingEngine;
  let scenario: ScenarioDefinition;
  let usLeader: LeaderProfile;

  beforeEach(() => {
    engine = new NationBriefingEngine();
    scenario = buildScenario();
    usLeader = makeLeader(FactionId.US, {
      name: 'James Hardin',
      title: 'President',
      ideology: 'Pragmatic Realism',
      decisionStyle: DecisionStyle.Analytical,
      primaryGoal: 'Global Leadership',
    });
  });

  // ───────────────────────────────────────────────────────
  // compileBriefing
  // ───────────────────────────────────────────────────────

  describe('compileBriefing', () => {
    let briefing: NationBriefing;

    beforeEach(() => {
      briefing = engine.compileBriefing(FactionId.US, usLeader, scenario);
    });

    it('returns the correct factionId', () => {
      expect(briefing.factionId).toBe(FactionId.US);
    });

    it('returns the leader passed in', () => {
      expect(briefing.leader).toBe(usLeader);
    });

    it('returns exactly 8 sections', () => {
      expect(briefing.sections).toHaveLength(8);
    });

    it('sections have correct ids in order', () => {
      const expected: BriefingSectionId[] = [
        'leaderProfile',
        'powerBase',
        'intelligence',
        'military',
        'geography',
        'vulnerabilities',
        'relationships',
        'strategies',
      ];
      const actual = briefing.sections.map((s) => s.id);
      expect(actual).toEqual(expected);
    });

    it('leaderProfile section has 7 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'leaderProfile');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(7);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'Name',
        'Title',
        'Ideology',
        'Decision Style',
        'Stress Response',
        'Primary Goal',
        'Historical Analog',
      ]);
    });

    it('powerBase section has 6 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'powerBase');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(6);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'Military Loyalty',
        'Oligarch Support',
        'Party Cohesion',
        'Clergy Support',
        'Public Approval',
        'Security Services',
      ]);
    });

    it('intelligence section has 5 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'intelligence');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(5);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'HUMINT',
        'SIGINT',
        'CYBER',
        'COVERT',
        'Counter-Intelligence',
      ]);
    });

    it('military section has 7 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'military');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(7);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'Active Forces',
        'Nuclear Arsenal',
        'Naval Power',
        'Air Power',
        'Special Capabilities',
        'Force Projection',
        'Readiness',
      ]);
    });

    it('geography section has 6 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'geography');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(6);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'Strategic Depth',
        'Natural Defenses',
        'Key Vulnerabilities',
        'Chokepoint Control',
        'Terrain Advantage',
        'Energy Dependency',
      ]);
    });

    it('vulnerabilities section has 4 entries', () => {
      const section = briefing.sections.find((s) => s.id === 'vulnerabilities');
      expect(section).toBeDefined();
      expect(section!.entries).toHaveLength(4);

      const labels = section!.entries.map((e) => e.label);
      expect(labels).toEqual([
        'Health Risk',
        'Succession Clarity',
        'Coup Risk',
        'Personal Scandal',
      ]);
    });

    it('relationships section entry count matches other factions', () => {
      const section = briefing.sections.find((s) => s.id === 'relationships');
      expect(section).toBeDefined();
      // 8 factions total, minus self = 7
      expect(section!.entries).toHaveLength(7);
    });

    it('strategies section has entries', () => {
      const section = briefing.sections.find((s) => s.id === 'strategies');
      expect(section).toBeDefined();
      expect(section!.entries.length).toBeGreaterThan(0);
    });

    it('returns relationships array (RelationshipSummary[])', () => {
      expect(Array.isArray(briefing.relationships)).toBe(true);
      expect(briefing.relationships.length).toBeGreaterThan(0);
      const first = briefing.relationships[0]!;
      expect(first).toHaveProperty('factionId');
      expect(first).toHaveProperty('factionLabel');
      expect(first).toHaveProperty('tensionLevel');
      expect(first).toHaveProperty('classification');
    });

    it('returns strategies array (StrategicRecommendation[])', () => {
      expect(Array.isArray(briefing.strategies)).toBe(true);
      expect(briefing.strategies.length).toBeGreaterThan(0);
      const first = briefing.strategies[0]!;
      expect(first).toHaveProperty('priority');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('recommendation');
      expect(first).toHaveProperty('rationale');
    });
  });

  // ───────────────────────────────────────────────────────
  // buildRelationships
  // ───────────────────────────────────────────────────────

  describe('buildRelationships', () => {
    let relationships: readonly RelationshipSummary[];

    beforeEach(() => {
      relationships = engine.buildRelationships(FactionId.US, scenario);
    });

    it('returns 7 entries for 8-faction scenario (excludes self)', () => {
      expect(relationships).toHaveLength(7);
      const ids = relationships.map((r) => r.factionId);
      expect(ids).not.toContain(FactionId.US);
    });

    it('correctly classifies Ally (tension 15 — Japan)', () => {
      const japan = relationships.find((r) => r.factionId === FactionId.Japan);
      expect(japan).toBeDefined();
      expect(japan!.classification).toBe('Ally');
      expect(japan!.tensionLevel).toBe(15);
    });

    it('correctly classifies Neutral (tension 25 — EU)', () => {
      const eu = relationships.find((r) => r.factionId === FactionId.EU);
      expect(eu).toBeDefined();
      expect(eu!.classification).toBe('Neutral');
      expect(eu!.tensionLevel).toBe(25);
    });

    it('correctly classifies Rival (tension 65 — China)', () => {
      const china = relationships.find((r) => r.factionId === FactionId.China);
      expect(china).toBeDefined();
      expect(china!.classification).toBe('Rival');
      expect(china!.tensionLevel).toBe(65);
    });

    it('correctly classifies Hostile (tension 80 — Russia)', () => {
      const russia = relationships.find((r) => r.factionId === FactionId.Russia);
      expect(russia).toBeDefined();
      expect(russia!.classification).toBe('Hostile');
      expect(russia!.tensionLevel).toBe(80);
    });

    it('factionLabel comes from leader name in aiProfiles', () => {
      const china = relationships.find((r) => r.factionId === FactionId.China);
      expect(china).toBeDefined();
      expect(china!.factionLabel).toBe('Xi Jinping');

      const japan = relationships.find((r) => r.factionId === FactionId.Japan);
      expect(japan).toBeDefined();
      expect(japan!.factionLabel).toBe('Shigeru Ishiba');
    });

    it('tension level matches scenario data', () => {
      const iran = relationships.find((r) => r.factionId === FactionId.Iran);
      expect(iran).toBeDefined();
      expect(iran!.tensionLevel).toBe(90);
      expect(iran!.classification).toBe('Hostile');

      const dprk = relationships.find((r) => r.factionId === FactionId.DPRK);
      expect(dprk).toBeDefined();
      expect(dprk!.tensionLevel).toBe(85);
      expect(dprk!.classification).toBe('Hostile');

      const syria = relationships.find((r) => r.factionId === FactionId.Syria);
      expect(syria).toBeDefined();
      expect(syria!.tensionLevel).toBe(70);
      expect(syria!.classification).toBe('Rival');
    });

    it('defaults to 50 (Neutral) if no matrix row for the faction', () => {
      // Build a scenario where the factionId has no row in relationshipMatrix
      const sparseScenario = buildScenario();
      // Delete the US row entirely to simulate a missing entry
       
      delete (sparseScenario.relationshipMatrix as Record<string, unknown>)[FactionId.US];

      const rels = engine.buildRelationships(FactionId.US, sparseScenario);
      for (const r of rels) {
        expect(r.tensionLevel).toBe(50);
        expect(r.classification).toBe('Neutral');
      }
    });
  });

  // ───────────────────────────────────────────────────────
  // generateStrategies
  // ───────────────────────────────────────────────────────

  describe('generateStrategies', () => {
    let strategies: readonly StrategicRecommendation[];

    beforeEach(() => {
      strategies = engine.generateStrategies(FactionId.US, usLeader, scenario);
    });

    it('includes domestic recommendation when stability < 40', () => {
      const domestic = strategies.find((s) => s.category === 'domestic');
      expect(domestic).toBeDefined();
      expect(domestic!.priority).toBe('high');
    });

    it('includes economic recommendation when treasury < 200', () => {
      const economic = strategies.find((s) => s.category === 'economic');
      expect(economic).toBeDefined();
      expect(economic!.priority).toBe('high');
    });

    it('includes military recommendation when militaryReadiness > 70', () => {
      const military = strategies.find((s) => s.category === 'military');
      expect(military).toBeDefined();
      expect(military!.priority).toBe('medium');
    });

    it('includes diplomacy recommendation when diplomaticInfluence > 60', () => {
      const diplomacy = strategies.find((s) => s.category === 'diplomacy');
      expect(diplomacy).toBeDefined();
      expect(diplomacy!.priority).toBe('medium');
    });

    it('includes technology recommendation when techLevel > 70', () => {
      const technology = strategies.find((s) => s.category === 'technology');
      expect(technology).toBeDefined();
      expect(technology!.priority).toBe('medium');
    });

    it('always includes leadership recommendation with primary goal', () => {
      // Use a scenario where fewer thresholds fire so leadership isn't capped out
      const calmScenario = buildScenario();
      calmScenario.nationStates[FactionId.US] = makeNationState(FactionId.US, {
        stability: 80,    // >= 40 → no domestic
        treasury: 500,    // >= 200 → no economic
        militaryReadiness: 50, // <= 70 → no military
        diplomaticInfluence: 40, // <= 60 → no diplomacy
        techLevel: 50,    // <= 70 → no technology
      });

      const calmStrategies = engine.generateStrategies(FactionId.US, usLeader, calmScenario);
      // Only candidate should be leadership
      expect(calmStrategies).toHaveLength(1);
      const leadership = calmStrategies[0];
      expect(leadership).toBeDefined();
      expect(leadership!.priority).toBe('medium');
      expect(leadership!.category).toBe('leadership');
      expect(leadership!.recommendation).toContain('Global Leadership');
    });

    it('is capped at 5 recommendations', () => {
      // Our US nation state triggers all 5 threshold conditions + leadership = 6 candidates
      // After sorting and capping, we should get at most 5
      expect(strategies.length).toBeLessThanOrEqual(5);
      expect(strategies).toHaveLength(5);
    });

    it('is sorted by decision-style relevance then priority', () => {
      // For Analytical: technology=3, economic=2, diplomacy=2, military=2, domestic=2, leadership=1
      // There are 6 candidates; cap at 5 means leadership (relevance=1) is likely dropped.
      // Among relevance-3 items: technology (medium, weight=2)
      // Among relevance-2 items: domestic (high, weight=3), economic (high, weight=3),
      //                           military (medium, weight=2), diplomacy (medium, weight=2)
      // Expected sort: technology first (rel=3), then domestic & economic (rel=2, high),
      //                then military & diplomacy (rel=2, medium)
      const categories = strategies.map((s) => s.category);

      // Technology should be first (highest relevance = 3 for Analytical)
      expect(categories[0]).toBe('technology');

      // The next two should be the high-priority items (domestic, economic) in some order
      const nextTwo = categories.slice(1, 3);
      expect(nextTwo).toContain('domestic');
      expect(nextTwo).toContain('economic');

      // The last two should be medium-priority, relevance-2 items
      const lastTwo = categories.slice(3, 5);
      expect(lastTwo).toContain('military');
      expect(lastTwo).toContain('diplomacy');
    });

    it('for Analytical leader, technology category gets highest relevance', () => {
      // Technology should appear first since Analytical gives it relevance 3
      const first = strategies[0];
      expect(first).toBeDefined();
      expect(first!.category).toBe('technology');
    });

    it('does NOT include domestic recommendation when stability >= 40', () => {
      // Create a scenario where stability is at the boundary (>= 40)
      const stableScenario = buildScenario();
      stableScenario.nationStates[FactionId.US] = makeNationState(FactionId.US, {
        stability: 40,
        treasury: 150,
        militaryReadiness: 85,
        diplomaticInfluence: 75,
        techLevel: 90,
      });

      const stableStrategies = engine.generateStrategies(
        FactionId.US,
        usLeader,
        stableScenario,
      );

      const domestic = stableStrategies.find((s) => s.category === 'domestic');
      expect(domestic).toBeUndefined();
    });
  });
});
