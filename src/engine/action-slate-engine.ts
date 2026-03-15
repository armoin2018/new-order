/**
 * Multi-Action Turn System Engine — FR-5000
 *
 * Pure functions for composing, validating, and resolving multi-action
 * turn slates: initialisation, CRUD, cost scaling, interaction detection,
 * commitment, resolution, and AI priority generation.
 *
 * **No side effects** — every function returns a new object.
 *
 * @see FR-5001 — Action slate composition and validation
 * @see FR-5002 — Interaction effect detection (synergy / conflict)
 * @see FR-5003 — AI action prioritisation
 * @see FR-5004 — Interaction effect detection (same-nation / same-dimension)
 * @see FR-5005 — Simultaneous action resolution and turn summary
 */

import type {
  ActionSlate,
  ActionDefinition,
  ActionId,
  InteractionEffect,
  ActionResolutionResult,
  TurnActionSummary,
} from '@/data/types/action-slate.types';
import { actionSlateConfig } from '@/engine/config/action-slate';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeActionSlate                                       FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an empty {@link ActionSlate} for a nation and turn.
 *
 * @param nationId — The nation that owns this slate.
 * @param turnNumber — Turn the slate belongs to.
 * @param maxActions — Optional override for the maximum actions allowed
 *   (defaults to {@link actionSlateConfig.limits.defaultMaxActions}).
 * @returns A fresh, uncommitted action slate with no actions.
 * @see FR-5001
 */
