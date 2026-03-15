/**
 * New Order: Alliance Obligation Evaluation Engine
 *
 * Implements FR-304 — When an ally is attacked, AI evaluates whether to honor
 * defense pacts based on utility: alliance credibility cost vs war cost vs
 * diplomatic fallout. Decision logged with rationale chain.
 *
 * The evaluator is fully stateless; all inputs flow through the
 * {@link AllianceObligationContext} and all outputs emerge in the
 * {@link AllianceObligationResult}.
 *
 * @see FR-304 — Alliance obligation evaluation
 * @see CNFL-0402 — Alliance Obligation system
 *
 * @module engine/alliance-evaluator
 */

import type {
  FactionId,
  LeaderProfile,
  EmotionalStateSnapshot,
  NationState,
} from '@/data/types';

import {
  ALL_FACTIONS,
  DecisionStyle,
  StressResponse,
} from '@/data/types';

import type { SeededRandom } from '@/engine/rng';

// ─────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────

/** Represents a defense pact between two factions. */
export interface DefensePact {
  factionA: FactionId;
  factionB: FactionId;
  /** Strength of the pact: 0–100 (100 = ironclad mutual defense). */
  strength: number;
  /** Whether this is a formal treaty or informal understanding. */
  formal: boolean;
}

/** Context for evaluating an alliance obligation. */
export interface AllianceObligationContext {
  /** The faction being asked to intervene. */
  evaluatingFaction: FactionId;
  /** The ally under attack. */
  allyFaction: FactionId;
  /** The attacker. */
  attackerFaction: FactionId;
  /** The defense pact in question. */
  pact: DefensePact;
  /** Current state of the evaluating faction. */
  evaluatingNationState: NationState;
  /** Leader profile of the evaluating faction. */
  leaderProfile: LeaderProfile;
  /** Emotional state of the evaluating faction's leader. */
  emotionalState: EmotionalStateSnapshot;
  /** Tension levels: evaluating faction vs each other faction (−100 allied … +100 hostile). */
  tensions: Record<FactionId, number>;
  /** Current military readiness of the evaluating faction. */
  militaryReadiness: number;
  /** RNG for probabilistic elements. */
  rng: SeededRandom;
}

/** Result of alliance obligation evaluation. */
export interface AllianceObligationResult {
  /** Whether the faction will honor the pact. */
  willHonor: boolean;
  /** Overall confidence in the decision: 0–100. */
  confidence: number;
  /** Detailed cost-benefit breakdown. */
  analysis: {
    /** Cost of going to war to help ally. */
    warCost: number;
    /** Cost to credibility if pact is broken. */
    credibilityCost: number;
    /** Diplomatic fallout from other nations if pact is broken. */
    diplomaticFallout: number;
    /** Risk assessment of the attacker. */
    attackerThreatLevel: number;
    /** Emotional bias (anger toward attacker, loyalty to ally). */
    emotionalBias: number;
    /** Leader personality factor (patient leaders more likely to negotiate first). */
    personalityFactor: number;
    /** Net utility: positive = honor, negative = break. */
    netUtility: number;
  };
  /** Human-readable rationale chain (for debug/display). */
  rationaleChain: string[];
}

// ─────────────────────────────────────────────────────────
// 2. Constants
// ─────────────────────────────────────────────────────────

/** Tension value above which a faction is considered "hostile". */
const HOSTILE_TENSION_THRESHOLD = 50;

/** Risk tolerance above which a leader is considered "high risk". */
const HIGH_RISK_TOLERANCE = 60;

/** Patience above which a leader is considered "highly patient". */
const HIGH_PATIENCE = 60;

/** Pragmatism above which a leader is considered "highly pragmatic". */
const HIGH_PRAGMATISM = 50;

// ─────────────────────────────────────────────────────────
// 3. AllianceEvaluator
// ─────────────────────────────────────────────────────────

/**
 * Stateless evaluator for alliance obligation decisions (FR-304).
 *
 * Determines whether a faction will honor a defense pact when an ally
 * is attacked, using a multi-factor utility analysis:
 *
 * 1. War Cost — military readiness, stability, treasury
 * 2. Credibility Cost — pact strength, formality, alliance reputation
 * 3. Diplomatic Fallout — friendly nations watching
 * 4. Attacker Threat Level — existing hostility
 * 5. Emotional Bias — anger, resolve, fear
 * 6. Personality Factor — risk tolerance, patience, decision style
 * 7. Net Utility — sum of factors determines honor / break
 *
 * @see FR-304
 */
