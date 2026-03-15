import { describe, it, expect } from 'vitest';
import { BilateralAgreementEngine } from '@/engine/diplomacy-agreements';
import type { BilateralAgreement, ProposalInput } from '@/engine/diplomacy-agreements';
import { AgreementType, AgreementStatus, FactionId } from '@/data/types';
import type { TurnNumber, NationState } from '@/data/types';

const AT = AgreementType;
const AS = AgreementStatus;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNation(overrides?: Partial<NationState>): NationState {
  return {
    factionId: FactionId.US,
    stability: 60,
    treasury: 100,
    gdp: 500,
    inflation: 2,
    militaryReadiness: 70,
    nuclearThreshold: 10,
    diplomaticInfluence: 50,
    popularity: 55,
    allianceCredibility: 75,
    techLevel: 60,
    ...overrides,
  };
}

function makeAgreement(overrides?: Partial<BilateralAgreement>): BilateralAgreement {
  return {
    id: 'test-agreement',
    type: AT.NAP,
    status: AS.Active,
    proposer: FactionId.US,
    target: FactionId.China,
    proposedTurn: 1 as TurnNumber,
    activatedTurn: 1 as TurnNumber,
    expirationTurn: null,
    duration: 0,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<ProposalInput>): ProposalInput {
  return {
    proposer: FactionId.US,
    target: FactionId.China,
    agreementType: AT.NAP,
    currentTurn: 1 as TurnNumber,
    proposerNation: makeNation({ factionId: FactionId.US }),
    targetNation: makeNation({ factionId: FactionId.China }),
    trust: 50,
    chemistry: 20,
    existingAgreements: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BilateralAgreementEngine', () => {
  const engine = new BilateralAgreementEngine();

  // -----------------------------------------------------------------------
  // getAgreementConfig
  // -----------------------------------------------------------------------
  describe('getAgreementConfig', () => {
    it('returns minTrust 20 and diCost 5 for NAP', () => {
      const cfg = engine.getAgreementConfig(AT.NAP);
      expect(cfg.minTrust).toBe(20);
      expect(cfg.diCost).toBe(5);
    });

    it('returns minTrust 15 and diCost 8 for TradeDeal', () => {
      const cfg = engine.getAgreementConfig(AT.TradeDeal);
      expect(cfg.minTrust).toBe(15);
      expect(cfg.diCost).toBe(8);
    });

    it('returns minTrust 40 and diCost 15 for DefensePact', () => {
      const cfg = engine.getAgreementConfig(AT.DefensePact);
      expect(cfg.minTrust).toBe(40);
      expect(cfg.diCost).toBe(15);
    });

    it('returns minTrust 60 and diCost 12 for IntelSharing', () => {
      const cfg = engine.getAgreementConfig(AT.IntelSharing);
      expect(cfg.minTrust).toBe(60);
      expect(cfg.diCost).toBe(12);
    });

    it('returns correct defaultDuration for each type (0, 10, 0, 8)', () => {
      expect(engine.getAgreementConfig(AT.NAP).defaultDuration).toBe(0);
      expect(engine.getAgreementConfig(AT.TradeDeal).defaultDuration).toBe(10);
      expect(engine.getAgreementConfig(AT.DefensePact).defaultDuration).toBe(0);
      expect(engine.getAgreementConfig(AT.IntelSharing).defaultDuration).toBe(8);
    });
  });

  // -----------------------------------------------------------------------
  // validateProposal
  // -----------------------------------------------------------------------
  describe('validateProposal', () => {
    it('returns valid when all requirements are met', () => {
      const result = engine.validateProposal(makeInput());
      expect(result.valid).toBe(true);
      expect(result.reason).toContain('valid');
    });

    it('rejects when trust is below NAP minimum (trust 10 < 20)', () => {
      const result = engine.validateProposal(makeInput({ trust: 10 }));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Trust');
      expect(result.reason).toContain('below minimum');
    });

    it('rejects when trust is below DefensePact minimum (trust 30 < 40)', () => {
      const result = engine.validateProposal(
        makeInput({ agreementType: AT.DefensePact, trust: 30 }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Trust');
    });

    it('rejects when proposer has insufficient DI (DI 3 < NAP cost 5)', () => {
      const result = engine.validateProposal(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            diplomaticInfluence: 3,
          }),
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Insufficient Diplomatic Influence');
    });

    it('rejects when a duplicate active agreement of the same type exists', () => {
      const existing = makeAgreement({
        type: AT.NAP,
        status: AS.Active,
        proposer: FactionId.US,
        target: FactionId.China,
      });
      const result = engine.validateProposal(
        makeInput({ existingAgreements: [existing] }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already exists');
    });

    it('rejects when max simultaneous agreements (3) are reached', () => {
      const existing = [
        makeAgreement({ id: 'a1', type: AT.NAP, status: AS.Active }),
        makeAgreement({ id: 'a2', type: AT.TradeDeal, status: AS.Active }),
        makeAgreement({ id: 'a3', type: AT.DefensePact, status: AS.Active }),
      ];
      const result = engine.validateProposal(
        makeInput({
          agreementType: AT.IntelSharing,
          trust: 60,
          existingAgreements: existing,
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Maximum simultaneous agreements');
    });

    it('rejects when target credibility is at or below autoRejectThreshold (20)', () => {
      const result = engine.validateProposal(
        makeInput({
          targetNation: makeNation({
            factionId: FactionId.China,
            allianceCredibility: 20,
          }),
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('auto-reject threshold');
    });

    it('accepts when target credibility is just above threshold (21)', () => {
      const result = engine.validateProposal(
        makeInput({
          targetNation: makeNation({
            factionId: FactionId.China,
            allianceCredibility: 21,
          }),
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('enforces IntelSharing minimum trust of 60', () => {
      const result = engine.validateProposal(
        makeInput({ agreementType: AT.IntelSharing, trust: 55 }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Trust');
      expect(result.reason).toContain('below minimum');
    });

    it('detects duplicates regardless of proposer/target direction', () => {
      // Existing agreement has China → US, new proposal is US → China
      const existing = makeAgreement({
        type: AT.NAP,
        status: AS.Active,
        proposer: FactionId.China,
        target: FactionId.US,
      });
      const result = engine.validateProposal(
        makeInput({ existingAgreements: [existing] }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already exists');
    });
  });

  // -----------------------------------------------------------------------
  // evaluateUtility
  // -----------------------------------------------------------------------
  describe('evaluateUtility', () => {
    it('high trust yields a high trustScore contribution', () => {
      const eval1 = engine.evaluateUtility(makeInput({ trust: 90 }));
      const eval2 = engine.evaluateUtility(makeInput({ trust: 20 }));
      expect(eval1.factors.trustScore).toBeGreaterThan(eval2.factors.trustScore);
    });

    it('negative chemistry reduces utility', () => {
      const evalPos = engine.evaluateUtility(makeInput({ chemistry: 30 }));
      const evalNeg = engine.evaluateUtility(makeInput({ chemistry: -30 }));
      expect(evalNeg.factors.chemistryScore).toBeLessThan(0);
      expect(evalNeg.utility).toBeLessThan(evalPos.utility);
    });

    it('positive chemistry increases utility', () => {
      const evalZero = engine.evaluateUtility(makeInput({ chemistry: 0 }));
      const evalPos = engine.evaluateUtility(makeInput({ chemistry: 50 }));
      expect(evalPos.factors.chemistryScore).toBeGreaterThan(0);
      expect(evalPos.utility).toBeGreaterThan(evalZero.utility);
    });

    it('grants trusted ally bonus (+0.2) when proposer credibility >= 80', () => {
      const evalTrusted = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      const evalNormal = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 79,
          }),
        }),
      );
      // The trusted ally bonus is 0.2 applied to the total utility
      expect(evalTrusted.utility - evalNormal.utility).toBeCloseTo(0.2, 1);
    });

    it('auto-rejects when proposer credibility <= 20', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 20,
          }),
        }),
      );
      expect(result.accepted).toBe(false);
      expect(result.reason).toContain('auto-reject');
    });

    it('credibilityModifier is 0 when proposer credibility is 50', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 50,
          }),
        }),
      );
      expect(result.factors.credibilityModifier).toBe(0);
    });

    it('credibilityModifier is 0.125 when proposer credibility is 75', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 75,
          }),
        }),
      );
      // (75 - 50) * 0.005 = 0.125
      expect(result.factors.credibilityModifier).toBeCloseTo(0.125, 5);
    });

    it('activates shared enemy bonus when both stabilities are below 50', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({ factionId: FactionId.US, stability: 40 }),
          targetNation: makeNation({ factionId: FactionId.China, stability: 30 }),
        }),
      );
      expect(result.factors.sharedEnemyBonus).toBe(0.15);
    });

    it('does not activate shared enemy bonus when either stability >= 50', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({ factionId: FactionId.US, stability: 50 }),
          targetNation: makeNation({ factionId: FactionId.China, stability: 30 }),
        }),
      );
      expect(result.factors.sharedEnemyBonus).toBe(0);
    });

    it('applies ideological penalty when popularity gap > 60', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({ factionId: FactionId.US, popularity: 90 }),
          targetNation: makeNation({ factionId: FactionId.China, popularity: 20 }),
        }),
      );
      expect(result.factors.ideologicalPenalty).toBe(-0.2);
    });

    it('does not apply ideological penalty when popularity gap <= 60', () => {
      const result = engine.evaluateUtility(
        makeInput({
          proposerNation: makeNation({ factionId: FactionId.US, popularity: 60 }),
          targetNation: makeNation({ factionId: FactionId.China, popularity: 10 }),
        }),
      );
      // Gap is 50 which is <= 60
      expect(result.factors.ideologicalPenalty).toBe(0);
    });

    it('accepts when utility >= 0.5', () => {
      // High trust + positive chemistry + decent credibility should push over threshold
      const result = engine.evaluateUtility(
        makeInput({
          trust: 90,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      expect(result.utility).toBeGreaterThanOrEqual(0.5);
      expect(result.accepted).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // proposeAgreement
  // -----------------------------------------------------------------------
  describe('proposeAgreement', () => {
    it('returns Rejected with utility 0 when validation fails', () => {
      const result = engine.proposeAgreement(makeInput({ trust: 5 }));
      expect(result.agreement.status).toBe(AS.Rejected);
      expect(result.evaluation.utility).toBe(0);
      expect(result.evaluation.accepted).toBe(false);
    });

    it('returns Active with activatedTurn set when utility meets threshold', () => {
      const result = engine.proposeAgreement(
        makeInput({
          trust: 90,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      expect(result.agreement.status).toBe(AS.Active);
      expect(result.agreement.activatedTurn).toBe(1);
    });

    it('returns Rejected with activatedTurn null when utility is below threshold', () => {
      // Very low trust/chemistry, credibility just above auto-reject
      const result = engine.proposeAgreement(
        makeInput({
          trust: 20,
          chemistry: -50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 25,
            popularity: 95,
          }),
          targetNation: makeNation({
            factionId: FactionId.China,
            popularity: 10,
          }),
        }),
      );
      expect(result.agreement.status).toBe(AS.Rejected);
      expect(result.agreement.activatedTurn).toBeNull();
    });

    it('always returns the DI cost for the agreement type', () => {
      const napResult = engine.proposeAgreement(makeInput({ agreementType: AT.NAP }));
      expect(napResult.diCost).toBe(5);

      const tradeResult = engine.proposeAgreement(
        makeInput({ agreementType: AT.TradeDeal, trust: 50 }),
      );
      expect(tradeResult.diCost).toBe(8);
    });

    it('sets correct expirationTurn for TradeDeal (activatedTurn + 10)', () => {
      const result = engine.proposeAgreement(
        makeInput({
          agreementType: AT.TradeDeal,
          currentTurn: 5 as TurnNumber,
          trust: 90,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      // Only check expiration if actually accepted
      if (result.agreement.status === AS.Active) {
        expect(result.agreement.expirationTurn).toBe(15); // 5 + 10
      }
    });

    it('sets expirationTurn to null for NAP (duration 0)', () => {
      const result = engine.proposeAgreement(
        makeInput({
          agreementType: AT.NAP,
          trust: 90,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      if (result.agreement.status === AS.Active) {
        expect(result.agreement.expirationTurn).toBeNull();
        expect(result.agreement.duration).toBe(0);
      }
    });

    it('generates agreement ID in format ${proposer}-${target}-${type}-T${turn}', () => {
      const result = engine.proposeAgreement(
        makeInput({
          proposer: FactionId.US,
          target: FactionId.China,
          agreementType: AT.NAP,
          currentTurn: 3 as TurnNumber,
        }),
      );
      expect(result.agreement.id).toBe('us-china-NAP-T3');
    });

    it('returns a valid evaluation breakdown on accepted proposal', () => {
      const result = engine.proposeAgreement(
        makeInput({
          trust: 90,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      expect(result.evaluation.factors).toBeDefined();
      expect(result.evaluation.factors.trustScore).toBeGreaterThan(0);
      expect(result.evaluation.accepted).toBe(true);
    });

    it('DefensePact requires trust 40+ to validate', () => {
      const result = engine.proposeAgreement(
        makeInput({ agreementType: AT.DefensePact, trust: 35 }),
      );
      expect(result.agreement.status).toBe(AS.Rejected);
      expect(result.evaluation.reason).toContain('Trust');
    });

    it('IntelSharing with trust 60+ and good utility is accepted', () => {
      const result = engine.proposeAgreement(
        makeInput({
          agreementType: AT.IntelSharing,
          trust: 80,
          chemistry: 50,
          proposerNation: makeNation({
            factionId: FactionId.US,
            allianceCredibility: 80,
          }),
        }),
      );
      expect(result.agreement.status).toBe(AS.Active);
    });
  });

  // -----------------------------------------------------------------------
  // calculateActiveEffects
  // -----------------------------------------------------------------------
  describe('calculateActiveEffects', () => {
    it('NAP produces stabilityBonus 1 and tensionReduction -10', () => {
      const agreements = [makeAgreement({ type: AT.NAP, status: AS.Active })];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(1);
      const eff = effects[0]!;
      expect(eff.stabilityBonus).toBe(1);
      expect(eff.tensionReduction).toBe(-10);
    });

    it('TradeDeal produces gdpBonus 0.005 and treasuryBonus 2', () => {
      const agreements = [
        makeAgreement({ type: AT.TradeDeal, status: AS.Active }),
      ];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(1);
      const eff = effects[0]!;
      expect(eff.gdpBonus).toBe(0.005);
      expect(eff.treasuryBonus).toBe(2);
    });

    it('DefensePact produces militaryReadinessBonus 5', () => {
      const agreements = [
        makeAgreement({ type: AT.DefensePact, status: AS.Active }),
      ];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(1);
      const eff = effects[0]!;
      expect(eff.militaryReadinessBonus).toBe(5);
    });

    it('IntelSharing produces all-zero effects', () => {
      const agreements = [
        makeAgreement({ type: AT.IntelSharing, status: AS.Active }),
      ];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(1);
      const eff = effects[0]!;
      expect(eff.stabilityBonus).toBe(0);
      expect(eff.gdpBonus).toBe(0);
      expect(eff.treasuryBonus).toBe(0);
      expect(eff.militaryReadinessBonus).toBe(0);
      expect(eff.tensionReduction).toBe(0);
    });

    it('only processes Active agreements, skipping Rejected and Expired', () => {
      const agreements = [
        makeAgreement({ id: 'active', type: AT.NAP, status: AS.Active }),
        makeAgreement({ id: 'rejected', type: AT.TradeDeal, status: AS.Rejected }),
        makeAgreement({ id: 'expired', type: AT.DefensePact, status: AS.Expired }),
      ];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(1);
      expect(effects[0]!.agreementId).toBe('active');
    });

    it('returns effects for both sides of an agreement', () => {
      const agreements = [
        makeAgreement({
          type: AT.NAP,
          status: AS.Active,
          proposer: FactionId.US,
          target: FactionId.China,
        }),
      ];

      const usEffects = engine.calculateActiveEffects(FactionId.US, agreements);
      const chinaEffects = engine.calculateActiveEffects(FactionId.China, agreements);

      expect(usEffects).toHaveLength(1);
      expect(chinaEffects).toHaveLength(1);
      // US sees partner as China, China sees partner as US
      expect(usEffects[0]!.targetFaction).toBe(FactionId.China);
      expect(chinaEffects[0]!.targetFaction).toBe(FactionId.US);
    });

    it('returns empty array when there are no active agreements', () => {
      const effects = engine.calculateActiveEffects(FactionId.US, []);
      expect(effects).toHaveLength(0);
    });

    it('returns multiple effects for multiple active agreements', () => {
      const agreements = [
        makeAgreement({ id: 'a1', type: AT.NAP, status: AS.Active }),
        makeAgreement({ id: 'a2', type: AT.TradeDeal, status: AS.Active }),
        makeAgreement({ id: 'a3', type: AT.DefensePact, status: AS.Active }),
      ];
      const effects = engine.calculateActiveEffects(FactionId.US, agreements);
      expect(effects).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // checkExpiration
  // -----------------------------------------------------------------------
  describe('checkExpiration', () => {
    it('returns false when duration is 0 (never expires)', () => {
      const agreement = makeAgreement({ duration: 0, activatedTurn: 1 as TurnNumber });
      expect(engine.checkExpiration(agreement, 100 as TurnNumber)).toBe(false);
    });

    it('returns false before expiration', () => {
      const agreement = makeAgreement({
        duration: 10,
        activatedTurn: 5 as TurnNumber,
      });
      // Expires at turn 15, currently at turn 10
      expect(engine.checkExpiration(agreement, 10 as TurnNumber)).toBe(false);
    });

    it('returns true exactly at expiration', () => {
      const agreement = makeAgreement({
        duration: 10,
        activatedTurn: 5 as TurnNumber,
      });
      // Expires at turn 15, currently at turn 15
      expect(engine.checkExpiration(agreement, 15 as TurnNumber)).toBe(true);
    });

    it('returns true past expiration', () => {
      const agreement = makeAgreement({
        duration: 10,
        activatedTurn: 5 as TurnNumber,
      });
      // Expires at turn 15, currently at turn 20
      expect(engine.checkExpiration(agreement, 20 as TurnNumber)).toBe(true);
    });

    it('returns false when activatedTurn is null', () => {
      const agreement = makeAgreement({
        duration: 10,
        activatedTurn: null,
      });
      expect(engine.checkExpiration(agreement, 100 as TurnNumber)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // processExpirations
  // -----------------------------------------------------------------------
  describe('processExpirations', () => {
    it('returns empty expired list when nothing has expired', () => {
      const agreements = [
        makeAgreement({ duration: 10, activatedTurn: 5 as TurnNumber }),
      ];
      const result = engine.processExpirations(agreements, 10 as TurnNumber);
      expect(result.expired).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
    });

    it('marks expired agreements with status Expired', () => {
      const agreements = [
        makeAgreement({
          id: 'exp',
          duration: 10,
          activatedTurn: 1 as TurnNumber,
          status: AS.Active,
        }),
      ];
      const result = engine.processExpirations(agreements, 11 as TurnNumber);
      expect(result.expired).toHaveLength(1);
      expect(result.expired[0]!.status).toBe(AS.Expired);
      expect(result.updated[0]!.status).toBe(AS.Expired);
    });

    it('leaves non-expired agreements unchanged', () => {
      const agreements = [
        makeAgreement({
          id: 'still-active',
          duration: 10,
          activatedTurn: 5 as TurnNumber,
          status: AS.Active,
        }),
        makeAgreement({
          id: 'indefinite',
          duration: 0,
          activatedTurn: 1 as TurnNumber,
          status: AS.Active,
        }),
      ];
      const result = engine.processExpirations(agreements, 10 as TurnNumber);
      expect(result.expired).toHaveLength(0);
      expect(result.updated).toHaveLength(2);
      expect(result.updated[0]!.status).toBe(AS.Active);
      expect(result.updated[1]!.status).toBe(AS.Active);
    });

    it('does not mutate the input array', () => {
      const original = makeAgreement({
        id: 'exp',
        duration: 5,
        activatedTurn: 1 as TurnNumber,
        status: AS.Active,
      });
      const agreements: readonly BilateralAgreement[] = [original];
      engine.processExpirations(agreements, 10 as TurnNumber);
      // Original object should still be Active
      expect(original.status).toBe(AS.Active);
      expect(agreements).toHaveLength(1);
    });

    it('handles multiple expirations in a single pass', () => {
      const agreements = [
        makeAgreement({
          id: 'exp1',
          duration: 5,
          activatedTurn: 1 as TurnNumber,
          status: AS.Active,
        }),
        makeAgreement({
          id: 'exp2',
          duration: 3,
          activatedTurn: 2 as TurnNumber,
          status: AS.Active,
        }),
        makeAgreement({
          id: 'still-active',
          duration: 20,
          activatedTurn: 1 as TurnNumber,
          status: AS.Active,
        }),
      ];
      const result = engine.processExpirations(agreements, 10 as TurnNumber);
      expect(result.expired).toHaveLength(2);
      expect(result.expired.map((a) => a.id).sort()).toEqual(['exp1', 'exp2']);
      expect(result.updated.find((a) => a.id === 'still-active')!.status).toBe(
        AS.Active,
      );
    });
  });

  // -----------------------------------------------------------------------
  // generateId (static)
  // -----------------------------------------------------------------------
  describe('generateId', () => {
    it('produces the correct format: ${proposer}-${target}-${type}-T${turn}', () => {
      const id = BilateralAgreementEngine.generateId(
        FactionId.US,
        FactionId.Russia,
        AT.DefensePact,
        7 as TurnNumber,
      );
      expect(id).toBe('us-russia-DefensePact-T7');
    });

    it('produces different IDs for different faction pairs', () => {
      const id1 = BilateralAgreementEngine.generateId(
        FactionId.US,
        FactionId.China,
        AT.NAP,
        1 as TurnNumber,
      );
      const id2 = BilateralAgreementEngine.generateId(
        FactionId.US,
        FactionId.Russia,
        AT.NAP,
        1 as TurnNumber,
      );
      expect(id1).not.toBe(id2);
    });

    it('produces different IDs for the same factions but different types', () => {
      const id1 = BilateralAgreementEngine.generateId(
        FactionId.US,
        FactionId.China,
        AT.NAP,
        1 as TurnNumber,
      );
      const id2 = BilateralAgreementEngine.generateId(
        FactionId.US,
        FactionId.China,
        AT.TradeDeal,
        1 as TurnNumber,
      );
      expect(id1).not.toBe(id2);
    });
  });
});
