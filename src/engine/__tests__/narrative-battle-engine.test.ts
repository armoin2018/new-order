import { describe, it, expect } from 'vitest';
import { NarrativeBattleEngine } from '@/engine';
import type {
  NarrativeBattleConfig,
  NarrativeBattleResolveInput,
  NarrativeBattleResult,
  NarrativeCombatant,
} from '@/engine';
import type { FactionId, TurnNumber, NarrativeType } from '@/data/types';
import { WhistleblowerChoice } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Shared deterministic config override
// ─────────────────────────────────────────────────────────

const TEST_CONFIG: NarrativeBattleConfig = {
  narrativeBattle: {
    legitimacyWeight: 0.4,
    mediaReachWeight: 0.3,
    narrativeInvestmentWeight: 0.3,
    winnerLegitimacyGain: 5,
    loserLegitimacyLoss: -5,
  },
  whistleblower: {
    divergenceThreshold: 30,
    exposureLegitimacyPenalty: -20,
    acknowledgePenalty: -10,
    securityServicesReductionPer20: 0.1,
  },
  whistleblowerCascade: {
    additionalExposureRisk: 0.15,
    maxOpsExposed: 3,
  },
};

// ─────────────────────────────────────────────────────────
// Helper factories
// ─────────────────────────────────────────────────────────

function makeCombatant(overrides: Partial<NarrativeCombatant> = {}): NarrativeCombatant {
  return {
    factionId: 'us' as FactionId,
    legitimacy: 50,
    mediaReach: 50,
    narrativeInvestment: 50,
    narrativeType: 'Liberation' as NarrativeType,
    ...overrides,
  };
}

function makeBattleInput(
  overrides: Partial<NarrativeBattleResolveInput> = {},
): NarrativeBattleResolveInput {
  return {
    turn: 5 as TurnNumber,
    attacker: makeCombatant({ factionId: 'us' as FactionId }),
    defender: makeCombatant({ factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType }),
    ...overrides,
  };
}

/**
 * Compute expected weighted score from combatant stats using the test config.
 */
function expectedScore(c: NarrativeCombatant): number {
  return (
    c.legitimacy * TEST_CONFIG.narrativeBattle.legitimacyWeight +
    c.mediaReach * TEST_CONFIG.narrativeBattle.mediaReachWeight +
    c.narrativeInvestment * TEST_CONFIG.narrativeBattle.narrativeInvestmentWeight
  );
}

// ─────────────────────────────────────────────────────────
// Engine instance (shared across all tests — stateless)
// ─────────────────────────────────────────────────────────