export class AllianceEvaluator {
  // ── Primary entry point ────────────────────────────────

  /**
   * Evaluate whether a faction will honor a defense pact.
   *
   * @param context - Full obligation evaluation context.
   * @returns Decision result with analysis breakdown and rationale chain.
   *
   * @see FR-304
   */
  static evaluate(context: AllianceObligationContext): AllianceObligationResult {
    const {
      evaluatingNationState,
      leaderProfile,
      emotionalState,
      tensions,
      militaryReadiness,
      pact,
      attackerFaction,
      evaluatingFaction,
    } = context;

    const rationaleChain: string[] = [];

    // ── Step 1: War Cost ──────────────────────────────────
    const warCost = AllianceEvaluator.calculateWarCost(
      evaluatingNationState,
      militaryReadiness,
    );
    rationaleChain.push(
      `War Cost = ${warCost.toFixed(1)} — ` +
      `readiness penalty: ${((100 - militaryReadiness) * 0.3).toFixed(1)}, ` +
      `stability penalty: ${evaluatingNationState.stability < 40 ? 30 : 0}, ` +
      `treasury penalty: ${evaluatingNationState.treasury < 500 ? 20 : 0}`,
    );

    // ── Step 2: Credibility Cost ──────────────────────────
    const credibilityCost = AllianceEvaluator.calculateCredibilityCost(
      pact,
      evaluatingNationState.allianceCredibility,
    );
    rationaleChain.push(
      `Credibility Cost = ${credibilityCost.toFixed(1)} — ` +
      `pact strength contribution: ${(pact.strength * 0.5).toFixed(1)}, ` +
      `formal treaty bonus: ${pact.formal ? 25 : 10}, ` +
      `alliance credibility contribution: ${(evaluatingNationState.allianceCredibility * 0.2).toFixed(1)}`,
    );

    // ── Step 3: Diplomatic Fallout ────────────────────────
    let friendlyFactionCount = 0;
    for (const faction of ALL_FACTIONS) {
      if (faction === evaluatingFaction) continue;
      const tensionValue = tensions[faction] ?? 0;
      if (tensionValue < 0) {
        friendlyFactionCount++;
      }
    }
    const diplomaticFallout = 20 + friendlyFactionCount * 10;
    rationaleChain.push(
      `Diplomatic Fallout = ${diplomaticFallout.toFixed(1)} — ` +
      `base: 20, friendly nations watching: ${friendlyFactionCount} (×10 each)`,
    );

    // ── Step 4: Attacker Threat Level ─────────────────────
    const attackerTension = tensions[attackerFaction] ?? 0;
    const attackerAlreadyHostile = attackerTension > HOSTILE_TENSION_THRESHOLD;
    const attackerThreatLevel =
      attackerTension * 0.3 + (attackerAlreadyHostile ? 20 : 0);
    rationaleChain.push(
      `Attacker Threat Level = ${attackerThreatLevel.toFixed(1)} — ` +
      `tension contribution: ${(attackerTension * 0.3).toFixed(1)}, ` +
      `already hostile (>${HOSTILE_TENSION_THRESHOLD}): ${String(attackerAlreadyHostile)} (${attackerAlreadyHostile ? '+20' : '+0'})`,
    );

    // ── Step 5: Emotional Bias ────────────────────────────
    const emotionalBias =
      emotionalState.anger * 0.15 +
      emotionalState.resolve * 0.1 -
      emotionalState.fear * 0.1;
    rationaleChain.push(
      `Emotional Bias = ${emotionalBias.toFixed(1)} — ` +
      `anger: +${(emotionalState.anger * 0.15).toFixed(1)}, ` +
      `resolve: +${(emotionalState.resolve * 0.1).toFixed(1)}, ` +
      `fear: -${(emotionalState.fear * 0.1).toFixed(1)}`,
    );

    // ── Step 6: Personality Factor ────────────────────────
    let personalityFactor = 0;
    const psychology = leaderProfile.psychology;

    // High risk tolerance → more willing to enter conflict
    if (psychology.riskTolerance > HIGH_RISK_TOLERANCE) {
      personalityFactor += 10;
      rationaleChain.push(
        `High risk tolerance (${psychology.riskTolerance}) → +10 willingness to fight`,
      );
    }

    // High patience → prefers to negotiate first
    if (psychology.patience > HIGH_PATIENCE) {
      personalityFactor -= 10;
      rationaleChain.push(
        `High patience (${psychology.patience}) → −10 (prefers negotiation first)`,
      );
    }

    // High pragmatism → pure cost comparison
    if (psychology.pragmatism > HIGH_PRAGMATISM) {
      if (warCost < credibilityCost) {
        personalityFactor += 5;
        rationaleChain.push(
          `Pragmatic leader: war cost (${warCost.toFixed(1)}) < credibility cost (${credibilityCost.toFixed(1)}) → +5`,
        );
      } else {
        personalityFactor -= 5;
        rationaleChain.push(
          `Pragmatic leader: war cost (${warCost.toFixed(1)}) ≥ credibility cost (${credibilityCost.toFixed(1)}) → −5`,
        );
      }
    }

    // Decision style modifiers
    if (psychology.decisionStyle === DecisionStyle.Transactional) {
      rationaleChain.push(
        'Transactional leader: decision based purely on cost-benefit analysis',
      );
    } else if (psychology.decisionStyle === DecisionStyle.Ideological) {
      personalityFactor += 10;
      rationaleChain.push(
        'Ideological leader: inherent loyalty to allied causes → +10',
      );
    }

    // Stress response modifiers
    if (psychology.stressResponse === StressResponse.Escalate) {
      personalityFactor += 15;
      rationaleChain.push(
        'Escalatory stress response: always ready to fight → +15',
      );
    } else if (psychology.stressResponse === StressResponse.Retreat) {
      personalityFactor -= 15;
      rationaleChain.push(
        'Retreat stress response: avoids confrontation → −15',
      );
    }

    rationaleChain.push(
      `Personality Factor (total) = ${personalityFactor.toFixed(1)}`,
    );

    // ── Step 7: Net Utility ───────────────────────────────
    const netUtility =
      credibilityCost +
      diplomaticFallout +
      attackerThreatLevel +
      emotionalBias +
      personalityFactor -
      warCost;

    const willHonor = netUtility > 0;
    const confidence = Math.min(100, Math.abs(netUtility));

    rationaleChain.push(
      `Net Utility = ${netUtility.toFixed(1)} ` +
      `(credibility ${credibilityCost.toFixed(1)} + fallout ${diplomaticFallout.toFixed(1)} + ` +
      `threat ${attackerThreatLevel.toFixed(1)} + emotional ${emotionalBias.toFixed(1)} + ` +
      `personality ${personalityFactor.toFixed(1)} − warCost ${warCost.toFixed(1)})`,
    );
    rationaleChain.push(
      `Decision: ${willHonor ? 'HONOR' : 'BREAK'} pact (confidence: ${confidence.toFixed(1)})`,
    );

    return {
      willHonor,
      confidence,
      analysis: {
        warCost,
        credibilityCost,
        diplomaticFallout,
        attackerThreatLevel,
        emotionalBias,
        personalityFactor,
        netUtility,
      },
      rationaleChain,
    };
  }

