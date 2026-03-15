/**
 * Victory & Loss Condition Extended Detection Engine (VC-08 → VC-17)
 *
 * Implements §13 extended victory and loss conditions for the New Order
 * geopolitical simulation. Covers coups, revolutions, authoritarian rule,
 * meta-victories, psychological warfare, resilience, information dominance,
 * proxy warfare, technological supremacy, and resource control.
 *
 * All public methods are **pure functions** — no side effects, no mutation of
 * external state. Configuration is injected from {@link GAME_CONFIG.victoryLoss}
 * per NFR-204.
 *
 * @see §13     Victory & Loss Conditions
 * @see NFR-204 All formulas configurable via constants
 *
 * @module engine/victory-loss-extended
 */

import type {
  FactionId,
  TurnNumber,
  LeaderId,
  StrategicGrade,
  NationState,
  LeaderProfile,
  EmotionalStateSnapshot,
  TechnologyIndex,
  InternationalLegitimacy,
  CivilUnrestComponents,
  ResourceSecurityIndex,
} from '@/data/types';

import type {
  ConditionType,
  ConditionDefinition,
  ConditionCheckResult,
} from './victory-loss-core';

import { GAME_CONFIG } from '@/engine/config';

// ═══════════════════════════════════════════════════════════════════════════
// Exported Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration slice derived from {@link GAME_CONFIG.victoryLoss}.
 * Preserves literal types from the `as const` assertion.
 */
export type VictoryLossExtConfig = typeof GAME_CONFIG.victoryLoss;

/**
 * Tracking data needed for extended conditions that span the full game.
 *
 * Passed into the engine each turn and returned (immutably) by
 * {@link VictoryLossExtendedEngine.updateTracker}.
 */
export interface ExtendedConditionTracker {
  /** VC-10: Number of turns where Iron Fist constraints were maintained. */
  vc10_ironFistTurns: number;
  /** VC-10: Whether Iron Fist was ever violated (once violated, cannot be recovered). */
  vc10_ironFistViolated: boolean;
  /** VC-12: Rival leaders successfully manipulated (anger or fear > threshold). */
  vc12_manipulatedLeaders: LeaderId[];
  /** VC-12: Whether player's PsyOps were ever discovered. */
  vc12_psyOpsDiscovered: boolean;
  /** VC-13: Number of trauma events survived. */
  vc13_traumaEventCount: number;
  /** VC-13: Whether player survived a civil crisis beyond Insurrection stage. */
  vc13_survivedCivilCrisis: boolean;
  /** VC-14: Consecutive turns with legitimacy ≥ 90. */
  vc14_legitimacyTurns: number;
  /** VC-14: Total narrative battles won. */
  vc14_narrativeBattleWins: number;
  /** VC-14: Total successful deepfakes against player. */
  vc14_deepfakesAgainst: number;
  /** VC-15: Strategic objectives achieved via proxy. */
  vc15_proxyObjectives: number;
  /** VC-15: Direct combat actions taken. */
  vc15_directCombatActions: number;
  /** VC-17: Number of military coercion actions taken. */
  vc17_militaryCoercionActions: number;
}

/**
 * Input for the extended condition checker.
 * Aggregates every piece of state needed for VC-08 → VC-17 evaluation.
 */
