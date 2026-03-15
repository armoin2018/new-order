import { describe, it, expect } from 'vitest';
import { RegimeTransitionEngine } from '@/engine/regime-transition-engine';
import type {
  RegimeChangeConditions,
  TransitionParams,
} from '@/engine/regime-transition-engine';
import type { NationState } from '@/data/types';
import type { PoliticalSystemProfile } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stableNation = {
  factionId: 'us',
  stability: 80,
  treasury: 500,
  gdp: 2000,
  inflation: 3,
  militaryReadiness: 85,
  nuclearThreshold: 30,
  diplomaticInfluence: 80,
  popularity: 70,
  allianceCredibility: 85,
  techLevel: 90,
} as NationState;

const unstableNation = {
  factionId: 'iran',
  stability: 12,
  treasury: 50,
  gdp: 400,
  inflation: 25,
  militaryReadiness: 45,
  nuclearThreshold: 60,
  diplomaticInfluence: 20,
  popularity: 15,
  allianceCredibility: 30,
  techLevel: 35,
} as NationState;

const liberalDemocracy: PoliticalSystemProfile = {
  schemaVersion: '1.0.0',
  systemId: 'liberal-democracy',
  systemName: 'Liberal Democracy',
  description: 'test',
  decisionSpeedModifier: -20,
  stabilityBaseline: 12,
  civilLibertyIndex: 90,
  pressFreedomIndex: 85,
  corruptionBaseline: 25,
  successionRisk: 10,
  reformCapacity: 80,
};

const authoritarian: PoliticalSystemProfile = {
  schemaVersion: '1.0.0',
  systemId: 'authoritarian-republic',
  systemName: 'Authoritarian Republic',
  description: 'test',
  decisionSpeedModifier: 30,
  stabilityBaseline: 5,
  civilLibertyIndex: 20,
  pressFreedomIndex: 15,
  corruptionBaseline: 65,
  successionRisk: 50,
  reformCapacity: 25,
};

const theocracy: PoliticalSystemProfile = {
  schemaVersion: '1.0.0',
  systemId: 'theocracy',
  systemName: 'Theocracy',
  description: 'test',
  decisionSpeedModifier: 10,
  stabilityBaseline: 8,
  civilLibertyIndex: 15,
  pressFreedomIndex: 10,
  corruptionBaseline: 55,
  successionRisk: 60,
  reformCapacity: 15,
};

