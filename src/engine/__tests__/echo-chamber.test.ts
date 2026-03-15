import { describe, it, expect, beforeEach } from 'vitest';
import { EchoChamberEngine } from '@/engine/echo-chamber';
import type { EchoChamberInput } from '@/engine/echo-chamber';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId } from '@/data/types';

const LEADER = 'leader-1' as LeaderId;

function makePowerBase(overrides: Partial<EchoChamberInput['powerBase']> = {}): EchoChamberInput['powerBase'] {
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

describe('EchoChamberEngine', () => {
  let engine: EchoChamberEngine;

  beforeEach(() => {
    engine = new EchoChamberEngine();
  });

  // -------------------------------------------------------------------------
  // evaluateEchoChamber (FR-1515)
  // -------------------------------------------------------------------------
  describe('evaluateEchoChamber', () => {
    const cfg = GAME_CONFIG.psychology.echoChamber;

    it('activates when any faction score > 80 and wasInEchoChamber=false', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 85 }),
        wasInEchoChamber: false,
      });

      expect(result.active).toBe(true);
      expect(result.dominantFaction).toBe('military');
      expect(result.leaderId).toBe(LEADER);
    });

    it('does NOT activate when all scores ≤ 80 and wasInEchoChamber=false', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 80 }),
        wasInEchoChamber: false,
      });

      expect(result.active).toBe(false);
    });

    it('stays active (hysteresis) when wasInEchoChamber=true and dominant score >= 70', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 75 }),
        wasInEchoChamber: true,
      });

      expect(result.active).toBe(true);
    });

    it('exits echo chamber when wasInEchoChamber=true and dominant score < 70', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 69 }),
        wasInEchoChamber: true,
      });

      expect(result.active).toBe(false);
    });

    it('returns correct effects when active', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 85 }),
        wasInEchoChamber: false,
      });

      expect(result.effects.intelligenceReliabilityModifier).toBe(cfg.intelligenceReliabilityPenalty);
      expect(result.effects.opposedUtilityModifier).toBe(cfg.opposedUtilityPenalty);
      expect(result.effects.factionUtilityModifier).toBe(cfg.factionUtilityBonus);
      expect(result.effects.biasIntensification).toBe(cfg.biasIntensification);
    });

    it('returns zero effects when inactive', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase(),
        wasInEchoChamber: false,
      });

      expect(result.effects.intelligenceReliabilityModifier).toBe(0);
      expect(result.effects.opposedUtilityModifier).toBe(0);
      expect(result.effects.factionUtilityModifier).toBe(0);
      expect(result.effects.biasIntensification).toBe(0);
    });

    it('correctly identifies the highest-scoring faction as dominantFaction', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ oligarchs: 90 }),
        wasInEchoChamber: false,
      });

      expect(result.active).toBe(true);
      expect(result.dominantFaction).toBe('oligarchs');
    });

    it('does NOT activate when exactly at activation threshold (score=80, wasInEchoChamber=false)', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 80 }),
        wasInEchoChamber: false,
      });

      expect(result.active).toBe(false);
    });

    it('stays active when exactly at exit threshold (score=70, wasInEchoChamber=true)', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 70 }),
        wasInEchoChamber: true,
      });

      expect(result.active).toBe(true);
    });

    it('dominantScore reflects the highest power-base score', () => {
      const result = engine.evaluateEchoChamber({
        leaderId: LEADER,
        powerBase: makePowerBase({ clergy: 92 }),
        wasInEchoChamber: false,
      });

      expect(result.dominantScore).toBe(92);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateSycophancy (FR-1516)
  // -------------------------------------------------------------------------
  describe('evaluateSycophancy', () => {
    const cfg = GAME_CONFIG.psychology.sycophancy;

    it('activates when both securityServicesScore and paranoia exceed thresholds', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 85,
        paranoia: 75,
      });

      expect(result.active).toBe(true);
      expect(result.leaderId).toBe(LEADER);
    });

    it('does NOT activate when securityServicesScore does not exceed threshold', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 80,
        paranoia: 75,
      });

      expect(result.active).toBe(false);
    });

    it('does NOT activate when paranoia does not exceed threshold', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 85,
        paranoia: 70,
      });

      expect(result.active).toBe(false);
    });

    it('does NOT activate when neither threshold is exceeded', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 50,
        paranoia: 50,
      });

      expect(result.active).toBe(false);
    });

    it('returns correct effects when active', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 85,
        paranoia: 75,
      });

      expect(result.effects.reliabilityInflation).toBe(cfg.reliabilityInflation);
      expect(result.effects.newsDelayTurns).toBe(cfg.newsDelay);
      expect(result.effects.unrestWarningDelayTurns).toBe(cfg.unrestWarningDelay);
      expect(result.effects.detectable).toBe(true);
    });

    it('returns zero/false effects when inactive', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 50,
        paranoia: 50,
      });

      expect(result.effects.reliabilityInflation).toBe(0);
      expect(result.effects.newsDelayTurns).toBe(0);
      expect(result.effects.unrestWarningDelayTurns).toBe(0);
      expect(result.effects.detectable).toBe(false);
    });

    it('does NOT activate at exact thresholds (security=80, paranoia=70)', () => {
      const result = engine.evaluateSycophancy({
        leaderId: LEADER,
        securityServicesScore: 80,
        paranoia: 70,
      });

      expect(result.active).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCombined (FR-1515 + FR-1516)
  // -------------------------------------------------------------------------
  describe('evaluateCombined', () => {
    it('reports compound risk when both echo chamber and sycophancy are active', () => {
      const result = engine.evaluateCombined({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 85 }),
        securityServicesScore: 85,
        paranoia: 75,
        wasInEchoChamber: false,
      });

      expect(result.echoChamber.active).toBe(true);
      expect(result.sycophancy.active).toBe(true);
      expect(result.compoundRisk).toBe(true);
    });

    it('no compound risk when only echo chamber is active', () => {
      const result = engine.evaluateCombined({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 85 }),
        securityServicesScore: 50,
        paranoia: 50,
        wasInEchoChamber: false,
      });

      expect(result.echoChamber.active).toBe(true);
      expect(result.sycophancy.active).toBe(false);
      expect(result.compoundRisk).toBe(false);
    });

    it('no compound risk when only sycophancy is active', () => {
      const result = engine.evaluateCombined({
        leaderId: LEADER,
        powerBase: makePowerBase(),
        securityServicesScore: 85,
        paranoia: 75,
        wasInEchoChamber: false,
      });

      expect(result.echoChamber.active).toBe(false);
      expect(result.sycophancy.active).toBe(true);
      expect(result.compoundRisk).toBe(false);
    });

    it('no compound risk when neither is active', () => {
      const result = engine.evaluateCombined({
        leaderId: LEADER,
        powerBase: makePowerBase(),
        securityServicesScore: 50,
        paranoia: 50,
        wasInEchoChamber: false,
      });

      expect(result.echoChamber.active).toBe(false);
      expect(result.sycophancy.active).toBe(false);
      expect(result.compoundRisk).toBe(false);
    });

    it('reason contains "COMPOUND RISK" when compoundRisk is true', () => {
      const result = engine.evaluateCombined({
        leaderId: LEADER,
        powerBase: makePowerBase({ military: 85 }),
        securityServicesScore: 85,
        paranoia: 75,
        wasInEchoChamber: false,
      });

      expect(result.compoundRisk).toBe(true);
      expect(result.reason).toContain('COMPOUND RISK');
    });
  });
});
