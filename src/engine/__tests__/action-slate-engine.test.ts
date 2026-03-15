/**
 * Multi-Action Turn System Engine — Unit Tests
 *
 * Covers all 12 exported functions from action-slate-engine.ts:
 *   initializeActionSlate, addAction, removeAction, reorderActions,
 *   computeActionCost, detectInteractionEffects, commitSlate,
 *   resolveActions, buildTurnSummary, canAddAction,
 *   getSlateResourceTotal, generateAIActionPriorities.
 *
 * @see FR-5000 — Multi-Action Turn System
 */

import { describe, it, expect } from 'vitest';

import {
  initializeActionSlate,
  addAction,
  removeAction,
  reorderActions,
  computeActionCost,
  detectInteractionEffects,
  commitSlate,
  resolveActions,
  buildTurnSummary,
  canAddAction,
  getSlateResourceTotal,
  generateAIActionPriorities,
} from '@/engine/action-slate-engine';

import type {
  ActionSlate,
  ActionDefinition,
  ActionId,
} from '@/data/types/action-slate.types';

import { actionSlateConfig } from '@/engine/config/action-slate';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Create a minimal ActionDefinition with sensible defaults. */
function makeAction(overrides: Partial<ActionDefinition> & { actionId: ActionId }): ActionDefinition {
  return {
    actionType: 'economic',
    targetNation: 'nation-a',
    targetDimension: null,
    parameters: {},
    estimatedImpact: { economy: 10 },
    resourceCost: 100,
    priority: 3,
    label: 'Test Action',
    description: 'A test action',
    ...overrides,
  };
}

/** Shorthand for casting a plain string to ActionId. */
function aid(id: string): ActionId {
  return id as ActionId;
}

// ---------------------------------------------------------------------------
// 1 — initializeActionSlate
// ---------------------------------------------------------------------------

describe('initializeActionSlate', () => {
  it('should return a slate with an empty actions array', () => {
    const slate = initializeActionSlate('us', 1);
    expect(slate.actions).toEqual([]);
  });

  it('should set the correct nationId', () => {
    const slate = initializeActionSlate('us', 1);
    expect(slate.nationId).toBe('us');
  });

  it('should set the correct turnNumber', () => {
    const slate = initializeActionSlate('us', 5);
    expect(slate.turnNumber).toBe(5);
  });

  it('should default maxActions to the config default', () => {
    const slate = initializeActionSlate('us', 1);
    expect(slate.maxActions).toBe(actionSlateConfig.limits.defaultMaxActions);
  });

  it('should accept a custom maxActions override', () => {
    const slate = initializeActionSlate('us', 1, 3);
    expect(slate.maxActions).toBe(3);
  });

  it('should clamp maxActions to maxConfigurableActions', () => {
    const slate = initializeActionSlate('us', 1, 999);
    expect(slate.maxActions).toBe(actionSlateConfig.limits.maxConfigurableActions);
  });

  it('should start with committed = false', () => {
    const slate = initializeActionSlate('us', 1);
    expect(slate.committed).toBe(false);
  });

  it('should start with empty interactionEffects', () => {
    const slate = initializeActionSlate('us', 1);
    expect(slate.interactionEffects).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2 — addAction
// ---------------------------------------------------------------------------

describe('addAction', () => {
  it('should append an action to the slate', () => {
    const slate = initializeActionSlate('us', 1);
    const action = makeAction({ actionId: aid('act-1') });
    const result = addAction(slate, action);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.actionId).toBe('act-1');
  });

  it('should not mutate the original slate', () => {
    const slate = initializeActionSlate('us', 1);
    const action = makeAction({ actionId: aid('act-1') });
    const result = addAction(slate, action);
    expect(slate.actions).toHaveLength(0);
    expect(result).not.toBe(slate);
  });

  it('should allow adding up to maxActions', () => {
    let slate = initializeActionSlate('us', 1, 2);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = addAction(slate, makeAction({ actionId: aid('act-2') }));
    expect(slate.actions).toHaveLength(2);
  });

  it('should throw when slate is full', () => {
    let slate = initializeActionSlate('us', 1, 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    expect(() => addAction(slate, makeAction({ actionId: aid('act-2') }))).toThrow(/full/);
  });

  it('should throw when slate is committed', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    expect(() => addAction(slate, makeAction({ actionId: aid('act-2') }))).toThrow(/committed/);
  });
});

// ---------------------------------------------------------------------------
// 3 — removeAction
// ---------------------------------------------------------------------------

describe('removeAction', () => {
  it('should remove the specified action', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = addAction(slate, makeAction({ actionId: aid('act-2') }));
    const result = removeAction(slate, aid('act-1'));
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.actionId).toBe('act-2');
  });

  it('should not mutate the original slate', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    const result = removeAction(slate, aid('act-1'));
    expect(slate.actions).toHaveLength(1);
    expect(result).not.toBe(slate);
  });

  it('should throw when action is not found', () => {
    const slate = initializeActionSlate('us', 1);
    expect(() => removeAction(slate, aid('nonexistent'))).toThrow(/not found/);
  });

  it('should throw when slate is committed', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    expect(() => removeAction(slate, aid('act-1'))).toThrow(/committed/);
  });
});

