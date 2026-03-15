/**
 * National Policy System Engine — Test Suite
 *
 * 50+ Vitest tests covering all 13 pure functions in policy-engine.ts.
 *
 * @see FR-5200 — National Policy System
 * @see FR-5201 — Policy lifecycle management
 * @see FR-5202 — Policy cost scaling
 * @see FR-5205 — Policy impact preview
 * @see FR-5206 — Policy status transitions & effectiveness
 * @see FR-5207 — Policy interaction modelling
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  initializeNationalPolicyState,
  proposePolicy,
  enactPolicy,
  suspendPolicy,
  repealPolicy,
  computePolicyCost,
  advancePolicyEffects,
  detectPolicyInteractions,
  getActivePolicies,
  getPoliciesByScope,
  computeAggregateImpact,
  canEnact,
  buildImpactPreview,
} from '@/engine/policy-engine';
import type {
  NationalPolicyState,
  PolicyModel,
  PolicyState,
  PolicyScope,
  PolicyInteraction,
  PolicyProposal,
} from '@/data/types/policy.types';
import { policyConfig } from '@/engine/config/policy';

// ── Test Helpers ────────────────────────────────────────────────────────────

/** Build a valid PolicyModel with sensible defaults, optionally overridden. */
function buildTestPolicy(overrides: Partial<PolicyModel> = {}): PolicyModel {
  return {
    policyId: 'pol-test-001',
    name: 'Test Policy',
    description: 'A policy created for testing purposes.',
    scope: 'domestic',
    targetEntities: ['domestic'],
    dimensionalImpacts: [
      { dimension: 'economy', magnitude: 5, timelineTurns: 10, description: 'Boost economy' },
    ],
    prerequisites: [],
    costPerTurn: 100,
    duration: null,
    effectivenessCurve: [0.2, 0.4, 0.6, 0.8, 1.0],
    narrativeContext: 'Test narrative context.',
    createdBy: 'player',
    createdAtTurn: 1,
    proposalReason: null,
    aiConfidence: null,
    ...overrides,
  };
}

/** Build a NationalPolicyState with an active policy already present. */
function buildStateWithActive(
  policyId = 'pol-active-001',
  overrides: Partial<PolicyState> = {},
): NationalPolicyState {
  const ps: PolicyState = {
    policyId,
    nationId: 'nation-test',
    status: 'active',
    enactedTurn: 1,
    currentEffectiveness: 50,
    turnsActive: 3,
    cumulativeImpact: { economy: 10 },
    ...overrides,
  };
  return {
    nationId: 'nation-test',
    activePolicies: [ps],
    proposedPolicies: [],
    repealedPolicies: [],
    policyHistory: [],
  };
}

