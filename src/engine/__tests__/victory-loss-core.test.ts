import { describe, it, expect } from 'vitest';
import { VictoryLossCoreEngine } from '@/engine/victory-loss-core';
import type {
  ConditionDefinition,
  ConsecutiveTurnTracker,
  CoreConditionInput,
} from '@/engine/victory-loss-core';
import type {
  TurnNumber,
  LeaderId,
  NationState,
  RelationshipMatrix,
  CivilUnrestComponents,
  LeaderProfile,
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

function makeRelationshipMatrix(
  defaultTension = 50,
): RelationshipMatrix {
  const matrix = {} as Record<FactionId, Record<FactionId, number>>;
  for (const a of ALL_FACTIONS) {
    matrix[a] = {} as Record<FactionId, number>;
    for (const b of ALL_FACTIONS) {
      matrix[a][b] = a === b ? 0 : defaultTension;
    }
  }
  return matrix;
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

function makeTracker(
  overrides: Partial<ConsecutiveTurnTracker> = {},
): ConsecutiveTurnTracker {
  return { vc01: 0, vc02: 0, vc03: 0, vc06: 0, ...overrides };
}

function makeInput(
  overrides: Partial<CoreConditionInput> = {},
): CoreConditionInput {
  return {
    currentTurn: 1 as TurnNumber,
    playerFaction: FactionId.US,
    nationStates: makeAllNations(),
    relationshipMatrix: makeRelationshipMatrix(),
    civilUnrestComponents: makeAllUnrest(),
    leaderProfiles: {} as Record<LeaderId, LeaderProfile>,
    consecutiveTracker: makeTracker(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('VictoryLossCoreEngine', () => {
  const engine = new VictoryLossCoreEngine();

  // ─────────────────────────────────────────────────────────
  // 1. getConditionDefinitions
  // ─────────────────────────────────────────────────────────

  describe('getConditionDefinitions', () => {
    it('returns exactly 7 condition definitions', () => {
      const defs: ConditionDefinition[] = engine.getConditionDefinitions();
      expect(defs).toHaveLength(7);
    });

    it('returns correct condition ids VC-01 through VC-07', () => {
      const ids = engine.getConditionDefinitions().map((d) => d.id);
      expect(ids).toEqual([
        'VC-01',
        'VC-02',
        'VC-03',
        'VC-04',
        'VC-05',
        'VC-06',
        'VC-07',
      ]);
    });

    it('returns a copy — mutating the result does not affect the engine', () => {
      const first = engine.getConditionDefinitions();
      first.pop();
      const second = engine.getConditionDefinitions();
      expect(second).toHaveLength(7);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. checkVC01Thresholds
  // ─────────────────────────────────────────────────────────

  describe('checkVC01Thresholds', () => {
    it('returns true when all 3 metrics at or above thresholds', () => {
      const nation = makeNation({
        stability: 90,
        diplomaticInfluence: 80,
        militaryReadiness: 70,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(true);
    });

    it('returns false when stability below 80', () => {
      const nation = makeNation({
        stability: 79,
        diplomaticInfluence: 80,
        militaryReadiness: 70,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(false);
    });

    it('returns false when diplomatic influence below 70', () => {
      const nation = makeNation({
        stability: 85,
        diplomaticInfluence: 69,
        militaryReadiness: 65,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(false);
    });

    it('returns false when military readiness below 60', () => {
      const nation = makeNation({
        stability: 90,
        diplomaticInfluence: 75,
        militaryReadiness: 59,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(false);
    });

    it('returns true at exact boundary values (80, 70, 60)', () => {
      const nation = makeNation({
        stability: 80,
        diplomaticInfluence: 70,
        militaryReadiness: 60,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(true);
    });

    it('returns false when all three metrics are below thresholds', () => {
      const nation = makeNation({
        stability: 10,
        diplomaticInfluence: 10,
        militaryReadiness: 10,
      });
      expect(engine.checkVC01Thresholds(nation)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. checkVC02Thresholds
  // ─────────────────────────────────────────────────────────

  describe('checkVC02Thresholds', () => {
    it('returns true when player GDP > top-2 rivals combined', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { gdp: 5000 },
        [FactionId.China]: { gdp: 2000 },
        [FactionId.Russia]: { gdp: 1500 },
        [FactionId.Japan]: { gdp: 1000 },
      });
      const player = allNations[FactionId.US];
      expect(
        engine.checkVC02Thresholds(player, allNations, FactionId.US),
      ).toBe(true);
    });

    it('returns false when player GDP < top-2 rivals combined', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { gdp: 3000 },
        [FactionId.China]: { gdp: 2000 },
        [FactionId.Russia]: { gdp: 1500 },
      });
      const player = allNations[FactionId.US];
      expect(
        engine.checkVC02Thresholds(player, allNations, FactionId.US),
      ).toBe(false);
    });

    it('returns false when player GDP = top-2 rivals combined (not strictly greater)', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { gdp: 3500 },
        [FactionId.China]: { gdp: 2000 },
        [FactionId.Russia]: { gdp: 1500 },
      });
      const player = allNations[FactionId.US];
      // top-2 rivals = 2000 + 1500 = 3500
      expect(
        engine.checkVC02Thresholds(player, allNations, FactionId.US),
      ).toBe(false);
    });

    it('handles a non-US player faction correctly', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { gdp: 1000 },
        [FactionId.China]: { gdp: 9999 },
        [FactionId.Russia]: { gdp: 500 },
      });
      const player = allNations[FactionId.China];
      // top-2 rivals (excluding China): US=1000, Russia=500 → sum=1500
      expect(
        engine.checkVC02Thresholds(player, allNations, FactionId.China),
      ).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. checkVC03Thresholds
  // ─────────────────────────────────────────────────────────

  describe('checkVC03Thresholds', () => {
    it('returns true when all tensions < 20', () => {
      const matrix = makeRelationshipMatrix(10);
      expect(engine.checkVC03Thresholds(FactionId.US, matrix)).toBe(true);
    });

    it('returns false when any tension >= 20', () => {
      const matrix = makeRelationshipMatrix(10);
      matrix[FactionId.US][FactionId.China] = 25;
      expect(engine.checkVC03Thresholds(FactionId.US, matrix)).toBe(false);
    });

    it('returns false when tension equals exactly 20', () => {
      const matrix = makeRelationshipMatrix(10);
      matrix[FactionId.US][FactionId.Russia] = 20;
      expect(engine.checkVC03Thresholds(FactionId.US, matrix)).toBe(false);
    });

    it('returns true when all tensions are 19 (just below threshold)', () => {
      const matrix = makeRelationshipMatrix(19);
      expect(engine.checkVC03Thresholds(FactionId.US, matrix)).toBe(true);
    });

    it('skips player-player pair (self-tension does not matter)', () => {
      const matrix = makeRelationshipMatrix(10);
      // Set self-tension to 99 — should be ignored
      matrix[FactionId.US][FactionId.US] = 99;
      expect(engine.checkVC03Thresholds(FactionId.US, matrix)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. checkVC04
  // ─────────────────────────────────────────────────────────

  describe('checkVC04', () => {
    it('returns true when stability = 0', () => {
      const nation = makeNation({ stability: 0 });
      const unrest = makeUnrest({ civilUnrest: 20 });
      expect(engine.checkVC04(nation, unrest)).toBe(true);
    });

    it('returns true when civilUnrest = 100', () => {
      const nation = makeNation({ stability: 50 });
      const unrest = makeUnrest({ civilUnrest: 100 });
      expect(engine.checkVC04(nation, unrest)).toBe(true);
    });

    it('returns true when both stability = 0 and civilUnrest = 100', () => {
      const nation = makeNation({ stability: 0 });
      const unrest = makeUnrest({ civilUnrest: 100 });
      expect(engine.checkVC04(nation, unrest)).toBe(true);
    });

    it('returns false when both metrics healthy', () => {
      const nation = makeNation({ stability: 50 });
      const unrest = makeUnrest({ civilUnrest: 30 });
      expect(engine.checkVC04(nation, unrest)).toBe(false);
    });

    it('returns false when stability = 1 and civilUnrest = 99', () => {
      const nation = makeNation({ stability: 1 });
      const unrest = makeUnrest({ civilUnrest: 99 });
      expect(engine.checkVC04(nation, unrest)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 6. checkVC05
  // ─────────────────────────────────────────────────────────

  describe('checkVC05', () => {
    it('returns triggered true + faction when any nuclearThreshold >= 100', () => {
      const allNations = makeAllNations({
        [FactionId.DPRK]: { nuclearThreshold: 100 },
      });
      const result = engine.checkVC05(allNations);
      expect(result.triggered).toBe(true);
      expect(result.triggeringFaction).toBe(FactionId.DPRK);
    });

    it('returns triggered false when all below 100', () => {
      const allNations = makeAllNations(); // default nuclearThreshold = 0
      const result = engine.checkVC05(allNations);
      expect(result.triggered).toBe(false);
      expect(result.triggeringFaction).toBeNull();
    });

    it('returns the first triggering faction in ALL_FACTIONS order', () => {
      const allNations = makeAllNations({
        [FactionId.Russia]: { nuclearThreshold: 100 },
        [FactionId.Iran]: { nuclearThreshold: 100 },
      });
      const result = engine.checkVC05(allNations);
      expect(result.triggered).toBe(true);
      // Russia comes before Iran in ALL_FACTIONS
      expect(result.triggeringFaction).toBe(FactionId.Russia);
    });

    it('triggers at exactly 100', () => {
      const allNations = makeAllNations({
        [FactionId.China]: { nuclearThreshold: 100 },
      });
      expect(engine.checkVC05(allNations).triggered).toBe(true);
    });

    it('does not trigger at 99', () => {
      const allNations = makeAllNations({
        [FactionId.China]: { nuclearThreshold: 99 },
      });
      expect(engine.checkVC05(allNations).triggered).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 7. checkVC06Thresholds
  // ─────────────────────────────────────────────────────────

  describe('checkVC06Thresholds', () => {
    it('returns true when all tensions > 80', () => {
      const matrix = makeRelationshipMatrix(85);
      expect(engine.checkVC06Thresholds(FactionId.US, matrix)).toBe(true);
    });

    it('returns false when any tension <= 80', () => {
      const matrix = makeRelationshipMatrix(85);
      matrix[FactionId.US][FactionId.Japan] = 80;
      expect(engine.checkVC06Thresholds(FactionId.US, matrix)).toBe(false);
    });

    it('returns false when tension equals exactly 80', () => {
      const matrix = makeRelationshipMatrix(81);
      matrix[FactionId.US][FactionId.EU] = 80;
      expect(engine.checkVC06Thresholds(FactionId.US, matrix)).toBe(false);
    });

    it('returns true when all tensions are 81 (just above threshold)', () => {
      const matrix = makeRelationshipMatrix(81);
      expect(engine.checkVC06Thresholds(FactionId.US, matrix)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 8. computeSurvivalScores
  // ─────────────────────────────────────────────────────────

  describe('computeSurvivalScores', () => {
    it('returns sorted scores descending', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { stability: 90, gdp: 2000, diplomaticInfluence: 80 },
        [FactionId.China]: { stability: 85, gdp: 1800, diplomaticInfluence: 70 },
        [FactionId.Japan]: { stability: 95, gdp: 1500, diplomaticInfluence: 90 },
      });
      const scores = engine.computeSurvivalScores(allNations);
      expect(scores).toHaveLength(ALL_FACTIONS.length);

      // Verify descending order
      for (let i = 1; i < scores.length; i++) {
        const prev = scores[i - 1];
        const curr = scores[i];
        expect(prev).toBeDefined();
        expect(curr).toBeDefined();
        expect(prev!.score).toBeGreaterThanOrEqual(curr!.score);
      }
    });

    it('uses correct weights (stability: 1, gdp: 1, diplomaticInfluence: 1)', () => {
      const allNations = makeAllNations({
        [FactionId.US]: { stability: 10, gdp: 20, diplomaticInfluence: 30 },
      });
      const scores = engine.computeSurvivalScores(allNations);
      const usScore = scores.find((s) => s.factionId === FactionId.US);
      expect(usScore).toBeDefined();
      // score = 10 * 1 + 20 * 1 + 30 * 1 = 60
      expect(usScore!.score).toBe(60);
    });

    it('includes all 8 factions in the result', () => {
      const allNations = makeAllNations();
      const scores = engine.computeSurvivalScores(allNations);
      const factionIds = scores.map((s) => s.factionId);
      for (const f of ALL_FACTIONS) {
        expect(factionIds).toContain(f);
      }
    });

    it('places the highest-scoring faction first', () => {
      const allNations = makeAllNations({
        [FactionId.EU]: { stability: 100, gdp: 9999, diplomaticInfluence: 100 },
      });
      const scores = engine.computeSurvivalScores(allNations);
      expect(scores[0]?.factionId).toBe(FactionId.EU);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 9. updateTracker
  // ─────────────────────────────────────────────────────────

  describe('updateTracker', () => {
    it('increments vc01 counter when thresholds met', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 90,
            diplomaticInfluence: 80,
            militaryReadiness: 70,
          },
        }),
        consecutiveTracker: makeTracker({ vc01: 3 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc01).toBe(4);
    });

    it('resets vc01 counter to 0 when thresholds not met', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 10 },
        }),
        consecutiveTracker: makeTracker({ vc01: 5 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc01).toBe(0);
    });

    it('increments vc02 counter when GDP exceeds top-2 rivals', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { gdp: 99999 },
        }),
        consecutiveTracker: makeTracker({ vc02: 7 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc02).toBe(8);
    });

    it('resets vc02 counter to 0 when GDP does not exceed top-2 rivals', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { gdp: 100 },
          [FactionId.China]: { gdp: 5000 },
        }),
        consecutiveTracker: makeTracker({ vc02: 11 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc02).toBe(0);
    });

    it('increments vc03 counter when all tensions below 20', () => {
      const input = makeInput({
        relationshipMatrix: makeRelationshipMatrix(10),
        consecutiveTracker: makeTracker({ vc03: 5 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc03).toBe(6);
    });

    it('resets vc03 counter to 0 when any tension >= 20', () => {
      const matrix = makeRelationshipMatrix(10);
      matrix[FactionId.US][FactionId.China] = 25;
      const input = makeInput({
        relationshipMatrix: matrix,
        consecutiveTracker: makeTracker({ vc03: 11 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc03).toBe(0);
    });

    it('increments vc06 counter when all tensions above 80', () => {
      const input = makeInput({
        relationshipMatrix: makeRelationshipMatrix(85),
        consecutiveTracker: makeTracker({ vc06: 4 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc06).toBe(5);
    });

    it('resets vc06 counter to 0 when any tension <= 80', () => {
      const matrix = makeRelationshipMatrix(85);
      matrix[FactionId.US][FactionId.EU] = 50;
      const input = makeInput({
        relationshipMatrix: matrix,
        consecutiveTracker: makeTracker({ vc06: 5 }),
      });
      const tracker = engine.updateTracker(input);
      expect(tracker.vc06).toBe(0);
    });

    it('returns a new object — does not mutate the input tracker', () => {
      const original = makeTracker({ vc01: 3 });
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 90,
            diplomaticInfluence: 80,
            militaryReadiness: 70,
          },
        }),
        consecutiveTracker: original,
      });
      const updated = engine.updateTracker(input);
      expect(updated).not.toBe(original);
      expect(original.vc01).toBe(3);
      expect(updated.vc01).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 10. evaluateTurn
  // ─────────────────────────────────────────────────────────

  describe('evaluateTurn', () => {
    it('VC-05 short-circuits all other checks', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 0 }, // Would trigger VC-04
          [FactionId.Russia]: { nuclearThreshold: 100 }, // Triggers VC-05
        }),
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 100 }, // Would trigger VC-04
        }),
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      expect(results[0]?.conditionId).toBe('VC-05');
      expect(results[0]?.conditionType).toBe('loss_all');
      expect(results[0]?.triggered).toBe(true);
    });

    it('VC-04 short-circuits duration checks', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 0,
            gdp: 99999,
            diplomaticInfluence: 90,
            militaryReadiness: 90,
          },
        }),
        relationshipMatrix: makeRelationshipMatrix(10),
        consecutiveTracker: makeTracker({ vc01: 5, vc02: 11, vc03: 11 }),
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      expect(results[0]?.conditionId).toBe('VC-04');
      expect(results[0]?.conditionType).toBe('loss');
    });

    it('returns VC-01 when consecutiveTurns met (6)', () => {
      // Need tracker at 5 + this turn passing thresholds → 6
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 90,
            diplomaticInfluence: 80,
            militaryReadiness: 70,
          },
        }),
        consecutiveTracker: makeTracker({ vc01: 5 }),
      });
      const results = engine.evaluateTurn(input);
      const vc01 = results.find((r) => r.conditionId === 'VC-01');
      expect(vc01).toBeDefined();
      expect(vc01!.triggered).toBe(true);
      expect(vc01!.conditionType).toBe('victory');
      expect(vc01!.triggeringFaction).toBe(FactionId.US);
    });

    it('returns VC-02 when consecutiveTurns met (12)', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { gdp: 99999 },
        }),
        consecutiveTracker: makeTracker({ vc02: 11 }),
      });
      const results = engine.evaluateTurn(input);
      const vc02 = results.find((r) => r.conditionId === 'VC-02');
      expect(vc02).toBeDefined();
      expect(vc02!.triggered).toBe(true);
      expect(vc02!.conditionType).toBe('victory');
    });

    it('returns VC-03 when consecutiveTurns met (12)', () => {
      const input = makeInput({
        relationshipMatrix: makeRelationshipMatrix(10),
        consecutiveTracker: makeTracker({ vc03: 11 }),
      });
      const results = engine.evaluateTurn(input);
      const vc03 = results.find((r) => r.conditionId === 'VC-03');
      expect(vc03).toBeDefined();
      expect(vc03!.triggered).toBe(true);
      expect(vc03!.conditionName).toBe('Pax Nationis');
    });

    it('returns VC-06 when consecutiveTurns met (6)', () => {
      const input = makeInput({
        relationshipMatrix: makeRelationshipMatrix(85),
        consecutiveTracker: makeTracker({ vc06: 5 }),
      });
      const results = engine.evaluateTurn(input);
      const vc06 = results.find((r) => r.conditionId === 'VC-06');
      expect(vc06).toBeDefined();
      expect(vc06!.triggered).toBe(true);
      expect(vc06!.conditionType).toBe('loss');
    });

    it('returns VC-07 at turn 60', () => {
      const allNations = makeAllNations({
        [FactionId.EU]: { stability: 100, gdp: 9999, diplomaticInfluence: 100 },
      });
      const input = makeInput({
        currentTurn: 60 as TurnNumber,
        nationStates: allNations,
      });
      const results = engine.evaluateTurn(input);
      const vc07 = results.find((r) => r.conditionId === 'VC-07');
      expect(vc07).toBeDefined();
      expect(vc07!.triggered).toBe(true);
      expect(vc07!.conditionType).toBe('conditional');
      expect(vc07!.survivalWinner).toBeDefined();
      expect(vc07!.survivalWinner!.factionId).toBe(FactionId.EU);
    });

    it('returns empty array when no condition met', () => {
      const input = makeInput({
        currentTurn: 5 as TurnNumber,
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(0);
    });

    it('does not return VC-07 before turn 60', () => {
      const input = makeInput({
        currentTurn: 59 as TurnNumber,
      });
      const results = engine.evaluateTurn(input);
      const vc07 = results.find((r) => r.conditionId === 'VC-07');
      expect(vc07).toBeUndefined();
    });

    it('can return multiple duration-based results in one turn', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 90,
            diplomaticInfluence: 80,
            militaryReadiness: 70,
            gdp: 99999,
          },
        }),
        relationshipMatrix: makeRelationshipMatrix(10),
        consecutiveTracker: makeTracker({ vc01: 5, vc02: 11, vc03: 11 }),
      });
      const results = engine.evaluateTurn(input);
      const ids = results.map((r) => r.conditionId);
      expect(ids).toContain('VC-01');
      expect(ids).toContain('VC-02');
      expect(ids).toContain('VC-03');
    });

    it('VC-04 triggers via civilUnrest reaching 100', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { stability: 50 },
        }),
        civilUnrestComponents: makeAllUnrest({
          [FactionId.US]: { civilUnrest: 100 },
        }),
      });
      const results = engine.evaluateTurn(input);
      expect(results).toHaveLength(1);
      expect(results[0]?.conditionId).toBe('VC-04');
    });

    it('VC-07 survivalWinner includes the correct composite score', () => {
      // Make US the highest scorer for VC-07 by keeping others at defaults
      // Default: stability=50, gdp=1000, di=50 → score=1100
      const usOverride = {
        stability: 100,
        gdp: 50000,
        diplomaticInfluence: 100,
      };
      const nations = makeAllNations({
        [FactionId.US]: usOverride,
      });
      const input = makeInput({
        currentTurn: 60 as TurnNumber,
        nationStates: nations,
      });
      const results = engine.evaluateTurn(input);
      const vc07 = results.find((r) => r.conditionId === 'VC-07');
      expect(vc07).toBeDefined();
      expect(vc07!.survivalWinner).toBeDefined();
      // score = 100 * 1 + 50000 * 1 + 100 * 1 = 50200
      expect(vc07!.survivalWinner!.score).toBe(50200);
      expect(vc07!.survivalWinner!.factionId).toBe(FactionId.US);
    });

    it('VC-01 does not trigger at consecutive count 5 (needs 6)', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: {
            stability: 90,
            diplomaticInfluence: 80,
            militaryReadiness: 70,
          },
        }),
        consecutiveTracker: makeTracker({ vc01: 4 }),
      });
      const results = engine.evaluateTurn(input);
      const vc01 = results.find((r) => r.conditionId === 'VC-01');
      expect(vc01).toBeUndefined();
    });

    it('VC-02 does not trigger at consecutive count 11 when threshold not met this turn', () => {
      const input = makeInput({
        nationStates: makeAllNations({
          [FactionId.US]: { gdp: 100 }, // too low
          [FactionId.China]: { gdp: 5000 },
        }),
        consecutiveTracker: makeTracker({ vc02: 11 }),
      });
      const results = engine.evaluateTurn(input);
      const vc02 = results.find((r) => r.conditionId === 'VC-02');
      expect(vc02).toBeUndefined();
    });
  });
});
