import { describe, it, expect } from 'vitest';
import { VictoryLossExtendedEngine } from '@/engine/victory-loss-extended';
import type {
  ExtendedConditionTracker,
  ExtendedConditionInput,
} from '@/engine/victory-loss-extended';
import type { ConditionCheckResult } from '@/engine/victory-loss-core';
import type {
  TurnNumber,
  LeaderId,
  NationState,
  LeaderProfile,
  LeaderIdentity,
  PowerBase,
  LeaderVulnerabilities,
  EmotionalStateSnapshot,
  TechnologyIndex,
  InternationalLegitimacy,
  CivilUnrestComponents,
  ResourceSecurityIndex,
  StrategicReserves,
  ImportDependency,
} from '@/data/types';
import { FactionId, ALL_FACTIONS, EscalationStage } from '@/data/types';

// ═══════════════════════════════════════════════════════════════════════════
// Helper factories
// ═══════════════════════════════════════════════════════════════════════════

function makeNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: FactionId.US,
    stability: 50,
    treasury: 500,
    gdp: 1000,
    inflation: 5,
    militaryReadiness: 50,
    nuclearThreshold: 0,
    diplomaticInfluence: 50,
    popularity: 50,
    allianceCredibility: 50,
    techLevel: 50,
    ...overrides,
  };
}

function makeLeader(
  overrides: {
    id?: string;
    nation?: FactionId;
    powerBase?: Partial<PowerBase>;
    vulnerabilities?: Partial<LeaderVulnerabilities>;
  } = {},
): LeaderProfile {
  return {
    id: (overrides.id ?? 'leader-us') as LeaderId,
    identity: { nation: overrides.nation ?? FactionId.US } as LeaderIdentity,
    powerBase: {
      military: 50,
      oligarchs: 50,
      party: 50,
      clergy: 50,
      public: 50,
      securityServices: 50,
      ...overrides.powerBase,
    },
    vulnerabilities: {
      healthRisk: 10,
      successionClarity: 70,
      coupRisk: 10,
      personalScandal: 10,
      ...overrides.vulnerabilities,
    },
  } as unknown as LeaderProfile;
}

function makeTracker(
  overrides: Partial<ExtendedConditionTracker> = {},
): ExtendedConditionTracker {
  return {
    vc10_ironFistTurns: 0,
    vc10_ironFistViolated: false,
    vc12_manipulatedLeaders: [],
    vc12_psyOpsDiscovered: false,
    vc13_traumaEventCount: 0,
    vc13_survivedCivilCrisis: false,
    vc14_legitimacyTurns: 0,
    vc14_narrativeBattleWins: 0,
    vc14_deepfakesAgainst: 0,
    vc15_proxyObjectives: 0,
    vc15_directCombatActions: 0,
    vc17_militaryCoercionActions: 0,
    ...overrides,
  };
}

function makeUnrest(
  overrides: Partial<CivilUnrestComponents> = {},
): CivilUnrestComponents {
  return {
    factionId: FactionId.US,
    turn: 1 as TurnNumber,
    civilUnrest: 20,
    inflation: 5,
    inequality: 10,
    repressionBacklash: 5,
    ethnicTension: 5,
    foreignPropaganda: 5,
    escalationStage: EscalationStage.Grumbling,
    ...overrides,
  };
}

function makeTech(overrides: Partial<TechnologyIndex> = {}): TechnologyIndex {
  return {
    factionId: FactionId.US,
    ai: 50,
    semiconductors: 50,
    quantum: 50,
    cyber: 50,
    biotech: 50,
    space: 50,
    techBlocAlignment: null,
    activeResearch: [],
    exportControls: {} as TechnologyIndex['exportControls'],
    ...overrides,
  } as TechnologyIndex;
}

function makeLegitimacy(
  overrides: Partial<InternationalLegitimacy> = {},
): InternationalLegitimacy {
  return {
    factionId: FactionId.US,
    turn: 1 as TurnNumber,
    legitimacy: 50,
    legitimacyDelta: 0,
    narrativeActive: null,
    narrativeBattleHistory: [],
    whistleblowerRisk: 10,
    ...overrides,
  };
}

function makeResIndex(
  overrides: Partial<ResourceSecurityIndex> = {},
): ResourceSecurityIndex {
  return {
    factionId: FactionId.US,
    turn: 1 as TurnNumber,
    energy: 50,
    food: 50,
    water: 50,
    criticalMinerals: 50,
    strategicReserves: { energy: 6, food: 6, water: 6, criticalMinerals: 6 } as StrategicReserves,
    activeResourceLeverage: [],
    importDependency: { energy: 30, food: 30, water: 30, criticalMinerals: 30 } as ImportDependency,
    ...overrides,
  };
}

function makeEmoState(
  overrides: Partial<EmotionalStateSnapshot> = {},
): EmotionalStateSnapshot {
  return {
    leaderId: 'leader-us' as LeaderId,
    turn: 1 as TurnNumber,
    stress: 30,
    confidence: 50,
    anger: 30,
    fear: 30,
    resolve: 50,
    decisionFatigue: 20,
    stressInoculated: false,
    ...overrides,
  };
}

