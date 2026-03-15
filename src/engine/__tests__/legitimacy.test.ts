import { describe, it, expect, beforeEach } from 'vitest';
import type {
  FactionId,
  TurnNumber,
  NarrativeType,
  InternationalLegitimacy,
} from '@/data/types';
import { LegitimacyEngine } from '@/engine/legitimacy';
import type { LegitimacyInput, NarrativeBattleInput } from '@/engine/legitimacy';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Factory for a `LegitimacyInput` with all-zeros defaults. */
function makeInput(overrides: Partial<LegitimacyInput> = {}): LegitimacyInput {
  return {
    aggressiveActionPenalty: 0,
    humanitarianBonus: 0,
    treatyComplianceBonus: 0,
    narrativeEffect: 0,
    unResolutions: 0,
    narrativeBattleDelta: 0,
    otherModifiers: 0,
    ...overrides,
  };
}

/** Factory for a base `InternationalLegitimacy` state. */
function makeState(
  overrides: Partial<InternationalLegitimacy> = {},
): InternationalLegitimacy {
  return {
    factionId: 'us' as FactionId,
    turn: 1 as TurnNumber,
    legitimacy: 50,
    legitimacyDelta: 0,
    narrativeActive: null,
    narrativeBattleHistory: [],
    whistleblowerRisk: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('LegitimacyEngine', () => {
  let engine: LegitimacyEngine;

  beforeEach(() => {
    engine = new LegitimacyEngine();
  });

  // ── computeLegitimacyDelta ──────────────────────────────

  describe('computeLegitimacyDelta', () => {
    it('sums all positive modifiers correctly', () => {
      const input = makeInput({
        humanitarianBonus: 5,
        treatyComplianceBonus: 3,
        narrativeEffect: 2,
        narrativeBattleDelta: 4,
        otherModifiers: 1,
      });
      expect(engine.computeLegitimacyDelta(input)).toBe(15);
    });

    it('applies negative aggressive action penalty', () => {
      const input = makeInput({ aggressiveActionPenalty: -8 });
      expect(engine.computeLegitimacyDelta(input)).toBe(-8);
    });

    it('applies UN resolution penalties (count × -10)', () => {
      const input = makeInput({ unResolutions: 1 });
      expect(engine.computeLegitimacyDelta(input)).toBe(-10);
    });

    it('handles zero input (all zeros → 0)', () => {
      expect(engine.computeLegitimacyDelta(makeInput())).toBe(0);
    });

    it('handles mixed positive and negative modifiers', () => {
      const input = makeInput({
        aggressiveActionPenalty: -5,
        humanitarianBonus: 3,
        treatyComplianceBonus: 2,
        narrativeEffect: -1,
        otherModifiers: 4,
      });
      // -5 + 3 + 2 + -1 + 0 + 0 + 4 = 3
      expect(engine.computeLegitimacyDelta(input)).toBe(3);
    });

    it('handles multiple UN resolutions', () => {
      const input = makeInput({ unResolutions: 3 });
      // 3 × -10 = -30
      expect(engine.computeLegitimacyDelta(input)).toBe(-30);
    });
  });

  // ── applyLegitimacyDelta ────────────────────────────────

  describe('applyLegitimacyDelta', () => {
    it('applies positive delta', () => {
      expect(engine.applyLegitimacyDelta(50, 10)).toBe(60);
    });

    it('applies negative delta', () => {
      expect(engine.applyLegitimacyDelta(50, -10)).toBe(40);
    });

    it('clamps to 0 (floor)', () => {
      expect(engine.applyLegitimacyDelta(10, -20)).toBe(0);
    });

    it('clamps to 100 (ceiling)', () => {
      expect(engine.applyLegitimacyDelta(90, 20)).toBe(100);
    });

    it('handles zero delta', () => {
      expect(engine.applyLegitimacyDelta(50, 0)).toBe(50);
    });

    it('handles extreme negative delta from high score', () => {
      expect(engine.applyLegitimacyDelta(100, -200)).toBe(0);
    });

    it('handles extreme positive delta from low score', () => {
      expect(engine.applyLegitimacyDelta(0, 200)).toBe(100);
    });
  });

  // ── isDiplomacyBlocked ──────────────────────────────────

  describe('isDiplomacyBlocked', () => {
    it('blocked at threshold (30)', () => {
      expect(engine.isDiplomacyBlocked(30)).toBe(true);
    });

    it('blocked below threshold', () => {
      expect(engine.isDiplomacyBlocked(15)).toBe(true);
    });

    it('not blocked above threshold (31)', () => {
      expect(engine.isDiplomacyBlocked(31)).toBe(false);
    });

    it('not blocked at high legitimacy', () => {
      expect(engine.isDiplomacyBlocked(80)).toBe(false);
    });

    it('blocked at 0', () => {
      expect(engine.isDiplomacyBlocked(0)).toBe(true);
    });
  });

  // ── getDiplomaticEffectivenessModifier ──────────────────

  describe('getDiplomaticEffectivenessModifier', () => {
    it('returns bonus at threshold (70)', () => {
      expect(engine.getDiplomaticEffectivenessModifier(70)).toBe(0.15);
    });

    it('returns bonus above threshold', () => {
      expect(engine.getDiplomaticEffectivenessModifier(85)).toBe(0.15);
    });

    it('returns 0 below threshold (69)', () => {
      expect(engine.getDiplomaticEffectivenessModifier(69)).toBe(0);
    });

    it('returns 0 at 0', () => {
      expect(engine.getDiplomaticEffectivenessModifier(0)).toBe(0);
    });

    it('returns bonus at 100', () => {
      expect(engine.getDiplomaticEffectivenessModifier(100)).toBe(0.15);
    });
  });

  // ── computeTurnLegitimacy ───────────────────────────────

  describe('computeTurnLegitimacy', () => {
    it('produces correct new state with positive modifiers', () => {
      const prev = makeState({ legitimacy: 50 });
      const input = makeInput({ humanitarianBonus: 10, treatyComplianceBonus: 5 });
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.legitimacy).toBe(65);
      expect(result.legitimacyDelta).toBe(15);
      expect(result.turn).toBe(2);
    });

    it('produces correct new state with negative modifiers', () => {
      const prev = makeState({ legitimacy: 50 });
      const input = makeInput({ aggressiveActionPenalty: -10, unResolutions: 1 });
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.legitimacy).toBe(30);
      expect(result.legitimacyDelta).toBe(-20);
    });

    it('clamps legitimacy to 0', () => {
      const prev = makeState({ legitimacy: 10 });
      const input = makeInput({ aggressiveActionPenalty: -50 });
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.legitimacy).toBe(0);
    });

    it('clamps legitimacy to 100', () => {
      const prev = makeState({ legitimacy: 90 });
      const input = makeInput({ humanitarianBonus: 30 });
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.legitimacy).toBe(100);
    });

    it('appends narrative battle entry to history', () => {
      const prev = makeState();
      const input = makeInput({ narrativeBattleDelta: 5 });
      const battle: NarrativeBattleInput = {
        attacker: 'china' as FactionId,
        defender: 'us' as FactionId,
        narrativeType: 'Liberation' as NarrativeType,
        legitimacyDelta: 5,
        countered: false,
      };
      const result = engine.computeTurnLegitimacy(
        prev,
        input,
        2 as TurnNumber,
        battle,
      );

      expect(result.narrativeBattleHistory).toHaveLength(1);
      expect(result.narrativeBattleHistory[0]?.attacker).toBe('china');
      expect(result.narrativeBattleHistory[0]?.defender).toBe('us');
      expect(result.narrativeBattleHistory[0]?.narrativeType).toBe('Liberation');
      expect(result.narrativeBattleHistory[0]?.legitimacyDelta).toBe(5);
      expect(result.narrativeBattleHistory[0]?.countered).toBe(false);
      expect(result.narrativeBattleHistory[0]?.turn).toBe(2);
    });

    it('preserves narrative battle history from previous turns', () => {
      const prev = makeState({
        narrativeBattleHistory: [
          {
            turn: 1 as TurnNumber,
            attacker: 'russia' as FactionId,
            defender: 'us' as FactionId,
            narrativeType: 'Victimhood' as NarrativeType,
            legitimacyDelta: -3,
            countered: true,
          },
        ],
      });
      const input = makeInput();
      const battle: NarrativeBattleInput = {
        attacker: 'china' as FactionId,
        defender: 'us' as FactionId,
        narrativeType: 'Liberation' as NarrativeType,
        legitimacyDelta: 5,
        countered: false,
      };
      const result = engine.computeTurnLegitimacy(
        prev,
        input,
        2 as TurnNumber,
        battle,
      );

      expect(result.narrativeBattleHistory).toHaveLength(2);
      expect(result.narrativeBattleHistory[0]?.narrativeType).toBe('Victimhood');
      expect(result.narrativeBattleHistory[1]?.narrativeType).toBe('Liberation');
    });

    it('handles no narrative battle (undefined)', () => {
      const prev = makeState();
      const input = makeInput({ humanitarianBonus: 5 });
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.narrativeBattleHistory).toHaveLength(0);
    });

    it('updates turn number correctly', () => {
      const prev = makeState({ turn: 5 as TurnNumber });
      const input = makeInput();
      const result = engine.computeTurnLegitimacy(prev, input, 6 as TurnNumber);

      expect(result.turn).toBe(6);
    });

    it('preserves narrativeActive from previous state', () => {
      const prev = makeState({ narrativeActive: 'Victimhood' as NarrativeType });
      const input = makeInput();
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.narrativeActive).toBe('Victimhood');
    });

    it('preserves whistleblowerRisk from previous state', () => {
      const prev = makeState({ whistleblowerRisk: 42 });
      const input = makeInput();
      const result = engine.computeTurnLegitimacy(prev, input, 2 as TurnNumber);

      expect(result.whistleblowerRisk).toBe(42);
    });
  });

  // ── assessDiplomaticGating ──────────────────────────────

  describe('assessDiplomaticGating', () => {
    it('returns blocked=true, bonusActive=false at low legitimacy', () => {
      const gating = engine.assessDiplomaticGating(20);

      expect(gating.blocked).toBe(true);
      expect(gating.bonusActive).toBe(false);
    });

    it('returns blocked=false, bonusActive=true at high legitimacy', () => {
      const gating = engine.assessDiplomaticGating(80);

      expect(gating.blocked).toBe(false);
      expect(gating.bonusActive).toBe(true);
    });

    it('returns blocked=false, bonusActive=false in middle range', () => {
      const gating = engine.assessDiplomaticGating(50);

      expect(gating.blocked).toBe(false);
      expect(gating.bonusActive).toBe(false);
    });

    it('returns correct effectivenessModifier', () => {
      const gatingHigh = engine.assessDiplomaticGating(75);
      expect(gatingHigh.effectivenessModifier).toBe(0.15);

      const gatingLow = engine.assessDiplomaticGating(40);
      expect(gatingLow.effectivenessModifier).toBe(0);
    });
  });

  // ── config override ─────────────────────────────────────

  describe('config override', () => {
    it('respects custom blocksAlliances threshold', () => {
      const custom = new LegitimacyEngine({ blocksAlliances: 20 });

      expect(custom.isDiplomacyBlocked(20)).toBe(true);
      expect(custom.isDiplomacyBlocked(21)).toBe(false);
      // Default engine would still block at 30
      expect(engine.isDiplomacyBlocked(25)).toBe(true);
    });

    it('respects custom diplomaticBonusThreshold', () => {
      const custom = new LegitimacyEngine({ diplomaticBonusThreshold: 80 });

      expect(custom.getDiplomaticEffectivenessModifier(75)).toBe(0);
      expect(custom.getDiplomaticEffectivenessModifier(80)).toBeGreaterThan(0);
    });

    it('respects custom diplomaticEffectivenessBonus', () => {
      const custom = new LegitimacyEngine({ diplomaticEffectivenessBonus: 0.25 });

      expect(custom.getDiplomaticEffectivenessModifier(70)).toBe(0.25);
    });

    it('respects custom unResolutionPenalty', () => {
      const custom = new LegitimacyEngine({ unResolutionPenalty: -15 });
      const input = makeInput({ unResolutions: 2 });

      // 2 × -15 = -30
      expect(custom.computeLegitimacyDelta(input)).toBe(-30);
      // Default engine: 2 × -10 = -20
      expect(engine.computeLegitimacyDelta(input)).toBe(-20);
    });
  });
});