  // ── Extracted cost calculators ─────────────────────────

  /**
   * Calculate the cost of going to war.
   *
   * Formula: `(100 − militaryReadiness) × 0.3 + (stability < 40 ? 30 : 0) + (treasury < 500 ? 20 : 0)`
   *
   * @param nationState - Current nation state.
   * @param militaryReadiness - Current military readiness (0–100).
   * @returns War cost score (higher = more costly to fight).
   */
  static calculateWarCost(
    nationState: NationState,
    militaryReadiness: number,
  ): number {
    return (
      (100 - militaryReadiness) * 0.3 +
      (nationState.stability < 40 ? 30 : 0) +
      (nationState.treasury < 500 ? 20 : 0)
    );
  }

  /**
   * Calculate the credibility cost of breaking a pact.
   *
   * Formula: `strength × 0.5 + (formal ? 25 : 10) + allianceCredibility × 0.2`
   *
   * @param pact - The defense pact under evaluation.
   * @param allianceCredibility - Evaluating faction's current alliance credibility (0–100).
   * @returns Credibility cost score (higher = more costly to break).
   */
  static calculateCredibilityCost(
    pact: DefensePact,
    allianceCredibility: number,
  ): number {
    return (
      pact.strength * 0.5 +
      (pact.formal ? 25 : 10) +
      allianceCredibility * 0.2
    );
  }
}
