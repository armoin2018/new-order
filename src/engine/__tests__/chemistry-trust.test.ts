import { describe, it, expect, beforeEach } from 'vitest';
import { ChemistryTrustEngine } from '@/engine/chemistry-trust';
import type { TrustInput, DiplomaticEncounterInput, AgreementTier } from '@/engine/chemistry-trust';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId, TurnNumber, Grudge } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGrudge(overrides: Partial<Grudge> = {}): Grudge {
  return {
    offender: 'putin' as LeaderId,
    offenseType: 'betrayal',
    severity: 5,
    turnCreated: 1 as TurnNumber,
    currentDecayedSeverity: 5,
    resolved: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ChemistryTrustEngine', () => {
  let engine: ChemistryTrustEngine;

  beforeEach(() => {
    engine = new ChemistryTrustEngine(GAME_CONFIG.psychology);
  });

  // =========================================================================
  // 1. computeTrust
  // =========================================================================
  describe('computeTrust', () => {
    const zeros: TrustInput = {
      promisesKept: 0,
      promisesBroken: 0,
      sharedEnemyBonus: 0,
      ideologicalAlignment: 0,
      pastBetrayals: 0,
    };

    it('returns trust 0 and no negotiation flags when all inputs are zero', () => {
      const result = engine.computeTrust(zeros);
      expect(result.rawTrust).toBe(0);
      expect(result.clampedTrust).toBe(0);
      expect(result.canNegotiateNAP).toBe(false);
      expect(result.canNegotiateDefensePact).toBe(false);
      expect(result.canShareIntelligence).toBe(false);
      expect(result.redTelephoneDiscount).toBe(0);
    });

    it('10 promises kept → trust 20, cannot NAP (not > 20)', () => {
      const result = engine.computeTrust({ ...zeros, promisesKept: 10 });
      expect(result.rawTrust).toBe(20);
      expect(result.clampedTrust).toBe(20);
      expect(result.canNegotiateNAP).toBe(false);
    });

    it('11 promises kept → trust 22, can NAP', () => {
      const result = engine.computeTrust({ ...zeros, promisesKept: 11 });
      expect(result.rawTrust).toBe(22);
      expect(result.canNegotiateNAP).toBe(true);
    });

    it('5 promises broken → trust -25', () => {
      const result = engine.computeTrust({ ...zeros, promisesBroken: 5 });
      expect(result.rawTrust).toBe(-25);
      expect(result.clampedTrust).toBe(-25);
      expect(result.canNegotiateNAP).toBe(false);
    });

    it('1 past betrayal → trust -10', () => {
      const result = engine.computeTrust({ ...zeros, pastBetrayals: 1 });
      expect(result.rawTrust).toBe(-10);
      expect(result.clampedTrust).toBe(-10);
    });

    it('sharedEnemyBonus 15 + 10 kept → trust 35, can NAP but not defense pact', () => {
      const result = engine.computeTrust({
        ...zeros,
        promisesKept: 10,
        sharedEnemyBonus: 15,
      });
      expect(result.rawTrust).toBe(35);
      expect(result.canNegotiateNAP).toBe(true);
      expect(result.canNegotiateDefensePact).toBe(false);
    });

    it('ideologicalAlignment 80 → +40 contribution', () => {
      const result = engine.computeTrust({ ...zeros, ideologicalAlignment: 80 });
      expect(result.rawTrust).toBe(40);
      expect(result.clampedTrust).toBe(40);
    });

    it('complex scenario: 10 kept, 2 broken, sharedEnemy 5, alignment 20, 0 betrayals → 25', () => {
      const result = engine.computeTrust({
        promisesKept: 10,
        promisesBroken: 2,
        sharedEnemyBonus: 5,
        ideologicalAlignment: 20,
        pastBetrayals: 0,
      });
      // (10*2) + (2*-5) + 5 + (20*0.5) + (0*-10) = 20 - 10 + 5 + 10 = 25
      expect(result.rawTrust).toBe(25);
      expect(result.canNegotiateNAP).toBe(true);
      expect(result.canNegotiateDefensePact).toBe(false);
    });

    it('high trust > 60: canShareIntelligence true and redTelephoneDiscount 0.5', () => {
      const result = engine.computeTrust({
        ...zeros,
        promisesKept: 25,
        sharedEnemyBonus: 15,
      });
      // 25*2 + 15 = 65
      expect(result.rawTrust).toBe(65);
      expect(result.canShareIntelligence).toBe(true);
      expect(result.redTelephoneDiscount).toBe(0.5);
    });

    it('trust exactly at 20 cannot negotiate NAP (> 20 required)', () => {
      const result = engine.computeTrust({ ...zeros, promisesKept: 10 });
      expect(result.clampedTrust).toBe(20);
      expect(result.canNegotiateNAP).toBe(false);
    });

    it('extreme negatives are clamped at -100', () => {
      const result = engine.computeTrust({
        ...zeros,
        promisesBroken: 50,
        pastBetrayals: 20,
      });
      // 50*-5 + 20*-10 = -250 - 200 = -450
      expect(result.rawTrust).toBe(-450);
      expect(result.clampedTrust).toBe(-100);
    });

    it('extreme positives are clamped at 100', () => {
      const result = engine.computeTrust({
        ...zeros,
        promisesKept: 100,
        sharedEnemyBonus: 50,
        ideologicalAlignment: 100,
      });
      // 100*2 + 50 + 100*0.5 = 200 + 50 + 50 = 300
      expect(result.rawTrust).toBe(300);
      expect(result.clampedTrust).toBe(100);
    });
  });

  // =========================================================================
  // 2. applyChemistryModifier
  // =========================================================================
  describe('applyChemistryModifier', () => {
    it('positive chemistry (10): bonus 0.1, tension -5', () => {
      const result = engine.applyChemistryModifier(10);
      expect(result.isPositive).toBe(true);
      expect(result.agreementAcceptanceModifier).toBe(0.1);
      expect(result.tensionModifier).toBe(-5);
      expect(result.chemistry).toBe(10);
    });

    it('negative chemistry (-10): penalty -0.1, tension 5', () => {
      const result = engine.applyChemistryModifier(-10);
      expect(result.isPositive).toBe(false);
      expect(result.agreementAcceptanceModifier).toBe(-0.1);
      expect(result.tensionModifier).toBe(5);
    });

    it('zero chemistry: all modifiers are zero', () => {
      const result = engine.applyChemistryModifier(0);
      expect(result.isPositive).toBe(false);
      expect(result.agreementAcceptanceModifier).toBe(0);
      expect(result.tensionModifier).toBe(0);
    });

    it('chemistry 50: same bonus 0.1, tension -5 regardless of magnitude', () => {
      const result = engine.applyChemistryModifier(50);
      expect(result.isPositive).toBe(true);
      expect(result.agreementAcceptanceModifier).toBe(0.1);
      expect(result.tensionModifier).toBe(-5);
    });

    it('chemistry -1: penalty -0.1, tension 5', () => {
      const result = engine.applyChemistryModifier(-1);
      expect(result.isPositive).toBe(false);
      expect(result.agreementAcceptanceModifier).toBe(-0.1);
      expect(result.tensionModifier).toBe(5);
    });
  });

  // =========================================================================
  // 3. evaluateDiplomaticEncounter
  // =========================================================================
  describe('evaluateDiplomaticEncounter', () => {
    const allZeros: DiplomaticEncounterInput = {
      chemistry: 0,
      trust: 0,
      relativePower: 0,
      emotionalAlignment: 0,
    };

    it('all zeros → outcomeModifier 0', () => {
      const result = engine.evaluateDiplomaticEncounter(allZeros);
      expect(result.outcomeModifier).toBe(0);
    });

    it('all ones → 0.3 + 0.3 + 0.2 + 0.2 = 1.0', () => {
      const result = engine.evaluateDiplomaticEncounter({
        chemistry: 1,
        trust: 1,
        relativePower: 1,
        emotionalAlignment: 1,
      });
      expect(result.outcomeModifier).toBeCloseTo(1.0);
    });

    it('only chemistry 1.0 → 0.3', () => {
      const result = engine.evaluateDiplomaticEncounter({
        ...allZeros,
        chemistry: 1,
      });
      expect(result.outcomeModifier).toBeCloseTo(0.3);
      expect(result.chemistryContribution).toBeCloseTo(0.3);
    });

    it('only trust 1.0 → 0.3', () => {
      const result = engine.evaluateDiplomaticEncounter({
        ...allZeros,
        trust: 1,
      });
      expect(result.outcomeModifier).toBeCloseTo(0.3);
      expect(result.trustContribution).toBeCloseTo(0.3);
    });

    it('only relativePower 1.0 → 0.2', () => {
      const result = engine.evaluateDiplomaticEncounter({
        ...allZeros,
        relativePower: 1,
      });
      expect(result.outcomeModifier).toBeCloseTo(0.2);
      expect(result.powerContribution).toBeCloseTo(0.2);
    });

    it('only emotionalAlignment 1.0 → 0.2', () => {
      const result = engine.evaluateDiplomaticEncounter({
        ...allZeros,
        emotionalAlignment: 1,
      });
      expect(result.outcomeModifier).toBeCloseTo(0.2);
      expect(result.emotionalContribution).toBeCloseTo(0.2);
    });

    it('mixed values: chemistry 0.5, trust 0.8, power 0.6, alignment 0.4 → 0.59', () => {
      const result = engine.evaluateDiplomaticEncounter({
        chemistry: 0.5,
        trust: 0.8,
        relativePower: 0.6,
        emotionalAlignment: 0.4,
      });
      // 0.5*0.3 + 0.8*0.3 + 0.6*0.2 + 0.4*0.2 = 0.15 + 0.24 + 0.12 + 0.08 = 0.59
      expect(result.outcomeModifier).toBeCloseTo(0.59);
    });

    it('individual contributions sum to outcomeModifier', () => {
      const result = engine.evaluateDiplomaticEncounter({
        chemistry: 0.7,
        trust: 0.3,
        relativePower: 0.9,
        emotionalAlignment: 0.1,
      });
      const sum =
        result.chemistryContribution +
        result.trustContribution +
        result.powerContribution +
        result.emotionalContribution;
      expect(result.outcomeModifier).toBeCloseTo(sum);
    });
  });

  // =========================================================================
  // 4. decayGrudges
  // =========================================================================
  describe('decayGrudges', () => {
    it('empty grudge array → empty result, 0 decayed, 0 at minimum', () => {
      const result = engine.decayGrudges([], 0);
      expect(result.updatedGrudges).toHaveLength(0);
      expect(result.grudgesDecayed).toBe(0);
      expect(result.grudgesAtMinimum).toBe(0);
    });

    it('single unresolved grudge (severity 5) → 4.5 after decay', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      const result = engine.decayGrudges([grudge], 0);
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.5);
      expect(result.grudgesDecayed).toBe(1);
    });

    it('grudge at severity 1.2 → clamped to minimum 1', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 1.2 });
      const result = engine.decayGrudges([grudge], 0);
      // 1.2 + (-0.5) = 0.7 → clamped to 1
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(1);
      expect(result.grudgesAtMinimum).toBe(1);
    });

    it('grudge already at minimum (1) → stays at 1, counted as at minimum', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 1 });
      const result = engine.decayGrudges([grudge], 0);
      // 1 + (-0.5) = 0.5 → clamped to 1
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(1);
      expect(result.grudgesAtMinimum).toBe(1);
      // severity didn't decrease (1 → 1), so NOT counted as decayed
      expect(result.grudgesDecayed).toBe(0);
    });

    it('resolved grudge passes through unchanged and is NOT counted as decayed', () => {
      const grudge = makeGrudge({ resolved: true, currentDecayedSeverity: 5 });
      const result = engine.decayGrudges([grudge], 0);
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(5);
      expect(result.updatedGrudges[0]!.resolved).toBe(true);
      expect(result.grudgesDecayed).toBe(0);
      expect(result.grudgesAtMinimum).toBe(0);
    });

    it('vengeful leader (index 50, threshold 50): decay -0.25 instead of -0.5', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      const result = engine.decayGrudges([grudge], 50, 50);
      // 5 + (-0.25) = 4.75
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.75);
      expect(result.grudgesDecayed).toBe(1);
    });

    it('non-vengeful leader (index 49, threshold 50): normal decay -0.5', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      const result = engine.decayGrudges([grudge], 49, 50);
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.5);
    });

    it('multiple grudges: mix of resolved, at-minimum, and normal', () => {
      const grudges = [
        makeGrudge({ currentDecayedSeverity: 5 }),               // normal → 4.5
        makeGrudge({ resolved: true, currentDecayedSeverity: 3 }), // resolved → 3
        makeGrudge({ currentDecayedSeverity: 1 }),                // at min → 1
        makeGrudge({ currentDecayedSeverity: 8 }),                // normal → 7.5
      ];
      const result = engine.decayGrudges(grudges, 0);
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.5);
      expect(result.updatedGrudges[1]!.currentDecayedSeverity).toBe(3);
      expect(result.updatedGrudges[2]!.currentDecayedSeverity).toBe(1);
      expect(result.updatedGrudges[3]!.currentDecayedSeverity).toBe(7.5);
      expect(result.grudgesDecayed).toBe(2);
      expect(result.grudgesAtMinimum).toBe(1);
    });

    it('custom threshold: vengefulThreshold 30, index 30 → vengeful decay', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      const result = engine.decayGrudges([grudge], 30, 30);
      // vengeful: 5 + (-0.25) = 4.75
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.75);
    });

    it('does not mutate the original grudge array', () => {
      const original = makeGrudge({ currentDecayedSeverity: 5 });
      const grudges = [original];
      engine.decayGrudges(grudges, 0);
      expect(original.currentDecayedSeverity).toBe(5);
    });

    it('default vengeful threshold is 50', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      // index 50, no explicit threshold → uses default 50 → vengeful
      const result = engine.decayGrudges([grudge], 50);
      expect(result.updatedGrudges[0]!.currentDecayedSeverity).toBe(4.75);
    });

    it('grudgesDecayed count excludes grudges that were already at minimum', () => {
      const grudges = [
        makeGrudge({ currentDecayedSeverity: 1 }),   // at min → stays 1
        makeGrudge({ currentDecayedSeverity: 1.3 }), // 0.8 → clamped to 1, but was > 1 before
      ];
      const result = engine.decayGrudges(grudges, 0);
      // First grudge: 1 → 1 (no decrease, not counted as decayed)
      // Second grudge: 1.3 → 1 (decreased from 1.3 to 1, counted as decayed)
      expect(result.grudgesDecayed).toBe(1);
      expect(result.grudgesAtMinimum).toBe(2);
    });
  });

  // =========================================================================
  // 5. computeRetaliationBonus
  // =========================================================================
  describe('computeRetaliationBonus', () => {
    it('no grudges → 0', () => {
      expect(engine.computeRetaliationBonus([])).toBe(0);
    });

    it('single unresolved grudge (severity 5) → 10', () => {
      const grudge = makeGrudge({ currentDecayedSeverity: 5 });
      expect(engine.computeRetaliationBonus([grudge])).toBe(10);
    });

    it('multiple unresolved grudges (severity 3, 4) → 14', () => {
      const grudges = [
        makeGrudge({ currentDecayedSeverity: 3 }),
        makeGrudge({ currentDecayedSeverity: 4 }),
      ];
      expect(engine.computeRetaliationBonus(grudges)).toBe(14);
    });

    it('resolved grudge excluded → 0', () => {
      const grudge = makeGrudge({ resolved: true, currentDecayedSeverity: 5 });
      expect(engine.computeRetaliationBonus([grudge])).toBe(0);
    });

    it('mix of resolved and unresolved: only unresolved counted', () => {
      const grudges = [
        makeGrudge({ currentDecayedSeverity: 3, resolved: false }),
        makeGrudge({ currentDecayedSeverity: 7, resolved: true }),
        makeGrudge({ currentDecayedSeverity: 2, resolved: false }),
      ];
      // (3 + 2) * 2 = 10
      expect(engine.computeRetaliationBonus(grudges)).toBe(10);
    });

    it('all resolved → 0', () => {
      const grudges = [
        makeGrudge({ resolved: true, currentDecayedSeverity: 5 }),
        makeGrudge({ resolved: true, currentDecayedSeverity: 3 }),
      ];
      expect(engine.computeRetaliationBonus(grudges)).toBe(0);
    });
  });

  // =========================================================================
  // 6. canNegotiate
  // =========================================================================
  describe('canNegotiate', () => {
    it('NAP at trust 20 → false (> 20 required)', () => {
      expect(engine.canNegotiate(20, 'NAP')).toBe(false);
    });

    it('NAP at trust 21 → true', () => {
      expect(engine.canNegotiate(21, 'NAP')).toBe(true);
    });

    it('defensePact at trust 40 → false', () => {
      expect(engine.canNegotiate(40, 'defensePact')).toBe(false);
    });

    it('defensePact at trust 41 → true', () => {
      expect(engine.canNegotiate(41, 'defensePact')).toBe(true);
    });

    it('intelligenceSharing at trust 60 → false', () => {
      expect(engine.canNegotiate(60, 'intelligenceSharing')).toBe(false);
    });

    it('intelligenceSharing at trust 61 → true', () => {
      expect(engine.canNegotiate(61, 'intelligenceSharing')).toBe(true);
    });

    it('NAP at trust -100 → false', () => {
      expect(engine.canNegotiate(-100, 'NAP')).toBe(false);
    });

    it('all tiers at trust 100 → all true', () => {
      const tiers: AgreementTier[] = ['NAP', 'defensePact', 'intelligenceSharing'];
      for (const tier of tiers) {
        expect(engine.canNegotiate(100, tier)).toBe(true);
      }
    });

    it('NAP at trust 20.01 → true (just above threshold)', () => {
      expect(engine.canNegotiate(20.01, 'NAP')).toBe(true);
    });
  });
});