function makeAllNations(
  overrides: Partial<Record<FactionId, Partial<NationState>>> = {},
): Record<FactionId, NationState> {
  const nations = {} as Record<FactionId, NationState>;
  for (const f of ALL_FACTIONS) {
    nations[f] = makeNation({ factionId: f, ...overrides[f] });
  }
  return nations;
}

function makeAllUnrest(
  overrides: Partial<Record<FactionId, Partial<CivilUnrestComponents>>> = {},
): Record<FactionId, CivilUnrestComponents> {
  const unrest = {} as Record<FactionId, CivilUnrestComponents>;
  for (const f of ALL_FACTIONS) {
    unrest[f] = makeUnrest({ factionId: f, ...overrides[f] });
  }
  return unrest;
}

function makeAllTech(
  overrides: Partial<Record<FactionId, Partial<TechnologyIndex>>> = {},
): Record<FactionId, TechnologyIndex> {
  const tech = {} as Record<FactionId, TechnologyIndex>;
  for (const f of ALL_FACTIONS) {
    tech[f] = makeTech({ factionId: f, ...overrides[f] });
  }
  return tech;
}

function makeAllLegitimacy(
  overrides: Partial<Record<FactionId, Partial<InternationalLegitimacy>>> = {},
): Record<FactionId, InternationalLegitimacy> {
  const leg = {} as Record<FactionId, InternationalLegitimacy>;
  for (const f of ALL_FACTIONS) {
    leg[f] = makeLegitimacy({ factionId: f, ...overrides[f] });
  }
  return leg;
}

function makeAllResIndex(
  overrides: Partial<Record<FactionId, Partial<ResourceSecurityIndex>>> = {},
): Record<FactionId, ResourceSecurityIndex> {
  const res = {} as Record<FactionId, ResourceSecurityIndex>;
  for (const f of ALL_FACTIONS) {
    res[f] = makeResIndex({ factionId: f, ...overrides[f] });
  }
  return res;
}

