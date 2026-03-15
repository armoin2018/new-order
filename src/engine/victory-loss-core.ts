/**
 * Victory & Loss Condition Core Detection Engine (VC-01 → VC-07)
 *
 * Implements §13 core victory and loss conditions for the New Order
 * geopolitical simulation. Evaluates per-turn game state against seven
 * condition definitions — three duration-based victories, two immediate
 * losses, one global catastrophe, and one conditional end-of-game score.
 *
 * All public methods are **pure functions** — no side effects, no mutation of
 * external state. Configuration is injected from {@link GAME_CONFIG.victoryLoss}
 * per NFR-204.
 *
 * @see §13     Victory & Loss Conditions
 * @see NFR-204 All formulas configurable via constants
 *
 * @module engine/victory-loss-core
 */

import type {
  FactionId,
  TurnNumber,
  NationState,
  RelationshipMatrix,
  CivilUnrestComponents,
  LeaderProfile,
} from '@/data/types';

import type { LeaderId } from '@/data/types';

import { ALL_FACTIONS } from '@/data/types';

import { GAME_CONFIG } from '@/engine/config';

// ═══════════════════════════════════════════════════════════════════════════
// Exported Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration slice derived from {@link GAME_CONFIG.victoryLoss}.
 * Preserves literal types from the `as const` assertion.
 */
export type VictoryLossCoreConfig = typeof GAME_CONFIG.victoryLoss;

/** Discriminant for condition outcomes. */
export type ConditionType = 'victory' | 'loss' | 'loss_all' | 'conditional';

/**
 * Static definition of a victory/loss condition.
 * Used for UI display, tooltips, and condition enumeration.
 */
export interface ConditionDefinition {
  /** Machine identifier, e.g. 'VC-01'. */
  id: string;
  /** Human-readable name, e.g. 'Hegemonic Dominance'. */
  name: string;
  /** Whether it's a victory, loss, global loss, or conditional. */
  type: ConditionType;
  /** One-sentence description of the trigger logic. */
  description: string;
}

/**
 * Result of evaluating a single condition for one turn.
 * Returned by {@link VictoryLossCoreEngine.evaluateTurn}.
 */
export interface ConditionCheckResult {
  /** Condition identifier, e.g. 'VC-01'. */
  conditionId: string;
  /** Condition name, e.g. 'Hegemonic Dominance'. */
  conditionName: string;
  /** Condition category. */
  conditionType: ConditionType;
  /** Whether the condition was triggered this turn. */
  triggered: boolean;
  /** Faction that triggered it (`null` for global conditions like Nuclear Winter). */
  triggeringFaction: FactionId | null;
  /** Human-readable reason explaining the trigger or non-trigger. */
  reason: string;
  /** For VC-07 Survival, the winner's faction and composite score. */
  survivalWinner?: { factionId: FactionId; score: number } | null;
}

/**
 * Tracks how many consecutive turns each duration-based condition
 * has been satisfied. Passed in each turn and returned (immutably)
 * by {@link VictoryLossCoreEngine.updateTracker}.
 */
export interface ConsecutiveTurnTracker {
  /** Turns the player has met VC-01 Hegemonic Dominance thresholds. */
  vc01: number;
  /** Turns the player has met VC-02 Economic Supremacy thresholds. */
  vc02: number;
  /** Turns all bilateral tensions with the player have been below threshold (VC-03). */
  vc03: number;
  /** Turns all bilateral tensions with the player have been above threshold (VC-06). */
  vc06: number;
}

/**
 * Composite input payload supplied to the engine each turn.
 * Aggregates every piece of state needed for condition evaluation.
 */
export interface CoreConditionInput {
  /** Current simulation turn (1-based). */
  currentTurn: TurnNumber;
  /** Which faction the human player controls. */
  playerFaction: FactionId;
  /** Per-faction nation states. */
  nationStates: Record<FactionId, NationState>;
  /** Bilateral tension matrix (FactionId × FactionId → TensionLevel). */
  relationshipMatrix: RelationshipMatrix;
  /** Per-faction civil unrest breakdown. */
  civilUnrestComponents: Record<FactionId, CivilUnrestComponents>;
  /** Leader profiles keyed by LeaderId. */
  leaderProfiles: Record<LeaderId, LeaderProfile>;
  /** Consecutive-turn counters from the previous turn. */
  consecutiveTracker: ConsecutiveTurnTracker;
}

