/**
 * National Policy System Engine — FR-5200
 *
 * Pure functions for managing national policies: proposing, enacting,
 * suspending, repealing, cost computation, effectiveness advancement,
 * interaction detection, and impact aggregation.
 *
 * **No side effects** — all state transitions return new objects.
 *
 * @see FR-5200 — National Policy System
 * @see FR-5201 — Policy lifecycle management
 * @see FR-5202 — Policy cost scaling
 * @see FR-5205 — Policy impact preview
 * @see FR-5206 — Policy status transitions & effectiveness
 * @see FR-5207 — Policy interaction modelling
 */

import type {
  NationalPolicyState,
  PolicyModel,
  PolicyState,
  PolicyScope,
  PolicyInteraction,
  PolicyProposal,
} from '@/data/types/policy.types';
import { policyConfig } from '@/engine/config/policy';
import { getPolicyModelById } from '@/engine/config/default-policies';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeNationalPolicyState                               FR-5201
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh {@link NationalPolicyState} with no policies.
 *
 * @param nationId — The nation this state belongs to.
 * @returns An empty national policy state ready for {@link proposePolicy}.
 * @see FR-5201
 */
export function initializeNationalPolicyState(nationId: string): NationalPolicyState {
  return {
    nationId,
    activePolicies: [],
    proposedPolicies: [],
    repealedPolicies: [],
    policyHistory: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — proposePolicy                                               FR-5201
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add a policy to the nation's proposed list, building a
 * {@link PolicyProposal} with an impact preview.
 *
 * @param state — Current national policy state.
 * @param policy — The policy model being proposed.
 * @returns Updated state with the new proposal appended.
 * @see FR-5201
 */
export function proposePolicy(
  state: NationalPolicyState,
  policy: PolicyModel,
): NationalPolicyState {
  const existingModels = state.activePolicies.map((ps) => ps.policyId);
  // Build a lightweight proposal — full interaction detection uses models,
  // but here we store the preview for the proposal record.
  const proposal: PolicyProposal = {
    policyId: policy.policyId,
    source: policy.createdBy,
    impactPreview: policy.dimensionalImpacts,
    interactions: [],
    aiRationale: policy.proposalReason,
  };

  return {
    ...state,
    proposedPolicies: [...state.proposedPolicies, proposal],
    policyHistory: [
      ...state.policyHistory,
      { policyId: policy.policyId, action: 'proposed', turn: policy.createdAtTurn ?? 0 },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — enactPolicy                                                 FR-5206
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move a policy from the proposed list to the active list, creating
 * an initial {@link PolicyState}.
 *
 * @param state — Current national policy state.
 * @param policyId — ID of the proposed policy to enact.
 * @param turn — Turn at which the policy is enacted.
 * @returns Updated state with the policy now active.
 * @throws {Error} If the policy is not found in the proposed list.
 * @see FR-5206
 */
export function enactPolicy(
  state: NationalPolicyState,
  policyId: string,
  turn: number,
): NationalPolicyState {
  const proposalIndex = state.proposedPolicies.findIndex((p) => p.policyId === policyId);
  if (proposalIndex === -1) {
    throw new Error(`Cannot enact policy '${policyId}': not found in proposed policies`);
  }

  const newPolicyState: PolicyState = {
    policyId,
    nationId: state.nationId,
    status: 'active',
    enactedTurn: turn,
    currentEffectiveness: 0,
    turnsActive: 0,
    cumulativeImpact: {},
  };

  return {
    ...state,
    proposedPolicies: state.proposedPolicies.filter((_, i) => i !== proposalIndex),
    activePolicies: [...state.activePolicies, newPolicyState],
    policyHistory: [
      ...state.policyHistory,
      { policyId, action: 'enacted', turn },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — suspendPolicy                                               FR-5206
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Suspend an active policy, setting its status to `suspended`.
 *
 * @param state — Current national policy state.
 * @param policyId — ID of the active policy to suspend.
 * @param turn — Turn at which the suspension occurs.
 * @returns Updated state with the policy suspended.
 * @throws {Error} If the policy is not found in the active list.
 * @see FR-5206
 */
export function suspendPolicy(
  state: NationalPolicyState,
  policyId: string,
  turn: number,
): NationalPolicyState {
  const policyIndex = state.activePolicies.findIndex((p) => p.policyId === policyId);
  if (policyIndex === -1) {
    throw new Error(`Cannot suspend policy '${policyId}': not found in active policies`);
  }

  const updatedPolicies = state.activePolicies.map((p) =>
    p.policyId === policyId ? { ...p, status: 'suspended' as const } : p,
  );

  return {
    ...state,
    activePolicies: updatedPolicies,
    policyHistory: [
      ...state.policyHistory,
      { policyId, action: 'suspended', turn },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — repealPolicy                                                FR-5206
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Repeal an active or suspended policy, moving it to the repealed list.
 *
 * @param state — Current national policy state.
 * @param policyId — ID of the policy to repeal.
 * @param turn — Turn at which the repeal occurs.
 * @returns Updated state with the policy moved to repealed.
 * @throws {Error} If the policy is not found in the active list.
 * @see FR-5206
 */
export function repealPolicy(
  state: NationalPolicyState,
  policyId: string,
  turn: number,
): NationalPolicyState {
  const policy = state.activePolicies.find((p) => p.policyId === policyId);
  if (!policy) {
    throw new Error(`Cannot repeal policy '${policyId}': not found in active policies`);
  }

  const repealedPolicy: PolicyState = {
    ...policy,
    status: 'repealed',
  };

  return {
    ...state,
    activePolicies: state.activePolicies.filter((p) => p.policyId !== policyId),
    repealedPolicies: [...state.repealedPolicies, repealedPolicy],
    policyHistory: [
      ...state.policyHistory,
      { policyId, action: 'repealed', turn },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — computePolicyCost                                           FR-5202
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the effective per-turn cost of a policy by applying scope-based
 * multipliers from {@link policyConfig}.
 *
 * Formula:
 * ```
 * cost = costPerTurn × baseCostMultiplier × scopeFactor
 * ```
 *
 * @param policy — The policy model.
 * @returns Computed cost per turn.
 * @see FR-5202
 */
export function computePolicyCost(policy: PolicyModel): number {
  const { baseCostMultiplier, domesticCostFactor, bilateralCostFactor, multilateralCostFactor } =
    policyConfig.costs;

  const scopeFactors: Record<PolicyScope, number> = {
    domestic: domesticCostFactor,
    bilateral: bilateralCostFactor,
    multilateral: multilateralCostFactor,
  };

  const scopeFactor = scopeFactors[policy.scope] ?? 1.0;
  return policy.costPerTurn * baseCostMultiplier * scopeFactor;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — advancePolicyEffects                                        FR-5206
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Advance all active policies by one turn: grow effectiveness and
 * accumulate dimensional impacts.
 *
 * Active policies gain effectiveness at
 * {@link policyConfig.lifecycle.effectivenessGrowthRate} per turn, capped at
 * {@link policyConfig.lifecycle.maxEffectiveness}.
 *
 * @param state — Current national policy state.
 * @param turn — The current turn number.
 * @returns Updated state with advanced policy effects.
 * @see FR-5206
 */
export function advancePolicyEffects(
  state: NationalPolicyState,
  turn: number,
): NationalPolicyState {
  const { effectivenessGrowthRate, effectivenessDecayRate, maxEffectiveness } =
    policyConfig.lifecycle;

  const updatedPolicies = state.activePolicies.map((ps) => {
    if (ps.status !== 'active') return ps;

    // Grow effectiveness toward the cap
    const newEffectiveness = Math.min(
      maxEffectiveness,
      ps.currentEffectiveness + effectivenessGrowthRate * maxEffectiveness,
    );

    const newTurnsActive = ps.turnsActive + 1;

    // Accumulate impact scaled by current effectiveness ratio
    const effectivenessRatio = newEffectiveness / maxEffectiveness;
    const updatedImpact = { ...ps.cumulativeImpact };

    // Resolve policy model to get dimensional impact data
    const model = getPolicyModelById(ps.policyId, ps.nationId);
    if (model) {
      for (const di of model.dimensionalImpacts) {
        updatedImpact[di.dimension] = (updatedImpact[di.dimension] ?? 0) + di.magnitude * effectivenessRatio;
      }
    }

    return {
      ...ps,
      currentEffectiveness: newEffectiveness,
      turnsActive: newTurnsActive,
      cumulativeImpact: updatedImpact,
    };
  });

  return {
    ...state,
    activePolicies: updatedPolicies,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — detectPolicyInteractions                                    FR-5207
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect synergies and conflicts between a set of co-active policies.
 *
 * Two policies conflict if they share a dimension where one has a positive
 * magnitude and the other has a negative magnitude. Otherwise, if they share
 * a dimension with the same sign, they are synergistic.
 *
 * @param policies — Array of policy models to compare pair-wise.
 * @returns Array of detected {@link PolicyInteraction} records.
 * @see FR-5207
 */
export function detectPolicyInteractions(policies: PolicyModel[]): PolicyInteraction[] {
  const interactions: PolicyInteraction[] = [];

  for (let i = 0; i < policies.length; i++) {
    for (let j = i + 1; j < policies.length; j++) {
      const a = policies[i];
      const b = policies[j];

      const aDims = new Map(a.dimensionalImpacts.map((d) => [d.dimension, d.magnitude]));
      const bDims = new Map(b.dimensionalImpacts.map((d) => [d.dimension, d.magnitude]));

      // Find shared dimensions
      for (const [dim, aMag] of aDims) {
        const bMag = bDims.get(dim);
        if (bMag === undefined) continue;

        const isConflict = (aMag > 0 && bMag < 0) || (aMag < 0 && bMag > 0);
        const isSynergy = (aMag > 0 && bMag > 0) || (aMag < 0 && bMag < 0);

        if (isConflict) {
          interactions.push({
            policyIdA: a.policyId,
            policyIdB: b.policyId,
            interactionType: 'conflict',
            description: `Conflict on '${dim}': '${a.name}' (${aMag > 0 ? '+' : ''}${aMag}) vs '${b.name}' (${bMag > 0 ? '+' : ''}${bMag})`,
            impactModifier: policyConfig.interactions.maxConflictPenalty,
          });
        } else if (isSynergy) {
          interactions.push({
            policyIdA: a.policyId,
            policyIdB: b.policyId,
            interactionType: 'synergy',
            description: `Synergy on '${dim}': '${a.name}' and '${b.name}' both push ${aMag > 0 ? 'positive' : 'negative'}`,
            impactModifier: policyConfig.interactions.maxSynergyBonus,
          });
        }
      }
    }
  }

  return interactions;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — getActivePolicies                                           FR-5200
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return only the policies with `active` status.
 *
 * @param state — National policy state.
 * @returns Array of active {@link PolicyState} entries.
 * @see FR-5200
 */
export function getActivePolicies(state: NationalPolicyState): PolicyState[] {
  return state.activePolicies.filter((p) => p.status === 'active');
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getPoliciesByScope                                         FR-5200
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter a nation's active policies by their geographic scope.
 *
 * Since {@link PolicyState} does not carry scope directly, this helper
 * matches against policy IDs whose scope would be resolved externally.
 * For convenience it filters on the `status` field being `active` and
 * returns all active entries when no richer scope data is embedded.
 *
 * @param state — National policy state.
 * @param scope — The desired {@link PolicyScope}.
 * @returns Array of matching {@link PolicyState} entries.
 * @see FR-5200
 */
export function getPoliciesByScope(
  state: NationalPolicyState,
  scope: PolicyScope,
): PolicyState[] {
  return state.activePolicies.filter((p) => {
    if (p.status !== 'active') return false;
    const model = getPolicyModelById(p.policyId, state.nationId);
    // If no model found, include the policy (graceful fallback)
    return model ? model.scope === scope : true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — computeAggregateImpact                                    FR-5200
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sum all active policy impacts, scaled by each policy's current
 * effectiveness ratio.
 *
 * Formula per dimension:
 * ```
 * aggregateImpact[dim] += cumulativeImpact[dim] × (effectiveness / max)
 * ```
 *
 * @param state — National policy state.
 * @returns A record mapping dimension names to their aggregate impact.
 * @see FR-5200
 */
export function computeAggregateImpact(
  state: NationalPolicyState,
): Record<string, number> {
  const aggregate: Record<string, number> = {};
  const { maxEffectiveness } = policyConfig.lifecycle;

  for (const ps of state.activePolicies) {
    if (ps.status !== 'active') continue;

    const effectivenessRatio = ps.currentEffectiveness / maxEffectiveness;

    for (const [dim, value] of Object.entries(ps.cumulativeImpact)) {
      aggregate[dim] = (aggregate[dim] ?? 0) + value * effectivenessRatio;
    }
  }

  return aggregate;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — canEnact                                                   FR-5206
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check whether a policy exists in the proposed list and can be enacted.
 *
 * @param state — National policy state.
 * @param policyId — ID of the policy to check.
 * @returns `true` if the policy is present in the proposed list.
 * @see FR-5206
 */
export function canEnact(state: NationalPolicyState, policyId: string): boolean {
  return state.proposedPolicies.some((p) => p.policyId === policyId);
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 — buildImpactPreview                                         FR-5205
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a {@link PolicyProposal} with a full impact preview and interaction
 * detection against the set of currently existing policies.
 *
 * @param policy — The policy model being considered.
 * @param existingPolicies — Currently active policy models for interaction detection.
 * @returns A {@link PolicyProposal} with populated impact and interaction fields.
 * @see FR-5205
 */
export function buildImpactPreview(
  policy: PolicyModel,
  existingPolicies: PolicyModel[],
): PolicyProposal {
  const interactions = detectPolicyInteractions([...existingPolicies, policy]).filter(
    (interaction) =>
      interaction.policyIdA === policy.policyId || interaction.policyIdB === policy.policyId,
  );

  return {
    policyId: policy.policyId,
    source: policy.createdBy,
    impactPreview: policy.dimensionalImpacts,
    interactions,
    aiRationale: policy.proposalReason,
  };
}