export function initializeActionSlate(
  nationId: string,
  turnNumber: number,
  maxActions?: number,
): ActionSlate {
  const max = maxActions ?? actionSlateConfig.limits.defaultMaxActions;
  return {
    nationId,
    turnNumber,
    actions: [],
    maxActions: Math.min(max, actionSlateConfig.limits.maxConfigurableActions),
    interactionEffects: [],
    committed: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — addAction                                                   FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append an {@link ActionDefinition} to the slate.
 *
 * @param slate — Current action slate.
 * @param action — The action to add.
 * @returns A new slate with the action appended.
 * @throws {Error} If the slate is committed or already at capacity.
 * @see FR-5001
 */
export function addAction(slate: ActionSlate, action: ActionDefinition): ActionSlate {
  if (slate.committed) {
    throw new Error('Cannot add action: slate is already committed');
  }
  if (!canAddAction(slate)) {
    throw new Error(
      `Cannot add action: slate is full (${slate.actions.length}/${slate.maxActions})`,
    );
  }
  return {
    ...slate,
    actions: [...slate.actions, action],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — removeAction                                                FR-5002
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove an action from the slate by its {@link ActionId}.
 *
 * @param slate — Current action slate.
 * @param actionId — Identifier of the action to remove.
 * @returns A new slate without the specified action.
 * @throws {Error} If the slate is committed or the action is not found.
 * @see FR-5002
 */
export function removeAction(slate: ActionSlate, actionId: ActionId): ActionSlate {
  if (slate.committed) {
    throw new Error('Cannot remove action: slate is already committed');
  }
  const idx = slate.actions.findIndex((a) => a.actionId === actionId);
  if (idx === -1) {
    throw new Error(`Cannot remove action: action '${actionId}' not found in slate`);
  }
  return {
    ...slate,
    actions: slate.actions.filter((a) => a.actionId !== actionId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — reorderActions                                              FR-5002
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reorder the actions within a slate according to an explicit ID sequence.
 *
 * Every ID in `orderedIds` must exist in the slate and the array must
 * contain exactly the same set of IDs (no additions, no removals).
 *
 * @param slate — Current action slate.
 * @param orderedIds — Desired ordering expressed as an array of action IDs.
 * @returns A new slate with actions reordered.
 * @throws {Error} If the slate is committed or the ID sets do not match.
 * @see FR-5002
 */
export function reorderActions(slate: ActionSlate, orderedIds: ActionId[]): ActionSlate {
  if (slate.committed) {
    throw new Error('Cannot reorder actions: slate is already committed');
  }

  const existing = new Set(slate.actions.map((a) => a.actionId));
  const incoming = new Set(orderedIds);

  if (existing.size !== incoming.size || !Array.from(existing).every((id) => incoming.has(id))) {
    throw new Error('Cannot reorder actions: provided IDs do not match the slate actions');
  }

  const actionMap = new Map(slate.actions.map((a) => [a.actionId, a]));
  const reordered = orderedIds.map((id) => actionMap.get(id)!);

  return {
    ...slate,
    actions: reordered,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — computeActionCost                                           FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the effective resource cost for an action at a given slate index,
 * applying the incremental scaling factor for actions beyond the third slot.
 *
 * Formula:
 * ```
 * extraSlots = max(0, actionIndex - 2)
 * multiplier = baseCostMultiplier + extraSlots × additionalActionCostScaling
 * cost       = baseResourceCost × multiplier
 * ```
 *
 * @param baseResourceCost — The action's base resource cost.
 * @param actionIndex — Zero-based position of the action within the slate.
 * @returns Scaled resource cost.
 * @see FR-5001
 */
export function computeActionCost(baseResourceCost: number, actionIndex: number): number {
  const extraSlots = Math.max(0, actionIndex - 2);
  const multiplier =
    actionSlateConfig.costs.baseCostMultiplier +
    extraSlots * actionSlateConfig.costs.additionalActionCostScaling;
  return baseResourceCost * multiplier;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — detectInteractionEffects                                    FR-5004
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scan an array of actions for pairwise interaction effects.
 *
 * Two actions targeting the **same nation** are compared:
 * - If one is `'economic'` and the other is `'diplomatic'`, a **conflict**
 *   is flagged (e.g. sanctions vs trade deal) with the configured
 *   credibility penalty as the impact modifier.
 * - If both target the same dimension, a **synergy** is flagged with the
 *   configured synergy modifier.
 * - Otherwise the pair is **neutral** and omitted from results.
 *
 * @param actions — Actions to evaluate (typically from a single slate).
 * @returns Array of detected {@link InteractionEffect} objects.
 * @see FR-5004
 */
export function detectInteractionEffects(actions: ActionDefinition[]): InteractionEffect[] {
  const effects: InteractionEffect[] = [];

  for (let i = 0; i < actions.length; i++) {
    for (let j = i + 1; j < actions.length; j++) {
      const a = actions[i]!;
      const b = actions[j]!;

      // Only compare actions targeting the same nation
      if (a.targetNation !== b.targetNation) continue;

      // Conflict: economic + diplomatic targeting the same nation
      const typePair = new Set([a.actionType, b.actionType]);
      if (typePair.has('economic') && typePair.has('diplomatic')) {
        effects.push({
          actionIdA: a.actionId,
          actionIdB: b.actionId,
          effectType: 'conflict',
          description:
            `Conflict: '${a.actionType}' action and '${b.actionType}' action both target ` +
            `${a.targetNation} — credibility penalty applies`,
          impactModifier: actionSlateConfig.interactions.credibilityPenalty,
        });
        continue;
      }

      // Synergy: same target dimension (when both specify one)
      if (
        a.targetDimension !== null &&
        b.targetDimension !== null &&
        a.targetDimension === b.targetDimension
      ) {
        effects.push({
          actionIdA: a.actionId,
          actionIdB: b.actionId,
          effectType: 'synergy',
          description:
            `Synergy: both actions target '${a.targetDimension}' dimension of ` +
            `${a.targetNation} — combined impact bonus`,
          impactModifier: actionSlateConfig.interactions.synergySanctionTrade,
        });
      }
    }
  }

  return effects;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — commitSlate                                                 FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark a slate as committed (locked for resolution) and recompute
 * interaction effects for the final action set.
 *
 * @param slate — Current action slate.
 * @returns A new slate with `committed: true` and fresh interaction effects.
 * @throws {Error} If the slate is already committed or has no actions.
 * @see FR-5001
 */
export function commitSlate(slate: ActionSlate): ActionSlate {
  if (slate.committed) {
    throw new Error('Cannot commit slate: already committed');
  }
  if (slate.actions.length < actionSlateConfig.limits.minActions) {
    throw new Error(
      `Cannot commit slate: at least ${actionSlateConfig.limits.minActions} action(s) required`,
    );
  }

  const interactionEffects = detectInteractionEffects(slate.actions);

  return {
    ...slate,
    committed: true,
    interactionEffects,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — resolveActions                                              FR-5005
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve all actions within a committed slate, producing an
 * {@link ActionResolutionResult} for each action.
 *
 * **Simplified resolution**: every action succeeds and its estimated impact
 * is used as the actual impact. Interaction-effect modifiers are applied
 * additively to every affected dimension.
 *
 * @param slate — A committed action slate.
 * @returns Array of resolution results, one per action.
 * @throws {Error} If the slate has not been committed.
 * @see FR-5005
 */
export function resolveActions(slate: ActionSlate): ActionResolutionResult[] {
  if (!slate.committed) {
    throw new Error('Cannot resolve actions: slate has not been committed');
  }

  // Build a modifier map: actionId → total impact modifier from interactions
  const modifierMap = new Map<string, number>();
  for (const effect of slate.interactionEffects) {
    modifierMap.set(
      effect.actionIdA,
      (modifierMap.get(effect.actionIdA) ?? 0) + effect.impactModifier,
    );
    modifierMap.set(
      effect.actionIdB,
      (modifierMap.get(effect.actionIdB) ?? 0) + effect.impactModifier,
    );
  }

  return slate.actions.map((action) => {
    const modifier = modifierMap.get(action.actionId) ?? 0;

    // Apply interaction modifier additively to each dimension
    const actualImpact: Record<string, number> = {};
    for (const [dim, value] of Object.entries(action.estimatedImpact) as [string, number][]) {
      actualImpact[dim] = value + modifier;
    }

    return {
      actionId: action.actionId,
      success: true,
      actualImpact,
      narrativeSummary:
        `[${action.actionType}] ${action.label} targeting ${action.targetNation} — ` +
        `resolved successfully`,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — buildTurnSummary                                            FR-5005
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate all nations' resolution results into a single
 * {@link TurnActionSummary}.
 *
 * Each nation's aggregate impact is the per-dimension sum of all its
 * resolved actions' actual impacts.
 *
 * @param turnNumber — The turn these results belong to.
 * @param nationSlates — Committed slates for every nation this turn.
 * @returns A complete turn summary with per-nation breakdowns.
 * @see FR-5005
 */
export function buildTurnSummary(
  turnNumber: number,
  nationSlates: ActionSlate[],
): TurnActionSummary {
  const nationSummaries = nationSlates.map((slate) => {
    const actions = resolveActions(slate);

    const aggregateImpact: Record<string, number> = {};
    for (const result of actions) {
      for (const [dim, value] of Object.entries(result.actualImpact) as [string, number][]) {
        aggregateImpact[dim] = (aggregateImpact[dim] ?? 0) + value;
      }
    }

    return {
      nationId: slate.nationId,
      actions,
      aggregateImpact,
    };
  });

  return {
    turnNumber,
    nationSummaries,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — canAddAction                                               FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether another action can be added to the slate.
 *
 * @param slate — Current action slate.
 * @returns `true` if the slate is not committed and below its max capacity.
 * @see FR-5001
 */
export function canAddAction(slate: ActionSlate): boolean {
  return !slate.committed && slate.actions.length < slate.maxActions;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — getSlateResourceTotal                                      FR-5001
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the total resource cost of every action in the slate, including
 * the incremental scaling applied to actions beyond slot 3.
 *
 * @param slate — Current action slate.
 * @returns Sum of scaled resource costs.
 * @see FR-5001
 */
export function getSlateResourceTotal(slate: ActionSlate): number {
  return slate.actions.reduce(
    (total, action, index) => total + computeActionCost(action.resourceCost, index),
    0,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — generateAIActionPriorities                                 FR-5003
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate normalised priority weights for AI action selection based on a
 * nation's current dimension scores and the configured prioritisation
 * weights.
 *
 * Lower dimension scores receive proportionally higher priority so the AI
 * focuses on its weakest areas.
 *
 * Formula per dimension `d`:
 * ```
 * rawWeight(d) = configWeight(d) × (1 - clamp(dimensionScore(d), 0, 100) / 100)
 * priority(d)  = rawWeight(d) / sum(rawWeights)
 * ```
 *
 * @param dimensions — Current dimension scores keyed by name (0–100 range).
 * @returns Normalised priority weights keyed by dimension name (sum ≈ 1).
 * @see FR-5003
 */
export function generateAIActionPriorities(
  dimensions: Record<string, number>,
): Record<string, number> {
  const configWeights = actionSlateConfig.ai.prioritizationWeights;
  const rawWeights: Record<string, number> = {};
  let sum = 0;

  for (const [dim, configWeight] of Object.entries(configWeights) as [string, number][]) {
    const score = dimensions[dim] ?? 50; // default to midpoint if missing
    const clampedScore = Math.min(100, Math.max(0, score));
    const raw = configWeight * (1 - clampedScore / 100);
    rawWeights[dim] = raw;
    sum += raw;
  }

  // Normalise so weights sum to 1 (guard against all-zero edge case)
  const priorities: Record<string, number> = {};
  if (sum === 0) {
    const keys = Object.keys(rawWeights);
    const uniform = keys.length > 0 ? 1 / keys.length : 0;
    for (const key of keys) {
      priorities[key] = uniform;
    }
  } else {
    for (const [dim, raw] of Object.entries(rawWeights)) {
      priorities[dim] = raw / sum;
    }
  }

  return priorities;
}