export interface ExtendedConditionInput {
  /** Current simulation turn (1-based). */
  currentTurn: TurnNumber;
  /** Which faction the human player controls. */
  playerFaction: FactionId;
  /** Per-faction nation states. */
  nationStates: Record<FactionId, NationState>;
  /** Leader profiles keyed by LeaderId. */
  leaderProfiles: Record<LeaderId, LeaderProfile>;
  /** Per-leader emotional state snapshots. */
  emotionalStates: Record<LeaderId, EmotionalStateSnapshot>;
  /** Per-faction technology indices. */
  technologyIndices: Record<FactionId, TechnologyIndex>;
  /** Per-faction international legitimacy. */
  internationalLegitimacy: Record<FactionId, InternationalLegitimacy>;
  /** Per-faction civil unrest breakdown. */
  civilUnrestComponents: Record<FactionId, CivilUnrestComponents>;
  /** Per-faction resource security indices. */
  resourceSecurity: Record<FactionId, ResourceSecurityIndex>;
  /** Multi-turn tracking state from the previous turn. */
  tracker: ExtendedConditionTracker;
  /** Which base victory was achieved (if any) — for VC-11 check. */
  baseVictoryId: string | null;
  /** Player's post-game strategic grade (if computed) — for VC-11 check. */
  strategicGrade: StrategicGrade | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Condition Definitions (static catalogue)
// ═══════════════════════════════════════════════════════════════════════════

const EXTENDED_CONDITION_DEFINITIONS: readonly ConditionDefinition[] = [
  // ── Extended Loss Conditions ───────────────────────────────
  {
    id: 'VC-08',
    name: "Coup d'État",
    type: 'loss' as ConditionType,
    description:
      'PowerBase.military < 30 AND PowerBase.securityServices < 30. Survive if SuccessionClarity > 60.',
  },
  {
    id: 'VC-09',
    name: "People's Revolution",
    type: 'loss' as ConditionType,
    description:
      'CivilUnrest = 100 via non-violent uprising (distinct from VC-04 Civil War path).',
  },
  // ── Extended Victory Conditions ────────────────────────────
  {
    id: 'VC-10',
    name: 'Iron Fist',
    type: 'victory' as ConditionType,
    description:
      'Maintain power for 60 turns with CivilUnrest never below 40 and Stability never above 50.',
  },
  {
    id: 'VC-11',
    name: 'Grand Strategist',
    type: 'victory' as ConditionType,
    description:
      'Win a base victory (VC-01, VC-02, VC-03, or VC-10) with Strategic Grade S.',
  },
  {
    id: 'VC-12',
    name: 'Puppet Master',
    type: 'victory' as ConditionType,
    description:
      'PsyOps on ≥ 3 rival leaders (anger or fear > 70) without being discovered.',
  },
  {
    id: 'VC-13',
    name: 'Unbreakable',
    type: 'victory' as ConditionType,
    description:
      'Survive ≥ 3 trauma events + civil crisis + end with Stability > 60 and Resolve > 80.',
  },
  {
    id: 'VC-14',
    name: 'Information Hegemon',
    type: 'victory' as ConditionType,
    description:
      'Legitimacy ≥ 90 for 12 consecutive turns, ≥ 5 narrative battle wins, 0 successful deepfakes.',
  },
  {
    id: 'VC-15',
    name: 'Shadow Emperor',
    type: 'victory' as ConditionType,
    description:
      '≥ 3 strategic objectives achieved via proxies with 0 direct combat actions.',
  },
  {
    id: 'VC-16',
    name: 'Tech Singularity',
    type: 'victory' as ConditionType,
    description:
      'AI ≥ 90, Quantum ≥ 70, Semiconductors ≥ 80, Stability ≥ 60.',
  },
  {
    id: 'VC-17',
    name: 'Resource Lord',
    type: 'victory' as ConditionType,
    description:
      'Control ≥ 50% of 2+ resource categories, Diplomatic Influence ≥ 70, 0 military coercion.',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extended Victory & Loss Condition detection engine (VC-08 → VC-17).
 *
 * Instantiated once per game session. Configuration is read from
 * {@link GAME_CONFIG.victoryLoss} but may be overridden via the constructor
 * for testing.
 */
export class VictoryLossExtendedEngine {
  /** Victory/loss configuration slice. */
  private readonly cfg: VictoryLossExtConfig;
  /** Maximum turns before end-of-game evaluation. */
  private readonly maxTurns: number;

  constructor(config?: VictoryLossExtConfig, maxTurns?: number) {
    this.cfg = config ?? GAME_CONFIG.victoryLoss;
    this.maxTurns = maxTurns ?? GAME_CONFIG.meta.MAX_TURNS;
  }

  // ─────────────────────────────────────────────────────────
  // Static catalogue
  // ─────────────────────────────────────────────────────────

  /** Return the static catalogue of extended condition definitions. */
  getConditionDefinitions(): ConditionDefinition[] {
    return [...EXTENDED_CONDITION_DEFINITIONS];
  }

  // ─────────────────────────────────────────────────────────
  // Individual Condition Checkers
  // ─────────────────────────────────────────────────────────

  /**
   * VC-08 — Coup d'État (Loss).
   *
   * Triggered when the player leader's military AND security-services
   * power-base pillars both fall below their respective thresholds.
   * The leader survives if succession clarity exceeds the configured threshold.
   *
   * @returns `true` if the coup succeeds (i.e. the player loses).
   */
  checkVC08(leaderProfile: LeaderProfile): boolean {
    const { powerBaseMilitaryMax, powerBaseSecurityMax, successionClarityThreshold } =
      this.cfg.vc08_coup;

    const militaryWeak = leaderProfile.powerBase.military < powerBaseMilitaryMax;
    const securityWeak = leaderProfile.powerBase.securityServices < powerBaseSecurityMax;

    if (!militaryWeak || !securityWeak) {
      return false;
    }

    // Leader survives if succession clarity is high enough
    const survives = leaderProfile.vulnerabilities.successionClarity > successionClarityThreshold;
    return !survives;
  }

  /**
   * VC-09 — People's Revolution (Loss).
   *
   * Triggered when civil unrest reaches the maximum (100) via the
   * non-violent uprising path, distinct from VC-04 Civil War.
   *
   * @returns `true` if the people's revolution topples the regime.
   */
  checkVC09(civilUnrest: CivilUnrestComponents): boolean {
    return civilUnrest.civilUnrest >= this.cfg.vc09_peoplesRevolution.civilUnrestTrigger;
  }

  /**
   * VC-10 — Iron Fist (Dark Victory).
   *
   * The player must maintain power for the full game duration (60 turns)
   * while CivilUnrest never dips below 40 and Stability never rises above 50.
   * Once violated in any turn, the condition can never be achieved.
   *
   * @returns `true` if the iron-fist victory has been achieved.
   */
  checkVC10(tracker: ExtendedConditionTracker): boolean {
    if (tracker.vc10_ironFistViolated) {
      return false;
    }
    return tracker.vc10_ironFistTurns >= this.cfg.vc10_ironFist.requiredTurns;
  }

  /**
   * VC-11 — Grand Strategist (Meta-Victory).
   *
   * The player must win one of the eligible base victories (VC-01, VC-02,
   * VC-03, or VC-10) AND achieve an 'S' strategic grade.
   *
   * @returns `true` if grand strategist meta-victory is earned.
   */
  checkVC11(baseVictoryId: string | null, grade: StrategicGrade | null): boolean {
    if (baseVictoryId === null || grade === null) {
      return false;
    }

    const eligible = this.cfg.vc11_grandStrategist.eligibleBaseVictories as readonly string[];
    const isEligibleVictory = eligible.includes(baseVictoryId);
    const isRequiredGrade = grade === this.cfg.vc11_grandStrategist.requiredGrade;

    return isEligibleVictory && isRequiredGrade;
  }

  /**
   * VC-12 — Puppet Master (Psychological Victory).
   *
   * The player must have manipulated ≥ 3 rival leaders (anger or fear > 70)
   * via PsyOps without ever being discovered.
   *
   * @returns `true` if puppet master victory is achieved.
   */
  checkVC12(tracker: ExtendedConditionTracker): boolean {
    if (tracker.vc12_psyOpsDiscovered && !this.cfg.vc12_puppetMaster.discoveryAllowed) {
      return false;
    }
    return tracker.vc12_manipulatedLeaders.length >= this.cfg.vc12_puppetMaster.minManipulatedLeaders;
  }

  /**
   * VC-13 — Unbreakable (Resilience Victory).
   *
   * The player must survive ≥ 3 trauma events, survive a civil crisis
   * beyond the Insurrection stage, and end the game with Stability > 60
   * and Resolve > 80.
   *
   * @returns `true` if the unbreakable victory is achieved.
   */
  checkVC13(
    tracker: ExtendedConditionTracker,
    finalNation: NationState,
    resolveScore: number,
  ): boolean {
    const { minTraumaEvents, finalStabilityMin, finalResolveMin } = this.cfg.vc13_unbreakable;

    if (tracker.vc13_traumaEventCount < minTraumaEvents) {
      return false;
    }
    if (!tracker.vc13_survivedCivilCrisis) {
      return false;
    }
    if (finalNation.stability < finalStabilityMin) {
      return false;
    }
    return resolveScore >= finalResolveMin;
  }

  /**
   * VC-14 — Information Hegemon (Narrative Victory).
   *
   * The player must maintain legitimacy ≥ 90 for 12 consecutive turns,
   * win ≥ 5 narrative battles, and have 0 successful deepfakes against them.
   *
   * @returns `true` if information hegemon victory is achieved.
   */
  checkVC14(tracker: ExtendedConditionTracker): boolean {
    const cfg = this.cfg.vc14_informationHegemon;

    if (tracker.vc14_legitimacyTurns < cfg.consecutiveTurns) {
      return false;
    }
    if (tracker.vc14_narrativeBattleWins < cfg.minNarrativeBattleWins) {
      return false;
    }
    return tracker.vc14_deepfakesAgainst <= cfg.maxSuccessfulDeepfakes;
  }

  /**
   * VC-15 — Shadow Emperor (Proxy Victory).
   *
   * The player must achieve ≥ 3 strategic objectives exclusively via
   * proxies with 0 direct combat actions.
   *
   * @returns `true` if shadow emperor victory is achieved.
   */
  checkVC15(tracker: ExtendedConditionTracker): boolean {
    const cfg = this.cfg.vc15_shadowEmperor;

    if (tracker.vc15_proxyObjectives < cfg.minStrategicObjectives) {
      return false;
    }
    return tracker.vc15_directCombatActions <= cfg.maxDirectCombatActions;
  }

  /**
   * VC-16 — Tech Singularity (Technology Victory).
   *
   * The player must reach AI ≥ 90, Quantum ≥ 70, Semiconductors ≥ 80,
   * and Stability ≥ 60 simultaneously.
   *
   * @returns `true` if tech singularity victory is achieved.
   */
  checkVC16(techIndex: TechnologyIndex, nation: NationState): boolean {
    const cfg = this.cfg.vc16_techSingularity;

    if (techIndex.ai < cfg.aiMin) {
      return false;
    }
    if (techIndex.quantum < cfg.quantumMin) {
      return false;
    }
    if (techIndex.semiconductors < cfg.semiconductorsMin) {
      return false;
    }
    return nation.stability >= cfg.stabilityMin;
  }

  /**
   * VC-17 — Resource Lord (Resource Victory).
   *
   * The player must control ≥ 50% of 2+ resource categories, maintain
   * Diplomatic Influence ≥ 70, and have 0 military coercion actions.
   *
   * @param resourceControlPercents Pre-computed map of resource category → control %.
   * @returns `true` if resource lord victory is achieved.
   */
  checkVC17(
    resourceControlPercents: Record<string, number>,
    nation: NationState,
    tracker: ExtendedConditionTracker,
  ): boolean {
    const cfg = this.cfg.vc17_resourceLord;

    if (tracker.vc17_militaryCoercionActions > cfg.maxMilitaryCoercionActions) {
      return false;
    }
    if (nation.diplomaticInfluence < cfg.diplomaticInfluenceMin) {
      return false;
    }

    // Count how many resource categories exceed the control threshold
    let categoriesControlled = 0;
    const entries = Object.values(resourceControlPercents);
    for (const percent of entries) {
      if (percent !== undefined && percent >= cfg.resourceControlThreshold) {
        categoriesControlled += 1;
      }
    }

    return categoriesControlled >= cfg.minResourceCategories;
  }

  // ─────────────────────────────────────────────────────────
  // Tracker Update
  // ─────────────────────────────────────────────────────────

  /**
   * Update tracker based on current turn state.
   * Returns a **new** tracker object — the original is never mutated.
   */
  updateTracker(input: ExtendedConditionInput): ExtendedConditionTracker {
    const prev = input.tracker;

    // ── VC-10: Iron Fist tracking ────────────────────────────
    const playerUnrest = input.civilUnrestComponents[input.playerFaction];
    const playerNation = input.nationStates[input.playerFaction];

    let vc10_ironFistTurns = prev.vc10_ironFistTurns;
    let vc10_ironFistViolated = prev.vc10_ironFistViolated;

    if (!vc10_ironFistViolated) {
      const unrestMet =
        playerUnrest !== undefined &&
        playerUnrest.civilUnrest >= this.cfg.vc10_ironFist.civilUnrestFloor;
      const stabilityMet =
        playerNation !== undefined &&
        playerNation.stability <= this.cfg.vc10_ironFist.stabilityCeiling;

      if (unrestMet && stabilityMet) {
        vc10_ironFistTurns = prev.vc10_ironFistTurns + 1;
      } else {
        vc10_ironFistViolated = true;
      }
    }

    // ── VC-12: Puppet Master tracking ────────────────────────
    const vc12_manipulatedLeaders = [...prev.vc12_manipulatedLeaders];
    const vc12_psyOpsDiscovered = prev.vc12_psyOpsDiscovered;

    // Scan rival leader emotional states for manipulation thresholds
    const emotionalEntries = Object.entries(input.emotionalStates) as Array<
      [string, EmotionalStateSnapshot]
    >;
    for (const [leaderId, emoState] of emotionalEntries) {
      if (emoState === undefined) {
        continue;
      }
      // Skip player's own leaders
      const leaderProfile = input.leaderProfiles[leaderId as LeaderId];
      if (leaderProfile === undefined) {
        continue;
      }
      if (leaderProfile.identity.nation === input.playerFaction) {
        continue;
      }
      // Check if anger or fear exceeds threshold
      const threshold = this.cfg.vc12_puppetMaster.emotionalThreshold;
      if (emoState.anger > threshold || emoState.fear > threshold) {
        if (!vc12_manipulatedLeaders.includes(leaderId as LeaderId)) {
          vc12_manipulatedLeaders.push(leaderId as LeaderId);
        }
      }
    }

    // ── VC-14: Information Hegemon tracking ──────────────────
    const playerLegitimacy = input.internationalLegitimacy[input.playerFaction];
    let vc14_legitimacyTurns = prev.vc14_legitimacyTurns;

    if (
      playerLegitimacy !== undefined &&
      playerLegitimacy.legitimacy >= this.cfg.vc14_informationHegemon.legitimacyMin
    ) {
      vc14_legitimacyTurns = prev.vc14_legitimacyTurns + 1;
    } else {
      // Reset streak — must be consecutive
      vc14_legitimacyTurns = 0;
    }

    return {
      vc10_ironFistTurns,
      vc10_ironFistViolated,
      vc12_manipulatedLeaders,
      vc12_psyOpsDiscovered,
      // These are updated by external event handlers, not per-turn auto-scan:
      vc13_traumaEventCount: prev.vc13_traumaEventCount,
      vc13_survivedCivilCrisis: prev.vc13_survivedCivilCrisis,
      vc14_legitimacyTurns,
      vc14_narrativeBattleWins: prev.vc14_narrativeBattleWins,
      vc14_deepfakesAgainst: prev.vc14_deepfakesAgainst,
      vc15_proxyObjectives: prev.vc15_proxyObjectives,
      vc15_directCombatActions: prev.vc15_directCombatActions,
      vc17_militaryCoercionActions: prev.vc17_militaryCoercionActions,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Turn Evaluation
  // ─────────────────────────────────────────────────────────

  /**
   * Evaluate all extended conditions for this turn.
   *
   * Loss conditions (VC-08, VC-09) are checked **first** — if triggered,
   * they short-circuit further evaluation. Victory conditions follow.
   *
   * @returns Array of triggered {@link ConditionCheckResult}s.
   */
  evaluateTurn(input: ExtendedConditionInput): ConditionCheckResult[] {
    const results: ConditionCheckResult[] = [];
    const { tracker, playerFaction } = input;

    // ── Find the player's leader ─────────────────────────────
    const playerLeader = this.findPlayerLeader(input.leaderProfiles, playerFaction);
    const playerNation = input.nationStates[playerFaction];
    const playerUnrest = input.civilUnrestComponents[playerFaction];
    const playerTech = input.technologyIndices[playerFaction];

    // ── Loss Conditions (checked first) ──────────────────────

    // VC-08: Coup d'État
    if (playerLeader !== undefined) {
      const coupTriggered = this.checkVC08(playerLeader);
      if (coupTriggered) {
        results.push({
          conditionId: 'VC-08',
          conditionName: "Coup d'État",
          conditionType: 'loss',
          triggered: true,
          triggeringFaction: playerFaction,
          reason:
            `Military power base (${String(playerLeader.powerBase.military)}) and ` +
            `security services (${String(playerLeader.powerBase.securityServices)}) ` +
            `both fell below threshold. Succession clarity ` +
            `(${String(playerLeader.vulnerabilities.successionClarity)}) too low to survive.`,
        });
      }
    }

    // VC-09: People's Revolution
    if (playerUnrest !== undefined) {
      const revolutionTriggered = this.checkVC09(playerUnrest);
      if (revolutionTriggered) {
        results.push({
          conditionId: 'VC-09',
          conditionName: "People's Revolution",
          conditionType: 'loss',
          triggered: true,
          triggeringFaction: playerFaction,
          reason:
            `Civil unrest reached ${String(playerUnrest.civilUnrest)} — ` +
            `non-violent people's revolution toppled the regime.`,
        });
      }
    }

    // Short-circuit: if any loss triggered, skip victory checks
    if (results.length > 0) {
      return results;
    }

    // ── Victory Conditions ───────────────────────────────────

    // VC-10: Iron Fist (checked at end of game or when required turns met)
    if (this.checkVC10(tracker)) {
      results.push({
        conditionId: 'VC-10',
        conditionName: 'Iron Fist',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason:
          `Maintained power for ${String(tracker.vc10_ironFistTurns)} turns ` +
          `with CivilUnrest ≥ ${String(this.cfg.vc10_ironFist.civilUnrestFloor)} ` +
          `and Stability ≤ ${String(this.cfg.vc10_ironFist.stabilityCeiling)}.`,
      });
    }

    // VC-11: Grand Strategist (post-game meta check)
    if (this.checkVC11(input.baseVictoryId, input.strategicGrade)) {
      results.push({
        conditionId: 'VC-11',
        conditionName: 'Grand Strategist',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason:
          `Achieved base victory ${String(input.baseVictoryId)} ` +
          `with Strategic Grade ${String(input.strategicGrade)}.`,
      });
    }

    // VC-12: Puppet Master
    if (this.checkVC12(tracker)) {
      results.push({
        conditionId: 'VC-12',
        conditionName: 'Puppet Master',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason:
          `Successfully manipulated ${String(tracker.vc12_manipulatedLeaders.length)} ` +
          `rival leaders without discovery.`,
      });
    }

    // VC-13: Unbreakable (end-of-game check — only valid at final turn)
    if (playerNation !== undefined && input.currentTurn >= this.maxTurns) {
      const playerLeaderEmo = playerLeader !== undefined
        ? input.emotionalStates[playerLeader.id]
        : undefined;
      const resolveScore = playerLeaderEmo?.resolve ?? 0;

      if (this.checkVC13(tracker, playerNation, resolveScore)) {
        results.push({
          conditionId: 'VC-13',
          conditionName: 'Unbreakable',
          conditionType: 'victory',
          triggered: true,
          triggeringFaction: playerFaction,
          reason:
            `Survived ${String(tracker.vc13_traumaEventCount)} trauma events, ` +
            `weathered civil crisis, ended with Stability ${String(playerNation.stability)} ` +
            `and Resolve ${String(resolveScore)}.`,
        });
      }
    }

    // VC-14: Information Hegemon
    if (this.checkVC14(tracker)) {
      results.push({
        conditionId: 'VC-14',
        conditionName: 'Information Hegemon',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason:
          `Legitimacy ≥ ${String(this.cfg.vc14_informationHegemon.legitimacyMin)} for ` +
          `${String(tracker.vc14_legitimacyTurns)} consecutive turns, ` +
          `${String(tracker.vc14_narrativeBattleWins)} narrative battle wins, ` +
          `${String(tracker.vc14_deepfakesAgainst)} deepfakes against.`,
      });
    }

    // VC-15: Shadow Emperor
    if (this.checkVC15(tracker)) {
      results.push({
        conditionId: 'VC-15',
        conditionName: 'Shadow Emperor',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason:
          `Achieved ${String(tracker.vc15_proxyObjectives)} strategic objectives ` +
          `via proxies with ${String(tracker.vc15_directCombatActions)} direct combat actions.`,
      });
    }

    // VC-16: Tech Singularity
    if (playerTech !== undefined && playerNation !== undefined) {
      if (this.checkVC16(playerTech, playerNation)) {
        results.push({
          conditionId: 'VC-16',
          conditionName: 'Tech Singularity',
          conditionType: 'victory',
          triggered: true,
          triggeringFaction: playerFaction,
          reason:
            `AI ${String(playerTech.ai)}, Quantum ${String(playerTech.quantum)}, ` +
            `Semiconductors ${String(playerTech.semiconductors)}, ` +
            `Stability ${String(playerNation.stability)}.`,
        });
      }
    }

    // VC-17: Resource Lord
    // Build resource control percents from resource security data
    if (playerNation !== undefined) {
      const resourcePercents = this.computeResourceControlPercents(
        input.resourceSecurity,
        playerFaction,
      );
      if (this.checkVC17(resourcePercents, playerNation, tracker)) {
        const controlledCategories = Object.entries(resourcePercents)
          .filter(([, pct]) => pct !== undefined && pct >= this.cfg.vc17_resourceLord.resourceControlThreshold)
          .map(([cat]) => cat);
        results.push({
          conditionId: 'VC-17',
          conditionName: 'Resource Lord',
          conditionType: 'victory',
          triggered: true,
          triggeringFaction: playerFaction,
          reason:
            `Controls ≥ ${String(this.cfg.vc17_resourceLord.resourceControlThreshold)}% of ` +
            `${String(controlledCategories.length)} resource categories ` +
            `(${controlledCategories.join(', ')}), DI ${String(playerNation.diplomaticInfluence)}, ` +
            `${String(tracker.vc17_militaryCoercionActions)} coercion actions.`,
        });
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────
  // Static Factory
  // ─────────────────────────────────────────────────────────

  /** Create a fresh tracker with all zeros/defaults. */
  static createDefaultTracker(): ExtendedConditionTracker {
    return {
      vc10_ironFistTurns: 0,
      vc10_ironFistViolated: false,
      vc12_manipulatedLeaders: [],
      vc12_psyOpsDiscovered: false,
      vc13_traumaEventCount: 0,
      vc13_survivedCivilCrisis: false,
      vc14_legitimacyTurns: 0,
      vc14_narrativeBattleWins: 0,
      vc14_deepfakesAgainst: 0,
      vc15_proxyObjectives: 0,
      vc15_directCombatActions: 0,
      vc17_militaryCoercionActions: 0,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Find the player's leader profile from the leader registry.
   * Returns `undefined` if no leader matches the player faction.
   */
  private findPlayerLeader(
    leaderProfiles: Record<LeaderId, LeaderProfile>,
    playerFaction: FactionId,
  ): LeaderProfile | undefined {
    const entries = Object.values(leaderProfiles) as LeaderProfile[];
    return entries.find((lp) => lp.identity.nation === playerFaction);
  }

  /**
   * Compute per-resource-category control percentages for the player faction.
   *
   * For each resource category, the player's security index is divided by
   * the sum of all factions' security indices to approximate control share.
   * Returns a record of category name → percentage (0–100).
   */
  private computeResourceControlPercents(
    resourceSecurity: Record<FactionId, ResourceSecurityIndex>,
    playerFaction: FactionId,
  ): Record<string, number> {
    const playerRes = resourceSecurity[playerFaction];
    if (playerRes === undefined) {
      return {};
    }

    const categories = ['energy', 'food', 'water', 'criticalMinerals'] as const;
    const result: Record<string, number> = {};

    for (const category of categories) {
      const playerValue = playerRes[category];
      let total = 0;

      const factionEntries = Object.values(resourceSecurity) as ResourceSecurityIndex[];
      for (const factionRes of factionEntries) {
        if (factionRes !== undefined) {
          total += factionRes[category];
        }
      }

      result[category] = total > 0 ? (playerValue / total) * 100 : 0;
    }

    return result;
  }
}
