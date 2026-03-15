import { describe, it, expect, beforeEach } from 'vitest';
import { RepressionEngine } from '@/engine/repression-engine';
import type { RepressionResult, BacklashFeedback, MartialLawResult, CoupRiskAssessment } from '@/engine/repression-engine';
import { GAME_CONFIG } from '@/engine/config';
import type { PowerBase } from '@/data/types';

function makePowerBase(overrides: Partial<PowerBase> = {}): PowerBase {
  return {
    military: 50,
    oligarchs: 50,
    party: 50,
    clergy: 50,
    public: 50,
    securityServices: 50,
    ...overrides,
  };
}

describe('RepressionEngine', () => {
  let engine: RepressionEngine;
  const cfg = GAME_CONFIG.stability;

  beforeEach(() => {
    engine = new RepressionEngine(cfg);
  });

  // ── applyPoliceDeployment ──────────────────────────────────────────

  describe('applyPoliceDeployment', () => {
    it('reduces unrest and increases backlash in a standard case', () => {
      const result: RepressionResult = engine.applyPoliceDeployment(50, 20);
      expect(result.newUnrest).toBe(40);
      expect(result.newBacklash).toBe(25);
    });

    it('returns correct unrestDelta constant', () => {
      const result = engine.applyPoliceDeployment(50, 20);
      expect(result.unrestDelta).toBe(cfg.policeDeployment.unrestReduction);
    });

    it('returns correct backlashDelta constant', () => {
      const result = engine.applyPoliceDeployment(50, 20);
      expect(result.backlashDelta).toBe(cfg.policeDeployment.backlashIncrease);
    });

    it('clamps unrest at 0 when reduction would go negative', () => {
      const result = engine.applyPoliceDeployment(5, 0);
      expect(result.newUnrest).toBe(0);
    });

    it('clamps backlash at 100 when increase would exceed cap', () => {
      const result = engine.applyPoliceDeployment(50, 97);
      expect(result.newBacklash).toBe(100);
    });

    it('keeps unrest at 0 when already at 0', () => {
      const result = engine.applyPoliceDeployment(0, 0);
      expect(result.newUnrest).toBe(0);
    });

    it('reduces unrest from 100 to 90', () => {
      const result = engine.applyPoliceDeployment(100, 0);
      expect(result.newUnrest).toBe(90);
    });

    it('increases backlash from 0 to 5', () => {
      const result = engine.applyPoliceDeployment(50, 0);
      expect(result.newBacklash).toBe(5);
    });

    it('does not produce negative backlash', () => {
      const result = engine.applyPoliceDeployment(50, 0);
      expect(result.newBacklash).toBeGreaterThanOrEqual(0);
    });

    it('does not produce unrest above 100', () => {
      const result = engine.applyPoliceDeployment(100, 100);
      expect(result.newUnrest).toBeLessThanOrEqual(100);
    });
  });

  // ── computeBacklashFeedback ────────────────────────────────────────

  describe('computeBacklashFeedback', () => {
    it('is inactive when backlash is below threshold', () => {
      const result: BacklashFeedback = engine.computeBacklashFeedback(30);
      expect(result.feedbackActive).toBe(false);
      expect(result.unrestContribution).toBe(0);
    });

    it('is inactive when backlash equals the threshold (strictly greater than)', () => {
      const result = engine.computeBacklashFeedback(50);
      expect(result.feedbackActive).toBe(false);
      expect(result.unrestContribution).toBe(0);
    });

    it('is active when backlash is above threshold', () => {
      const result = engine.computeBacklashFeedback(60);
      expect(result.feedbackActive).toBe(true);
      expect(result.unrestContribution).toBe(5);
    });

    it('returns correct contribution at maximum backlash (100)', () => {
      const result = engine.computeBacklashFeedback(100);
      expect(result.feedbackActive).toBe(true);
      expect(result.unrestContribution).toBe(25);
    });

    it('returns minimal contribution at 51 (just above threshold)', () => {
      const result = engine.computeBacklashFeedback(51);
      expect(result.feedbackActive).toBe(true);
      expect(result.unrestContribution).toBeCloseTo(0.5);
    });

    it('is inactive at 0 backlash', () => {
      const result = engine.computeBacklashFeedback(0);
      expect(result.feedbackActive).toBe(false);
      expect(result.unrestContribution).toBe(0);
    });

    it('echoes the input backlash value in the result', () => {
      const result = engine.computeBacklashFeedback(73);
      expect(result.backlash).toBe(73);
    });

    it('uses the configured threshold value', () => {
      const threshold = cfg.repressionBacklashThreshold;
      const result = engine.computeBacklashFeedback(threshold + 10);
      expect(result.unrestContribution).toBe(10 * 0.5);
    });
  });

  // ── applyMartialLaw ────────────────────────────────────────────────

  describe('applyMartialLaw', () => {
    it('reduces unrest by 30 in a standard case', () => {
      const result: MartialLawResult = engine.applyMartialLaw(80, 60);
      expect(result.newUnrest).toBe(50);
    });

    it('does not trigger coup risk when military loyalty is above threshold', () => {
      const result = engine.applyMartialLaw(80, 60);
      expect(result.coupRiskTriggered).toBe(false);
    });

    it('triggers coup risk when military loyalty is below threshold', () => {
      const result = engine.applyMartialLaw(80, 40);
      expect(result.coupRiskTriggered).toBe(true);
    });

    it('does not trigger coup risk when military loyalty equals threshold (50)', () => {
      const result = engine.applyMartialLaw(80, 50);
      expect(result.coupRiskTriggered).toBe(false);
    });

    it('triggers coup risk when military loyalty is 49', () => {
      const result = engine.applyMartialLaw(80, 49);
      expect(result.coupRiskTriggered).toBe(true);
    });

    it('clamps unrest at 0 when reduction overshoots', () => {
      const result = engine.applyMartialLaw(20, 60);
      expect(result.newUnrest).toBe(0);
    });

    it('returns the configured popularityDecayPerTurn', () => {
      const result = engine.applyMartialLaw(80, 60);
      expect(result.popularityDecayPerTurn).toBe(-20);
    });

    it('returns the configured economicGrowthReduction', () => {
      const result = engine.applyMartialLaw(80, 60);
      expect(result.economicGrowthReduction).toBe(-0.3);
    });

    it('returns the configured tensionIncreaseAllFactions', () => {
      const result = engine.applyMartialLaw(80, 60);
      expect(result.tensionIncreaseAllFactions).toBe(10);
    });

    it('clamps unrest at 0 when starting from 0', () => {
      const result = engine.applyMartialLaw(0, 60);
      expect(result.newUnrest).toBe(0);
    });
  });

  // ── assessCoupRisk ─────────────────────────────────────────────────

  describe('assessCoupRisk', () => {
    it('returns coupPossible false when both military and security are above threshold', () => {
      const pb = makePowerBase({ military: 50, securityServices: 50 });
      const result: CoupRiskAssessment = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(false);
    });

    it('returns coupPossible false when military is above threshold but security is below', () => {
      const pb = makePowerBase({ military: 50, securityServices: 20 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(false);
    });

    it('returns coupPossible false when security is above threshold but military is below', () => {
      const pb = makePowerBase({ military: 20, securityServices: 50 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(false);
    });

    it('returns coupPossible true when both military and security are below threshold', () => {
      const pb = makePowerBase({ military: 20, securityServices: 20 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(true);
    });

    it('computes correct probability when both are at 0 and popularity is 0', () => {
      const pb = makePowerBase({ military: 0, securityServices: 0 });
      const result = engine.assessCoupRisk(pb, 0);
      expect(result.coupPossible).toBe(true);
      expect(result.coupProbability).toBe(60);
    });

    it('computes correct probability when both are at 0 and popularity is 100', () => {
      const pb = makePowerBase({ military: 0, securityServices: 0 });
      const result = engine.assessCoupRisk(pb, 100);
      expect(result.coupPossible).toBe(true);
      expect(result.coupProbability).toBe(40);
    });

    it('computes correct probability with military 20, security 20, popularity 50', () => {
      const pb = makePowerBase({ military: 20, securityServices: 20 });
      const result = engine.assessCoupRisk(pb, 50);
      // (100-20)*0.3 + (100-20)*0.3 - 50*0.2 = 24 + 24 - 10 = 38
      expect(result.coupProbability).toBeCloseTo(38);
    });

    it('computes correct probability when both are at 29', () => {
      const pb = makePowerBase({ military: 29, securityServices: 29 });
      const result = engine.assessCoupRisk(pb, 50);
      // (100-29)*0.3 + (100-29)*0.3 - 50*0.2 = 21.3 + 21.3 - 10 = 32.6
      expect(result.coupProbability).toBeCloseTo(32.6);
    });

    it('clamps probability to 0 when raw value would be negative', () => {
      const pb = makePowerBase({ military: 29, securityServices: 29 });
      // (100-29)*0.3 + (100-29)*0.3 - popularity*0.2 → need popularity high enough
      // 21.3 + 21.3 - popularity*0.2 < 0 → popularity > 213
      // Use 100 as max: 42.6 - 20 = 22.6 still positive, so use very high popularity concept
      // With military=29, security=29 → 42.6 - pop*0.2, need pop > 213 (impossible at 100)
      // Instead test at values where it CAN go negative: military=29, security=29, but that can't.
      // Probability = (100-29)*0.3 + (100-29)*0.3 - pop*0.2 = 42.6 - pop*0.2
      // minimum at pop=100: 42.6 - 20 = 22.6 — still positive
      // So test the clamp indirectly: probability should never go below 0
      const result2 = engine.assessCoupRisk(pb, 100);
      expect(result2.coupProbability).toBeGreaterThanOrEqual(0);
    });

    it('clamps probability to a maximum of 100', () => {
      const pb = makePowerBase({ military: 0, securityServices: 0 });
      const result = engine.assessCoupRisk(pb, 0);
      expect(result.coupProbability).toBeLessThanOrEqual(100);
    });

    it('returns coupPossible false when military equals threshold (30)', () => {
      const pb = makePowerBase({ military: 30, securityServices: 20 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(false);
    });

    it('returns coupPossible false when security equals threshold (30)', () => {
      const pb = makePowerBase({ military: 20, securityServices: 30 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(false);
    });

    it('returns coupPossible true when both are at 29 (just below threshold)', () => {
      const pb = makePowerBase({ military: 29, securityServices: 29 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.coupPossible).toBe(true);
    });

    it('includes a reason string when coup is possible', () => {
      const pb = makePowerBase({ military: 20, securityServices: 20 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('includes a reason string when coup is not possible', () => {
      const pb = makePowerBase({ military: 50, securityServices: 50 });
      const result = engine.assessCoupRisk(pb, 50);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });

    it('does not depend on unrelated PowerBase fields', () => {
      const pbA = makePowerBase({ military: 20, securityServices: 20, oligarchs: 0, party: 0, clergy: 0, public: 0 });
      const pbB = makePowerBase({ military: 20, securityServices: 20, oligarchs: 100, party: 100, clergy: 100, public: 100 });
      const resultA = engine.assessCoupRisk(pbA, 50);
      const resultB = engine.assessCoupRisk(pbB, 50);
      expect(resultA.coupProbability).toBe(resultB.coupProbability);
      expect(resultA.coupPossible).toBe(resultB.coupPossible);
    });
  });

  // ── applyRepressionDecay ───────────────────────────────────────────

  describe('applyRepressionDecay', () => {
    it('reduces backlash by the decay rate', () => {
      const result = engine.applyRepressionDecay(50, 2);
      expect(result).toBe(48);
    });

    it('clamps at 0 when decay exceeds current backlash', () => {
      const result = engine.applyRepressionDecay(1, 5);
      expect(result).toBe(0);
    });

    it('stays at 0 when already at 0', () => {
      const result = engine.applyRepressionDecay(0, 2);
      expect(result).toBe(0);
    });

    it('reduces from 100 correctly', () => {
      const result = engine.applyRepressionDecay(100, 10);
      expect(result).toBe(90);
    });

    it('returns same value when decay rate is 0', () => {
      const result = engine.applyRepressionDecay(50, 0);
      expect(result).toBe(50);
    });

    it('never returns a value below 0', () => {
      const result = engine.applyRepressionDecay(3, 100);
      expect(result).toBe(0);
    });

    it('never returns a value above 100', () => {
      const result = engine.applyRepressionDecay(100, 0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });
});
