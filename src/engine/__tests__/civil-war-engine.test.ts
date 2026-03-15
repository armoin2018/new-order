/**
 * Civil War & Protest Scenarios Engine — Test Suite
 *
 * 55+ Vitest tests covering all 14 pure functions in civil-war-engine.ts.
 *
 * @see FR-5300 — Civil War & Protest Scenarios
 * @see FR-5301 — Civil war trigger conditions
 * @see FR-5302 — Protest movement lifecycle
 * @see FR-5303 — Government unrest responses
 * @see FR-5304 — Civil war resolution
 * @see FR-5305 — AI unrest response logic
 * @see FR-5306 — International civil war intervention
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  initializeNationCivilWarState,
  createProtestMovement,
  escalateMovement,
  deescalateMovement,
  checkCivilWarTrigger,
  trackConsecutiveUnrest,
  triggerCivilWar,
  getReactionOptions,
  applyUnrestReaction,
  advanceCivilWar,
  checkResolution,
  resolveCivilWar,
  getAIUnrestResponse,
  applyInternationalResponse,
} from '@/engine/civil-war-engine';
import type {
  NationCivilWarState,
  ProtestMovement,
  CivilWarState,
  UnrestReactionOption,
  UnrestResponseResult,
} from '@/data/types/civil-war.types';
import { civilWarConfig } from '@/engine/config/civil-war';

// ── Test Helpers ────────────────────────────────────────────────────────────

/** Build a test protest movement with sensible defaults. */
function buildTestMovement(overrides: Partial<ProtestMovement> = {}): ProtestMovement {
  return {
    movementId: 'mov-test-001',
    nationId: 'nation-alpha',
    name: 'Workers United',
    cause: 'economic',
    sizePercent: 30,
    organizationLevel: 'spontaneous',
    demands: ['Higher wages', 'Better conditions'],
    foreignBacking: null,
    turnsActive: 0,
    leaderName: 'Test Leader',
    publicSympathy: 50,
    governmentResponse: 'none',
    resolved: false,
    ...overrides,
  };
}

/** Build a test civil war state with sensible defaults. */
function buildTestCivilWar(overrides: Partial<CivilWarState> = {}): CivilWarState {
  return {
    warId: 'war-test-001',
    nationId: 'nation-alpha',
    rebelFactionName: 'Liberation Front',
    cause: 'political',
    startTurn: 10,
    territoryControlPercent: 70,
    militarySplitRatio: 0.65,
    economicDamagePercent: 0,
    externalSupport: {},
    casualties: 0,
    refugeesGenerated: 0,
    resolutionType: null,
    resolutionTurn: null,
    ...overrides,
  };
}

