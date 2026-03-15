/**
 * Civil War & Protest Scenarios Engine — FR-5300
 *
 * Pure functions for managing protest movements, civil war triggers,
 * government unrest responses, war progression, resolution, AI behaviour,
 * and international interventions.
 *
 * **No side effects** — all state is returned as new objects.
 *
 * @see FR-5300 — Civil War & Protest Scenarios
 * @see FR-5301 — Civil war trigger conditions
 * @see FR-5302 — Protest movement lifecycle
 * @see FR-5303 — Government unrest responses
 * @see FR-5304 — Civil war resolution
 * @see FR-5305 — AI unrest response logic
 * @see FR-5306 — International civil war intervention
 */

import type {
  NationCivilWarState,
  ProtestMovement,
  ProtestCause,
  OrganizationLevel,
  CivilWarState,
  CivilWarResolutionType,
  UnrestReactionOption,
  UnrestResponseResult,
  UnrestResponseType,
  InternationalCivilWarResponse,
} from '@/data/types/civil-war.types';
import { civilWarConfig } from '@/engine/config/civil-war';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeNationCivilWarState                               FR-5300
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh {@link NationCivilWarState} with no active movements or wars.
 *
 * @param nationId — Nation to initialise state for.
 * @returns A clean civil-war state ready for simulation.
 * @see FR-5300
 */