/** Build a NationalPolicyState with a proposed policy ready for enactment. */
function buildStateWithProposed(policyId = 'pol-proposed-001'): NationalPolicyState {
  return {
    nationId: 'nation-test',
    activePolicies: [],
    proposedPolicies: [
      {
        policyId,
        source: 'player',
        impactPreview: [
          { dimension: 'economy', magnitude: 5, timelineTurns: 10, description: 'Boost economy' },
        ],
        interactions: [],
        aiRationale: null,
      },
    ],
    repealedPolicies: [],
    policyHistory: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeNationalPolicyState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeNationalPolicyState', () => {
  it('should set the nationId on the returned state', () => {
    const state = initializeNationalPolicyState('nation-alpha');
    expect(state.nationId).toBe('nation-alpha');
  });

  it('should return an empty activePolicies array', () => {
    const state = initializeNationalPolicyState('nation-alpha');
    expect(state.activePolicies).toEqual([]);
  });

  it('should return an empty proposedPolicies array', () => {
    const state = initializeNationalPolicyState('nation-alpha');
    expect(state.proposedPolicies).toEqual([]);
  });

  it('should return an empty repealedPolicies array', () => {
    const state = initializeNationalPolicyState('nation-alpha');
    expect(state.repealedPolicies).toEqual([]);
  });

  it('should return an empty policyHistory array', () => {
    const state = initializeNationalPolicyState('nation-alpha');
    expect(state.policyHistory).toEqual([]);
  });

  it('should work with different nation IDs', () => {
    const s1 = initializeNationalPolicyState('us');
    const s2 = initializeNationalPolicyState('china');
    expect(s1.nationId).toBe('us');
    expect(s2.nationId).toBe('china');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — proposePolicy
// ═══════════════════════════════════════════════════════════════════════════

describe('proposePolicy', () => {
  it('should add a proposal to the proposedPolicies list', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy();
    const result = proposePolicy(state, policy);
    expect(result.proposedPolicies).toHaveLength(1);
  });

  it('should preserve the policyId in the proposal', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy({ policyId: 'pol-custom' });
    const result = proposePolicy(state, policy);
    expect(result.proposedPolicies[0].policyId).toBe('pol-custom');
  });

  it('should record the createdBy as source', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy({ createdBy: 'ai' });
    const result = proposePolicy(state, policy);
    expect(result.proposedPolicies[0].source).toBe('ai');
  });

  it('should include dimensional impacts in the impactPreview', () => {
    const state = initializeNationalPolicyState('nation-test');
    const impacts = [
      { dimension: 'stability', magnitude: 3, timelineTurns: 5, description: 'Stabilize' },
    ];
    const policy = buildTestPolicy({ dimensionalImpacts: impacts });
    const result = proposePolicy(state, policy);
    expect(result.proposedPolicies[0].impactPreview).toEqual(impacts);
  });

  it('should store the proposalReason as aiRationale', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy({ proposalReason: 'Geopolitical necessity' });
    const result = proposePolicy(state, policy);
    expect(result.proposedPolicies[0].aiRationale).toBe('Geopolitical necessity');
  });

  it('should append a history entry with action "proposed"', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy({ policyId: 'pol-hist', createdAtTurn: 5 });
    const result = proposePolicy(state, policy);
    expect(result.policyHistory).toContainEqual({
      policyId: 'pol-hist',
      action: 'proposed',
      turn: 5,
    });
  });

  it('should default turn to 0 when createdAtTurn is null', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy({ createdAtTurn: null });
    const result = proposePolicy(state, policy);
    expect(result.policyHistory[0].turn).toBe(0);
  });

  it('should not mutate the original state', () => {
    const state = initializeNationalPolicyState('nation-test');
    const policy = buildTestPolicy();
    const result = proposePolicy(state, policy);
    expect(state.proposedPolicies).toHaveLength(0);
    expect(result.proposedPolicies).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — enactPolicy
// ═══════════════════════════════════════════════════════════════════════════

describe('enactPolicy', () => {
  it('should move a proposed policy to activePolicies', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 2);
    expect(result.activePolicies).toHaveLength(1);
    expect(result.activePolicies[0].policyId).toBe('pol-a');
  });

  it('should remove the policy from proposedPolicies', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 2);
    expect(result.proposedPolicies).toHaveLength(0);
  });

  it('should set the new PolicyState status to active', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 2);
    expect(result.activePolicies[0].status).toBe('active');
  });

  it('should set enactedTurn to the provided turn', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 7);
    expect(result.activePolicies[0].enactedTurn).toBe(7);
  });

  it('should initialize effectiveness and turnsActive to zero', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 2);
    expect(result.activePolicies[0].currentEffectiveness).toBe(0);
    expect(result.activePolicies[0].turnsActive).toBe(0);
  });

  it('should append a history entry with action "enacted"', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 3);
    expect(result.policyHistory).toContainEqual({
      policyId: 'pol-a',
      action: 'enacted',
      turn: 3,
    });
  });

  it('should throw if policyId is not found in proposed', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(() => enactPolicy(state, 'nonexistent', 1)).toThrow(
      "Cannot enact policy 'nonexistent': not found in proposed policies",
    );
  });

  it('should set nationId on the new PolicyState', () => {
    const state = buildStateWithProposed('pol-a');
    const result = enactPolicy(state, 'pol-a', 2);
    expect(result.activePolicies[0].nationId).toBe('nation-test');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — suspendPolicy
// ═══════════════════════════════════════════════════════════════════════════

describe('suspendPolicy', () => {
  it('should set the policy status to suspended', () => {
    const state = buildStateWithActive('pol-s');
    const result = suspendPolicy(state, 'pol-s', 5);
    const suspended = result.activePolicies.find((p) => p.policyId === 'pol-s');
    expect(suspended?.status).toBe('suspended');
  });

  it('should keep the policy in the activePolicies array', () => {
    const state = buildStateWithActive('pol-s');
    const result = suspendPolicy(state, 'pol-s', 5);
    expect(result.activePolicies).toHaveLength(1);
  });

  it('should append a history entry with action "suspended"', () => {
    const state = buildStateWithActive('pol-s');
    const result = suspendPolicy(state, 'pol-s', 5);
    expect(result.policyHistory).toContainEqual({
      policyId: 'pol-s',
      action: 'suspended',
      turn: 5,
    });
  });

  it('should throw if policyId is not found in active', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(() => suspendPolicy(state, 'nonexistent', 1)).toThrow(
      "Cannot suspend policy 'nonexistent': not found in active policies",
    );
  });

  it('should not mutate the original state', () => {
    const state = buildStateWithActive('pol-s');
    suspendPolicy(state, 'pol-s', 5);
    expect(state.activePolicies[0].status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — repealPolicy
// ═══════════════════════════════════════════════════════════════════════════

describe('repealPolicy', () => {
  it('should move the policy from activePolicies to repealedPolicies', () => {
    const state = buildStateWithActive('pol-r');
    const result = repealPolicy(state, 'pol-r', 8);
    expect(result.activePolicies).toHaveLength(0);
    expect(result.repealedPolicies).toHaveLength(1);
  });

  it('should set the repealed policy status to "repealed"', () => {
    const state = buildStateWithActive('pol-r');
    const result = repealPolicy(state, 'pol-r', 8);
    expect(result.repealedPolicies[0].status).toBe('repealed');
  });

  it('should preserve policyId on the repealed entry', () => {
    const state = buildStateWithActive('pol-r');
    const result = repealPolicy(state, 'pol-r', 8);
    expect(result.repealedPolicies[0].policyId).toBe('pol-r');
  });

  it('should append a history entry with action "repealed"', () => {
    const state = buildStateWithActive('pol-r');
    const result = repealPolicy(state, 'pol-r', 8);
    expect(result.policyHistory).toContainEqual({
      policyId: 'pol-r',
      action: 'repealed',
      turn: 8,
    });
  });

  it('should throw if policyId is not found in active', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(() => repealPolicy(state, 'ghost', 1)).toThrow(
      "Cannot repeal policy 'ghost': not found in active policies",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — computePolicyCost
// ═══════════════════════════════════════════════════════════════════════════

describe('computePolicyCost', () => {
  it('should apply domesticCostFactor (×1.0) for domestic policies', () => {
    const policy = buildTestPolicy({ scope: 'domestic', costPerTurn: 100 });
    const cost = computePolicyCost(policy);
    expect(cost).toBe(100 * policyConfig.costs.baseCostMultiplier * policyConfig.costs.domesticCostFactor);
  });

  it('should apply bilateralCostFactor (×1.5) for bilateral policies', () => {
    const policy = buildTestPolicy({ scope: 'bilateral', costPerTurn: 100 });
    const cost = computePolicyCost(policy);
    expect(cost).toBe(100 * policyConfig.costs.baseCostMultiplier * policyConfig.costs.bilateralCostFactor);
  });

  it('should apply multilateralCostFactor (×2.5) for multilateral policies', () => {
    const policy = buildTestPolicy({ scope: 'multilateral', costPerTurn: 100 });
    const cost = computePolicyCost(policy);
    expect(cost).toBe(100 * policyConfig.costs.baseCostMultiplier * policyConfig.costs.multilateralCostFactor);
  });

  it('should scale linearly with costPerTurn', () => {
    const p1 = buildTestPolicy({ scope: 'domestic', costPerTurn: 50 });
    const p2 = buildTestPolicy({ scope: 'domestic', costPerTurn: 200 });
    expect(computePolicyCost(p2)).toBe(computePolicyCost(p1) * 4);
  });

  it('should return 0 when costPerTurn is 0', () => {
    const policy = buildTestPolicy({ costPerTurn: 0 });
    expect(computePolicyCost(policy)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — advancePolicyEffects
// ═══════════════════════════════════════════════════════════════════════════

describe('advancePolicyEffects', () => {
  it('should increase effectiveness for active policies', () => {
    const state = buildStateWithActive('pol-adv', { currentEffectiveness: 10 });
    const result = advancePolicyEffects(state, 2);
    expect(result.activePolicies[0].currentEffectiveness).toBeGreaterThan(10);
  });

  it('should cap effectiveness at maxEffectiveness', () => {
    const state = buildStateWithActive('pol-cap', {
      currentEffectiveness: policyConfig.lifecycle.maxEffectiveness,
    });
    const result = advancePolicyEffects(state, 5);
    expect(result.activePolicies[0].currentEffectiveness).toBeLessThanOrEqual(
      policyConfig.lifecycle.maxEffectiveness,
    );
  });

  it('should increment turnsActive by 1 for active policies', () => {
    const state = buildStateWithActive('pol-t', { turnsActive: 5 });
    const result = advancePolicyEffects(state, 6);
    expect(result.activePolicies[0].turnsActive).toBe(6);
  });

  it('should not advance suspended policies', () => {
    const state = buildStateWithActive('pol-susp', {
      status: 'suspended',
      currentEffectiveness: 20,
      turnsActive: 3,
    });
    const result = advancePolicyEffects(state, 4);
    expect(result.activePolicies[0].turnsActive).toBe(3);
    expect(result.activePolicies[0].currentEffectiveness).toBe(20);
  });

  it('should return a new state object (immutability)', () => {
    const state = buildStateWithActive('pol-imm');
    const result = advancePolicyEffects(state, 2);
    expect(result).not.toBe(state);
  });

  it('should grow effectiveness by growthRate × maxEffectiveness per turn', () => {
    const { effectivenessGrowthRate, maxEffectiveness } = policyConfig.lifecycle;
    const state = buildStateWithActive('pol-growth', { currentEffectiveness: 0 });
    const result = advancePolicyEffects(state, 1);
    expect(result.activePolicies[0].currentEffectiveness).toBe(
      effectivenessGrowthRate * maxEffectiveness,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — detectPolicyInteractions
// ═══════════════════════════════════════════════════════════════════════════

describe('detectPolicyInteractions', () => {
  it('should detect a conflict when two policies have opposing signs on the same dimension', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      name: 'Expand Military',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: -5, timelineTurns: 5, description: 'Destabilize' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      name: 'Peace Accord',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: 10, timelineTurns: 5, description: 'Stabilize' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions).toHaveLength(1);
    expect(interactions[0].interactionType).toBe('conflict');
  });

  it('should detect a synergy when two policies have same-sign impacts on a dimension', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      name: 'STEM Initiative',
      dimensionalImpacts: [
        { dimension: 'education', magnitude: 8, timelineTurns: 10, description: 'Boost ed.' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      name: 'Literacy Campaign',
      dimensionalImpacts: [
        { dimension: 'education', magnitude: 4, timelineTurns: 5, description: 'Literacy boost' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions).toHaveLength(1);
    expect(interactions[0].interactionType).toBe('synergy');
  });

  it('should return an empty array when policies share no dimensions', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 5, timelineTurns: 5, description: 'Econ' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      dimensionalImpacts: [
        { dimension: 'technology', magnitude: 3, timelineTurns: 5, description: 'Tech' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions).toHaveLength(0);
  });

  it('should return an empty array for a single policy', () => {
    const interactions = detectPolicyInteractions([buildTestPolicy()]);
    expect(interactions).toHaveLength(0);
  });

  it('should return an empty array for an empty policy list', () => {
    const interactions = detectPolicyInteractions([]);
    expect(interactions).toHaveLength(0);
  });

  it('should detect interactions across more than two policies', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      name: 'PolicyA',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: 5, timelineTurns: 5, description: '+stability' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      name: 'PolicyB',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: -3, timelineTurns: 5, description: '-stability' },
      ],
    });
    const pC = buildTestPolicy({
      policyId: 'pol-c',
      name: 'PolicyC',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: 7, timelineTurns: 5, description: '+stability' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB, pC]);
    // A↔B conflict, A↔C synergy, B↔C conflict
    const conflicts = interactions.filter((i) => i.interactionType === 'conflict');
    const synergies = interactions.filter((i) => i.interactionType === 'synergy');
    expect(conflicts.length).toBe(2);
    expect(synergies.length).toBe(1);
  });

  it('should include the correct policyIdA and policyIdB on interactions', () => {
    const pA = buildTestPolicy({
      policyId: 'first',
      name: 'First',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 5, timelineTurns: 5, description: 'Econ' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'second',
      name: 'Second',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 3, timelineTurns: 5, description: 'Econ' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions[0].policyIdA).toBe('first');
    expect(interactions[0].policyIdB).toBe('second');
  });

  it('should assign maxConflictPenalty as impactModifier for conflicts', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      name: 'A',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 5, timelineTurns: 5, description: '+econ' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      name: 'B',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: -3, timelineTurns: 5, description: '-econ' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions[0].impactModifier).toBe(policyConfig.interactions.maxConflictPenalty);
  });

  it('should assign maxSynergyBonus as impactModifier for synergies', () => {
    const pA = buildTestPolicy({
      policyId: 'pol-a',
      name: 'A',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 5, timelineTurns: 5, description: '+econ' },
      ],
    });
    const pB = buildTestPolicy({
      policyId: 'pol-b',
      name: 'B',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 3, timelineTurns: 5, description: '+econ' },
      ],
    });
    const interactions = detectPolicyInteractions([pA, pB]);
    expect(interactions[0].impactModifier).toBe(policyConfig.interactions.maxSynergyBonus);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — getActivePolicies
// ═══════════════════════════════════════════════════════════════════════════

describe('getActivePolicies', () => {
  it('should return only policies with status "active"', () => {
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [
        { policyId: 'a', nationId: 'nation-test', status: 'active', enactedTurn: 1, currentEffectiveness: 50, turnsActive: 2, cumulativeImpact: {} },
        { policyId: 'b', nationId: 'nation-test', status: 'suspended', enactedTurn: 1, currentEffectiveness: 30, turnsActive: 3, cumulativeImpact: {} },
        { policyId: 'c', nationId: 'nation-test', status: 'active', enactedTurn: 2, currentEffectiveness: 10, turnsActive: 1, cumulativeImpact: {} },
      ],
      proposedPolicies: [],
      repealedPolicies: [],
      policyHistory: [],
    };
    const active = getActivePolicies(state);
    expect(active).toHaveLength(2);
    expect(active.every((p) => p.status === 'active')).toBe(true);
  });

  it('should return an empty array when no active policies exist', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(getActivePolicies(state)).toEqual([]);
  });

  it('should exclude suspended policies', () => {
    const state = buildStateWithActive('pol-s', { status: 'suspended' });
    expect(getActivePolicies(state)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getPoliciesByScope
// ═══════════════════════════════════════════════════════════════════════════

describe('getPoliciesByScope', () => {
  it('should return active policies when filtering by domestic scope', () => {
    const state = buildStateWithActive('pol-dom');
    const result = getPoliciesByScope(state, 'domestic');
    expect(result).toHaveLength(1);
  });

  it('should return active policies when filtering by bilateral scope', () => {
    const state = buildStateWithActive('pol-bil');
    const result = getPoliciesByScope(state, 'bilateral');
    expect(result).toHaveLength(1);
  });

  it('should return active policies when filtering by multilateral scope', () => {
    const state = buildStateWithActive('pol-mul');
    const result = getPoliciesByScope(state, 'multilateral');
    expect(result).toHaveLength(1);
  });

  it('should exclude suspended policies regardless of scope', () => {
    const state = buildStateWithActive('pol-susp', { status: 'suspended' });
    const result = getPoliciesByScope(state, 'domestic');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no active policies exist', () => {
    const state = initializeNationalPolicyState('nation-test');
    const result = getPoliciesByScope(state, 'domestic');
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — computeAggregateImpact
// ═══════════════════════════════════════════════════════════════════════════

describe('computeAggregateImpact', () => {
  it('should sum impacts scaled by effectiveness for active policies', () => {
    const maxEff = policyConfig.lifecycle.maxEffectiveness;
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [
        {
          policyId: 'p1',
          nationId: 'nation-test',
          status: 'active',
          enactedTurn: 1,
          currentEffectiveness: maxEff,
          turnsActive: 5,
          cumulativeImpact: { economy: 20, stability: 10 },
        },
      ],
      proposedPolicies: [],
      repealedPolicies: [],
      policyHistory: [],
    };
    const agg = computeAggregateImpact(state);
    expect(agg.economy).toBe(20);
    expect(agg.stability).toBe(10);
  });

  it('should scale impacts by effectiveness ratio', () => {
    const maxEff = policyConfig.lifecycle.maxEffectiveness;
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [
        {
          policyId: 'p1',
          nationId: 'nation-test',
          status: 'active',
          enactedTurn: 1,
          currentEffectiveness: maxEff / 2,
          turnsActive: 5,
          cumulativeImpact: { economy: 40 },
        },
      ],
      proposedPolicies: [],
      repealedPolicies: [],
      policyHistory: [],
    };
    const agg = computeAggregateImpact(state);
    expect(agg.economy).toBe(20); // 40 × 0.5
  });

  it('should sum across multiple active policies', () => {
    const maxEff = policyConfig.lifecycle.maxEffectiveness;
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [
        {
          policyId: 'p1',
          nationId: 'nation-test',
          status: 'active',
          enactedTurn: 1,
          currentEffectiveness: maxEff,
          turnsActive: 5,
          cumulativeImpact: { economy: 10 },
        },
        {
          policyId: 'p2',
          nationId: 'nation-test',
          status: 'active',
          enactedTurn: 2,
          currentEffectiveness: maxEff,
          turnsActive: 3,
          cumulativeImpact: { economy: 15, stability: 5 },
        },
      ],
      proposedPolicies: [],
      repealedPolicies: [],
      policyHistory: [],
    };
    const agg = computeAggregateImpact(state);
    expect(agg.economy).toBe(25);
    expect(agg.stability).toBe(5);
  });

  it('should ignore suspended policies', () => {
    const maxEff = policyConfig.lifecycle.maxEffectiveness;
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [
        {
          policyId: 'p1',
          nationId: 'nation-test',
          status: 'suspended',
          enactedTurn: 1,
          currentEffectiveness: maxEff,
          turnsActive: 5,
          cumulativeImpact: { economy: 100 },
        },
      ],
      proposedPolicies: [],
      repealedPolicies: [],
      policyHistory: [],
    };
    const agg = computeAggregateImpact(state);
    expect(agg.economy).toBeUndefined();
  });

  it('should return an empty record when no active policies exist', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(computeAggregateImpact(state)).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — canEnact
// ═══════════════════════════════════════════════════════════════════════════

describe('canEnact', () => {
  it('should return true when the policy is in proposed list', () => {
    const state = buildStateWithProposed('pol-ready');
    expect(canEnact(state, 'pol-ready')).toBe(true);
  });

  it('should return false when the policy is not in proposed list', () => {
    const state = initializeNationalPolicyState('nation-test');
    expect(canEnact(state, 'nonexistent')).toBe(false);
  });

  it('should return false for a policy that is active, not proposed', () => {
    const state = buildStateWithActive('pol-active');
    expect(canEnact(state, 'pol-active')).toBe(false);
  });

  it('should distinguish between multiple proposed policies', () => {
    const state: NationalPolicyState = {
      nationId: 'nation-test',
      activePolicies: [],
      proposedPolicies: [
        { policyId: 'alpha', source: 'player', impactPreview: [], interactions: [], aiRationale: null },
        { policyId: 'beta', source: 'ai', impactPreview: [], interactions: [], aiRationale: null },
      ],
      repealedPolicies: [],
      policyHistory: [],
    };
    expect(canEnact(state, 'alpha')).toBe(true);
    expect(canEnact(state, 'beta')).toBe(true);
    expect(canEnact(state, 'gamma')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13 — buildImpactPreview
// ═══════════════════════════════════════════════════════════════════════════

describe('buildImpactPreview', () => {
  it('should return a PolicyProposal with the correct policyId', () => {
    const policy = buildTestPolicy({ policyId: 'pol-preview' });
    const proposal = buildImpactPreview(policy, []);
    expect(proposal.policyId).toBe('pol-preview');
  });

  it('should set source from the policy createdBy field', () => {
    const policy = buildTestPolicy({ createdBy: 'ai' });
    const proposal = buildImpactPreview(policy, []);
    expect(proposal.source).toBe('ai');
  });

  it('should include dimensionalImpacts as impactPreview', () => {
    const impacts = [
      { dimension: 'economy', magnitude: 10, timelineTurns: 5, description: 'Boost' },
    ];
    const policy = buildTestPolicy({ dimensionalImpacts: impacts });
    const proposal = buildImpactPreview(policy, []);
    expect(proposal.impactPreview).toEqual(impacts);
  });

  it('should detect interactions with existing policies', () => {
    const existing = buildTestPolicy({
      policyId: 'existing-001',
      name: 'Existing',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: -5, timelineTurns: 5, description: 'Drag economy' },
      ],
    });
    const newPolicy = buildTestPolicy({
      policyId: 'new-001',
      name: 'New',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 10, timelineTurns: 5, description: 'Boost economy' },
      ],
    });
    const proposal = buildImpactPreview(newPolicy, [existing]);
    expect(proposal.interactions).toHaveLength(1);
    expect(proposal.interactions[0].interactionType).toBe('conflict');
  });

  it('should return only interactions involving the proposed policy', () => {
    const existA = buildTestPolicy({
      policyId: 'exist-a',
      name: 'ExistA',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: 5, timelineTurns: 5, description: '+econ' },
      ],
    });
    const existB = buildTestPolicy({
      policyId: 'exist-b',
      name: 'ExistB',
      dimensionalImpacts: [
        { dimension: 'economy', magnitude: -3, timelineTurns: 5, description: '-econ' },
      ],
    });
    const newPolicy = buildTestPolicy({
      policyId: 'new-pol',
      name: 'NewPol',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: 5, timelineTurns: 5, description: '+stability' },
      ],
    });
    const proposal = buildImpactPreview(newPolicy, [existA, existB]);
    // existA↔existB conflict should be excluded because it doesn't involve new-pol
    expect(proposal.interactions.every(
      (i) => i.policyIdA === 'new-pol' || i.policyIdB === 'new-pol',
    )).toBe(true);
  });

  it('should return empty interactions when no shared dimensions exist', () => {
    const existing = buildTestPolicy({
      policyId: 'exist',
      dimensionalImpacts: [
        { dimension: 'technology', magnitude: 5, timelineTurns: 5, description: 'Tech' },
      ],
    });
    const newPolicy = buildTestPolicy({
      policyId: 'new',
      dimensionalImpacts: [
        { dimension: 'stability', magnitude: 5, timelineTurns: 5, description: 'Stability' },
      ],
    });
    const proposal = buildImpactPreview(newPolicy, [existing]);
    expect(proposal.interactions).toEqual([]);
  });

  it('should set aiRationale from policy proposalReason', () => {
    const policy = buildTestPolicy({ proposalReason: 'Strategic necessity' });
    const proposal = buildImpactPreview(policy, []);
    expect(proposal.aiRationale).toBe('Strategic necessity');
  });

  it('should set aiRationale to null when proposalReason is null', () => {
    const policy = buildTestPolicy({ proposalReason: null });
    const proposal = buildImpactPreview(policy, []);
    expect(proposal.aiRationale).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration — Full lifecycle flow
// ═══════════════════════════════════════════════════════════════════════════

describe('policy lifecycle integration', () => {
  it('should support a full propose → enact → advance → suspend → repeal lifecycle', () => {
    const policy = buildTestPolicy({ policyId: 'lifecycle-pol' });

    // Initialize
    let state = initializeNationalPolicyState('nation-lc');
    expect(state.activePolicies).toHaveLength(0);

    // Propose
    state = proposePolicy(state, policy);
    expect(state.proposedPolicies).toHaveLength(1);
    expect(canEnact(state, 'lifecycle-pol')).toBe(true);

    // Enact
    state = enactPolicy(state, 'lifecycle-pol', 1);
    expect(state.activePolicies).toHaveLength(1);
    expect(state.proposedPolicies).toHaveLength(0);
    expect(canEnact(state, 'lifecycle-pol')).toBe(false);

    // Advance a few turns
    state = advancePolicyEffects(state, 2);
    state = advancePolicyEffects(state, 3);
    expect(state.activePolicies[0].turnsActive).toBe(2);
    expect(state.activePolicies[0].currentEffectiveness).toBeGreaterThan(0);

    // Suspend
    state = suspendPolicy(state, 'lifecycle-pol', 4);
    expect(state.activePolicies[0].status).toBe('suspended');

    // Repeal
    state = repealPolicy(state, 'lifecycle-pol', 5);
    expect(state.activePolicies).toHaveLength(0);
    expect(state.repealedPolicies).toHaveLength(1);

    // Verify complete history
    expect(state.policyHistory).toHaveLength(4); // proposed, enacted, suspended, repealed
  });

  it('should produce correct aggregate impact after multi-turn advancement', () => {
    const maxEff = policyConfig.lifecycle.maxEffectiveness;
    const policy = buildTestPolicy({ policyId: 'agg-pol' });

    let state = initializeNationalPolicyState('nation-agg');
    state = proposePolicy(state, policy);
    state = enactPolicy(state, 'agg-pol', 1);

    // Advance several turns to build effectiveness
    for (let t = 2; t <= 10; t++) {
      state = advancePolicyEffects(state, t);
    }

    // Policy should have advanced 9 turns, effectiveness growing each turn
    expect(state.activePolicies[0].turnsActive).toBe(9);
    expect(state.activePolicies[0].currentEffectiveness).toBeGreaterThan(0);
    expect(state.activePolicies[0].currentEffectiveness).toBeLessThanOrEqual(maxEff);
  });
});