function makeInput(
  overrides: Partial<ExtendedConditionInput> = {},
): ExtendedConditionInput {
  const playerFaction = overrides.playerFaction ?? FactionId.US;
  const leaderId = 'leader-us' as LeaderId;
  return {
    currentTurn: 1 as TurnNumber,
    playerFaction,
    nationStates: makeAllNations(),
    leaderProfiles: {
      [leaderId]: makeLeader({ id: 'leader-us', nation: playerFaction }),
    } as Record<LeaderId, LeaderProfile>,
    emotionalStates: {
      [leaderId]: makeEmoState({ leaderId }),
    } as Record<LeaderId, EmotionalStateSnapshot>,
    technologyIndices: makeAllTech(),
    internationalLegitimacy: makeAllLegitimacy(),
    civilUnrestComponents: makeAllUnrest(),
    resourceSecurity: makeAllResIndex(),
    tracker: makeTracker(),
    baseVictoryId: null,
    strategicGrade: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('VictoryLossExtendedEngine', () => {
  const engine = new VictoryLossExtendedEngine();

  // ─────────────────────────────────────────────────────────
  // 1. createDefaultTracker
  // ─────────────────────────────────────────────────────────

  describe('createDefaultTracker', () => {
    it('returns all numeric fields as zero', () => {
      const t = VictoryLossExtendedEngine.createDefaultTracker();
      expect(t.vc10_ironFistTurns).toBe(0);
      expect(t.vc14_legitimacyTurns).toBe(0);
      expect(t.vc14_narrativeBattleWins).toBe(0);
      expect(t.vc14_deepfakesAgainst).toBe(0);
      expect(t.vc15_proxyObjectives).toBe(0);
      expect(t.vc15_directCombatActions).toBe(0);
      expect(t.vc17_militaryCoercionActions).toBe(0);
      expect(t.vc13_traumaEventCount).toBe(0);
    });

    it('returns boolean flags as false', () => {
      const t = VictoryLossExtendedEngine.createDefaultTracker();
      expect(t.vc10_ironFistViolated).toBe(false);
      expect(t.vc12_psyOpsDiscovered).toBe(false);
      expect(t.vc13_survivedCivilCrisis).toBe(false);
    });

    it('returns empty manipulated leaders array', () => {
      const t = VictoryLossExtendedEngine.createDefaultTracker();
      expect(t.vc12_manipulatedLeaders).toEqual([]);
      expect(t.vc12_manipulatedLeaders).toHaveLength(0);
    });

    it('returns a new object each call', () => {
      const a = VictoryLossExtendedEngine.createDefaultTracker();
      const b = VictoryLossExtendedEngine.createDefaultTracker();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. getConditionDefinitions
  // ─────────────────────────────────────────────────────────

  describe('getConditionDefinitions', () => {
    it('returns exactly 10 condition definitions', () => {
      const defs = engine.getConditionDefinitions();
      expect(defs).toHaveLength(10);
    });

    it('returns correct condition ids VC-08 through VC-17', () => {
      const ids = engine.getConditionDefinitions().map((d) => d.id);
      expect(ids).toEqual([
        'VC-08',
        'VC-09',
        'VC-10',
        'VC-11',
        'VC-12',
        'VC-13',
        'VC-14',
        'VC-15',
        'VC-16',
        'VC-17',
      ]);
    });

    it('returns a copy — mutating the result does not affect the engine', () => {
      const first = engine.getConditionDefinitions();
      first.pop();
      const second = engine.getConditionDefinitions();
      expect(second).toHaveLength(10);
    });

    it('loss conditions come before victory conditions', () => {
      const defs = engine.getConditionDefinitions();
      const types = defs.map((d) => d.type);
      // VC-08 and VC-09 are loss, rest are victory
      expect(types[0]).toBe('loss');
      expect(types[1]).toBe('loss');
      for (let i = 2; i < types.length; i++) {
        expect(types[i]).toBe('victory');
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. checkVC08 — Coup d'État
  // ─────────────────────────────────────────────────────────

  describe('checkVC08', () => {
    it('returns true when military < 30 AND security < 30 AND successionClarity <= 60', () => {
      const leader = makeLeader({
        powerBase: { military: 20, securityServices: 20 },
        vulnerabilities: { successionClarity: 50 },
      });
      expect(engine.checkVC08(leader)).toBe(true);
    });

    it('returns false when military >= 30', () => {
      const leader = makeLeader({
        powerBase: { military: 30, securityServices: 10 },
        vulnerabilities: { successionClarity: 10 },
      });
      expect(engine.checkVC08(leader)).toBe(false);
    });

    it('returns false when securityServices >= 30', () => {
      const leader = makeLeader({
        powerBase: { military: 10, securityServices: 30 },
        vulnerabilities: { successionClarity: 10 },
      });
      expect(engine.checkVC08(leader)).toBe(false);
    });

    it('returns false (survived) when successionClarity > 60 despite weak power base', () => {
      const leader = makeLeader({
        powerBase: { military: 10, securityServices: 10 },
        vulnerabilities: { successionClarity: 61 },
      });
      expect(engine.checkVC08(leader)).toBe(false);
    });

    it('returns true when successionClarity is exactly 60', () => {
      const leader = makeLeader({
        powerBase: { military: 0, securityServices: 0 },
        vulnerabilities: { successionClarity: 60 },
      });
      expect(engine.checkVC08(leader)).toBe(true);
    });

    it('returns false when both power base values are exactly at threshold', () => {
      const leader = makeLeader({
        powerBase: { military: 30, securityServices: 30 },
        vulnerabilities: { successionClarity: 10 },
      });
      expect(engine.checkVC08(leader)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. checkVC09 — People's Revolution
  // ─────────────────────────────────────────────────────────

  describe('checkVC09', () => {
    it('returns true when civilUnrest >= 100', () => {
      const unrest = makeUnrest({ civilUnrest: 100 });
      expect(engine.checkVC09(unrest)).toBe(true);
    });

    it('returns false when civilUnrest < 100', () => {
      const unrest = makeUnrest({ civilUnrest: 99 });
      expect(engine.checkVC09(unrest)).toBe(false);
    });

    it('returns true when civilUnrest exceeds 100', () => {
      const unrest = makeUnrest({ civilUnrest: 120 });
      expect(engine.checkVC09(unrest)).toBe(true);
    });

    it('returns false when civilUnrest is at default (20)', () => {
      const unrest = makeUnrest();
      expect(engine.checkVC09(unrest)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. checkVC10 — Iron Fist
  // ─────────────────────────────────────────────────────────

  describe('checkVC10', () => {
    it('returns true when turns >= 60 and not violated', () => {
      const tracker = makeTracker({ vc10_ironFistTurns: 60, vc10_ironFistViolated: false });
      expect(engine.checkVC10(tracker)).toBe(true);
    });

    it('returns false when violated even with enough turns', () => {
      const tracker = makeTracker({ vc10_ironFistTurns: 60, vc10_ironFistViolated: true });
      expect(engine.checkVC10(tracker)).toBe(false);
    });

    it('returns false when turns < 60', () => {
      const tracker = makeTracker({ vc10_ironFistTurns: 59, vc10_ironFistViolated: false });
      expect(engine.checkVC10(tracker)).toBe(false);
    });

    it('returns true when turns exceed 60', () => {
      const tracker = makeTracker({ vc10_ironFistTurns: 100, vc10_ironFistViolated: false });
      expect(engine.checkVC10(tracker)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 6. checkVC11 — Grand Strategist
  // ─────────────────────────────────────────────────────────

  describe('checkVC11', () => {
    it('returns true for eligible victory + S grade', () => {
      expect(engine.checkVC11('VC-01', 'S')).toBe(true);
    });

    it('returns true for VC-02 eligible victory + S grade', () => {
      expect(engine.checkVC11('VC-02', 'S')).toBe(true);
    });

    it('returns true for VC-03 eligible victory + S grade', () => {
      expect(engine.checkVC11('VC-03', 'S')).toBe(true);
    });

    it('returns true for VC-10 eligible victory + S grade', () => {
      expect(engine.checkVC11('VC-10', 'S')).toBe(true);
    });

    it('returns false for non-eligible victory', () => {
      expect(engine.checkVC11('VC-04', 'S')).toBe(false);
    });

    it('returns false for eligible victory + non-S grade (A)', () => {
      expect(engine.checkVC11('VC-01', 'A')).toBe(false);
    });

    it('returns false for eligible victory + non-S grade (F)', () => {
      expect(engine.checkVC11('VC-01', 'F')).toBe(false);
    });

    it('returns false when baseVictoryId is null', () => {
      expect(engine.checkVC11(null, 'S')).toBe(false);
    });

    it('returns false when grade is null', () => {
      expect(engine.checkVC11('VC-01', null)).toBe(false);
    });

    it('returns false when both are null', () => {
      expect(engine.checkVC11(null, null)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 7. checkVC12 — Puppet Master
  // ─────────────────────────────────────────────────────────

  describe('checkVC12', () => {
    it('returns true when >= 3 manipulated leaders and no discovery', () => {
      const tracker = makeTracker({
        vc12_manipulatedLeaders: ['l1' as LeaderId, 'l2' as LeaderId, 'l3' as LeaderId],
        vc12_psyOpsDiscovered: false,
      });
      expect(engine.checkVC12(tracker)).toBe(true);
    });

    it('returns false when discovered', () => {
      const tracker = makeTracker({
        vc12_manipulatedLeaders: ['l1' as LeaderId, 'l2' as LeaderId, 'l3' as LeaderId],
        vc12_psyOpsDiscovered: true,
      });
      expect(engine.checkVC12(tracker)).toBe(false);
    });

    it('returns false when < 3 leaders manipulated', () => {
      const tracker = makeTracker({
        vc12_manipulatedLeaders: ['l1' as LeaderId, 'l2' as LeaderId],
        vc12_psyOpsDiscovered: false,
      });
      expect(engine.checkVC12(tracker)).toBe(false);
    });

    it('returns true with more than 3 manipulated leaders', () => {
      const tracker = makeTracker({
        vc12_manipulatedLeaders: [
          'l1' as LeaderId,
          'l2' as LeaderId,
          'l3' as LeaderId,
          'l4' as LeaderId,
        ],
        vc12_psyOpsDiscovered: false,
      });
      expect(engine.checkVC12(tracker)).toBe(true);
    });

    it('returns false with 0 manipulated leaders', () => {
      const tracker = makeTracker({
        vc12_manipulatedLeaders: [],
        vc12_psyOpsDiscovered: false,
      });
      expect(engine.checkVC12(tracker)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 8. checkVC13 — Unbreakable
  // ─────────────────────────────────────────────────────────

  describe('checkVC13', () => {
    it('returns true when all criteria met', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 3,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 61 });
      expect(engine.checkVC13(tracker, nation, 80)).toBe(true);
    });

    it('returns false when trauma < 3', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 2,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 70 });
      expect(engine.checkVC13(tracker, nation, 90)).toBe(false);
    });

    it('returns false when no civil crisis survived', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 5,
        vc13_survivedCivilCrisis: false,
      });
      const nation = makeNation({ stability: 70 });
      expect(engine.checkVC13(tracker, nation, 90)).toBe(false);
    });

    it('returns false when stability < 60', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 5,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 59 });
      expect(engine.checkVC13(tracker, nation, 90)).toBe(false);
    });

    it('returns false when resolve < 80', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 5,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 70 });
      expect(engine.checkVC13(tracker, nation, 79)).toBe(false);
    });

    it('returns true at exact boundary values (trauma=3, stability=60, resolve=80)', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 3,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC13(tracker, nation, 80)).toBe(true);
    });

    it('returns true with many trauma events exceeded', () => {
      const tracker = makeTracker({
        vc13_traumaEventCount: 20,
        vc13_survivedCivilCrisis: true,
      });
      const nation = makeNation({ stability: 90 });
      expect(engine.checkVC13(tracker, nation, 100)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 9. checkVC14 — Information Hegemon
  // ─────────────────────────────────────────────────────────

  describe('checkVC14', () => {
    it('returns true when all criteria met (12 turns, 5 wins, 0 deepfakes)', () => {
      const tracker = makeTracker({
        vc14_legitimacyTurns: 12,
        vc14_narrativeBattleWins: 5,
        vc14_deepfakesAgainst: 0,
      });
      expect(engine.checkVC14(tracker)).toBe(true);
    });

    it('returns false when legitimacy turns < 12', () => {
      const tracker = makeTracker({
        vc14_legitimacyTurns: 11,
        vc14_narrativeBattleWins: 5,
        vc14_deepfakesAgainst: 0,
      });
      expect(engine.checkVC14(tracker)).toBe(false);
    });

    it('returns false when narrative wins < 5', () => {
      const tracker = makeTracker({
        vc14_legitimacyTurns: 12,
        vc14_narrativeBattleWins: 4,
        vc14_deepfakesAgainst: 0,
      });
      expect(engine.checkVC14(tracker)).toBe(false);
    });

    it('returns false when deepfakes > 0', () => {
      const tracker = makeTracker({
        vc14_legitimacyTurns: 12,
        vc14_narrativeBattleWins: 5,
        vc14_deepfakesAgainst: 1,
      });
      expect(engine.checkVC14(tracker)).toBe(false);
    });

    it('returns true with values exceeding thresholds', () => {
      const tracker = makeTracker({
        vc14_legitimacyTurns: 30,
        vc14_narrativeBattleWins: 20,
        vc14_deepfakesAgainst: 0,
      });
      expect(engine.checkVC14(tracker)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 10. checkVC15 — Shadow Emperor
  // ─────────────────────────────────────────────────────────

  describe('checkVC15', () => {
    it('returns true when >= 3 proxy objectives and 0 combat', () => {
      const tracker = makeTracker({
        vc15_proxyObjectives: 3,
        vc15_directCombatActions: 0,
      });
      expect(engine.checkVC15(tracker)).toBe(true);
    });

    it('returns false when < 3 objectives', () => {
      const tracker = makeTracker({
        vc15_proxyObjectives: 2,
        vc15_directCombatActions: 0,
      });
      expect(engine.checkVC15(tracker)).toBe(false);
    });

    it('returns false when > 0 combat actions', () => {
      const tracker = makeTracker({
        vc15_proxyObjectives: 5,
        vc15_directCombatActions: 1,
      });
      expect(engine.checkVC15(tracker)).toBe(false);
    });

    it('returns true with many proxy objectives and 0 combat', () => {
      const tracker = makeTracker({
        vc15_proxyObjectives: 10,
        vc15_directCombatActions: 0,
      });
      expect(engine.checkVC15(tracker)).toBe(true);
    });

    it('returns false with 0 objectives and 0 combat', () => {
      const tracker = makeTracker({
        vc15_proxyObjectives: 0,
        vc15_directCombatActions: 0,
      });
      expect(engine.checkVC15(tracker)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 11. checkVC16 — Tech Singularity
  // ─────────────────────────────────────────────────────────

  describe('checkVC16', () => {
    it('returns true when all tech thresholds met + stability >= 60', () => {
      const tech = makeTech({ ai: 90, quantum: 70, semiconductors: 80 });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC16(tech, nation)).toBe(true);
    });

    it('returns false when ai < 90', () => {
      const tech = makeTech({ ai: 89, quantum: 70, semiconductors: 80 });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC16(tech, nation)).toBe(false);
    });

    it('returns false when quantum < 70', () => {
      const tech = makeTech({ ai: 90, quantum: 69, semiconductors: 80 });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC16(tech, nation)).toBe(false);
    });

    it('returns false when semiconductors < 80', () => {
      const tech = makeTech({ ai: 90, quantum: 70, semiconductors: 79 });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC16(tech, nation)).toBe(false);
    });

    it('returns false when stability < 60', () => {
      const tech = makeTech({ ai: 90, quantum: 70, semiconductors: 80 });
      const nation = makeNation({ stability: 59 });
      expect(engine.checkVC16(tech, nation)).toBe(false);
    });

    it('returns true with values far exceeding thresholds', () => {
      const tech = makeTech({ ai: 100, quantum: 100, semiconductors: 100 });
      const nation = makeNation({ stability: 100 });
      expect(engine.checkVC16(tech, nation)).toBe(true);
    });

    it('returns true at exact boundary values', () => {
      const tech = makeTech({ ai: 90, quantum: 70, semiconductors: 80 });
      const nation = makeNation({ stability: 60 });
      expect(engine.checkVC16(tech, nation)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 12. checkVC17 — Resource Lord
  // ─────────────────────────────────────────────────────────

  describe('checkVC17', () => {
    it('returns true when >= 2 categories at >= 50%, DI >= 70, 0 coercion', () => {
      const percents = { energy: 60, food: 55, water: 30, criticalMinerals: 20 };
      const nation = makeNation({ diplomaticInfluence: 70 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 0 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(true);
    });

    it('returns false when < 2 categories at threshold', () => {
      const percents = { energy: 60, food: 40, water: 30, criticalMinerals: 20 };
      const nation = makeNation({ diplomaticInfluence: 70 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 0 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(false);
    });

    it('returns false when DI < 70', () => {
      const percents = { energy: 60, food: 55, water: 55, criticalMinerals: 55 };
      const nation = makeNation({ diplomaticInfluence: 69 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 0 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(false);
    });

    it('returns false when coercion > 0', () => {
      const percents = { energy: 60, food: 55, water: 55, criticalMinerals: 55 };
      const nation = makeNation({ diplomaticInfluence: 80 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 1 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(false);
    });

    it('returns true when all 4 categories meet threshold', () => {
      const percents = { energy: 80, food: 80, water: 80, criticalMinerals: 80 };
      const nation = makeNation({ diplomaticInfluence: 90 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 0 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(true);
    });

    it('returns true with exactly 2 categories at exactly 50%', () => {
      const percents = { energy: 50, food: 50, water: 10, criticalMinerals: 10 };
      const nation = makeNation({ diplomaticInfluence: 70 });
      const tracker = makeTracker({ vc17_militaryCoercionActions: 0 });
      expect(engine.checkVC17(percents, nation, tracker)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 13. updateTracker
  // ─────────────────────────────────────────────────────────

  describe('updateTracker', () => {
    it('VC-10 increments when unrest >= 40 and stability <= 50', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 50 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 45 },
        }),
        tracker: makeTracker({ vc10_ironFistTurns: 5 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc10_ironFistTurns).toBe(6);
      expect(updated.vc10_ironFistViolated).toBe(false);
    });

    it('VC-10 sets violated when unrest < 40', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 39 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 45 },
        }),
        tracker: makeTracker({ vc10_ironFistTurns: 5 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc10_ironFistViolated).toBe(true);
    });

    it('VC-10 sets violated when stability > 50', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 60 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 51 },
        }),
        tracker: makeTracker({ vc10_ironFistTurns: 10 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc10_ironFistViolated).toBe(true);
    });

    it('VC-10 stays violated once violated — does not re-increment', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 60 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 40 },
        }),
        tracker: makeTracker({ vc10_ironFistTurns: 10, vc10_ironFistViolated: true }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc10_ironFistViolated).toBe(true);
      expect(updated.vc10_ironFistTurns).toBe(10);
    });

    it('VC-10 increments at exact boundary (unrest=40, stability=50)', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 40 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 50 },
        }),
        tracker: makeTracker({ vc10_ironFistTurns: 0 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc10_ironFistTurns).toBe(1);
      expect(updated.vc10_ironFistViolated).toBe(false);
    });

    it('VC-12 adds manipulated leaders when anger > 70', () => {
      const rivalId = 'leader-china' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          ['leader-us' as LeaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
          [rivalId]: makeLeader({ id: 'leader-china', nation: FactionId.China }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          ['leader-us' as LeaderId]: makeEmoState({ leaderId: 'leader-us' as LeaderId, anger: 30 }),
          [rivalId]: makeEmoState({ leaderId: rivalId, anger: 71 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        tracker: makeTracker(),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc12_manipulatedLeaders).toContain(rivalId);
    });

    it('VC-12 adds manipulated leaders when fear > 70', () => {
      const rivalId = 'leader-russia' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          ['leader-us' as LeaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
          [rivalId]: makeLeader({ id: 'leader-russia', nation: FactionId.Russia }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          ['leader-us' as LeaderId]: makeEmoState({ leaderId: 'leader-us' as LeaderId }),
          [rivalId]: makeEmoState({ leaderId: rivalId, fear: 71 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        tracker: makeTracker(),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc12_manipulatedLeaders).toContain(rivalId);
    });

    it('VC-12 does not add player faction leaders', () => {
      const input = makeInput({
        leaderProfiles: {
          ['leader-us' as LeaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          ['leader-us' as LeaderId]: makeEmoState({
            leaderId: 'leader-us' as LeaderId,
            anger: 99,
            fear: 99,
          }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        tracker: makeTracker(),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc12_manipulatedLeaders).toHaveLength(0);
    });

    it('VC-12 does not duplicate already-manipulated leaders', () => {
      const rivalId = 'leader-china' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          ['leader-us' as LeaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
          [rivalId]: makeLeader({ id: 'leader-china', nation: FactionId.China }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          ['leader-us' as LeaderId]: makeEmoState({ leaderId: 'leader-us' as LeaderId }),
          [rivalId]: makeEmoState({ leaderId: rivalId, anger: 80 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        tracker: makeTracker({ vc12_manipulatedLeaders: [rivalId] }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc12_manipulatedLeaders).toHaveLength(1);
    });

    it('VC-14 increments legitimacy streak when legitimacy >= 90', () => {
      const input = makeInput({
        internationalLegitimacy: makeAllLegitimacy({
          [FactionId.US]: { legitimacy: 90 },
        }),
        tracker: makeTracker({ vc14_legitimacyTurns: 5 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc14_legitimacyTurns).toBe(6);
    });

    it('VC-14 resets legitimacy streak when below 90', () => {
      const input = makeInput({
        internationalLegitimacy: makeAllLegitimacy({
          [FactionId.US]: { legitimacy: 89 },
        }),
        tracker: makeTracker({ vc14_legitimacyTurns: 10 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc14_legitimacyTurns).toBe(0);
    });

    it('VC-14 increments at exact boundary (legitimacy=90)', () => {
      const input = makeInput({
        internationalLegitimacy: makeAllLegitimacy({
          [FactionId.US]: { legitimacy: 90 },
        }),
        tracker: makeTracker({ vc14_legitimacyTurns: 11 }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc14_legitimacyTurns).toBe(12);
    });

    it('does not mutate original tracker', () => {
      const original = makeTracker({ vc10_ironFistTurns: 5 });
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 50 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 40 },
        }),
        tracker: original,
      });
      const updated = engine.updateTracker(input);
      expect(updated).not.toBe(original);
      expect(original.vc10_ironFistTurns).toBe(5);
      expect(updated.vc10_ironFistTurns).toBe(6);
    });

    it('preserves event-driven fields (trauma, narrative wins, deepfakes, proxy, combat, coercion)', () => {
      const input = makeInput({
        tracker: makeTracker({
          vc13_traumaEventCount: 4,
          vc13_survivedCivilCrisis: true,
          vc14_narrativeBattleWins: 7,
          vc14_deepfakesAgainst: 2,
          vc15_proxyObjectives: 3,
          vc15_directCombatActions: 1,
          vc17_militaryCoercionActions: 2,
        }),
      });
      const updated = engine.updateTracker(input);
      expect(updated.vc13_traumaEventCount).toBe(4);
      expect(updated.vc13_survivedCivilCrisis).toBe(true);
      expect(updated.vc14_narrativeBattleWins).toBe(7);
      expect(updated.vc14_deepfakesAgainst).toBe(2);
      expect(updated.vc15_proxyObjectives).toBe(3);
      expect(updated.vc15_directCombatActions).toBe(1);
      expect(updated.vc17_militaryCoercionActions).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 14. evaluateTurn
  // ─────────────────────────────────────────────────────────

  describe('evaluateTurn', () => {
    it('loss conditions short-circuit victories', () => {
      const leaderId = 'leader-us' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          [leaderId]: makeLeader({
            id: 'leader-us',
            nation: FactionId.US,
            powerBase: { military: 10, securityServices: 10 },
            vulnerabilities: { successionClarity: 20 },
          }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        // Also set up conditions that would trigger VC-10 victory
        tracker: makeTracker({ vc10_ironFistTurns: 60 }),
      });
      const results = engine.evaluateTurn(input);
      const ids = results.map((r) => r.conditionId);
      expect(ids).toContain('VC-08');
      expect(ids).not.toContain('VC-10');
    });

    it('VC-08 coup triggers in evaluateTurn', () => {
      const leaderId = 'leader-us' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          [leaderId]: makeLeader({
            id: 'leader-us',
            nation: FactionId.US,
            powerBase: { military: 5, securityServices: 5 },
            vulnerabilities: { successionClarity: 30 },
          }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      const coup = results[0] as ConditionCheckResult;
      expect(coup.conditionId).toBe('VC-08');
      expect(coup.conditionName).toBe("Coup d'État");
      expect(coup.conditionType).toBe('loss');
      expect(coup.triggered).toBe(true);
      expect(coup.triggeringFaction).toBe(FactionId.US);
    });

    it('VC-09 revolution triggers in evaluateTurn', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 100 },
        }),
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      const rev = results[0] as ConditionCheckResult;
      expect(rev.conditionId).toBe('VC-09');
      expect(rev.conditionName).toBe("People's Revolution");
      expect(rev.conditionType).toBe('loss');
      expect(rev.triggered).toBe(true);
    });

    it('VC-08 and VC-09 can both trigger simultaneously as losses', () => {
      const leaderId = 'leader-us' as LeaderId;
      const input = makeInput({
        leaderProfiles: {
          [leaderId]: makeLeader({
            id: 'leader-us',
            nation: FactionId.US,
            powerBase: { military: 5, securityServices: 5 },
            vulnerabilities: { successionClarity: 20 },
          }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 100 },
        }),
      });
      const results = engine.evaluateTurn(input);
      const ids = results.map((r) => r.conditionId);
      expect(ids).toContain('VC-08');
      expect(ids).toContain('VC-09');
      expect(results).toHaveLength(2);
    });

    it('VC-10 victory when maintained for 60 turns', () => {
      const input = makeInput({
        tracker: makeTracker({ vc10_ironFistTurns: 60, vc10_ironFistViolated: false }),
      });
      const results = engine.evaluateTurn(input);
      const vc10 = results.find((r) => r.conditionId === 'VC-10');
      expect(vc10).toBeDefined();
      expect(vc10!.conditionType).toBe('victory');
      expect(vc10!.triggered).toBe(true);
    });

    it('VC-11 grand strategist triggers with eligible victory and S grade', () => {
      const input = makeInput({
        baseVictoryId: 'VC-01',
        strategicGrade: 'S',
      });
      const results = engine.evaluateTurn(input);
      const vc11 = results.find((r) => r.conditionId === 'VC-11');
      expect(vc11).toBeDefined();
      expect(vc11!.conditionType).toBe('victory');
    });

    it('VC-12 puppet master triggers', () => {
      const input = makeInput({
        tracker: makeTracker({
          vc12_manipulatedLeaders: ['l1' as LeaderId, 'l2' as LeaderId, 'l3' as LeaderId],
          vc12_psyOpsDiscovered: false,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc12 = results.find((r) => r.conditionId === 'VC-12');
      expect(vc12).toBeDefined();
      expect(vc12!.conditionType).toBe('victory');
    });

    it('VC-16 tech singularity triggers', () => {
      const input = makeInput({
        technologyIndices: makeAllTech({
          [FactionId.US]: { ai: 95, quantum: 80, semiconductors: 85 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 70 },
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc16 = results.find((r) => r.conditionId === 'VC-16');
      expect(vc16).toBeDefined();
      expect(vc16!.conditionType).toBe('victory');
      expect(vc16!.triggeringFaction).toBe(FactionId.US);
    });

    it('returns empty array when no conditions met', () => {
      const input = makeInput({
        currentTurn: 5 as TurnNumber,
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(0);
    });

    it('VC-13 only evaluated at final turn (turn >= 60)', () => {
      const leaderId = 'leader-us' as LeaderId;
      // Set up conditions that would pass VC-13 check
      const input = makeInput({
        currentTurn: 30 as TurnNumber,
        leaderProfiles: {
          [leaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId, resolve: 90 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 80 },
        }),
        tracker: makeTracker({
          vc13_traumaEventCount: 5,
          vc13_survivedCivilCrisis: true,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc13 = results.find((r) => r.conditionId === 'VC-13');
      expect(vc13).toBeUndefined();
    });

    it('VC-13 triggers at final turn when criteria met', () => {
      const leaderId = 'leader-us' as LeaderId;
      const input = makeInput({
        currentTurn: 60 as TurnNumber,
        leaderProfiles: {
          [leaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId, resolve: 90 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 80 },
        }),
        tracker: makeTracker({
          vc13_traumaEventCount: 5,
          vc13_survivedCivilCrisis: true,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc13 = results.find((r) => r.conditionId === 'VC-13');
      expect(vc13).toBeDefined();
      expect(vc13!.conditionType).toBe('victory');
      expect(vc13!.triggered).toBe(true);
    });

    it('VC-14 information hegemon triggers', () => {
      const input = makeInput({
        tracker: makeTracker({
          vc14_legitimacyTurns: 12,
          vc14_narrativeBattleWins: 5,
          vc14_deepfakesAgainst: 0,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc14 = results.find((r) => r.conditionId === 'VC-14');
      expect(vc14).toBeDefined();
      expect(vc14!.conditionType).toBe('victory');
    });

    it('VC-15 shadow emperor triggers', () => {
      const input = makeInput({
        tracker: makeTracker({
          vc15_proxyObjectives: 5,
          vc15_directCombatActions: 0,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc15 = results.find((r) => r.conditionId === 'VC-15');
      expect(vc15).toBeDefined();
      expect(vc15!.conditionType).toBe('victory');
    });

    it('VC-17 resource lord triggers with dominant resource control', () => {
      // Set player US to have high resource values, others low
      const input = makeInput({
        resourceSecurity: makeAllResIndex({
          [FactionId.US]: { energy: 400, food: 400, water: 10, criticalMinerals: 10 },
          [FactionId.China]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.Russia]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.Japan]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.Iran]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.DPRK]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.EU]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
          [FactionId.Syria]: { energy: 10, food: 10, water: 50, criticalMinerals: 50 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { diplomaticInfluence: 80 },
        }),
        tracker: makeTracker({ vc17_militaryCoercionActions: 0 }),
      });
      const results = engine.evaluateTurn(input);
      const vc17 = results.find((r) => r.conditionId === 'VC-17');
      expect(vc17).toBeDefined();
      expect(vc17!.conditionType).toBe('victory');
    });

    it('multiple victories can trigger in one turn', () => {
      const input = makeInput({
        technologyIndices: makeAllTech({
          [FactionId.US]: { ai: 95, quantum: 80, semiconductors: 85 },
        }),
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 70 },
        }),
        tracker: makeTracker({
          vc10_ironFistTurns: 60,
          vc10_ironFistViolated: false,
          vc15_proxyObjectives: 5,
          vc15_directCombatActions: 0,
        }),
      });
      const results = engine.evaluateTurn(input);
      const ids = results.map((r) => r.conditionId);
      expect(ids).toContain('VC-10');
      expect(ids).toContain('VC-15');
      expect(ids).toContain('VC-16');
    });

    it('works for non-US player faction', () => {
      const leaderId = 'leader-china' as LeaderId;
      const input = makeInput({
        playerFaction: FactionId.China,
        leaderProfiles: {
          [leaderId]: makeLeader({ id: 'leader-china', nation: FactionId.China }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        technologyIndices: makeAllTech({
          [FactionId.China]: { ai: 95, quantum: 80, semiconductors: 85 },
        }),
        nationStates: makeAllNations({
          [FactionId.China]: { stability: 70 },
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc16 = results.find((r) => r.conditionId === 'VC-16');
      expect(vc16).toBeDefined();
      expect(vc16!.triggeringFaction).toBe(FactionId.China);
    });

    it('VC-13 uses resolve from player leader emotional state', () => {
      const leaderId = 'leader-us' as LeaderId;
      // resolve too low
      const input = makeInput({
        currentTurn: 60 as TurnNumber,
        leaderProfiles: {
          [leaderId]: makeLeader({ id: 'leader-us', nation: FactionId.US }),
        } as Record<LeaderId, LeaderProfile>,
        emotionalStates: {
          [leaderId]: makeEmoState({ leaderId, resolve: 79 }),
        } as Record<LeaderId, EmotionalStateSnapshot>,
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 80 },
        }),
        tracker: makeTracker({
          vc13_traumaEventCount: 5,
          vc13_survivedCivilCrisis: true,
        }),
      });
      const results = engine.evaluateTurn(input);
      const vc13 = results.find((r) => r.conditionId === 'VC-13');
      expect(vc13).toBeUndefined();
    });

    it('evaluateTurn results include reason strings', () => {
      const input = makeInput({
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 100 },
        }),
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      expect(results[0]!.reason).toBeDefined();
      expect(results[0]!.reason.length).toBeGreaterThan(0);
    });
  });
});
