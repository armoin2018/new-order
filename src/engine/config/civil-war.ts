/**
 * Civil War & Protest Scenario Configuration — FR-5300
 *
 * Trigger thresholds, protest escalation rates, government response
 * modifiers, civil war parameters, resolution conditions, AI biases,
 * and international intervention costs / effects.
 *
 * All game formulas are tunable here without code changes.
 *
 * @see NFR-204  — All game formulas shall be configurable via constants.
 * @see FR-5300  — Civil War & Protest Scenarios
 */

import type { UnrestResponseType, InternationalCivilWarResponse } from '@/data/types/civil-war.types';

export const civilWarConfig = {
  // -------------------------------------------------------------------------
  // Trigger Thresholds
  // -------------------------------------------------------------------------

  /**
   * Conditions under which a civil war can be triggered.
   * @see FR-5300
   */
  triggers: {
    /** National unrest level that can ignite civil war. */
    civilWarUnrestThreshold: 80,
    /** Consecutive high-unrest turns required before escalation. */
    consecutiveTurnsRequired: 3,
    /** Ethnic / religious fault-line tension that can trigger civil war directly. */
    faultLineCriticalThreshold: 90,
    /** Whether a failed coup attempt automatically triggers civil war. */
    coupFailureTrigger: true,
  },

  // -------------------------------------------------------------------------
  // Protest Dynamics
  // -------------------------------------------------------------------------

  /**
   * Rates and limits governing protest movement lifecycle.
   * @see FR-5300
   */
  protests: {
    /** Per-turn unrest increase while a movement is active. */
    escalationRate: 5,
    /** Per-turn unrest decrease when a movement is winding down. */
    deEscalationRate: 3,
    /** Turns before a spontaneous movement becomes organised. */
    spontaneousToOrganizedTurns: 4,
    /** Turns before an organised movement becomes militant. */
    organizedToMilitantTurns: 6,
    /** Maximum simultaneous protest movements per nation. */
    maxSimultaneousMovements: 5,
    /** Flat bonus to movement size when foreign backing is present. */
    foreignBackingBonus: 10,
  },

  // -------------------------------------------------------------------------
  // Government Reaction Modifiers
  // -------------------------------------------------------------------------

  /**
   * Per-response-type modifiers applied when the government reacts to unrest.
   * @see FR-5300
   */
  reactions: {
    negotiate: { unrestModifier: -15, stabilityModifier: -5, treasuryCost: 50, reputationModifier: 2, longTermTension: 5 },
    reform: { unrestModifier: -5, stabilityModifier: 3, treasuryCost: 100, reputationModifier: 5, longTermTension: -10 },
    repress: { unrestModifier: -25, stabilityModifier: -10, treasuryCost: 30, reputationModifier: -15, longTermTension: 20 },
    concede: { unrestModifier: -50, stabilityModifier: -15, treasuryCost: 0, reputationModifier: 0, longTermTension: -5 },
    divide: { unrestModifier: -20, stabilityModifier: -3, treasuryCost: 40, reputationModifier: -5, longTermTension: 8 },
    ignore: { unrestModifier: 10, stabilityModifier: -5, treasuryCost: 0, reputationModifier: -3, longTermTension: 15 },
  } as Readonly<Record<UnrestResponseType, {
    unrestModifier: number;
    stabilityModifier: number;
    treasuryCost: number;
    reputationModifier: number;
    longTermTension: number;
  }>>,

  // -------------------------------------------------------------------------
  // Civil War Parameters
  // -------------------------------------------------------------------------

  /**
   * Baseline per-turn values and limits for active civil wars.
   * @see FR-5300
   */
  civilWar: {
    /** Initial percentage of territory under government control. */
    initialTerritoryGovernment: 70,
    /** Base fraction of the military loyal to the government at war start. */
    militarySplitBase: 0.65,
    /** Economic damage inflicted per turn of active war. */
    economicDamagePerTurn: 5,
    /** Baseline casualties per turn of active war. */
    casualtiesPerTurn: 1000,
    /** Refugees generated per turn of active war. */
    refugeesPerTurn: 5000,
    /** Hard cap on civil war duration in turns. */
    maxDurationTurns: 50,
  },

  // -------------------------------------------------------------------------
  // Resolution Conditions
  // -------------------------------------------------------------------------

  /**
   * Thresholds that determine how a civil war is resolved.
   * Territory percentages refer to government control.
   * @see FR-5300
   */
  resolution: {
    /** Government controls ≥ this % → government_victory. */
    governmentVictoryThreshold: 90,
    /** Government controls ≤ this % → rebel_victory. */
    rebelVictoryThreshold: 20,
    /** Territory range within which negotiated settlement is possible. */
    negotiationWindow: { min: 30, max: 70 },
    /** Turns of stalemate before partition becomes an option. */
    partitionThreshold: 15,
    /** Flat strength bonus from external military intervention. */
    externalInterventionStrength: 20,
  },

  // -------------------------------------------------------------------------
  // AI Response Biases
  // -------------------------------------------------------------------------

  /**
   * Default AI response tendencies based on political system archetype.
   * @see FR-5300
   */
  aiResponse: {
    /** Preferred response for authoritarian regimes. */
    authoritarianBias: 'repress' as const,
    /** Preferred response for democratic regimes. */
    democraticBias: 'negotiate' as const,
    /** Preferred response for ideologically rigid regimes. */
    ideologicalBias: 'ignore' as const,
    /** Minimum resource level (% of GDP) below which AI avoids costly responses. */
    resourceThreshold: 30,
  },

  // -------------------------------------------------------------------------
  // International Intervention Options
  // -------------------------------------------------------------------------

  /**
   * Costs and effects for each international response to another nation's civil war.
   * @see FR-5300
   */
  international: {
    humanitarian_aid: { legitimacyBonus: 5, treasuryCost: 100, stabilizationEffect: 3 },
    arms_embargo: { militaryReduction: 20, diplomaticCost: -5 },
    recognize_rebels: { governmentLegitimacyHit: -10, rebelBoost: 15 },
    deploy_peacekeepers: { treasuryCost: 500, stabilizationEffect: 15, riskFactor: 0.2 },
    exploit_chaos: { resourceGain: 50, reputationCost: -20, discoveryRisk: 0.3 },
  } as Readonly<Record<InternationalCivilWarResponse, Record<string, number>>>,
} as const;
