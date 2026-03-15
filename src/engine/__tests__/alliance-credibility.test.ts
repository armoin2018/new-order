import { describe, it, expect } from 'vitest';
import { AllianceCredibilityEngine } from '@/engine/alliance-credibility';
import type { CredibilityState, BreachInput, CredibilityTurnInput } from '@/engine/alliance-credibility';
import { AgreementType, FactionId } from '@/data/types';
import type { TurnNumber } from '@/data/types';

const AT = AgreementType;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeState(overrides?: Partial<CredibilityState>): CredibilityState {
  return {
    factionId: FactionId.US,
    credibility: 75,
    lastBreachTurn: null,
    totalBreaches: 0,
    breachHistory: [],
    ...overrides,
  };
}

function makeBreach(overrides?: Partial<BreachInput>): BreachInput {
  return {
    breakingFaction: FactionId.US,
    targetFaction: FactionId.China,
    agreementType: AT.NAP,
    currentTurn: 5 as TurnNumber,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AllianceCredibilityEngine', () => {
  const engine = new AllianceCredibilityEngine();

  /* ================================================================ */
  /*  createInitialState                                               */
  /* ================================================================ */

  describe('createInitialState', () => {
    it('sets credibility to 75 (initialValue)', () => {
      const state = AllianceCredibilityEngine.createInitialState(FactionId.US);
      expect(state.credibility).toBe(75);
    });

    it('sets factionId correctly', () => {
      const state = AllianceCredibilityEngine.createInitialState(FactionId.China);
      expect(state.factionId).toBe(FactionId.China);
    });

    it('sets lastBreachTurn to null', () => {
      const state = AllianceCredibilityEngine.createInitialState(FactionId.US);
      expect(state.lastBreachTurn).toBeNull();
    });

    it('sets totalBreaches to 0', () => {
      const state = AllianceCredibilityEngine.createInitialState(FactionId.US);
      expect(state.totalBreaches).toBe(0);
    });

    it('sets breachHistory to an empty array', () => {
      const state = AllianceCredibilityEngine.createInitialState(FactionId.US);
      expect(state.breachHistory).toEqual([]);
    });

    it('returns a new object each call', () => {
      const a = AllianceCredibilityEngine.createInitialState(FactionId.US);
      const b = AllianceCredibilityEngine.createInitialState(FactionId.US);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  /* ================================================================ */
  /*  getBreachPenalty                                                 */
  /* ================================================================ */

  describe('getBreachPenalty', () => {
    it('returns -15 for NAP', () => {
      expect(engine.getBreachPenalty(AT.NAP)).toBe(-15);
    });

    it('returns -10 for TradeDeal', () => {
      expect(engine.getBreachPenalty(AT.TradeDeal)).toBe(-10);
    });

    it('returns -30 for DefensePact', () => {
      expect(engine.getBreachPenalty(AT.DefensePact)).toBe(-30);
    });

    it('returns -20 for IntelSharing', () => {
      expect(engine.getBreachPenalty(AT.IntelSharing)).toBe(-20);
    });
  });

  /* ================================================================ */
  /*  processBreach                                                    */
  /* ================================================================ */

  describe('processBreach', () => {
    it('NAP breach decreases credibility by 15 (75 → 60)', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({ agreementType: AT.NAP }));
      expect(result.newState.credibility).toBe(60);
    });

    it('TradeDeal breach decreases credibility by 10 (75 → 65)', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({ agreementType: AT.TradeDeal }));
      expect(result.newState.credibility).toBe(65);
    });

    it('DefensePact breach decreases credibility by 30 (75 → 45)', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({ agreementType: AT.DefensePact }));
      expect(result.newState.credibility).toBe(45);
    });

    it('IntelSharing breach decreases credibility by 20 (75 → 55)', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({ agreementType: AT.IntelSharing }));
      expect(result.newState.credibility).toBe(55);
    });

    it('DI penalty is -5', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach());
      expect(result.diPenalty).toBe(-5);
    });

    it('betrayed stability penalty is -5', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach());
      expect(result.betrayedStabilityPenalty).toBe(-5);
    });

    it('updates lastBreachTurn to currentTurn', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({ currentTurn: 12 as TurnNumber }));
      expect(result.newState.lastBreachTurn).toBe(12);
    });

    it('increments totalBreaches', () => {
      const state = makeState({ totalBreaches: 3 });
      const result = engine.processBreach(state, makeBreach());
      expect(result.newState.totalBreaches).toBe(4);
    });

    it('appends breach record to history', () => {
      const state = makeState();
      const result = engine.processBreach(state, makeBreach({
        agreementType: AT.TradeDeal,
        currentTurn: 7 as TurnNumber,
      }));
      expect(result.newState.breachHistory).toHaveLength(1);
      expect(result.newState.breachHistory[0]).toEqual(result.record);
    });

    it('does not mutate input state', () => {
      const state = makeState();
      const originalCredibility = state.credibility;
      const originalBreaches = state.totalBreaches;
      engine.processBreach(state, makeBreach());
      expect(state.credibility).toBe(originalCredibility);
      expect(state.totalBreaches).toBe(originalBreaches);
      expect(state.breachHistory).toHaveLength(0);
      expect(state.lastBreachTurn).toBeNull();
    });

    it('clamps credibility to min 0 (no negative values)', () => {
      const state = makeState({ credibility: 10 });
      const result = engine.processBreach(state, makeBreach({ agreementType: AT.DefensePact }));
      expect(result.newState.credibility).toBe(0);
    });

    it('accumulates multiple breaches in history', () => {
      const state0 = makeState();
      const result1 = engine.processBreach(state0, makeBreach({
        agreementType: AT.NAP,
        currentTurn: 3 as TurnNumber,
      }));
      const result2 = engine.processBreach(result1.newState, makeBreach({
        agreementType: AT.TradeDeal,
        currentTurn: 4 as TurnNumber,
      }));
      expect(result2.newState.breachHistory).toHaveLength(2);
      expect(result2.newState.totalBreaches).toBe(2);
    });
  });

  /* ================================================================ */
  /*  applyRecovery                                                    */
  /* ================================================================ */

  describe('applyRecovery', () => {
    it('recovers when no breaches (lastBreachTurn null)', () => {
      const state = makeState({ credibility: 70 });
      const result = engine.applyRecovery(state, 10 as TurnNumber);
      expect(result.recovered).toBe(true);
      expect(result.amount).toBe(1);
      expect(result.newState.credibility).toBe(71);
    });

    it('recovers when grace period has passed', () => {
      const state = makeState({ credibility: 60, lastBreachTurn: 2 as TurnNumber });
      const result = engine.applyRecovery(state, 8 as TurnNumber); // 8 - 2 = 6 > 5
      expect(result.recovered).toBe(true);
      expect(result.amount).toBe(1);
      expect(result.newState.credibility).toBe(61);
    });

    it('does not recover during grace period', () => {
      const state = makeState({ credibility: 60, lastBreachTurn: 3 as TurnNumber });
      const result = engine.applyRecovery(state, 5 as TurnNumber); // 5 - 3 = 2 <= 5
      expect(result.recovered).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toContain('Within grace period');
    });

    it('does not recover when already at max (100)', () => {
      const state = makeState({ credibility: 100 });
      const result = engine.applyRecovery(state, 10 as TurnNumber);
      expect(result.recovered).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toBe('Credibility already at maximum');
    });

    it('blocks recovery at exactly grace-period boundary (5 turns since breach)', () => {
      const state = makeState({ credibility: 60, lastBreachTurn: 5 as TurnNumber });
      const result = engine.applyRecovery(state, 10 as TurnNumber); // 10 - 5 = 5 <= 5
      expect(result.recovered).toBe(false);
      expect(result.reason).toContain('Within grace period');
    });

    it('allows recovery at 6 turns after breach', () => {
      const state = makeState({ credibility: 60, lastBreachTurn: 4 as TurnNumber });
      const result = engine.applyRecovery(state, 10 as TurnNumber); // 10 - 4 = 6 > 5
      expect(result.recovered).toBe(true);
      expect(result.amount).toBe(1);
    });

    it('does not mutate input state', () => {
      const state = makeState({ credibility: 70 });
      const originalCredibility = state.credibility;
      engine.applyRecovery(state, 10 as TurnNumber);
      expect(state.credibility).toBe(originalCredibility);
    });

    it('caps credibility at max 100', () => {
      const state = makeState({ credibility: 99 });
      const result = engine.applyRecovery(state, 10 as TurnNumber);
      expect(result.recovered).toBe(true);
      expect(result.newState.credibility).toBe(100);
    });

    it('includes correct reason string for recovery', () => {
      const state = makeState({ credibility: 50 });
      const result = engine.applyRecovery(state, 10 as TurnNumber);
      expect(result.reason).toBe('Passive recovery applied');
    });

    it('recovery amount reflects actual change when near max', () => {
      const state = makeState({ credibility: 100 });
      const result = engine.applyRecovery(state, 10 as TurnNumber);
      expect(result.amount).toBe(0);
      expect(result.recovered).toBe(false);
    });
  });

  /* ================================================================ */
  /*  calculateAcceptanceModifier                                      */
  /* ================================================================ */

  describe('calculateAcceptanceModifier', () => {
    it('credibility 0 → auto-rejected, modifier -1', () => {
      const mod = engine.calculateAcceptanceModifier(0);
      expect(mod.isAutoRejected).toBe(true);
      expect(mod.credibilityModifier).toBe(-1);
    });

    it('credibility 20 → auto-rejected (at threshold)', () => {
      const mod = engine.calculateAcceptanceModifier(20);
      expect(mod.isAutoRejected).toBe(true);
      expect(mod.credibilityModifier).toBe(-1);
    });

    it('credibility 21 → NOT auto-rejected', () => {
      const mod = engine.calculateAcceptanceModifier(21);
      expect(mod.isAutoRejected).toBe(false);
    });

    it('credibility 80 → trusted ally, modifier 0.2', () => {
      const mod = engine.calculateAcceptanceModifier(80);
      expect(mod.isTrustedAlly).toBe(true);
      expect(mod.credibilityModifier).toBe(0.2);
    });

    it('credibility 100 → trusted ally', () => {
      const mod = engine.calculateAcceptanceModifier(100);
      expect(mod.isTrustedAlly).toBe(true);
      expect(mod.credibilityModifier).toBe(0.2);
    });

    it('credibility 79 → NOT trusted ally', () => {
      const mod = engine.calculateAcceptanceModifier(79);
      expect(mod.isTrustedAlly).toBe(false);
    });

    it('credibility 50 → modifier 0 (neutral)', () => {
      const mod = engine.calculateAcceptanceModifier(50);
      expect(mod.credibilityModifier).toBe(0);
    });

    it('credibility 60 → modifier 0.05', () => {
      const mod = engine.calculateAcceptanceModifier(60);
      expect(mod.credibilityModifier).toBeCloseTo(0.05);
    });

    it('credibility 30 → modifier -0.1', () => {
      const mod = engine.calculateAcceptanceModifier(30);
      expect(mod.credibilityModifier).toBeCloseTo(-0.1);
    });

    it('credibility 75 → modifier 0.125', () => {
      const mod = engine.calculateAcceptanceModifier(75);
      expect(mod.credibilityModifier).toBeCloseTo(0.125);
    });
  });

  /* ================================================================ */
  /*  processTurn                                                      */
  /* ================================================================ */

  describe('processTurn', () => {
    it('all eligible factions recover', () => {
      const input: CredibilityTurnInput = {
        states: [
          makeState({ factionId: FactionId.US, credibility: 60 }),
          makeState({ factionId: FactionId.China, credibility: 50 }),
        ],
        currentTurn: 20 as TurnNumber,
      };
      const result = engine.processTurn(input);
      expect(result.updatedStates[0]?.credibility).toBe(61);
      expect(result.updatedStates[1]?.credibility).toBe(51);
      expect(result.recoveries).toHaveLength(2);
    });

    it('ineligible factions do not recover', () => {
      const input: CredibilityTurnInput = {
        states: [
          makeState({ factionId: FactionId.US, credibility: 60, lastBreachTurn: 9 as TurnNumber }),
        ],
        currentTurn: 10 as TurnNumber, // 10 - 9 = 1 <= 5
      };
      const result = engine.processTurn(input);
      expect(result.updatedStates[0]?.credibility).toBe(60);
      expect(result.recoveries).toHaveLength(0);
    });

    it('returns updated states for all factions', () => {
      const input: CredibilityTurnInput = {
        states: [
          makeState({ factionId: FactionId.US }),
          makeState({ factionId: FactionId.China }),
          makeState({ factionId: FactionId.Russia }),
        ],
        currentTurn: 20 as TurnNumber,
      };
      const result = engine.processTurn(input);
      expect(result.updatedStates).toHaveLength(3);
    });

    it('recoveries array only contains factions that recovered', () => {
      const input: CredibilityTurnInput = {
        states: [
          makeState({ factionId: FactionId.US, credibility: 60 }),
          makeState({ factionId: FactionId.China, credibility: 100 }),
        ],
        currentTurn: 20 as TurnNumber,
      };
      const result = engine.processTurn(input);
      expect(result.recoveries).toHaveLength(1);
      expect(result.recoveries[0]?.factionId).toBe(FactionId.US);
    });

    it('empty input → empty output', () => {
      const input: CredibilityTurnInput = {
        states: [],
        currentTurn: 1 as TurnNumber,
      };
      const result = engine.processTurn(input);
      expect(result.updatedStates).toHaveLength(0);
      expect(result.recoveries).toHaveLength(0);
    });

    it('mixed: some recover, some blocked by grace period', () => {
      const input: CredibilityTurnInput = {
        states: [
          makeState({ factionId: FactionId.US, credibility: 50 }),
          makeState({
            factionId: FactionId.China,
            credibility: 40,
            lastBreachTurn: 8 as TurnNumber,
          }),
        ],
        currentTurn: 10 as TurnNumber, // US: no breach → recovers; China: 10-8=2 <=5 → blocked
      };
      const result = engine.processTurn(input);
      expect(result.updatedStates[0]?.credibility).toBe(51);
      expect(result.updatedStates[1]?.credibility).toBe(40);
      expect(result.recoveries).toHaveLength(1);
      expect(result.recoveries[0]?.factionId).toBe(FactionId.US);
    });
  });

  /* ================================================================ */
  /*  isAutoRejected                                                   */
  /* ================================================================ */

  describe('isAutoRejected', () => {
    it('20 → true', () => {
      expect(engine.isAutoRejected(20)).toBe(true);
    });

    it('0 → true', () => {
      expect(engine.isAutoRejected(0)).toBe(true);
    });

    it('21 → false', () => {
      expect(engine.isAutoRejected(21)).toBe(false);
    });
  });

  /* ================================================================ */
  /*  isTrustedAlly                                                    */
  /* ================================================================ */

  describe('isTrustedAlly', () => {
    it('80 → true', () => {
      expect(engine.isTrustedAlly(80)).toBe(true);
    });

    it('100 → true', () => {
      expect(engine.isTrustedAlly(100)).toBe(true);
    });

    it('79 → false', () => {
      expect(engine.isTrustedAlly(79)).toBe(false);
    });
  });

  /* ================================================================ */
  /*  getCredibilityTier                                               */
  /* ================================================================ */

  describe('getCredibilityTier', () => {
    it('0 → pariah', () => {
      expect(engine.getCredibilityTier(0)).toBe('pariah');
    });

    it('20 → pariah (boundary)', () => {
      expect(engine.getCredibilityTier(20)).toBe('pariah');
    });

    it('21 → unreliable', () => {
      expect(engine.getCredibilityTier(21)).toBe('unreliable');
    });

    it('50 → neutral', () => {
      expect(engine.getCredibilityTier(50)).toBe('neutral');
    });

    it('75 → reliable', () => {
      expect(engine.getCredibilityTier(75)).toBe('reliable');
    });

    it('90 → trusted', () => {
      expect(engine.getCredibilityTier(90)).toBe('trusted');
    });
  });
});