// ---------------------------------------------------------------------------
// 4 — reorderActions
// ---------------------------------------------------------------------------

describe('reorderActions', () => {
  it('should reorder actions according to the provided ID sequence', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-a'), label: 'A' }));
    slate = addAction(slate, makeAction({ actionId: aid('act-b'), label: 'B' }));
    slate = addAction(slate, makeAction({ actionId: aid('act-c'), label: 'C' }));

    const reordered = reorderActions(slate, [aid('act-c'), aid('act-a'), aid('act-b')]);
    expect(reordered.actions.map((a) => a.actionId)).toEqual(['act-c', 'act-a', 'act-b']);
  });

  it('should not mutate the original slate', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-a') }));
    slate = addAction(slate, makeAction({ actionId: aid('act-b') }));
    const result = reorderActions(slate, [aid('act-b'), aid('act-a')]);
    expect(slate.actions[0]!.actionId).toBe('act-a');
    expect(result).not.toBe(slate);
  });

  it('should throw when IDs do not match slate actions', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-a') }));
    expect(() => reorderActions(slate, [aid('act-z')])).toThrow(/do not match/);
  });

  it('should throw when slate is committed', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-a') }));
    slate = commitSlate(slate);
    expect(() => reorderActions(slate, [aid('act-a')])).toThrow(/committed/);
  });
});

// ---------------------------------------------------------------------------
// 5 — computeActionCost
// ---------------------------------------------------------------------------