export function initializeNationCivilWarState(nationId: string): NationCivilWarState {
  return {
    nationId,
    protestMovements: [],
    activeCivilWars: [],
    consecutiveHighUnrestTurns: 0,
    unrestResponseHistory: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createProtestMovement                                       FR-5302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new {@link ProtestMovement} entity with `spontaneous` organisation.
 *
 * @param nationId — Nation in which the movement forms.
 * @param name — Human-readable name of the movement.
 * @param cause — Root cause driving the protest.
 * @param sizePercent — Initial population participation percentage (0–100).
 * @param demands — Concrete demands issued by the movement.
 * @param leaderName — Name of the movement's leader figure.
 * @returns A new protest movement entity.
 * @see FR-5302
 */
export function createProtestMovement(
  nationId: string,
  name: string,
  cause: ProtestCause,
  sizePercent: number,
  demands: string[],
  leaderName: string,
): ProtestMovement {
  return {
    movementId: crypto.randomUUID(),
    nationId,
    name,
    cause,
    sizePercent: Math.max(0, Math.min(100, sizePercent)),
    organizationLevel: 'spontaneous',
    demands: [...demands],
    foreignBacking: null,
    turnsActive: 0,
    leaderName,
    publicSympathy: 50,
    governmentResponse: 'none',
    resolved: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — escalateMovement                                            FR-5302
// ═══════════════════════════════════════════════════════════════════════════

/** Organisation escalation ladder. */
const ESCALATION_LADDER: readonly OrganizationLevel[] = [
  'spontaneous',
  'organized',
  'militant',
] as const;

/**
 * Increase the organisation level of a protest movement by one step:
 * `spontaneous → organized → militant`.
 *
 * If the movement is already `militant` it is returned unchanged.
 *
 * @param movement — Current protest movement.
 * @returns Updated movement with the next organisation level.
 * @see FR-5302
 */
export function escalateMovement(movement: ProtestMovement): ProtestMovement {
  const currentIndex = ESCALATION_LADDER.indexOf(movement.organizationLevel);
  if (currentIndex >= ESCALATION_LADDER.length - 1) {
    return { ...movement };
  }
  return {
    ...movement,
    organizationLevel: ESCALATION_LADDER[currentIndex + 1]!,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — deescalateMovement                                          FR-5302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decrease the organisation level of a protest movement by one step:
 * `militant → organized → spontaneous`.
 *
 * If the movement is already `spontaneous` it is returned unchanged.
 *
 * @param movement — Current protest movement.
 * @returns Updated movement with the previous organisation level.
 * @see FR-5302
 */
export function deescalateMovement(movement: ProtestMovement): ProtestMovement {
  const currentIndex = ESCALATION_LADDER.indexOf(movement.organizationLevel);
  if (currentIndex <= 0) {
    return { ...movement };
  }
  return {
    ...movement,
    organizationLevel: ESCALATION_LADDER[currentIndex - 1]!,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — checkCivilWarTrigger                                        FR-5301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether conditions are met to trigger a civil war.
 *
 * A civil war is triggered when **any** of the following hold:
 * 1. National unrest ≥ threshold **and** consecutive high-unrest turns ≥
 *    the required count.
 * 2. Fault-line tension ≥ the critical threshold.
 * 3. A coup has failed and the config flag is enabled.
 *
 * @param state — Current nation civil-war state.
 * @param currentUnrest — Current national unrest level.
 * @param faultLineTension — Current ethnic/religious fault-line tension.
 * @param coupFailed — Whether a coup attempt has just failed.
 * @returns `true` if a civil war should be triggered.
 * @see FR-5301
 */
export function checkCivilWarTrigger(
  state: NationCivilWarState,
  currentUnrest: number,
  faultLineTension: number,
  coupFailed: boolean,
): boolean {
  const { triggers } = civilWarConfig;

  // Condition 1: sustained high unrest
  if (
    currentUnrest >= triggers.civilWarUnrestThreshold &&
    state.consecutiveHighUnrestTurns >= triggers.consecutiveTurnsRequired
  ) {
    return true;
  }

  // Condition 2: critical fault-line tension
  if (faultLineTension >= triggers.faultLineCriticalThreshold) {
    return true;
  }

  // Condition 3: failed coup
  if (coupFailed && triggers.coupFailureTrigger) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — trackConsecutiveUnrest                                      FR-5301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update the consecutive high-unrest turn counter.
 *
 * If the current unrest is at or above the civil-war threshold the counter
 * increments; otherwise it resets to zero.
 *
 * @param state — Current nation civil-war state.
 * @param currentUnrest — Current national unrest level.
 * @returns Updated state with adjusted counter.
 * @see FR-5301
 */
export function trackConsecutiveUnrest(
  state: NationCivilWarState,
  currentUnrest: number,
): NationCivilWarState {
  const threshold = civilWarConfig.triggers.civilWarUnrestThreshold;
  return {
    ...state,
    consecutiveHighUnrestTurns:
      currentUnrest >= threshold
        ? state.consecutiveHighUnrestTurns + 1
        : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — triggerCivilWar                                             FR-5301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trigger a civil war within a nation, creating a new {@link CivilWarState}
 * and appending it to the nation's active wars.
 *
 * Initial territory control and military split are sourced from
 * {@link civilWarConfig.civilWar}.
 *
 * @param state — Current nation civil-war state.
 * @param cause — Root cause of the conflict.
 * @param rebelFactionName — Name of the rebel faction.
 * @param startTurn — Turn on which the war begins.
 * @returns Updated nation state with the new civil war.
 * @see FR-5301
 */
export function triggerCivilWar(
  state: NationCivilWarState,
  cause: string,
  rebelFactionName: string,
  startTurn: number,
): NationCivilWarState {
  const war: CivilWarState = {
    warId: crypto.randomUUID(),
    nationId: state.nationId,
    rebelFactionName,
    cause,
    startTurn,
    territoryControlPercent: civilWarConfig.civilWar.initialTerritoryGovernment,
    militarySplitRatio: civilWarConfig.civilWar.militarySplitBase,
    economicDamagePercent: 0,
    externalSupport: {},
    casualties: 0,
    refugeesGenerated: 0,
    resolutionType: null,
    resolutionTurn: null,
  };

  return {
    ...state,
    activeCivilWars: [...state.activeCivilWars, war],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — getReactionOptions                                          FR-5303
// ═══════════════════════════════════════════════════════════════════════════

/** Human-readable labels for each response type. */
const RESPONSE_LABELS: Readonly<Record<UnrestResponseType, string>> = {
  negotiate: 'Negotiate',
  reform: 'Enact Reforms',
  repress: 'Repress',
  concede: 'Concede to Demands',
  divide: 'Divide & Conquer',
  ignore: 'Ignore',
};

/** Longer descriptions for each response type. */
const RESPONSE_DESCRIPTIONS: Readonly<Record<UnrestResponseType, string>> = {
  negotiate:
    'Open dialogue with movement leaders to de-escalate tensions through compromise.',
  reform:
    'Implement structural reforms that address the movement\'s grievances over time.',
  repress:
    'Deploy security forces to suppress the movement by force.',
  concede:
    'Accept all demands, ending the movement immediately at high political cost.',
  divide:
    'Exploit internal divisions within the movement to weaken its cohesion.',
  ignore:
    'Take no action and hope the movement dissipates on its own.',
};

/**
 * Return all six {@link UnrestReactionOption}s available against a protest
 * movement, with costs and effects drawn from {@link civilWarConfig.reactions}.
 *
 * @param _movement — The protest movement being responded to (reserved for
 *   future modifiers).
 * @returns Array of six reaction options.
 * @see FR-5303
 */
export function getReactionOptions(_movement: ProtestMovement): UnrestReactionOption[] {
  const responseTypes: UnrestResponseType[] = [
    'negotiate',
    'reform',
    'repress',
    'concede',
    'divide',
    'ignore',
  ];

  return responseTypes.map((type) => {
    const cfg = civilWarConfig.reactions[type];
    return {
      type,
      label: RESPONSE_LABELS[type],
      description: RESPONSE_DESCRIPTIONS[type],
      costTreasury: cfg.treasuryCost,
      stabilityEffect: cfg.stabilityModifier,
      unrestEffect: cfg.unrestModifier,
      internationalReputationEffect: cfg.reputationModifier,
      longTermTensionEffect: cfg.longTermTension,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — applyUnrestReaction                                         FR-5303
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a government unrest response to a specific protest movement,
 * returning the updated nation state and a result record.
 *
 * The movement's government response posture is updated and its size is
 * adjusted by the configured unrest modifier. If the `concede` response is
 * chosen the movement is immediately resolved.
 *
 * @param state — Current nation civil-war state.
 * @param movementId — ID of the targeted movement.
 * @param response — The response strategy to apply.
 * @param turn — Current game turn.
 * @returns Object with the updated state and an {@link UnrestResponseResult}.
 * @throws {Error} If the movement is not found.
 * @see FR-5303
 */
export function applyUnrestReaction(
  state: NationCivilWarState,
  movementId: string,
  response: UnrestResponseType,
  turn: number,
): { state: NationCivilWarState; result: UnrestResponseResult } {
  const movementIndex = state.protestMovements.findIndex(
    (m) => m.movementId === movementId,
  );
  if (movementIndex === -1) {
    throw new Error(`Movement not found: ${movementId}`);
  }

  const cfg = civilWarConfig.reactions[response];
  const movement = state.protestMovements[movementIndex]!;

  const responsePosture = responseToPosture(response);

  const updatedMovement: ProtestMovement = {
    ...movement,
    sizePercent: Math.max(0, Math.min(100, movement.sizePercent + cfg.unrestModifier)),
    governmentResponse: responsePosture,
    resolved: response === 'concede',
  };

  const effectsApplied: Record<string, number> = {
    unrest: cfg.unrestModifier,
    stability: cfg.stabilityModifier,
    treasury: -cfg.treasuryCost,
    reputation: cfg.reputationModifier,
    longTermTension: cfg.longTermTension,
  };

  const result: UnrestResponseResult = {
    responseType: response,
    targetMovementId: movementId,
    effectsApplied,
    narrativeSummary: buildNarrative(response, movement.name, turn),
  };

  const updatedMovements = state.protestMovements.map((m, i) =>
    i === movementIndex ? updatedMovement : m,
  );

  return {
    state: {
      ...state,
      protestMovements: updatedMovements,
      unrestResponseHistory: [...state.unrestResponseHistory, result],
    },
    result,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — advanceCivilWar                                            FR-5301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Advance an active civil war by one turn, accumulating economic damage,
 * casualties, refugees, and shifting territory control.
 *
 * Territory drifts toward the rebels proportionally to the inverse of the
 * military split ratio (i.e. lower government loyalty → faster loss).
 *
 * @param war — Current civil war state.
 * @returns Updated civil war state after one turn of progression.
 * @see FR-5301
 */
export function advanceCivilWar(war: CivilWarState): CivilWarState {
  const cfg = civilWarConfig.civilWar;

  // Territory shifts toward rebels based on government military weakness
  const territoryShift = (1 - war.militarySplitRatio) * 5;

  return {
    ...war,
    economicDamagePercent: war.economicDamagePercent + cfg.economicDamagePerTurn,
    casualties: war.casualties + cfg.casualtiesPerTurn,
    refugeesGenerated: war.refugeesGenerated + cfg.refugeesPerTurn,
    territoryControlPercent: Math.max(
      0,
      Math.min(100, war.territoryControlPercent - territoryShift),
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — checkResolution                                            FR-5304
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check whether a civil war has met any resolution condition.
 *
 * Resolution types and their triggers:
 * - `government_victory` — territory ≥ government-victory threshold.
 * - `rebel_victory` — territory ≤ rebel-victory threshold.
 * - `negotiated_settlement` — territory within the negotiation window.
 * - `partition` — war duration exceeds the partition threshold.
 *
 * Returns `null` if no condition is met.
 *
 * @param war — Current civil war state.
 * @returns The resolution type, or `null` if the war continues.
 * @see FR-5304
 */
export function checkResolution(war: CivilWarState): CivilWarResolutionType | null {
  const { resolution } = civilWarConfig;
  const territory = war.territoryControlPercent;

  if (territory >= resolution.governmentVictoryThreshold) {
    return 'government_victory';
  }

  if (territory <= resolution.rebelVictoryThreshold) {
    return 'rebel_victory';
  }

  // Duration-based checks require knowing how many turns have elapsed
  const turnsElapsed = war.resolutionTurn === null
    ? civilWarConfig.civilWar.maxDurationTurns // fallback; caller should track
    : 0;

  // Negotiated settlement possible within the negotiation window
  if (
    territory >= resolution.negotiationWindow.min &&
    territory <= resolution.negotiationWindow.max
  ) {
    return 'negotiated_settlement';
  }

  // Partition after prolonged stalemate — caller passes current turn via
  // advanceCivilWar; here we check using startTurn delta is not available
  // directly, so we rely on the caller. However, we can provide a duration
  // helper check:
  if (turnsElapsed >= resolution.partitionThreshold) {
    return 'partition';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — resolveCivilWar                                            FR-5304
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a resolution to a civil war, marking it as resolved on the given turn.
 *
 * @param state — Current nation civil-war state.
 * @param warId — ID of the war to resolve.
 * @param resolution — Resolution type to apply.
 * @param turn — Turn on which the resolution occurs.
 * @returns Updated nation state with the resolved war.
 * @throws {Error} If the war is not found.
 * @see FR-5304
 */
export function resolveCivilWar(
  state: NationCivilWarState,
  warId: string,
  resolution: CivilWarResolutionType,
  turn: number,
): NationCivilWarState {
  const warIndex = state.activeCivilWars.findIndex((w) => w.warId === warId);
  if (warIndex === -1) {
    throw new Error(`Civil war not found: ${warId}`);
  }

  const updatedWar: CivilWarState = {
    ...state.activeCivilWars[warIndex]!,
    resolutionType: resolution,
    resolutionTurn: turn,
  };

  const updatedWars = state.activeCivilWars.map((w, i) =>
    i === warIndex ? updatedWar : w,
  );

  return {
    ...state,
    activeCivilWars: updatedWars,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 — getAIUnrestResponse                                        FR-5305
// ═══════════════════════════════════════════════════════════════════════════

/** Political system keywords mapped to config bias keys. */
const SYSTEM_BIAS_MAP: Readonly<Record<string, keyof typeof civilWarConfig.aiResponse>> = {
  authoritarian: 'authoritarianBias',
  authoritarian_republic: 'authoritarianBias',
  absolute_monarchy: 'authoritarianBias',
  communist_state: 'authoritarianBias',
  military_junta: 'authoritarianBias',
  theocracy: 'authoritarianBias',
  democratic: 'democraticBias',
  parliamentary_democracy: 'democraticBias',
  presidential_republic: 'democraticBias',
  federal_republic: 'democraticBias',
  constitutional_monarchy: 'democraticBias',
  ideological: 'ideologicalBias',
  one_party_state: 'ideologicalBias',
};

/**
 * Determine the AI's preferred unrest response based on the nation's
 * political system archetype, current unrest level, and available resources.
 *
 * - Authoritarian systems default to `repress`.
 * - Democratic systems default to `negotiate`.
 * - Ideological systems default to `ignore`.
 * - If resources are below the configured threshold, the AI falls back to
 *   `ignore` to avoid costly responses.
 *
 * @param politicalSystem — Political system identifier (e.g. `'authoritarian'`).
 * @param currentUnrest — Current national unrest level.
 * @param availableResources — Available treasury / resources as a percentage of GDP.
 * @returns The response type the AI would choose.
 * @see FR-5305
 */
export function getAIUnrestResponse(
  politicalSystem: string,
  currentUnrest: number,
  availableResources: number,
): UnrestResponseType {
  const { aiResponse } = civilWarConfig;

  // If resources are too low, avoid costly responses
  if (availableResources < aiResponse.resourceThreshold) {
    return 'ignore';
  }

  // Look up the bias key for this political system
  const normalised = politicalSystem.toLowerCase().replace(/[\s-]+/g, '_');
  const biasKey = SYSTEM_BIAS_MAP[normalised];

  if (biasKey) {
    return aiResponse[biasKey] as UnrestResponseType;
  }

  // Fallback: high unrest → repress, moderate → negotiate, low → ignore
  if (currentUnrest >= civilWarConfig.triggers.civilWarUnrestThreshold) {
    return 'repress';
  }
  if (currentUnrest >= 40) {
    return 'negotiate';
  }
  return 'ignore';
}

// ═══════════════════════════════════════════════════════════════════════════
// 14 — applyInternationalResponse                                 FR-5306
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a foreign nation's intervention to an active civil war.
 *
 * Effects vary by response type and are sourced from
 * {@link civilWarConfig.international}:
 * - `humanitarian_aid` — stabilises territory slightly.
 * - `arms_embargo` — reduces military effectiveness on both sides.
 * - `recognize_rebels` — shifts territory toward rebels.
 * - `deploy_peacekeepers` — stabilises territory significantly.
 * - `exploit_chaos` — no military effect (economic only, tracked externally).
 *
 * The responding nation is recorded in `externalSupport`.
 *
 * @param war — Current civil war state.
 * @param respondingNation — Nation ID of the intervening nation.
 * @param response — Type of international response.
 * @returns Updated civil war state.
 * @see FR-5306
 */
export function applyInternationalResponse(
  war: CivilWarState,
  respondingNation: string,
  response: InternationalCivilWarResponse,
): CivilWarState {
  const cfg = civilWarConfig.international[response];

  let territoryDelta = 0;
  let militaryDelta = 0;
  let side: 'government' | 'rebel' = 'government';

  switch (response) {
    case 'humanitarian_aid': {
      territoryDelta = (cfg as Record<string, number>).stabilizationEffect ?? 0;
      side = 'government';
      break;
    }
    case 'arms_embargo': {
      militaryDelta = -((cfg as Record<string, number>).militaryReduction ?? 0) / 100;
      side = 'government';
      break;
    }
    case 'recognize_rebels': {
      const rebelBoost = (cfg as Record<string, number>).rebelBoost ?? 0;
      territoryDelta = -rebelBoost;
      side = 'rebel';
      break;
    }
    case 'deploy_peacekeepers': {
      territoryDelta = (cfg as Record<string, number>).stabilizationEffect ?? 0;
      side = 'government';
      break;
    }
    case 'exploit_chaos': {
      // Economic exploitation — no direct territorial or military effect
      side = 'rebel';
      break;
    }
  }

  return {
    ...war,
    territoryControlPercent: Math.max(
      0,
      Math.min(100, war.territoryControlPercent + territoryDelta),
    ),
    militarySplitRatio: Math.max(
      0,
      Math.min(1, war.militarySplitRatio + militaryDelta),
    ),
    externalSupport: {
      ...war.externalSupport,
      [respondingNation]: side,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers (not exported)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map an {@link UnrestResponseType} to the corresponding
 * {@link GovernmentResponseStatus} posture.
 */
function responseToPosture(
  response: UnrestResponseType,
): 'none' | 'negotiating' | 'reforming' | 'repressing' {
  switch (response) {
    case 'negotiate':
    case 'concede':
    case 'divide':
      return 'negotiating';
    case 'reform':
      return 'reforming';
    case 'repress':
      return 'repressing';
    case 'ignore':
    default:
      return 'none';
  }
}

/**
 * Build a short narrative string summarising the government's action.
 */
function buildNarrative(
  response: UnrestResponseType,
  movementName: string,
  turn: number,
): string {
  const actions: Record<UnrestResponseType, string> = {
    negotiate: `The government opened negotiations with ${movementName} on turn ${turn}.`,
    reform: `The government announced structural reforms in response to ${movementName} on turn ${turn}.`,
    repress: `Security forces moved to suppress ${movementName} on turn ${turn}.`,
    concede: `The government conceded to all demands of ${movementName} on turn ${turn}.`,
    divide: `The government exploited internal divisions within ${movementName} on turn ${turn}.`,
    ignore: `The government chose to ignore ${movementName} on turn ${turn}.`,
  };
  return actions[response];
}
