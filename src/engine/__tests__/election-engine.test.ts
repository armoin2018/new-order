/**
 * Leader Elections & Leadership Transitions Engine — Test Suite
 *
 * 50+ tests covering:
 *  - initializeElectionState
 *  - isDemocratic
 *  - isElectionDue / isElectionAnnounced
 *  - simulateElection (all formula factors, contested range, edge cases)
 *  - processElectionOutcome
 *  - processNonDemocraticTransition (coup, revolution, assassination, health)
 *  - applyTransitionEffects
 *  - advanceTransition
 *
 * @see FR-4501 – FR-4506
 */

import { describe, it, expect } from 'vitest';
import type { FactionId, TurnNumber } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';
import type {
  PoliticalSystemType,
  ElectionState,
  LeadershipTransitionType,
} from '@/data/types/election.types';
import {
  initializeElectionState,
  isDemocratic,
  isElectionDue,
  isElectionAnnounced,
  simulateElection,
  processElectionOutcome,
  processNonDemocraticTransition,
  applyTransitionEffects,
  advanceTransition,
} from '@/engine/election-engine';

// ── Helpers ─────────────────────────────────────────────────────────────────

const T = (n: number) => n as unknown as TurnNumber;
const F = (s: string) => s as unknown as FactionId;

/** Deterministic RNG that always returns a fixed value. */
const fixedRng = (value: number) => ({ next: () => value });

/** Convenience builder for a minimal NationState. */
function makeNationState(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: F('us'),
    stability: 70,
    treasury: 500,
    gdp: 5000,
    inflation: 3,
    militaryReadiness: 80,
    nuclearThreshold: 20,
    diplomaticInfluence: 65,
    popularity: 55,
    allianceCredibility: 75,
    techLevel: 70,
    ...overrides,
  };
}