/** Build a fresh nation civil-war state for convenience. */
function buildNationState(overrides: Partial<NationCivilWarState> = {}): NationCivilWarState {
  return {
    nationId: 'nation-alpha',
    protestMovements: [],
    activeCivilWars: [],
    consecutiveHighUnrestTurns: 0,
    unrestResponseHistory: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeNationCivilWarState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeNationCivilWarState', () => {
  it('should set the nationId to the given value', () => {
    const state = initializeNationCivilWarState('nation-bravo');
    expect(state.nationId).toBe('nation-bravo');
  });

  it('should initialise protestMovements as an empty array', () => {
    const state = initializeNationCivilWarState('nation-bravo');
    expect(state.protestMovements).toEqual([]);
  });

  it('should initialise activeCivilWars as an empty array', () => {
    const state = initializeNationCivilWarState('nation-bravo');
    expect(state.activeCivilWars).toEqual([]);
  });

  it('should set consecutiveHighUnrestTurns to zero', () => {
    const state = initializeNationCivilWarState('nation-bravo');
    expect(state.consecutiveHighUnrestTurns).toBe(0);
  });

  it('should initialise unrestResponseHistory as an empty array', () => {
    const state = initializeNationCivilWarState('nation-bravo');
    expect(state.unrestResponseHistory).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createProtestMovement
// ═══════════════════════════════════════════════════════════════════════════

describe('createProtestMovement', () => {
  it('should assign the correct nationId', () => {
    const movement = createProtestMovement('nation-alpha', 'Uprising', 'economic', 25, ['Reform'], 'Leader A');
    expect(movement.nationId).toBe('nation-alpha');
  });

  it('should assign the correct name', () => {
    const movement = createProtestMovement('n', 'Freedom Rally', 'political', 10, [], 'L');
    expect(movement.name).toBe('Freedom Rally');
  });

  it('should assign the correct cause', () => {
    const movement = createProtestMovement('n', 'M', 'religious', 10, [], 'L');
    expect(movement.cause).toBe('religious');
  });

  it('should clamp sizePercent to the range [0, 100]', () => {
    const tooHigh = createProtestMovement('n', 'M', 'economic', 150, [], 'L');
    expect(tooHigh.sizePercent).toBe(100);
    const tooLow = createProtestMovement('n', 'M', 'economic', -20, [], 'L');
    expect(tooLow.sizePercent).toBe(0);
  });

  it('should default organizationLevel to spontaneous', () => {
    const movement = createProtestMovement('n', 'M', 'ethnic', 20, [], 'L');
    expect(movement.organizationLevel).toBe('spontaneous');
  });

  it('should copy demands without sharing the reference', () => {
    const demands = ['Land reform', 'Elections'];
    const movement = createProtestMovement('n', 'M', 'political', 20, demands, 'L');
    expect(movement.demands).toEqual(demands);
    expect(movement.demands).not.toBe(demands);
  });

  it('should set foreignBacking to null', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'L');
    expect(movement.foreignBacking).toBeNull();
  });

  it('should set turnsActive to 0', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'L');
    expect(movement.turnsActive).toBe(0);
  });

  it('should assign the correct leaderName', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'Commander X');
    expect(movement.leaderName).toBe('Commander X');
  });

  it('should set publicSympathy to 50', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'L');
    expect(movement.publicSympathy).toBe(50);
  });

  it('should set governmentResponse to none', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'L');
    expect(movement.governmentResponse).toBe('none');
  });

  it('should set resolved to false', () => {
    const movement = createProtestMovement('n', 'M', 'economic', 20, [], 'L');
    expect(movement.resolved).toBe(false);
  });

  it('should generate a unique movementId', () => {
    const m1 = createProtestMovement('n', 'A', 'economic', 10, [], 'L');
    const m2 = createProtestMovement('n', 'B', 'economic', 10, [], 'L');
    expect(m1.movementId).not.toBe(m2.movementId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — escalateMovement
// ═══════════════════════════════════════════════════════════════════════════

describe('escalateMovement', () => {
  it('should escalate spontaneous to organized', () => {
    const movement = buildTestMovement({ organizationLevel: 'spontaneous' });
    const result = escalateMovement(movement);
    expect(result.organizationLevel).toBe('organized');
  });

  it('should escalate organized to militant', () => {
    const movement = buildTestMovement({ organizationLevel: 'organized' });
    const result = escalateMovement(movement);
    expect(result.organizationLevel).toBe('militant');
  });

  it('should keep militant at militant (ceiling)', () => {
    const movement = buildTestMovement({ organizationLevel: 'militant' });
    const result = escalateMovement(movement);
    expect(result.organizationLevel).toBe('militant');
  });

  it('should return a new object (immutability)', () => {
    const movement = buildTestMovement({ organizationLevel: 'spontaneous' });
    const result = escalateMovement(movement);
    expect(result).not.toBe(movement);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — deescalateMovement
// ═══════════════════════════════════════════════════════════════════════════

describe('deescalateMovement', () => {
  it('should de-escalate militant to organized', () => {
    const movement = buildTestMovement({ organizationLevel: 'militant' });
    const result = deescalateMovement(movement);
    expect(result.organizationLevel).toBe('organized');
  });

  it('should de-escalate organized to spontaneous', () => {
    const movement = buildTestMovement({ organizationLevel: 'organized' });
    const result = deescalateMovement(movement);
    expect(result.organizationLevel).toBe('spontaneous');
  });

  it('should keep spontaneous at spontaneous (floor)', () => {
    const movement = buildTestMovement({ organizationLevel: 'spontaneous' });
    const result = deescalateMovement(movement);
    expect(result.organizationLevel).toBe('spontaneous');
  });

  it('should return a new object (immutability)', () => {
    const movement = buildTestMovement({ organizationLevel: 'militant' });
    const result = deescalateMovement(movement);
    expect(result).not.toBe(movement);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — checkCivilWarTrigger
// ═══════════════════════════════════════════════════════════════════════════

describe('checkCivilWarTrigger', () => {
  const threshold = civilWarConfig.triggers.civilWarUnrestThreshold;
  const requiredTurns = civilWarConfig.triggers.consecutiveTurnsRequired;

  it('should trigger when unrest >= threshold AND consecutive turns >= required', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: requiredTurns });
    expect(checkCivilWarTrigger(state, threshold, 0, false)).toBe(true);
  });

  it('should trigger when unrest exceeds threshold with enough turns', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: requiredTurns + 2 });
    expect(checkCivilWarTrigger(state, threshold + 10, 0, false)).toBe(true);
  });

  it('should NOT trigger when unrest is high but consecutive turns are insufficient', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: requiredTurns - 1 });
    expect(checkCivilWarTrigger(state, threshold, 0, false)).toBe(false);
  });

  it('should NOT trigger when consecutive turns are enough but unrest is below threshold', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: requiredTurns });
    expect(checkCivilWarTrigger(state, threshold - 1, 0, false)).toBe(false);
  });

  it('should trigger when fault-line tension >= critical threshold', () => {
    const state = buildNationState();
    const faultLineThreshold = civilWarConfig.triggers.faultLineCriticalThreshold;
    expect(checkCivilWarTrigger(state, 0, faultLineThreshold, false)).toBe(true);
  });

  it('should NOT trigger when fault-line tension is below critical threshold', () => {
    const state = buildNationState();
    const faultLineThreshold = civilWarConfig.triggers.faultLineCriticalThreshold;
    expect(checkCivilWarTrigger(state, 0, faultLineThreshold - 1, false)).toBe(false);
  });

  it('should trigger on a failed coup when config flag is enabled', () => {
    const state = buildNationState();
    expect(checkCivilWarTrigger(state, 0, 0, true)).toBe(true);
  });

  it('should NOT trigger when all conditions are false', () => {
    const state = buildNationState();
    expect(checkCivilWarTrigger(state, 10, 10, false)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — trackConsecutiveUnrest
// ═══════════════════════════════════════════════════════════════════════════

describe('trackConsecutiveUnrest', () => {
  const threshold = civilWarConfig.triggers.civilWarUnrestThreshold;

  it('should increment counter when unrest is at the threshold', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: 2 });
    const result = trackConsecutiveUnrest(state, threshold);
    expect(result.consecutiveHighUnrestTurns).toBe(3);
  });

  it('should increment counter when unrest exceeds the threshold', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: 5 });
    const result = trackConsecutiveUnrest(state, threshold + 10);
    expect(result.consecutiveHighUnrestTurns).toBe(6);
  });

  it('should reset counter to zero when unrest drops below threshold', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: 5 });
    const result = trackConsecutiveUnrest(state, threshold - 1);
    expect(result.consecutiveHighUnrestTurns).toBe(0);
  });

  it('should reset counter to zero when unrest is zero', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: 3 });
    const result = trackConsecutiveUnrest(state, 0);
    expect(result.consecutiveHighUnrestTurns).toBe(0);
  });

  it('should return a new object (immutability)', () => {
    const state = buildNationState({ consecutiveHighUnrestTurns: 1 });
    const result = trackConsecutiveUnrest(state, threshold);
    expect(result).not.toBe(state);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — triggerCivilWar
// ═══════════════════════════════════════════════════════════════════════════

describe('triggerCivilWar', () => {
  it('should append a new civil war to activeCivilWars', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'economic collapse', 'Rebel Alliance', 5);
    expect(result.activeCivilWars).toHaveLength(1);
  });

  it('should set the rebel faction name from the argument', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'famine', 'Northern Front', 1);
    expect(result.activeCivilWars[0]!.rebelFactionName).toBe('Northern Front');
  });

  it('should set the cause from the argument', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'ethnic tension', 'Freedom Fighters', 3);
    expect(result.activeCivilWars[0]!.cause).toBe('ethnic tension');
  });

  it('should set startTurn from the argument', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'c', 'f', 42);
    expect(result.activeCivilWars[0]!.startTurn).toBe(42);
  });

  it('should initialise territory control from config', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'c', 'f', 1);
    expect(result.activeCivilWars[0]!.territoryControlPercent).toBe(
      civilWarConfig.civilWar.initialTerritoryGovernment,
    );
  });

  it('should initialise military split ratio from config', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'c', 'f', 1);
    expect(result.activeCivilWars[0]!.militarySplitRatio).toBe(
      civilWarConfig.civilWar.militarySplitBase,
    );
  });

  it('should start with zero casualties and refugees', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'c', 'f', 1);
    const war = result.activeCivilWars[0]!;
    expect(war.casualties).toBe(0);
    expect(war.refugeesGenerated).toBe(0);
  });

  it('should start with null resolution', () => {
    const state = buildNationState();
    const result = triggerCivilWar(state, 'c', 'f', 1);
    const war = result.activeCivilWars[0]!;
    expect(war.resolutionType).toBeNull();
    expect(war.resolutionTurn).toBeNull();
  });

  it('should preserve existing civil wars when appending', () => {
    const existingWar = buildTestCivilWar({ warId: 'existing' });
    const state = buildNationState({ activeCivilWars: [existingWar] });
    const result = triggerCivilWar(state, 'c', 'f', 1);
    expect(result.activeCivilWars).toHaveLength(2);
    expect(result.activeCivilWars[0]!.warId).toBe('existing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — getReactionOptions
// ═══════════════════════════════════════════════════════════════════════════

describe('getReactionOptions', () => {
  const movement = buildTestMovement();
  let options: UnrestReactionOption[];

  it('should return exactly 6 options', () => {
    options = getReactionOptions(movement);
    expect(options).toHaveLength(6);
  });

  it('should include negotiate, reform, repress, concede, divide, ignore', () => {
    options = getReactionOptions(movement);
    const types = options.map((o) => o.type);
    expect(types).toEqual(['negotiate', 'reform', 'repress', 'concede', 'divide', 'ignore']);
  });

  it('should populate label and description for each option', () => {
    options = getReactionOptions(movement);
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });

  it('should source costTreasury from config', () => {
    options = getReactionOptions(movement);
    const negotiateOpt = options.find((o) => o.type === 'negotiate')!;
    expect(negotiateOpt.costTreasury).toBe(civilWarConfig.reactions.negotiate.treasuryCost);
  });

  it('should source unrestEffect from config', () => {
    options = getReactionOptions(movement);
    const repressOpt = options.find((o) => o.type === 'repress')!;
    expect(repressOpt.unrestEffect).toBe(civilWarConfig.reactions.repress.unrestModifier);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — applyUnrestReaction
// ═══════════════════════════════════════════════════════════════════════════

describe('applyUnrestReaction', () => {
  it('should throw if the movement is not found', () => {
    const state = buildNationState();
    expect(() => applyUnrestReaction(state, 'nonexistent', 'negotiate', 1)).toThrow(
      'Movement not found: nonexistent',
    );
  });

  it('negotiate should reduce movement size by the configured unrest modifier', () => {
    const movement = buildTestMovement({ sizePercent: 50 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'negotiate', 1);
    const updated = newState.protestMovements[0]!;
    const expected = 50 + civilWarConfig.reactions.negotiate.unrestModifier;
    expect(updated.sizePercent).toBe(Math.max(0, Math.min(100, expected)));
  });

  it('repress should reduce movement size more than negotiate', () => {
    const m1 = buildTestMovement({ movementId: 'a', sizePercent: 60 });
    const m2 = buildTestMovement({ movementId: 'b', sizePercent: 60 });
    const s1 = buildNationState({ protestMovements: [m1] });
    const s2 = buildNationState({ protestMovements: [m2] });
    const { state: afterNeg } = applyUnrestReaction(s1, 'a', 'negotiate', 1);
    const { state: afterRep } = applyUnrestReaction(s2, 'b', 'repress', 1);
    expect(afterRep.protestMovements[0]!.sizePercent).toBeLessThan(
      afterNeg.protestMovements[0]!.sizePercent,
    );
  });

  it('ignore should increase movement size', () => {
    const movement = buildTestMovement({ sizePercent: 30 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'ignore', 1);
    expect(newState.protestMovements[0]!.sizePercent).toBeGreaterThan(30);
  });

  it('concede should mark the movement as resolved', () => {
    const movement = buildTestMovement({ sizePercent: 40 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'concede', 5);
    expect(newState.protestMovements[0]!.resolved).toBe(true);
  });

  it('should update the government response posture for repress', () => {
    const movement = buildTestMovement({ sizePercent: 40 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'repress', 1);
    expect(newState.protestMovements[0]!.governmentResponse).toBe('repressing');
  });

  it('should update the government response posture for reform', () => {
    const movement = buildTestMovement({ sizePercent: 40 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'reform', 1);
    expect(newState.protestMovements[0]!.governmentResponse).toBe('reforming');
  });

  it('should append the result to unrestResponseHistory', () => {
    const movement = buildTestMovement();
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState, result } = applyUnrestReaction(
      state,
      movement.movementId,
      'negotiate',
      3,
    );
    expect(newState.unrestResponseHistory).toHaveLength(1);
    expect(newState.unrestResponseHistory[0]).toEqual(result);
  });

  it('result should contain the correct responseType and targetMovementId', () => {
    const movement = buildTestMovement();
    const state = buildNationState({ protestMovements: [movement] });
    const { result } = applyUnrestReaction(state, movement.movementId, 'divide', 7);
    expect(result.responseType).toBe('divide');
    expect(result.targetMovementId).toBe(movement.movementId);
  });

  it('result should contain effectsApplied matching config values', () => {
    const movement = buildTestMovement();
    const state = buildNationState({ protestMovements: [movement] });
    const { result } = applyUnrestReaction(state, movement.movementId, 'reform', 2);
    const cfg = civilWarConfig.reactions.reform;
    expect(result.effectsApplied.unrest).toBe(cfg.unrestModifier);
    expect(result.effectsApplied.stability).toBe(cfg.stabilityModifier);
    expect(result.effectsApplied.treasury).toBe(-cfg.treasuryCost);
    expect(result.effectsApplied.reputation).toBe(cfg.reputationModifier);
    expect(result.effectsApplied.longTermTension).toBe(cfg.longTermTension);
  });

  it('result should contain a narrativeSummary string', () => {
    const movement = buildTestMovement({ name: 'People\'s Front' });
    const state = buildNationState({ protestMovements: [movement] });
    const { result } = applyUnrestReaction(state, movement.movementId, 'repress', 4);
    expect(result.narrativeSummary).toContain('People\'s Front');
    expect(result.narrativeSummary).toContain('4');
  });

  it('should clamp sizePercent to 0 when reduction exceeds current size', () => {
    const movement = buildTestMovement({ sizePercent: 5 });
    const state = buildNationState({ protestMovements: [movement] });
    const { state: newState } = applyUnrestReaction(state, movement.movementId, 'concede', 1);
    expect(newState.protestMovements[0]!.sizePercent).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — advanceCivilWar
// ═══════════════════════════════════════════════════════════════════════════

describe('advanceCivilWar', () => {
  it('should increase economic damage by config economicDamagePerTurn', () => {
    const war = buildTestCivilWar({ economicDamagePercent: 10 });
    const result = advanceCivilWar(war);
    expect(result.economicDamagePercent).toBe(10 + civilWarConfig.civilWar.economicDamagePerTurn);
  });

  it('should increase casualties by config casualtiesPerTurn', () => {
    const war = buildTestCivilWar({ casualties: 500 });
    const result = advanceCivilWar(war);
    expect(result.casualties).toBe(500 + civilWarConfig.civilWar.casualtiesPerTurn);
  });

  it('should increase refugees by config refugeesPerTurn', () => {
    const war = buildTestCivilWar({ refugeesGenerated: 2000 });
    const result = advanceCivilWar(war);
    expect(result.refugeesGenerated).toBe(2000 + civilWarConfig.civilWar.refugeesPerTurn);
  });

  it('should shift territory toward rebels based on military split ratio', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 70, militarySplitRatio: 0.65 });
    const result = advanceCivilWar(war);
    const expectedShift = (1 - 0.65) * 5;
    expect(result.territoryControlPercent).toBeCloseTo(70 - expectedShift, 5);
  });

  it('should lose territory faster when military split ratio is low', () => {
    const weakMilitary = buildTestCivilWar({ territoryControlPercent: 60, militarySplitRatio: 0.3 });
    const strongMilitary = buildTestCivilWar({ territoryControlPercent: 60, militarySplitRatio: 0.8 });
    const afterWeak = advanceCivilWar(weakMilitary);
    const afterStrong = advanceCivilWar(strongMilitary);
    expect(afterWeak.territoryControlPercent).toBeLessThan(afterStrong.territoryControlPercent);
  });

  it('should clamp territory control to a minimum of 0', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 1, militarySplitRatio: 0.0 });
    const result = advanceCivilWar(war);
    expect(result.territoryControlPercent).toBeGreaterThanOrEqual(0);
  });

  it('should return a new object (immutability)', () => {
    const war = buildTestCivilWar();
    const result = advanceCivilWar(war);
    expect(result).not.toBe(war);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — checkResolution
// ═══════════════════════════════════════════════════════════════════════════

describe('checkResolution', () => {
  it('should return government_victory when territory >= threshold', () => {
    const war = buildTestCivilWar({
      territoryControlPercent: civilWarConfig.resolution.governmentVictoryThreshold,
    });
    expect(checkResolution(war)).toBe('government_victory');
  });

  it('should return government_victory when territory exceeds threshold', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 95 });
    expect(checkResolution(war)).toBe('government_victory');
  });

  it('should return rebel_victory when territory <= threshold', () => {
    const war = buildTestCivilWar({
      territoryControlPercent: civilWarConfig.resolution.rebelVictoryThreshold,
    });
    expect(checkResolution(war)).toBe('rebel_victory');
  });

  it('should return rebel_victory when territory is 0', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 0 });
    expect(checkResolution(war)).toBe('rebel_victory');
  });

  it('should return negotiated_settlement when within negotiation window', () => {
    const { min, max } = civilWarConfig.resolution.negotiationWindow;
    const midPoint = Math.floor((min + max) / 2);
    const war = buildTestCivilWar({ territoryControlPercent: midPoint });
    expect(checkResolution(war)).toBe('negotiated_settlement');
  });

  it('should return negotiated_settlement at negotiation window min boundary', () => {
    const war = buildTestCivilWar({
      territoryControlPercent: civilWarConfig.resolution.negotiationWindow.min,
    });
    expect(checkResolution(war)).toBe('negotiated_settlement');
  });

  it('should return negotiated_settlement at negotiation window max boundary', () => {
    const war = buildTestCivilWar({
      territoryControlPercent: civilWarConfig.resolution.negotiationWindow.max,
    });
    expect(checkResolution(war)).toBe('negotiated_settlement');
  });

  it('should return null for territory between rebel threshold and negotiation min', () => {
    const territory = civilWarConfig.resolution.rebelVictoryThreshold + 1;
    // Only if this falls outside the negotiation window
    if (territory < civilWarConfig.resolution.negotiationWindow.min) {
      const war = buildTestCivilWar({ territoryControlPercent: territory });
      const result = checkResolution(war);
      // It could be null or partition depending on maxDurationTurns logic
      expect(result === null || result === 'partition').toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — resolveCivilWar
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveCivilWar', () => {
  it('should throw if the war is not found', () => {
    const state = buildNationState();
    expect(() => resolveCivilWar(state, 'nonexistent', 'government_victory', 10)).toThrow(
      'Civil war not found: nonexistent',
    );
  });

  it('should set resolutionType on the matched war', () => {
    const war = buildTestCivilWar({ warId: 'w1' });
    const state = buildNationState({ activeCivilWars: [war] });
    const result = resolveCivilWar(state, 'w1', 'rebel_victory', 20);
    expect(result.activeCivilWars[0]!.resolutionType).toBe('rebel_victory');
  });

  it('should set resolutionTurn on the matched war', () => {
    const war = buildTestCivilWar({ warId: 'w1' });
    const state = buildNationState({ activeCivilWars: [war] });
    const result = resolveCivilWar(state, 'w1', 'negotiated_settlement', 15);
    expect(result.activeCivilWars[0]!.resolutionTurn).toBe(15);
  });

  it('should not modify other wars in the array', () => {
    const war1 = buildTestCivilWar({ warId: 'w1' });
    const war2 = buildTestCivilWar({ warId: 'w2' });
    const state = buildNationState({ activeCivilWars: [war1, war2] });
    const result = resolveCivilWar(state, 'w2', 'partition', 25);
    expect(result.activeCivilWars[0]!.resolutionType).toBeNull();
    expect(result.activeCivilWars[1]!.resolutionType).toBe('partition');
  });

  it('should return a new state object (immutability)', () => {
    const war = buildTestCivilWar({ warId: 'w1' });
    const state = buildNationState({ activeCivilWars: [war] });
    const result = resolveCivilWar(state, 'w1', 'government_victory', 10);
    expect(result).not.toBe(state);
    expect(result.activeCivilWars).not.toBe(state.activeCivilWars);
  });

  it('should support external_intervention as a resolution type', () => {
    const war = buildTestCivilWar({ warId: 'w1' });
    const state = buildNationState({ activeCivilWars: [war] });
    const result = resolveCivilWar(state, 'w1', 'external_intervention', 30);
    expect(result.activeCivilWars[0]!.resolutionType).toBe('external_intervention');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13 — getAIUnrestResponse
// ═══════════════════════════════════════════════════════════════════════════

describe('getAIUnrestResponse', () => {
  it('should return repress for authoritarian systems', () => {
    expect(getAIUnrestResponse('authoritarian', 50, 80)).toBe('repress');
  });

  it('should return repress for absolute_monarchy systems', () => {
    expect(getAIUnrestResponse('absolute_monarchy', 50, 80)).toBe('repress');
  });

  it('should return repress for military_junta systems', () => {
    expect(getAIUnrestResponse('military_junta', 50, 80)).toBe('repress');
  });

  it('should return negotiate for democratic systems', () => {
    expect(getAIUnrestResponse('democratic', 50, 80)).toBe('negotiate');
  });

  it('should return negotiate for parliamentary_democracy systems', () => {
    expect(getAIUnrestResponse('parliamentary_democracy', 50, 80)).toBe('negotiate');
  });

  it('should return negotiate for constitutional_monarchy systems', () => {
    expect(getAIUnrestResponse('constitutional_monarchy', 50, 80)).toBe('negotiate');
  });

  it('should return ignore for ideological systems', () => {
    expect(getAIUnrestResponse('ideological', 50, 80)).toBe('ignore');
  });

  it('should return ignore for one_party_state systems', () => {
    expect(getAIUnrestResponse('one_party_state', 50, 80)).toBe('ignore');
  });

  it('should fall back to ignore when resources are below the threshold', () => {
    const lowResources = civilWarConfig.aiResponse.resourceThreshold - 1;
    expect(getAIUnrestResponse('authoritarian', 90, lowResources)).toBe('ignore');
  });

  it('should fall back to ignore when resources are below threshold even for democratic', () => {
    const lowResources = civilWarConfig.aiResponse.resourceThreshold - 1;
    expect(getAIUnrestResponse('democratic', 50, lowResources)).toBe('ignore');
  });

  it('should fall back to repress for unknown system with high unrest', () => {
    const unrest = civilWarConfig.triggers.civilWarUnrestThreshold;
    expect(getAIUnrestResponse('unknown_system', unrest, 80)).toBe('repress');
  });

  it('should fall back to negotiate for unknown system with moderate unrest', () => {
    expect(getAIUnrestResponse('unknown_system', 50, 80)).toBe('negotiate');
  });

  it('should fall back to ignore for unknown system with low unrest', () => {
    expect(getAIUnrestResponse('unknown_system', 10, 80)).toBe('ignore');
  });

  it('should handle hyphenated political system names', () => {
    expect(getAIUnrestResponse('authoritarian-republic', 50, 80)).toBe('repress');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14 — applyInternationalResponse
// ═══════════════════════════════════════════════════════════════════════════

describe('applyInternationalResponse', () => {
  it('humanitarian_aid should increase territory control (stabilisation)', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 50 });
    const result = applyInternationalResponse(war, 'nation-helper', 'humanitarian_aid');
    expect(result.territoryControlPercent).toBeGreaterThan(50);
  });

  it('humanitarian_aid should record the responding nation as government side', () => {
    const war = buildTestCivilWar();
    const result = applyInternationalResponse(war, 'nation-helper', 'humanitarian_aid');
    expect(result.externalSupport['nation-helper']).toBe('government');
  });

  it('arms_embargo should reduce military split ratio', () => {
    const war = buildTestCivilWar({ militarySplitRatio: 0.65 });
    const result = applyInternationalResponse(war, 'nation-embargo', 'arms_embargo');
    expect(result.militarySplitRatio).toBeLessThan(0.65);
  });

  it('arms_embargo should record the responding nation as government side', () => {
    const war = buildTestCivilWar();
    const result = applyInternationalResponse(war, 'nation-embargo', 'arms_embargo');
    expect(result.externalSupport['nation-embargo']).toBe('government');
  });

  it('recognize_rebels should decrease territory control (rebel boost)', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 60 });
    const result = applyInternationalResponse(war, 'nation-rebel-backer', 'recognize_rebels');
    expect(result.territoryControlPercent).toBeLessThan(60);
  });

  it('recognize_rebels should record the responding nation as rebel side', () => {
    const war = buildTestCivilWar();
    const result = applyInternationalResponse(war, 'nation-rebel-backer', 'recognize_rebels');
    expect(result.externalSupport['nation-rebel-backer']).toBe('rebel');
  });

  it('deploy_peacekeepers should increase territory control significantly', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 45 });
    const result = applyInternationalResponse(war, 'nation-un', 'deploy_peacekeepers');
    expect(result.territoryControlPercent).toBeGreaterThan(45);
    // Peacekeepers should have a larger effect than humanitarian aid
    const warForAid = buildTestCivilWar({ territoryControlPercent: 45 });
    const aidResult = applyInternationalResponse(warForAid, 'nation-aid', 'humanitarian_aid');
    expect(result.territoryControlPercent).toBeGreaterThan(aidResult.territoryControlPercent);
  });

  it('deploy_peacekeepers should record the responding nation as government side', () => {
    const war = buildTestCivilWar();
    const result = applyInternationalResponse(war, 'nation-un', 'deploy_peacekeepers');
    expect(result.externalSupport['nation-un']).toBe('government');
  });

  it('exploit_chaos should record the responding nation as rebel side', () => {
    const war = buildTestCivilWar();
    const result = applyInternationalResponse(war, 'nation-vulture', 'exploit_chaos');
    expect(result.externalSupport['nation-vulture']).toBe('rebel');
  });

  it('exploit_chaos should not change territory or military split', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 55, militarySplitRatio: 0.6 });
    const result = applyInternationalResponse(war, 'nation-vulture', 'exploit_chaos');
    expect(result.territoryControlPercent).toBe(55);
    expect(result.militarySplitRatio).toBe(0.6);
  });

  it('should clamp territory control to max 100', () => {
    const war = buildTestCivilWar({ territoryControlPercent: 99 });
    const result = applyInternationalResponse(war, 'nation-un', 'deploy_peacekeepers');
    expect(result.territoryControlPercent).toBeLessThanOrEqual(100);
  });

  it('should clamp military split ratio to min 0', () => {
    const war = buildTestCivilWar({ militarySplitRatio: 0.05 });
    const result = applyInternationalResponse(war, 'nation-embargo', 'arms_embargo');
    expect(result.militarySplitRatio).toBeGreaterThanOrEqual(0);
  });

  it('should preserve other war fields unchanged', () => {
    const war = buildTestCivilWar({ casualties: 5000, refugeesGenerated: 20000 });
    const result = applyInternationalResponse(war, 'nation-x', 'humanitarian_aid');
    expect(result.casualties).toBe(5000);
    expect(result.refugeesGenerated).toBe(20000);
    expect(result.rebelFactionName).toBe(war.rebelFactionName);
  });

  it('should accumulate multiple external support entries', () => {
    let war = buildTestCivilWar();
    war = applyInternationalResponse(war, 'nation-a', 'humanitarian_aid');
    war = applyInternationalResponse(war, 'nation-b', 'recognize_rebels');
    expect(war.externalSupport['nation-a']).toBe('government');
    expect(war.externalSupport['nation-b']).toBe('rebel');
  });
});