const engine = new NarrativeBattleEngine(TEST_CONFIG);

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('NarrativeBattleEngine', () => {
  // ── resolveNarrativeBattle ──────────────────────────────────────────────

  describe('resolveNarrativeBattle', () => {
    it('returns attacker as winner when attacker has higher score', () => {
      const attacker = makeCombatant({
        factionId: 'us' as FactionId,
        legitimacy: 80,
        mediaReach: 70,
        narrativeInvestment: 60,
        narrativeType: 'Liberation' as NarrativeType,
      });
      const defender = makeCombatant({
        factionId: 'russia' as FactionId,
        legitimacy: 40,
        mediaReach: 30,
        narrativeInvestment: 20,
        narrativeType: 'Victimhood' as NarrativeType,
      });
      const result = engine.resolveNarrativeBattle({ turn: 5 as TurnNumber, attacker, defender });

      expect(result.winner).toBe('us');
      expect(result.loser).toBe('russia');
    });

    it('returns defender as winner when defender has higher score', () => {
      const attacker = makeCombatant({
        factionId: 'us' as FactionId,
        legitimacy: 20,
        mediaReach: 20,
        narrativeInvestment: 20,
        narrativeType: 'Liberation' as NarrativeType,
      });
      const defender = makeCombatant({
        factionId: 'russia' as FactionId,
        legitimacy: 80,
        mediaReach: 80,
        narrativeInvestment: 80,
        narrativeType: 'Victimhood' as NarrativeType,
      });
      const result = engine.resolveNarrativeBattle({ turn: 5 as TurnNumber, attacker, defender });

      expect(result.winner).toBe('russia');
      expect(result.loser).toBe('us');
    });

    it('returns attacker as winner on tie (first-mover advantage)', () => {
      const attacker = makeCombatant({
        factionId: 'us' as FactionId,
        legitimacy: 50,
        mediaReach: 50,
        narrativeInvestment: 50,
      });
      const defender = makeCombatant({
        factionId: 'russia' as FactionId,
        legitimacy: 50,
        mediaReach: 50,
        narrativeInvestment: 50,
      });
      const result = engine.resolveNarrativeBattle({ turn: 5 as TurnNumber, attacker, defender });

      expect(result.winner).toBe('us');
      expect(result.loser).toBe('russia');
    });

    it('computes correct weighted scores', () => {
      const attacker = makeCombatant({
        factionId: 'us' as FactionId,
        legitimacy: 80,
        mediaReach: 60,
        narrativeInvestment: 40,
      });
      const defender = makeCombatant({
        factionId: 'russia' as FactionId,
        legitimacy: 30,
        mediaReach: 50,
        narrativeInvestment: 70,
      });
      const result = engine.resolveNarrativeBattle({ turn: 5 as TurnNumber, attacker, defender });

      // attacker: 80*0.4 + 60*0.3 + 40*0.3 = 32 + 18 + 12 = 62
      expect(result.attackerScore).toBeCloseTo(expectedScore(attacker), 10);
      expect(result.attackerScore).toBeCloseTo(62, 10);
      // defender: 30*0.4 + 50*0.3 + 70*0.3 = 12 + 15 + 21 = 48
      expect(result.defenderScore).toBeCloseTo(expectedScore(defender), 10);
      expect(result.defenderScore).toBeCloseTo(48, 10);
    });

    it('returns correct legitimacy deltas (+5 / -5)', () => {
      const result = engine.resolveNarrativeBattle(makeBattleInput());

      expect(result.winnerLegitimacyDelta).toBe(5);
      expect(result.loserLegitimacyDelta).toBe(-5);
    });

    it('includes battle entry with correct turn and narrative type', () => {
      const attacker = makeCombatant({
        factionId: 'us' as FactionId,
        legitimacy: 90,
        narrativeType: 'Liberation' as NarrativeType,
      });
      const defender = makeCombatant({
        factionId: 'russia' as FactionId,
        legitimacy: 20,
        narrativeType: 'Victimhood' as NarrativeType,
      });
      const result = engine.resolveNarrativeBattle({
        turn: 10 as TurnNumber,
        attacker,
        defender,
      });

      expect(result.battleEntry.turn).toBe(10);
      // Attacker wins → narrativeType is attacker's
      expect(result.battleEntry.narrativeType).toBe('Liberation');
      expect(result.battleEntry.attacker).toBe('us');
      expect(result.battleEntry.defender).toBe('russia');
    });

    it('sets battleEntry.countered=false when attacker wins, true when defender wins', () => {
      // Attacker wins
      const attackerWin = engine.resolveNarrativeBattle(
        makeBattleInput({
          attacker: makeCombatant({ factionId: 'us' as FactionId, legitimacy: 90 }),
          defender: makeCombatant({ factionId: 'russia' as FactionId, legitimacy: 10, narrativeType: 'Victimhood' as NarrativeType }),
        }),
      );
      expect(attackerWin.battleEntry.countered).toBe(false);

      // Defender wins
      const defenderWin = engine.resolveNarrativeBattle(
        makeBattleInput({
          attacker: makeCombatant({ factionId: 'us' as FactionId, legitimacy: 10 }),
          defender: makeCombatant({ factionId: 'russia' as FactionId, legitimacy: 90, narrativeType: 'Victimhood' as NarrativeType }),
        }),
      );
      expect(defenderWin.battleEntry.countered).toBe(true);
    });
  });

  // ── computeNeutralPerception ────────────────────────────────────────────

  describe('computeNeutralPerception', () => {
    /** Build a battle result fixture for perception tests. */
    function makeBattleResult(overrides: Partial<NarrativeBattleResult> = {}): NarrativeBattleResult {
      return {
        winner: 'us' as FactionId,
        loser: 'russia' as FactionId,
        attackerScore: 62,
        defenderScore: 48,
        winnerLegitimacyDelta: 5,
        loserLegitimacyDelta: -5,
        battleEntry: {
          turn: 5 as TurnNumber,
          attacker: 'us' as FactionId,
          defender: 'russia' as FactionId,
          narrativeType: 'Liberation' as NarrativeType,
          legitimacyDelta: 5,
          countered: false,
        },
        ...overrides,
      };
    }

    it('returns higher alignment shift for Aligned factions (+10 base)', () => {
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult(),
        neutralFactions: [
          { factionId: 'japan' as FactionId, stanceTowardWinner: 'Aligned' },
        ],
        winnerMediaReach: 100,
      });

      const jp = result.perceptions.find(p => p.factionId === 'japan');
      expect(jp!.alignmentShift).toBe(10);
    });

    it('returns medium alignment shift for Neutral factions (+5 base)', () => {
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult(),
        neutralFactions: [
          { factionId: 'japan' as FactionId, stanceTowardWinner: 'Neutral' },
        ],
        winnerMediaReach: 100,
      });

      const jp = result.perceptions.find(p => p.factionId === 'japan');
      expect(jp!.alignmentShift).toBe(5);
    });

    it('returns lower alignment shift for Opposed factions (+2 base)', () => {
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult(),
        neutralFactions: [
          { factionId: 'iran' as FactionId, stanceTowardWinner: 'Opposed' },
        ],
        winnerMediaReach: 100,
      });

      const ir = result.perceptions.find(p => p.factionId === 'iran');
      expect(ir!.alignmentShift).toBe(2);
    });

    it('scales shifts by media reach', () => {
      // Media reach = 50 → scalar = 0.5
      // Aligned: round(10 * 0.5) = 5, but max(1, 5) = 5
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult(),
        neutralFactions: [
          { factionId: 'japan' as FactionId, stanceTowardWinner: 'Aligned' },
          { factionId: 'iran' as FactionId, stanceTowardWinner: 'Opposed' },
        ],
        winnerMediaReach: 50,
      });

      const jp = result.perceptions.find(p => p.factionId === 'japan');
      // round(10 * 0.5) = 5
      expect(jp!.alignmentShift).toBe(5);

      const ir = result.perceptions.find(p => p.factionId === 'iran');
      // round(2 * 0.5) = 1, max(1, 1) = 1
      expect(ir!.alignmentShift).toBe(1);
    });

    it('all factions adopt winner narrative when media reach > 0', () => {
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult(),
        neutralFactions: [
          { factionId: 'japan' as FactionId, stanceTowardWinner: 'Aligned' },
          { factionId: 'eu' as FactionId, stanceTowardWinner: 'Neutral' },
          { factionId: 'iran' as FactionId, stanceTowardWinner: 'Opposed' },
        ],
        winnerMediaReach: 10,
      });

      for (const perception of result.perceptions) {
        expect(perception.adoptedWinnerNarrative).toBe(true);
        expect(perception.alignmentShift).toBeGreaterThan(0);
      }
    });

    it('returns correct winner faction ID', () => {
      const result = engine.computeNeutralPerception({
        battleResult: makeBattleResult({ winner: 'china' as FactionId }),
        neutralFactions: [
          { factionId: 'japan' as FactionId, stanceTowardWinner: 'Neutral' },
        ],
        winnerMediaReach: 80,
      });

      expect(result.winner).toBe('china');
    });
  });

  // ── evaluateWhistleblowerRisk ───────────────────────────────────────────

  describe('evaluateWhistleblowerRisk', () => {
    it('returns 0 probability when divergence <= threshold (30)', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 30,
        securityServicesScore: 0,
      });

      expect(result.baseProbability).toBe(0);
      expect(result.finalProbability).toBe(0);
    });

    it('returns 0 probability when divergence < threshold', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 10,
        securityServicesScore: 0,
      });

      expect(result.baseProbability).toBe(0);
      expect(result.finalProbability).toBe(0);
    });

    it('computes correct base probability (divergence=55 → base=0.25)', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 55,
        securityServicesScore: 0,
      });

      // (55 - 30) / 100 = 0.25
      expect(result.baseProbability).toBeCloseTo(0.25, 10);
      expect(result.finalProbability).toBeCloseTo(0.25, 10);
    });

    it('applies security reduction correctly (score=40 → floor(2)×0.1 = 0.2)', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 80,
        securityServicesScore: 40,
      });

      // floor(40 / 20) = 2, 2 * 0.1 = 0.2
      expect(result.securityReduction).toBeCloseTo(0.2, 10);
    });

    it('computes final probability (0.25 - 0.2 = 0.05)', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 55,
        securityServicesScore: 40,
      });

      // base = (55-30)/100 = 0.25, reduction = floor(40/20)*0.1 = 0.2
      expect(result.baseProbability).toBeCloseTo(0.25, 10);
      expect(result.securityReduction).toBeCloseTo(0.2, 10);
      expect(result.finalProbability).toBeCloseTo(0.05, 10);
    });

    it('clamps final probability at 0 when security reduction exceeds base', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 35,
        securityServicesScore: 80,
      });

      // base = (35-30)/100 = 0.05, reduction = floor(80/20)*0.1 = 0.4
      // final = max(0, 0.05 - 0.4) = 0
      expect(result.baseProbability).toBeCloseTo(0.05, 10);
      expect(result.securityReduction).toBeCloseTo(0.4, 10);
      expect(result.finalProbability).toBe(0);
    });

    it('returns correct divergence threshold in result', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 50,
        securityServicesScore: 0,
      });

      expect(result.divergenceThreshold).toBe(30);
    });

    it('handles maximum divergence (100 → base=0.7)', () => {
      const result = engine.evaluateWhistleblowerRisk({
        factionId: 'russia' as FactionId,
        turn: 5 as TurnNumber,
        behaviorDivergence: 100,
        securityServicesScore: 0,
      });

      // (100 - 30) / 100 = 0.7
      expect(result.baseProbability).toBeCloseTo(0.7, 10);
      expect(result.finalProbability).toBeCloseTo(0.7, 10);
    });
  });

  // ── resolveWhistleblower ────────────────────────────────────────────────

  describe('resolveWhistleblower', () => {
    it('suppress returns -20 legitimacy delta', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Suppress,
        activeCovertOpsCount: 5,
      });

      expect(result.legitimacyDelta).toBe(-20);
    });

    it('suppress returns 0.15 cascade risk', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Suppress,
        activeCovertOpsCount: 5,
      });

      expect(result.cascadeRisk).toBeCloseTo(0.15, 10);
    });

    it('suppress caps opsExposed at 3 (maxOpsExposed)', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Suppress,
        activeCovertOpsCount: 10,
      });

      expect(result.opsExposed).toBe(3);
    });

    it('suppress exposes fewer if activeOps < 3', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Suppress,
        activeCovertOpsCount: 1,
      });

      expect(result.opsExposed).toBe(1);
    });

    it('suppress sets cascadePrevented to false', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Suppress,
        activeCovertOpsCount: 5,
      });

      expect(result.cascadePrevented).toBe(false);
    });

    it('acknowledge returns -10 legitimacy delta', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Acknowledge,
        activeCovertOpsCount: 5,
      });

      expect(result.legitimacyDelta).toBe(-10);
    });

    it('acknowledge returns 0 cascade risk and 0 ops exposed', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Acknowledge,
        activeCovertOpsCount: 5,
      });

      expect(result.cascadeRisk).toBe(0);
      expect(result.opsExposed).toBe(0);
    });

    it('acknowledge sets cascadePrevented to true', () => {
      const result = engine.resolveWhistleblower({
        factionId: 'us' as FactionId,
        turn: 10 as TurnNumber,
        choice: WhistleblowerChoice.Acknowledge,
        activeCovertOpsCount: 5,
      });

      expect(result.cascadePrevented).toBe(true);
    });
  });

  // ── detectContradictoryNarratives ───────────────────────────────────────

  describe('detectContradictoryNarratives', () => {
    it('detects contradiction when two factions target same faction with different narratives', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'iran' as FactionId },
        ],
      });

      expect(result.count).toBe(1);
      expect(result.contradictions).toHaveLength(1);
      expect(result.contradictions[0]!.factionA).toBe('us');
      expect(result.contradictions[0]!.factionB).toBe('russia');
      expect(result.contradictions[0]!.targetFactionId).toBe('iran');
    });

    it('returns count matching contradictions length', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'china' as FactionId, narrativeType: 'EconomicJustice' as NarrativeType, targetFactionId: 'japan' as FactionId },
          { factionId: 'eu' as FactionId, narrativeType: 'HistoricalGrievance' as NarrativeType, targetFactionId: 'japan' as FactionId },
        ],
      });

      expect(result.count).toBe(result.contradictions.length);
    });

    it('does not detect same-faction campaigns as contradictory', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'us' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'iran' as FactionId },
        ],
      });

      expect(result.count).toBe(0);
      expect(result.contradictions).toHaveLength(0);
    });

    it('does not detect campaigns targeting different factions', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'japan' as FactionId },
        ],
      });

      expect(result.count).toBe(0);
      expect(result.contradictions).toHaveLength(0);
    });

    it('does not detect same narrative type as contradictory', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
        ],
      });

      expect(result.count).toBe(0);
      expect(result.contradictions).toHaveLength(0);
    });

    it('deduplicates symmetric pairs', () => {
      // Two entries from the same pair of factions targeting the same faction
      // but appearing in different order should only count once.
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'HistoricalGrievance' as NarrativeType, targetFactionId: 'iran' as FactionId },
        ],
      });

      // us-Liberation vs russia-Victimhood → contradiction (Victimhood ↔ Liberation in pairs)
      // us-Liberation vs russia-HistoricalGrievance → contradiction (Liberation ↔ HistoricalGrievance in pairs)
      // russia-Victimhood vs russia-HistoricalGrievance → same faction, skipped
      // Both pairs have different pairKeys (us:russia:iran but different checks), so 2 contradictions.
      // The dedup key is sorted factionIds + target, so us:russia:iran for both → only first kept.
      expect(result.count).toBe(1);
    });

    it('handles empty campaign list', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [],
      });

      expect(result.count).toBe(0);
      expect(result.contradictions).toHaveLength(0);
    });

    it('detects multiple contradictions across different targets', () => {
      const result = engine.detectContradictoryNarratives({
        activeCampaigns: [
          { factionId: 'us' as FactionId, narrativeType: 'Liberation' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'russia' as FactionId, narrativeType: 'Victimhood' as NarrativeType, targetFactionId: 'iran' as FactionId },
          { factionId: 'china' as FactionId, narrativeType: 'EconomicJustice' as NarrativeType, targetFactionId: 'japan' as FactionId },
          { factionId: 'eu' as FactionId, narrativeType: 'HistoricalGrievance' as NarrativeType, targetFactionId: 'japan' as FactionId },
        ],
      });

      // Pair 1: us-Liberation vs russia-Victimhood targeting iran
      // Pair 2: china-EconomicJustice vs eu-HistoricalGrievance targeting japan
      expect(result.count).toBe(2);
      expect(result.contradictions).toHaveLength(2);

      const targets = result.contradictions.map(c => c.targetFactionId);
      expect(targets).toContain('iran');
      expect(targets).toContain('japan');
    });
  });
});