const engine = new RegimeTransitionEngine();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RegimeTransitionEngine', () => {
  // ── evaluateRegimeChangeRisk ────────────────────────────────────────

  it('returns low risk for a stable nation', () => {
    const conditions: RegimeChangeConditions = {
      factionId: 'us',
      nation: stableNation,
      currentSystem: liberalDemocracy,
      foreignOccupation: 0,
      turnsInCrisis: 0,
      successionTriggered: false,
      reformDemand: 20,
      militaryLoyalty: 90,
    };

    const result = engine.evaluateRegimeChangeRisk(conditions);
    expect(result.transitionProbability).toBeLessThan(0.4);
    expect(result.isImminent).toBe(false);
    expect(result.factionId).toBe('us');
  });

  it('detects revolution conditions', () => {
    const conditions: RegimeChangeConditions = {
      factionId: 'iran',
      nation: unstableNation,
      currentSystem: theocracy,
      foreignOccupation: 0,
      turnsInCrisis: 10,
      successionTriggered: false,
      reformDemand: 30,
      militaryLoyalty: 35, // < 40 triggers revolution, >= 30 avoids coup
    };

    const result = engine.evaluateRegimeChangeRisk(conditions);
    // stability < 15, turnsInCrisis >= 3, militaryLoyalty < 40 → revolution
    expect(result.mostLikelyType).toBe('revolution');
    expect(result.riskFactors.length).toBeGreaterThan(0);
  });

  it('detects coup conditions', () => {
    const coupNation = { ...unstableNation, stability: 20 } as NationState;
    const conditions: RegimeChangeConditions = {
      factionId: 'iran',
      nation: coupNation,
      currentSystem: theocracy,
      foreignOccupation: 0,
      turnsInCrisis: 1,
      successionTriggered: false,
      reformDemand: 30,
      militaryLoyalty: 15,
    };

    const result = engine.evaluateRegimeChangeRisk(conditions);
    // stability < 25, militaryLoyalty < 30 → coup
    expect(result.mostLikelyType).toBe('coup');
  });

  it('detects reform conditions', () => {
    const reformNation = { ...stableNation, stability: 55 } as NationState;
    const conditions: RegimeChangeConditions = {
      factionId: 'us',
      nation: reformNation,
      currentSystem: liberalDemocracy,
      foreignOccupation: 0,
      turnsInCrisis: 0,
      successionTriggered: false,
      reformDemand: 85,
      militaryLoyalty: 80,
    };

    const result = engine.evaluateRegimeChangeRisk(conditions);
    // reformDemand > 70 AND reformCapacity > 50 → reform
    expect(result.mostLikelyType).toBe('reform');
  });

  it('detects external regime change', () => {
    const conditions: RegimeChangeConditions = {
      factionId: 'syria',
      nation: { ...unstableNation, factionId: 'syria' } as NationState,
      currentSystem: authoritarian,
      foreignOccupation: 80,
      turnsInCrisis: 0,
      successionTriggered: false,
      reformDemand: 10,
      militaryLoyalty: 50,
    };

    const result = engine.evaluateRegimeChangeRisk(conditions);
    // foreignOccupation > 60 → external
    expect(result.mostLikelyType).toBe('external');
  });

  // ── getTransitionPathways ───────────────────────────────────────────

  it('returns pathways for liberal-democracy', () => {
    const paths = engine.getTransitionPathways('liberal-democracy');
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.fromSystemId).toBe('liberal-democracy');
      expect(p.possibleTargets.length).toBeGreaterThan(0);
    }
  });

  it('returns pathways for authoritarian-republic', () => {
    const paths = engine.getTransitionPathways('authoritarian-republic');
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.fromSystemId).toBe('authoritarian-republic');
    }
  });

  it('returns empty array for unknown system', () => {
    const paths = engine.getTransitionPathways('galactic-empire');
    expect(paths).toEqual([]);
  });

  // ── executeTransition ───────────────────────────────────────────────

  it('applies stability penalty on transition', () => {
    const params: TransitionParams = {
      factionId: 'russia',
      transitionType: 'revolution',
      currentSystem: authoritarian,
      targetSystemId: 'liberal-democracy',
      currentNation: { ...stableNation, factionId: 'russia' } as NationState,
    };

    const result = engine.executeTransition(params);
    expect(result.stabilityPenalty).toBeGreaterThan(0);
    expect(result.updatedNation.stability).toBeLessThan(stableNation.stability);
  });

  it('applies treasury cost on transition', () => {
    const params: TransitionParams = {
      factionId: 'russia',
      transitionType: 'revolution',
      currentSystem: authoritarian,
      targetSystemId: 'liberal-democracy',
      currentNation: { ...stableNation, factionId: 'russia' } as NationState,
    };

    const result = engine.executeTransition(params);
    expect(result.treasuryCost).toBeGreaterThan(0);
    expect(result.updatedNation.treasury).toBeLessThan(stableNation.treasury);
  });

  it('reform has lower penalties than revolution', () => {
    const baseNation = { ...stableNation, factionId: 'russia' } as NationState;

    const reformResult = engine.executeTransition({
      factionId: 'russia',
      transitionType: 'reform',
      currentSystem: authoritarian,
      targetSystemId: 'liberal-democracy',
      currentNation: baseNation,
    });

    const revolutionResult = engine.executeTransition({
      factionId: 'russia',
      transitionType: 'revolution',
      currentSystem: authoritarian,
      targetSystemId: 'liberal-democracy',
      currentNation: baseNation,
    });

    expect(reformResult.stabilityPenalty).toBeLessThan(revolutionResult.stabilityPenalty);
    expect(reformResult.militaryReadinessLoss).toBeLessThan(revolutionResult.militaryReadinessLoss);
  });

  // ── computeTransitionChaos ──────────────────────────────────────────

  it('returns appropriate chaos duration', () => {
    const revolutionChaos = engine.computeTransitionChaos('revolution', 50);
    const reformChaos = engine.computeTransitionChaos('reform', 50);

    expect(revolutionChaos).toBeGreaterThanOrEqual(1);
    expect(reformChaos).toBeGreaterThanOrEqual(1);
    expect(revolutionChaos).toBeGreaterThan(reformChaos);
  });

  // ── getReformPressure ───────────────────────────────────────────────

  it('returns high pressure for oppressive low-popularity regime', () => {
    const pressure = engine.getReformPressure(unstableNation, theocracy);
    // Low civil liberty (15), low popularity (15) → high pressure
    expect(pressure).toBeGreaterThan(40);
  });

  it('returns low pressure for popular democracy', () => {
    const pressure = engine.getReformPressure(stableNation, liberalDemocracy);
    // High civil liberty (90), high popularity (70) → low pressure
    expect(pressure).toBeLessThan(30);
  });
});