describe('computeActionCost', () => {
  it('should return base cost for index 0 (first action)', () => {
    expect(computeActionCost(100, 0)).toBe(100);
  });

  it('should return base cost for index 1 (second action)', () => {
    expect(computeActionCost(100, 1)).toBe(100);
  });

  it('should return base cost for index 2 (third action)', () => {
    expect(computeActionCost(100, 2)).toBe(100);
  });

  it('should apply +15% scaling for index 3 (fourth action)', () => {
    // extraSlots = max(0, 3 - 2) = 1 → multiplier = 1.0 + 1 × 0.15 = 1.15
    expect(computeActionCost(100, 3)).toBeCloseTo(115);
  });

  it('should apply +30% scaling for index 4 (fifth action)', () => {
    // extraSlots = max(0, 4 - 2) = 2 → multiplier = 1.0 + 2 × 0.15 = 1.3
    expect(computeActionCost(100, 4)).toBeCloseTo(130);
  });

  it('should scale linearly for higher indices', () => {
    // extraSlots = 3 → multiplier = 1.0 + 3 × 0.15 = 1.45
    expect(computeActionCost(100, 5)).toBeCloseTo(145);
  });

  it('should handle zero base cost', () => {
    expect(computeActionCost(0, 4)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6 — detectInteractionEffects
// ---------------------------------------------------------------------------

describe('detectInteractionEffects', () => {
  it('should detect a conflict between economic and diplomatic actions targeting the same nation', () => {
    const actions: ActionDefinition[] = [
      makeAction({ actionId: aid('act-e'), actionType: 'economic', targetNation: 'china' }),
      makeAction({ actionId: aid('act-d'), actionType: 'diplomatic', targetNation: 'china' }),
    ];
    const effects = detectInteractionEffects(actions);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.effectType).toBe('conflict');
    expect(effects[0]!.impactModifier).toBe(actionSlateConfig.interactions.credibilityPenalty);
  });

  it('should detect a synergy when both actions target the same dimension of the same nation', () => {
    const actions: ActionDefinition[] = [
      makeAction({
        actionId: aid('act-1'),
        actionType: 'military',
        targetNation: 'russia',
        targetDimension: 'defense',
      }),
      makeAction({
        actionId: aid('act-2'),
        actionType: 'military',
        targetNation: 'russia',
        targetDimension: 'defense',
      }),
    ];
    const effects = detectInteractionEffects(actions);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.effectType).toBe('synergy');
    expect(effects[0]!.impactModifier).toBe(actionSlateConfig.interactions.synergySanctionTrade);
  });

  it('should return no effects for actions targeting different nations', () => {
    const actions: ActionDefinition[] = [
      makeAction({ actionId: aid('act-1'), actionType: 'economic', targetNation: 'china' }),
      makeAction({ actionId: aid('act-2'), actionType: 'diplomatic', targetNation: 'india' }),
    ];
    const effects = detectInteractionEffects(actions);
    expect(effects).toHaveLength(0);
  });

  it('should return no effects for an empty action list', () => {
    expect(detectInteractionEffects([])).toEqual([]);
  });

  it('should return no effects for a single action', () => {
    const actions = [makeAction({ actionId: aid('act-1') })];
    expect(detectInteractionEffects(actions)).toEqual([]);
  });

  it('should return neutral (no effect) for same-nation actions that are neither economic/diplomatic nor same-dimension', () => {
    const actions: ActionDefinition[] = [
      makeAction({
        actionId: aid('act-1'),
        actionType: 'military',
        targetNation: 'iran',
        targetDimension: 'defense',
      }),
      makeAction({
        actionId: aid('act-2'),
        actionType: 'intelligence',
        targetNation: 'iran',
        targetDimension: 'cyber',
      }),
    ];
    const effects = detectInteractionEffects(actions);
    expect(effects).toHaveLength(0);
  });

  it('should detect multiple interactions in a three-action set', () => {
    const actions: ActionDefinition[] = [
      makeAction({ actionId: aid('act-1'), actionType: 'economic', targetNation: 'china' }),
      makeAction({ actionId: aid('act-2'), actionType: 'diplomatic', targetNation: 'china' }),
      makeAction({
        actionId: aid('act-3'),
        actionType: 'military',
        targetNation: 'china',
        targetDimension: null,
      }),
    ];
    const effects = detectInteractionEffects(actions);
    // economic + diplomatic → conflict; the military action has no shared dim and isn't eco/diplo pair
    expect(effects.length).toBeGreaterThanOrEqual(1);
    expect(effects.some((e) => e.effectType === 'conflict')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7 — commitSlate
// ---------------------------------------------------------------------------

describe('commitSlate', () => {
  it('should mark the slate as committed', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    const committed = commitSlate(slate);
    expect(committed.committed).toBe(true);
  });

  it('should recompute interaction effects on commit', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(
      slate,
      makeAction({ actionId: aid('act-e'), actionType: 'economic', targetNation: 'iran' }),
    );
    slate = addAction(
      slate,
      makeAction({ actionId: aid('act-d'), actionType: 'diplomatic', targetNation: 'iran' }),
    );
    const committed = commitSlate(slate);
    expect(committed.interactionEffects).toHaveLength(1);
    expect(committed.interactionEffects[0]!.effectType).toBe('conflict');
  });

  it('should not mutate the original slate', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    const committed = commitSlate(slate);
    expect(slate.committed).toBe(false);
    expect(committed).not.toBe(slate);
  });

  it('should throw when committing an already-committed slate', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    expect(() => commitSlate(slate)).toThrow(/already committed/);
  });

  it('should throw when committing an empty slate', () => {
    const slate = initializeActionSlate('us', 1);
    expect(() => commitSlate(slate)).toThrow(/required/);
  });
});

// ---------------------------------------------------------------------------
// 8 — resolveActions
// ---------------------------------------------------------------------------

describe('resolveActions', () => {
  it('should return a result for each action in the slate', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = addAction(slate, makeAction({ actionId: aid('act-2') }));
    slate = commitSlate(slate);
    const results = resolveActions(slate);
    expect(results).toHaveLength(2);
  });

  it('should mark every action as successful', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    const results = resolveActions(slate);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('should use estimated impact as actual impact when no interactions exist', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(
      slate,
      makeAction({ actionId: aid('act-1'), estimatedImpact: { economy: 15 } }),
    );
    slate = commitSlate(slate);
    const results = resolveActions(slate);
    expect(results[0]!.actualImpact).toEqual({ economy: 15 });
  });

  it('should apply interaction modifiers additively to actual impact', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(
      slate,
      makeAction({
        actionId: aid('act-e'),
        actionType: 'economic',
        targetNation: 'china',
        estimatedImpact: { economy: 20 },
      }),
    );
    slate = addAction(
      slate,
      makeAction({
        actionId: aid('act-d'),
        actionType: 'diplomatic',
        targetNation: 'china',
        estimatedImpact: { diplomacy: 10 },
      }),
    );
    slate = commitSlate(slate);
    const results = resolveActions(slate);
    const penalty = actionSlateConfig.interactions.credibilityPenalty;
    // economic action: economy dim = 20 + penalty
    expect(results[0]!.actualImpact.economy).toBe(20 + penalty);
    // diplomatic action: diplomacy dim = 10 + penalty
    expect(results[1]!.actualImpact.diplomacy).toBe(10 + penalty);
  });

  it('should throw when resolving an uncommitted slate', () => {
    const slate = initializeActionSlate('us', 1);
    expect(() => resolveActions(slate)).toThrow(/not been committed/);
  });
});

// ---------------------------------------------------------------------------
// 9 — buildTurnSummary
// ---------------------------------------------------------------------------

describe('buildTurnSummary', () => {
  it('should set the correct turnNumber', () => {
    let slateA = initializeActionSlate('us', 3);
    slateA = addAction(slateA, makeAction({ actionId: aid('a-1') }));
    slateA = commitSlate(slateA);
    const summary = buildTurnSummary(3, [slateA]);
    expect(summary.turnNumber).toBe(3);
  });

  it('should include a nation summary for each slate', () => {
    let slateA = initializeActionSlate('us', 1);
    slateA = addAction(slateA, makeAction({ actionId: aid('a-1') }));
    slateA = commitSlate(slateA);

    let slateB = initializeActionSlate('china', 1);
    slateB = addAction(slateB, makeAction({ actionId: aid('b-1') }));
    slateB = commitSlate(slateB);

    const summary = buildTurnSummary(1, [slateA, slateB]);
    expect(summary.nationSummaries).toHaveLength(2);
    expect(summary.nationSummaries.map((ns) => ns.nationId)).toEqual(['us', 'china']);
  });

  it('should aggregate impacts across multiple actions for a single nation', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(
      slate,
      makeAction({ actionId: aid('a-1'), estimatedImpact: { economy: 10, military: 5 } }),
    );
    slate = addAction(
      slate,
      makeAction({ actionId: aid('a-2'), estimatedImpact: { economy: 7 } }),
    );
    slate = commitSlate(slate);
    const summary = buildTurnSummary(1, [slate]);
    const agg = summary.nationSummaries[0]!.aggregateImpact;
    expect(agg.economy).toBe(17);
    expect(agg.military).toBe(5);
  });

  it('should handle an empty array of slates', () => {
    const summary = buildTurnSummary(1, []);
    expect(summary.nationSummaries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10 — canAddAction
// ---------------------------------------------------------------------------

describe('canAddAction', () => {
  it('should return true when slate is empty', () => {
    const slate = initializeActionSlate('us', 1);
    expect(canAddAction(slate)).toBe(true);
  });

  it('should return true when slate is under capacity', () => {
    let slate = initializeActionSlate('us', 1, 3);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    expect(canAddAction(slate)).toBe(true);
  });

  it('should return false when slate is at capacity', () => {
    let slate = initializeActionSlate('us', 1, 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    expect(canAddAction(slate)).toBe(false);
  });

  it('should return false when slate is committed', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    expect(canAddAction(slate)).toBe(false);
  });

  it('should return false when slate is both full and committed', () => {
    let slate = initializeActionSlate('us', 1, 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1') }));
    slate = commitSlate(slate);
    expect(canAddAction(slate)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11 — getSlateResourceTotal
// ---------------------------------------------------------------------------

describe('getSlateResourceTotal', () => {
  it('should return 0 for an empty slate', () => {
    const slate = initializeActionSlate('us', 1);
    expect(getSlateResourceTotal(slate)).toBe(0);
  });

  it('should return the base cost for a single action', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('act-1'), resourceCost: 200 }));
    expect(getSlateResourceTotal(slate)).toBe(200);
  });

  it('should sum costs for three actions with no scaling', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('a-1'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-2'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-3'), resourceCost: 100 }));
    // All at 1.0 multiplier → 300
    expect(getSlateResourceTotal(slate)).toBe(300);
  });

  it('should apply scaling from the fourth action onward', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('a-1'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-2'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-3'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-4'), resourceCost: 100 }));
    // 100 + 100 + 100 + 115 = 415
    expect(getSlateResourceTotal(slate)).toBeCloseTo(415);
  });

  it('should apply cumulative scaling for five actions', () => {
    let slate = initializeActionSlate('us', 1);
    slate = addAction(slate, makeAction({ actionId: aid('a-1'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-2'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-3'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-4'), resourceCost: 100 }));
    slate = addAction(slate, makeAction({ actionId: aid('a-5'), resourceCost: 100 }));
    // 100 + 100 + 100 + 115 + 130 = 545
    expect(getSlateResourceTotal(slate)).toBeCloseTo(545);
  });
});

// ---------------------------------------------------------------------------
// 12 — generateAIActionPriorities
// ---------------------------------------------------------------------------

describe('generateAIActionPriorities', () => {
  it('should return priorities that sum to approximately 1', () => {
    const dimensions = { military: 50, economic: 50, diplomatic: 50, intelligence: 50, policy: 50 };
    const priorities = generateAIActionPriorities(dimensions);
    const sum = Object.values(priorities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('should give higher priority to lower-scored dimensions', () => {
    const dimensions = { military: 10, economic: 90, diplomatic: 50, intelligence: 50, policy: 50 };
    const priorities = generateAIActionPriorities(dimensions);
    expect(priorities.military).toBeGreaterThan(priorities.economic);
  });

  it('should use midpoint default for missing dimensions', () => {
    // All config keys get a score of 50 by default when missing
    const priorities = generateAIActionPriorities({});
    const sum = Object.values(priorities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('should handle all dimensions at 100 (edge case: uniform distribution)', () => {
    const dimensions = { military: 100, economic: 100, diplomatic: 100, intelligence: 100, policy: 100, humanitarian: 100, technology: 100, propaganda: 100 };
    const priorities = generateAIActionPriorities(dimensions);
    // rawWeight = configWeight × (1 - 1) = 0 for all → uniform fallback
    const values = Object.values(priorities);
    const expected = 1 / values.length;
    for (const v of values) {
      expect(v).toBeCloseTo(expected);
    }
  });

  it('should handle all dimensions at 0 (max priority for all)', () => {
    const dimensions = { military: 0, economic: 0, diplomatic: 0, intelligence: 0, policy: 0, humanitarian: 0, technology: 0, propaganda: 0 };
    const priorities = generateAIActionPriorities(dimensions);
    const sum = Object.values(priorities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    // Priorities should match config weights exactly since (1 - 0/100) = 1
    const totalWeight = Object.values(actionSlateConfig.ai.prioritizationWeights).reduce(
      (a, b) => a + b,
      0,
    );
    expect(priorities.military).toBeCloseTo(
      actionSlateConfig.ai.prioritizationWeights.military / totalWeight,
    );
  });

  it('should clamp negative dimension scores to 0', () => {
    const dimensions = { military: -50, economic: 50, diplomatic: 50, intelligence: 50, policy: 50 };
    const priorities = generateAIActionPriorities(dimensions);
    // military is clamped to 0 → gets full config weight
    expect(priorities.military).toBeGreaterThan(priorities.economic);
  });

  it('should clamp dimension scores above 100 to 100', () => {
    const dimensions = { military: 200, economic: 50, diplomatic: 50, intelligence: 50, policy: 50 };
    const priorities = generateAIActionPriorities(dimensions);
    // military clamped to 100 → rawWeight = 0 for military (or near-zero priority)
    expect(priorities.military).toBeLessThan(priorities.economic);
  });

  it('should return keys matching the config prioritization weights', () => {
    const priorities = generateAIActionPriorities({});
    const expectedKeys = Object.keys(actionSlateConfig.ai.prioritizationWeights).sort();
    expect(Object.keys(priorities).sort()).toEqual(expectedKeys);
  });
});