// ═══════════════════════════════════════════════════════════════════════════
// Condition Definitions (static catalogue)
// ═══════════════════════════════════════════════════════════════════════════

const CORE_CONDITION_DEFINITIONS: readonly ConditionDefinition[] = [
  {
    id: 'VC-01',
    name: 'Hegemonic Dominance',
    type: 'victory',
    description:
      'Stability ≥ 80, Diplomatic Influence ≥ 70, Military Readiness ≥ 60 for 6 consecutive turns.',
  },
  {
    id: 'VC-02',
    name: 'Economic Supremacy',
    type: 'victory',
    description:
      'Player GDP exceeds the combined GDP of the top-2 rival nations for 12 consecutive turns.',
  },
  {
    id: 'VC-03',
    name: 'Pax Nationis',
    type: 'victory',
    description:
      'All bilateral tensions involving the player remain below 20 for 12 consecutive turns.',
  },
  {
    id: 'VC-04',
    name: 'Government Collapse',
    type: 'loss',
    description:
      'Stability drops to 0 or Civil Unrest reaches 100 — immediate loss.',
  },
  {
    id: 'VC-05',
    name: 'Nuclear Winter',
    type: 'loss_all',
    description:
      "Any nation's Nuclear Threshold reaches 100 — all players lose.",
  },
  {
    id: 'VC-06',
    name: 'Isolation',
    type: 'loss',
    description:
      'All bilateral tensions with the player exceed +80 for 6 consecutive turns.',
  },
  {
    id: 'VC-07',
    name: 'Survival',
    type: 'conditional',
    description:
      'After 60 turns the faction with the highest composite score (Stability + GDP + Diplomatic Influence) wins.',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core Victory & Loss Condition detection engine.
 *
 * Instantiated once per game session. Configuration is read from
 * {@link GAME_CONFIG.victoryLoss} but may be overridden via the constructor
 * for testing.
 */
export class VictoryLossCoreEngine {
  /** Victory/loss configuration slice. */
  private readonly cfg: VictoryLossCoreConfig;
  /** Maximum turns before VC-07 Survival is evaluated. */
  private readonly maxTurns: number;

  constructor(config?: VictoryLossCoreConfig, maxTurns?: number) {
    this.cfg = config ?? GAME_CONFIG.victoryLoss;
    this.maxTurns = maxTurns ?? GAME_CONFIG.meta.MAX_TURNS;
  }

  // ─────────────────────────────────────────────────────────
  // Static catalogue
  // ─────────────────────────────────────────────────────────

  /** Return the static list of all core condition definitions (VC-01 → VC-07). */
  getConditionDefinitions(): ConditionDefinition[] {
    return [...CORE_CONDITION_DEFINITIONS];
  }

  // ─────────────────────────────────────────────────────────
  // Individual threshold checks
  // ─────────────────────────────────────────────────────────

  /**
   * VC-01 Hegemonic Dominance — single-turn threshold check.
   *
   * @returns `true` when the player's stability, diplomatic influence,
   *          and military readiness all meet or exceed their minimums.
   */
  checkVC01Thresholds(playerNation: NationState): boolean {
    const { stabilityMin, diplomaticInfluenceMin, militaryReadinessMin } =
      this.cfg.vc01_hegemonicDominance;

    return (
      playerNation.stability >= stabilityMin &&
      playerNation.diplomaticInfluence >= diplomaticInfluenceMin &&
      playerNation.militaryReadiness >= militaryReadinessMin
    );
  }

  /**
   * VC-02 Economic Supremacy — single-turn threshold check.
   *
   * The player's GDP must exceed the combined GDP of the top-N rival
   * factions (sorted descending, N = `rivalCountForComparison`).
   */
  checkVC02Thresholds(
    playerNation: NationState,
    allNations: Record<FactionId, NationState>,
    playerFaction: FactionId,
  ): boolean {
    const { rivalCountForComparison } = this.cfg.vc02_economicSupremacy;

    // Collect rival GDPs (every faction except the player).
    const rivalGdps: number[] = [];
    for (const faction of ALL_FACTIONS) {
      if (faction === playerFaction) continue;
      const nation = allNations[faction];
      rivalGdps.push(nation?.gdp ?? 0);
    }

    // Sort descending and sum the top-N.
    rivalGdps.sort((a, b) => b - a);
    let topRivalSum = 0;
    for (let i = 0; i < rivalCountForComparison && i < rivalGdps.length; i++) {
      topRivalSum += rivalGdps[i] ?? 0;
    }

    return playerNation.gdp > topRivalSum;
  }

  /**
   * VC-03 Pax [Nation] — single-turn threshold check.
   *
   * ALL bilateral tensions between the player and every other faction
   * must be strictly below `tensionMax`.
   */
  checkVC03Thresholds(
    playerFaction: FactionId,
    matrix: RelationshipMatrix,
  ): boolean {
    const { tensionMax } = this.cfg.vc03_pax;

    for (const rival of ALL_FACTIONS) {
      if (rival === playerFaction) continue;

      const tension = matrix[playerFaction]?.[rival] ?? 0;
      if (tension >= tensionMax) {
        return false;
      }
    }

    return true;
  }

  /**
   * VC-04 Government Collapse — immediate loss check.
   *
   * Triggers when the player's stability drops to 0 **or** civil unrest
   * reaches 100. No consecutive-turn requirement.
   */
  checkVC04(
    playerNation: NationState,
    civilUnrest: CivilUnrestComponents,
  ): boolean {
    const { stabilityTrigger, civilUnrestTrigger } =
      this.cfg.vc04_governmentCollapse;

    return (
      playerNation.stability <= stabilityTrigger ||
      civilUnrest.civilUnrest >= civilUnrestTrigger
    );
  }

  /**
   * VC-05 Nuclear Winter — global immediate loss check.
   *
   * Fires when **any** nation's `nuclearThreshold` reaches or exceeds
   * the configured trigger (default 100). Returns the triggering faction.
   */
  checkVC05(
    allNations: Record<FactionId, NationState>,
  ): { triggered: boolean; triggeringFaction: FactionId | null } {
    const { nuclearThresholdTrigger } = this.cfg.vc05_nuclearWinter;

    for (const faction of ALL_FACTIONS) {
      const nation = allNations[faction];
      if ((nation?.nuclearThreshold ?? 0) >= nuclearThresholdTrigger) {
        return { triggered: true, triggeringFaction: faction };
      }
    }

    return { triggered: false, triggeringFaction: null };
  }

  /**
   * VC-06 Isolation — single-turn threshold check.
   *
   * ALL bilateral tensions between the player and every other faction
   * must be strictly above `tensionMin`.
   */
  checkVC06Thresholds(
    playerFaction: FactionId,
    matrix: RelationshipMatrix,
  ): boolean {
    const { tensionMin } = this.cfg.vc06_isolation;

    for (const rival of ALL_FACTIONS) {
      if (rival === playerFaction) continue;

      const tension = matrix[playerFaction]?.[rival] ?? 0;
      if (tension <= tensionMin) {
        return false;
      }
    }

    return true;
  }

  /**
   * VC-07 Survival — compute composite scores for every faction.
   *
   * Score = (Stability × w_s) + (GDP × w_gdp) + (DiplomaticInfluence × w_di)
   *
   * Returns the array sorted descending by score.
   */
  computeSurvivalScores(
    allNations: Record<FactionId, NationState>,
  ): Array<{ factionId: FactionId; score: number }> {
    const { scoreWeights } = this.cfg.vc07_survival;

    const scores: Array<{ factionId: FactionId; score: number }> = [];

    for (const faction of ALL_FACTIONS) {
      const nation = allNations[faction];
      const stability = nation?.stability ?? 0;
      const gdp = nation?.gdp ?? 0;
      const diplomaticInfluence = nation?.diplomaticInfluence ?? 0;

      const score =
        stability * scoreWeights.stability +
        gdp * scoreWeights.gdp +
        diplomaticInfluence * scoreWeights.diplomaticInfluence;

      scores.push({ factionId: faction, score });
    }

    // Sort descending by score.
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  // ─────────────────────────────────────────────────────────
  // Tracker management
  // ─────────────────────────────────────────────────────────

  /**
   * Update the consecutive-turn tracker based on the current turn state.
   *
   * Returns a **new** tracker object — the input is never mutated.
   * Counters are incremented by 1 when thresholds are met this turn,
   * and reset to 0 when they are not.
   */
  updateTracker(input: CoreConditionInput): ConsecutiveTurnTracker {
    const { playerFaction, nationStates, relationshipMatrix } = input;
    const playerNation = nationStates[playerFaction];

    // Safely handle missing player nation (should never happen in practice).
    const hasPlayer = playerNation !== undefined;

    // VC-01
    const vc01Met = hasPlayer && this.checkVC01Thresholds(playerNation);
    const vc01 = vc01Met ? input.consecutiveTracker.vc01 + 1 : 0;

    // VC-02
    const vc02Met =
      hasPlayer &&
      this.checkVC02Thresholds(playerNation, nationStates, playerFaction);
    const vc02 = vc02Met ? input.consecutiveTracker.vc02 + 1 : 0;

    // VC-03
    const vc03Met = this.checkVC03Thresholds(playerFaction, relationshipMatrix);
    const vc03 = vc03Met ? input.consecutiveTracker.vc03 + 1 : 0;

    // VC-06
    const vc06Met = this.checkVC06Thresholds(playerFaction, relationshipMatrix);
    const vc06 = vc06Met ? input.consecutiveTracker.vc06 + 1 : 0;

    return { vc01, vc02, vc03, vc06 };
  }

  // ─────────────────────────────────────────────────────────
  // Main per-turn evaluation
  // ─────────────────────────────────────────────────────────

  /**
   * Evaluate ALL core conditions for a single turn.
   *
   * Evaluation order (by priority):
   *  1. **VC-05** Nuclear Winter (global catastrophe — checked first)
   *  2. **VC-04** Government Collapse (immediate player loss)
   *  3. **VC-01** Hegemonic Dominance (duration-based victory)
   *  4. **VC-02** Economic Supremacy (duration-based victory)
   *  5. **VC-03** Pax [Nation] (duration-based victory)
   *  6. **VC-06** Isolation (duration-based loss)
   *  7. **VC-07** Survival (conditional — only at turn ≥ maxTurns)
   *
   * @returns Array of triggered {@link ConditionCheckResult}s.
   *          Empty if no condition is triggered this turn.
   */
  evaluateTurn(input: CoreConditionInput): ConditionCheckResult[] {
    const {
      currentTurn,
      playerFaction,
      nationStates,
      civilUnrestComponents,
    } = input;

    const results: ConditionCheckResult[] = [];

    const playerNation = nationStates[playerFaction];
    const playerUnrest = civilUnrestComponents[playerFaction];

    // Update tracker with this turn's state to get latest counts.
    const updatedTracker = this.updateTracker(input);

    // ── VC-05: Nuclear Winter (global, highest priority) ─────────
    const vc05Result = this.checkVC05(nationStates);
    if (vc05Result.triggered) {
      results.push({
        conditionId: 'VC-05',
        conditionName: 'Nuclear Winter',
        conditionType: 'loss_all',
        triggered: true,
        triggeringFaction: vc05Result.triggeringFaction,
        reason: `Nuclear threshold reached 100 for ${String(vc05Result.triggeringFaction)} — all factions lose.`,
      });
      // Nuclear Winter is catastrophic — return immediately.
      return results;
    }

    // ── VC-04: Government Collapse (immediate player loss) ───────
    if (
      playerNation !== undefined &&
      playerUnrest !== undefined &&
      this.checkVC04(playerNation, playerUnrest)
    ) {
      const stabilityZero =
        playerNation.stability <=
        this.cfg.vc04_governmentCollapse.stabilityTrigger;
      const unrestMax =
        playerUnrest.civilUnrest >=
        this.cfg.vc04_governmentCollapse.civilUnrestTrigger;

      const parts: string[] = [];
      if (stabilityZero) parts.push('stability reached 0');
      if (unrestMax) parts.push('civil unrest reached 100');

      results.push({
        conditionId: 'VC-04',
        conditionName: 'Government Collapse',
        conditionType: 'loss',
        triggered: true,
        triggeringFaction: playerFaction,
        reason: `Government collapse for ${playerFaction}: ${parts.join(' and ')}.`,
      });
      // Immediate loss — return now.
      return results;
    }

    // ── VC-01: Hegemonic Dominance (duration-based victory) ──────
    const vc01Required = this.cfg.vc01_hegemonicDominance.consecutiveTurns;
    if (updatedTracker.vc01 >= vc01Required) {
      results.push({
        conditionId: 'VC-01',
        conditionName: 'Hegemonic Dominance',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason: `${playerFaction} maintained Stability ≥ ${String(this.cfg.vc01_hegemonicDominance.stabilityMin)}, ` +
          `Diplomatic Influence ≥ ${String(this.cfg.vc01_hegemonicDominance.diplomaticInfluenceMin)}, ` +
          `Military Readiness ≥ ${String(this.cfg.vc01_hegemonicDominance.militaryReadinessMin)} ` +
          `for ${String(vc01Required)} consecutive turns.`,
      });
    }

    // ── VC-02: Economic Supremacy (duration-based victory) ───────
    const vc02Required = this.cfg.vc02_economicSupremacy.consecutiveTurns;
    if (updatedTracker.vc02 >= vc02Required) {
      results.push({
        conditionId: 'VC-02',
        conditionName: 'Economic Supremacy',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason: `${playerFaction} GDP exceeded the combined top-${String(this.cfg.vc02_economicSupremacy.rivalCountForComparison)} ` +
          `rival GDPs for ${String(vc02Required)} consecutive turns.`,
      });
    }

    // ── VC-03: Pax [Nation] (duration-based victory) ─────────────
    const vc03Required = this.cfg.vc03_pax.consecutiveTurns;
    if (updatedTracker.vc03 >= vc03Required) {
      results.push({
        conditionId: 'VC-03',
        conditionName: 'Pax Nationis',
        conditionType: 'victory',
        triggered: true,
        triggeringFaction: playerFaction,
        reason: `All bilateral tensions involving ${playerFaction} remained below ` +
          `${String(this.cfg.vc03_pax.tensionMax)} for ${String(vc03Required)} consecutive turns.`,
      });
    }

    // ── VC-06: Isolation (duration-based loss) ───────────────────
    const vc06Required = this.cfg.vc06_isolation.consecutiveTurns;
    if (updatedTracker.vc06 >= vc06Required) {
      results.push({
        conditionId: 'VC-06',
        conditionName: 'Isolation',
        conditionType: 'loss',
        triggered: true,
        triggeringFaction: playerFaction,
        reason: `All bilateral tensions with ${playerFaction} exceeded ` +
          `+${String(this.cfg.vc06_isolation.tensionMin)} for ${String(vc06Required)} consecutive turns.`,
      });
    }

    // ── VC-07: Survival (conditional — final turn) ───────────────
    if ((currentTurn as number) >= this.maxTurns) {
      const scores = this.computeSurvivalScores(nationStates);
      const winner = scores[0];

      if (winner !== undefined) {
        results.push({
          conditionId: 'VC-07',
          conditionName: 'Survival',
          conditionType: 'conditional',
          triggered: true,
          triggeringFaction: winner.factionId,
          reason: `Turn limit (${String(this.maxTurns)}) reached. ` +
            `${winner.factionId} wins Survival with composite score ${String(winner.score)}.`,
          survivalWinner: { factionId: winner.factionId, score: winner.score },
        });
      }
    }

    return results;
  }
}