/** Build a default ElectionState for a democratic nation. */
function makeDemocraticState(overrides: Partial<ElectionState> = {}): ElectionState {
  return {
    nationCode: F('us'),
    politicalSystem: 'liberal_democracy',
    electionCycleMonths: 48,
    lastElectionTurn: T(0),
    nextElectionTurn: T(48),
    announcementTurn: T(42),
    incumbentPopularity: 50,
    challengerStrength: 30,
    electionResult: null,
    transitionTurnsRemaining: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// isDemocratic
// ═══════════════════════════════════════════════════════════════════════════

describe('isDemocratic', () => {
  it('returns true for liberal_democracy', () => {
    expect(isDemocratic('liberal_democracy')).toBe(true);
  });

  it('returns true for federal_republic', () => {
    expect(isDemocratic('federal_republic')).toBe(true);
  });

  it('returns true for parliamentary_democracy', () => {
    expect(isDemocratic('parliamentary_democracy')).toBe(true);
  });

  it('returns true for illiberal_democracy', () => {
    expect(isDemocratic('illiberal_democracy')).toBe(true);
  });

  it('returns false for communist_state', () => {
    expect(isDemocratic('communist_state')).toBe(false);
  });

  it('returns false for military_junta', () => {
    expect(isDemocratic('military_junta')).toBe(false);
  });

  it('returns false for absolute_monarchy', () => {
    expect(isDemocratic('absolute_monarchy')).toBe(false);
  });

  it('returns false for theocratic', () => {
    expect(isDemocratic('theocratic')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// initializeElectionState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeElectionState', () => {
  it('creates a democratic state with default cycle for US', () => {
    const s = initializeElectionState(F('us'), 'liberal_democracy');
    expect(s.nationCode).toBe('us');
    expect(s.politicalSystem).toBe('liberal_democracy');
    expect(s.electionCycleMonths).toBe(48);
    expect(s.nextElectionTurn).toBe(T(48));
  });

  it('respects explicit cycleMonths override', () => {
    const s = initializeElectionState(F('us'), 'liberal_democracy', 36);
    expect(s.electionCycleMonths).toBe(36);
    expect(s.nextElectionTurn).toBe(T(36));
  });

  it('sets cycle to 0 for non-democratic systems', () => {
    const s = initializeElectionState(F('china'), 'communist_state');
    expect(s.electionCycleMonths).toBe(0);
    expect(s.nextElectionTurn).toBe(T(Infinity));
  });

  it('sets announcement turn before next election', () => {
    const s = initializeElectionState(F('us'), 'federal_republic');
    expect((s.announcementTurn as unknown as number)).toBeLessThan(
      s.nextElectionTurn as unknown as number,
    );
  });

  it('initialises incumbentPopularity to 50', () => {
    const s = initializeElectionState(F('eu'), 'parliamentary_democracy');
    expect(s.incumbentPopularity).toBe(50);
  });

  it('initialises challengerStrength to 30', () => {
    const s = initializeElectionState(F('japan'), 'liberal_democracy');
    expect(s.challengerStrength).toBe(30);
  });

  it('initialises electionResult to null', () => {
    const s = initializeElectionState(F('us'), 'liberal_democracy');
    expect(s.electionResult).toBeNull();
  });

  it('initialises transitionTurnsRemaining to 0', () => {
    const s = initializeElectionState(F('us'), 'liberal_democracy');
    expect(s.transitionTurnsRemaining).toBe(0);
  });

  it('falls back to 0 cycle for unknown nation code in non-democratic system', () => {
    const s = initializeElectionState(F('syria'), 'military_junta');
    expect(s.electionCycleMonths).toBe(0);
  });

  it('uses 0 cycle for a democratic system with no default cycle mapping', () => {
    const s = initializeElectionState(F('syria'), 'liberal_democracy');
    // syria is not in defaultCycles, so fallback is 0 → nextElection = Infinity
    expect(s.electionCycleMonths).toBe(0);
    expect(s.nextElectionTurn).toBe(T(Infinity));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isElectionDue / isElectionAnnounced
// ═══════════════════════════════════════════════════════════════════════════

describe('isElectionDue', () => {
  it('returns true when currentTurn equals nextElectionTurn', () => {
    const s = makeDemocraticState({ nextElectionTurn: T(48) });
    expect(isElectionDue(s, T(48))).toBe(true);
  });

  it('returns true when currentTurn exceeds nextElectionTurn', () => {
    const s = makeDemocraticState({ nextElectionTurn: T(48) });
    expect(isElectionDue(s, T(50))).toBe(true);
  });

  it('returns false when currentTurn is before nextElectionTurn', () => {
    const s = makeDemocraticState({ nextElectionTurn: T(48) });
    expect(isElectionDue(s, T(47))).toBe(false);
  });

  it('returns false for non-democratic systems (cycle = 0)', () => {
    const s = makeDemocraticState({ electionCycleMonths: 0, nextElectionTurn: T(48) });
    expect(isElectionDue(s, T(48))).toBe(false);
  });
});

describe('isElectionAnnounced', () => {
  it('returns true when currentTurn equals announcementTurn', () => {
    const s = makeDemocraticState({ announcementTurn: T(42) });
    expect(isElectionAnnounced(s, T(42))).toBe(true);
  });

  it('returns true when currentTurn exceeds announcementTurn', () => {
    const s = makeDemocraticState({ announcementTurn: T(42) });
    expect(isElectionAnnounced(s, T(44))).toBe(true);
  });

  it('returns false when currentTurn is before announcementTurn', () => {
    const s = makeDemocraticState({ announcementTurn: T(42) });
    expect(isElectionAnnounced(s, T(41))).toBe(false);
  });

  it('returns false for non-democratic systems', () => {
    const s = makeDemocraticState({ electionCycleMonths: 0, announcementTurn: T(42) });
    expect(isElectionAnnounced(s, T(42))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// simulateElection
// ═══════════════════════════════════════════════════════════════════════════

describe('simulateElection', () => {
  it('produces an ElectionResult with a formula breakdown', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const result = simulateElection(s, ns, 20, 60, fixedRng(0.5));
    expect(result.formulaBreakdown).toBeDefined();
    expect(typeof result.formulaBreakdown.total).toBe('number');
  });

  it('includes all expected fields in formula breakdown', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const result = simulateElection(s, ns, 10, 50, fixedRng(0.5));
    const b = result.formulaBreakdown;
    expect(b).toHaveProperty('popularity');
    expect(b).toHaveProperty('econPerf');
    expect(b).toHaveProperty('unrest');
    expect(b).toHaveProperty('warWeariness');
    expect(b).toHaveProperty('powerBase');
    expect(b).toHaveProperty('challengerStrength');
    expect(b).toHaveProperty('randomDelta');
    expect(b).toHaveProperty('total');
  });

  it('returns incumbent_wins when total exceeds contestedMax', () => {
    // High popularity, low challenger, low unrest → high score
    const s = makeDemocraticState({ challengerStrength: 0 });
    const ns = makeNationState({ popularity: 100, stability: 100, gdp: 10000 });
    const result = simulateElection(s, ns, 0, 100, fixedRng(0.5));
    expect(result.outcome).toBe('incumbent_wins');
  });

  it('returns challenger_wins when total is below contestedMin', () => {
    // Low popularity, high challenger, high unrest → low score
    const s = makeDemocraticState({ challengerStrength: 100 });
    const ns = makeNationState({ popularity: 0, stability: 0, gdp: 0 });
    const result = simulateElection(s, ns, 100, 0, fixedRng(0.5));
    expect(result.outcome).toBe('challenger_wins');
  });

  it('returns contested when total is within the threshold band', () => {
    // Carefully balanced to hit 48–52 range
    // pop:50*0.3=15, econPerf:clamp(5000/100)=50→50*0.2=10, unrest:(100-70)*-0.15=-4.5,
    // war:20*-0.1=-2, power:50*0.15=7.5, chal:30*-0.1=-3, random=0 → total=23
    // That's too low... we need total near 50.
    // Let's try: pop:80*0.3=24, econ:100*0.2=20, unrest:10*-0.15=-1.5, war:0, power:60*0.15=9, chal:10*-0.1=-1 → 50.5
    const s = makeDemocraticState({ challengerStrength: 10 });
    const ns = makeNationState({ popularity: 80, stability: 90, gdp: 10000 });
    const result = simulateElection(s, ns, 0, 60, fixedRng(0.5));
    // total = 24 + 20 + -1.5 + 0 + 9 + -1 + 0 = 50.5
    expect(result.outcome).toBe('contested');
  });

  it('assigns newLeaderId when challenger wins', () => {
    const s = makeDemocraticState({ challengerStrength: 100 });
    const ns = makeNationState({ popularity: 0, stability: 0, gdp: 0 });
    const result = simulateElection(s, ns, 100, 0, fixedRng(0.5));
    expect(result.newLeaderId).toBeDefined();
  });

  it('does NOT assign newLeaderId when incumbent wins', () => {
    const s = makeDemocraticState({ challengerStrength: 0 });
    const ns = makeNationState({ popularity: 100, stability: 100, gdp: 10000 });
    const result = simulateElection(s, ns, 0, 100, fixedRng(0.5));
    expect(result.newLeaderId).toBeUndefined();
  });

  it('random component shifts total when RNG varies', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const resultLow = simulateElection(s, ns, 20, 50, fixedRng(0.0));
    const resultHigh = simulateElection(s, ns, 20, 50, fixedRng(1.0));
    expect(resultHigh.formulaBreakdown.total).toBeGreaterThan(
      resultLow.formulaBreakdown.total,
    );
  });

  it('randomDelta is 0 when rng.next() returns 0.5', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const result = simulateElection(s, ns, 20, 50, fixedRng(0.5));
    expect(result.formulaBreakdown.randomDelta).toBeCloseTo(0, 5);
  });

  it('high war weariness lowers total', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const peaceful = simulateElection(s, ns, 0, 50, fixedRng(0.5));
    const warTorn = simulateElection(s, ns, 100, 50, fixedRng(0.5));
    expect(warTorn.formulaBreakdown.total).toBeLessThan(peaceful.formulaBreakdown.total);
  });

  it('high challenger strength lowers total', () => {
    const sWeak = makeDemocraticState({ challengerStrength: 10 });
    const sStrong = makeDemocraticState({ challengerStrength: 90 });
    const ns = makeNationState();
    const weak = simulateElection(sWeak, ns, 20, 50, fixedRng(0.5));
    const strong = simulateElection(sStrong, ns, 20, 50, fixedRng(0.5));
    expect(strong.formulaBreakdown.total).toBeLessThan(weak.formulaBreakdown.total);
  });

  it('higher popularity raises total', () => {
    const s = makeDemocraticState();
    const low = simulateElection(s, makeNationState({ popularity: 20 }), 20, 50, fixedRng(0.5));
    const high = simulateElection(s, makeNationState({ popularity: 80 }), 20, 50, fixedRng(0.5));
    expect(high.formulaBreakdown.total).toBeGreaterThan(low.formulaBreakdown.total);
  });

  it('higher power base raises total', () => {
    const s = makeDemocraticState();
    const ns = makeNationState();
    const low = simulateElection(s, ns, 20, 10, fixedRng(0.5));
    const high = simulateElection(s, ns, 20, 90, fixedRng(0.5));
    expect(high.formulaBreakdown.total).toBeGreaterThan(low.formulaBreakdown.total);
  });

  it('econPerf is clamped between 0 and 100', () => {
    const s = makeDemocraticState();
    const massive = simulateElection(
      s,
      makeNationState({ gdp: 999999 }),
      0,
      50,
      fixedRng(0.5),
    );
    // econPerf = clamp(999999/100,0,100) = 100 → contrib = 100*0.2 = 20
    expect(massive.formulaBreakdown.econPerf).toBeCloseTo(20, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// processElectionOutcome
// ═══════════════════════════════════════════════════════════════════════════

describe('processElectionOutcome', () => {
  it('advances nextElectionTurn by one cycle when challenger wins', () => {
    const s = makeDemocraticState({ nextElectionTurn: T(48) });
    const result = simulateElection(
      { ...s, challengerStrength: 100 },
      makeNationState({ popularity: 0, stability: 0, gdp: 0 }),
      100,
      0,
      fixedRng(0.5),
    );
    const { updatedState } = processElectionOutcome(s, result);
    expect(updatedState.nextElectionTurn).toBe(T(48 + 48));
  });

  it('sets lastElectionTurn to the current election turn', () => {
    const s = makeDemocraticState({ nextElectionTurn: T(48) });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 100, stability: 100, gdp: 10000 }),
      0,
      100,
      fixedRng(0.5),
    );
    const { updatedState } = processElectionOutcome(s, result);
    expect(updatedState.lastElectionTurn).toBe(T(48));
  });

  it('stores the election result on the updated state', () => {
    const s = makeDemocraticState();
    const result = simulateElection(
      s,
      makeNationState(),
      20,
      50,
      fixedRng(0.5),
    );
    const { updatedState } = processElectionOutcome(s, result);
    expect(updatedState.electionResult).toBe(result);
  });

  it('returns null transition when incumbent wins', () => {
    const s = makeDemocraticState({ challengerStrength: 0 });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 100, stability: 100, gdp: 10000 }),
      0,
      100,
      fixedRng(0.5),
    );
    const { transition } = processElectionOutcome(s, result);
    expect(transition).toBeNull();
  });

  it('returns a transition record when challenger wins', () => {
    const s = makeDemocraticState({ challengerStrength: 100 });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 0, stability: 0, gdp: 0 }),
      100,
      0,
      fixedRng(0.5),
    );
    const { transition } = processElectionOutcome(s, result);
    expect(transition).not.toBeNull();
    expect(transition!.transitionType).toBe('election');
  });

  it('transition has correct nationCode', () => {
    const s = makeDemocraticState({ nationCode: F('eu'), challengerStrength: 100 });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 0, stability: 0, gdp: 0 }),
      100,
      0,
      fixedRng(0.5),
    );
    const { transition } = processElectionOutcome(s, result);
    expect(transition!.nationCode).toBe('eu');
  });

  it('sets transitionTurnsRemaining when challenger wins', () => {
    const s = makeDemocraticState({ challengerStrength: 100 });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 0, stability: 0, gdp: 0 }),
      100,
      0,
      fixedRng(0.5),
    );
    const { updatedState } = processElectionOutcome(s, result);
    expect(updatedState.transitionTurnsRemaining).toBeGreaterThan(0);
  });

  it('transitionTurnsRemaining is 0 when incumbent wins', () => {
    const s = makeDemocraticState({ challengerStrength: 0 });
    const result = simulateElection(
      s,
      makeNationState({ popularity: 100, stability: 100, gdp: 10000 }),
      0,
      100,
      fixedRng(0.5),
    );
    const { updatedState } = processElectionOutcome(s, result);
    expect(updatedState.transitionTurnsRemaining).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// processNonDemocraticTransition
// ═══════════════════════════════════════════════════════════════════════════

describe('processNonDemocraticTransition', () => {
  const types: LeadershipTransitionType[] = ['coup', 'revolution', 'assassination', 'health'];

  for (const tt of types) {
    it(`creates a valid record for '${tt}'`, () => {
      const record = processNonDemocraticTransition(F('russia'), tt, T(10), fixedRng(0.5));
      expect(record.transitionType).toBe(tt);
      expect(record.nationCode).toBe('russia');
      expect(record.turn).toBe(T(10));
      expect(record.effects.length).toBeGreaterThan(0);
    });
  }

  it('coup has higher severity than health', () => {
    const coup = processNonDemocraticTransition(F('russia'), 'coup', T(5), fixedRng(0.5));
    const health = processNonDemocraticTransition(F('russia'), 'health', T(5), fixedRng(0.5));
    expect(Math.abs(coup.stabilityImpact)).toBeGreaterThan(Math.abs(health.stabilityImpact));
  });

  it('revolution has the longest transition duration', () => {
    const revolution = processNonDemocraticTransition(F('iran'), 'revolution', T(5), fixedRng(0.5));
    const coup = processNonDemocraticTransition(F('iran'), 'coup', T(5), fixedRng(0.5));
    expect(revolution.transitionDuration).toBeGreaterThan(coup.transitionDuration);
  });

  it('includes diplomaticInfluence in effects', () => {
    const record = processNonDemocraticTransition(F('china'), 'coup', T(3), fixedRng(0.5));
    const dims = record.effects.map((e) => e.dimension);
    expect(dims).toContain('diplomaticInfluence');
  });

  it('rng variance changes stability impact', () => {
    const low = processNonDemocraticTransition(F('china'), 'coup', T(5), fixedRng(0.0));
    const high = processNonDemocraticTransition(F('china'), 'coup', T(5), fixedRng(1.0));
    expect(low.stabilityImpact).not.toBe(high.stabilityImpact);
  });

  it('assigns distinct previousLeaderId and newLeaderId', () => {
    const record = processNonDemocraticTransition(F('dprk'), 'assassination', T(7), fixedRng(0.5));
    expect(record.previousLeaderId).not.toBe(record.newLeaderId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// applyTransitionEffects
// ═══════════════════════════════════════════════════════════════════════════

describe('applyTransitionEffects', () => {
  it('reduces stability according to transition effects', () => {
    const ns = makeNationState({ stability: 70 });
    const record = processNonDemocraticTransition(F('us'), 'coup', T(1), fixedRng(0.5));
    const updated = applyTransitionEffects(ns, record);
    expect(updated.stability).toBeLessThan(70);
  });

  it('reduces GDP according to transition effects', () => {
    const ns = makeNationState({ gdp: 5000 });
    const record = processNonDemocraticTransition(F('us'), 'revolution', T(1), fixedRng(0.5));
    const updated = applyTransitionEffects(ns, record);
    expect(updated.gdp).toBeLessThan(5000);
  });

  it('clamps stability to minimum 0', () => {
    const ns = makeNationState({ stability: 5 });
    const record = processNonDemocraticTransition(F('us'), 'revolution', T(1), fixedRng(0.5));
    const updated = applyTransitionEffects(ns, record);
    expect(updated.stability).toBeGreaterThanOrEqual(0);
  });

  it('clamps GDP to minimum 0', () => {
    const ns = makeNationState({ gdp: 5 });
    const record = processNonDemocraticTransition(F('us'), 'revolution', T(1), fixedRng(0.5));
    const updated = applyTransitionEffects(ns, record);
    expect(updated.gdp).toBeGreaterThanOrEqual(0);
  });

  it('clamps stability to maximum 100', () => {
    // Positive impact on stability (hypothetical)
    const ns = makeNationState({ stability: 99 });
    const transition = {
      ...processNonDemocraticTransition(F('us'), 'health', T(1), fixedRng(0.5)),
      effects: [{ dimension: 'stability', impact: 50 }],
    };
    const updated = applyTransitionEffects(ns, transition);
    expect(updated.stability).toBe(100);
  });

  it('does not mutate the original NationState', () => {
    const ns = makeNationState({ stability: 70 });
    const record = processNonDemocraticTransition(F('us'), 'coup', T(1), fixedRng(0.5));
    applyTransitionEffects(ns, record);
    expect(ns.stability).toBe(70);
  });

  it('applies diplomaticInfluence effects', () => {
    const ns = makeNationState({ diplomaticInfluence: 60 });
    const record = processNonDemocraticTransition(F('us'), 'coup', T(1), fixedRng(0.5));
    const updated = applyTransitionEffects(ns, record);
    expect(updated.diplomaticInfluence).toBeLessThan(60);
  });

  it('handles unknown dimension gracefully', () => {
    const ns = makeNationState();
    const transition = {
      ...processNonDemocraticTransition(F('us'), 'health', T(1), fixedRng(0.5)),
      effects: [{ dimension: 'unknown_dim', impact: -10 }],
    };
    const updated = applyTransitionEffects(ns, transition);
    // Should be identical since unknown dimension is ignored
    expect(updated.stability).toBe(ns.stability);
    expect(updated.gdp).toBe(ns.gdp);
  });

  it('applies popularity effect when present', () => {
    const ns = makeNationState({ popularity: 50 });
    const transition = {
      ...processNonDemocraticTransition(F('us'), 'health', T(1), fixedRng(0.5)),
      effects: [{ dimension: 'popularity', impact: -20 }],
    };
    const updated = applyTransitionEffects(ns, transition);
    expect(updated.popularity).toBe(30);
  });

  it('applies militaryReadiness effect when present', () => {
    const ns = makeNationState({ militaryReadiness: 80 });
    const transition = {
      ...processNonDemocraticTransition(F('us'), 'coup', T(1), fixedRng(0.5)),
      effects: [{ dimension: 'militaryReadiness', impact: -15 }],
    };
    const updated = applyTransitionEffects(ns, transition);
    expect(updated.militaryReadiness).toBe(65);
  });

  it('applies techLevel effect when present', () => {
    const ns = makeNationState({ techLevel: 70 });
    const transition = {
      ...processNonDemocraticTransition(F('us'), 'revolution', T(1), fixedRng(0.5)),
      effects: [{ dimension: 'techLevel', impact: -5 }],
    };
    const updated = applyTransitionEffects(ns, transition);
    expect(updated.techLevel).toBe(65);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// advanceTransition
// ═══════════════════════════════════════════════════════════════════════════

describe('advanceTransition', () => {
  it('decrements transitionTurnsRemaining by 1', () => {
    const s = makeDemocraticState({ transitionTurnsRemaining: 5 });
    const updated = advanceTransition(s);
    expect(updated.transitionTurnsRemaining).toBe(4);
  });

  it('does not go below 0', () => {
    const s = makeDemocraticState({ transitionTurnsRemaining: 0 });
    const updated = advanceTransition(s);
    expect(updated.transitionTurnsRemaining).toBe(0);
  });

  it('returns same reference when already at 0', () => {
    const s = makeDemocraticState({ transitionTurnsRemaining: 0 });
    const updated = advanceTransition(s);
    expect(updated).toBe(s);
  });

  it('returns a new object when decremented', () => {
    const s = makeDemocraticState({ transitionTurnsRemaining: 3 });
    const updated = advanceTransition(s);
    expect(updated).not.toBe(s);
  });

  it('does not mutate the original state', () => {
    const s = makeDemocraticState({ transitionTurnsRemaining: 3 });
    advanceTransition(s);
    expect(s.transitionTurnsRemaining).toBe(3);
  });

  it('reaches 0 after exactly N advances', () => {
    let s = makeDemocraticState({ transitionTurnsRemaining: 4 });
    for (let i = 0; i < 4; i++) {
      s = advanceTransition(s);
    }
    expect(s.transitionTurnsRemaining).toBe(0);
  });
});
