/**
 * War Economy & Global Financial Stability Engine
 *
 * Implements two tightly coupled macro-economic mechanics that shape
 * mid-to-late-game strategy:
 *
 * **War Economy Mobilization (FR-1707):** A faction may declare a war
 * economy, immediately boosting military production and treasury income
 * at the cost of frozen GDP growth, rising civil unrest, and a one-time
 * legitimacy hit. If the war economy is sustained beyond the exhaustion
 * threshold the faction auto-transitions to an Exhausted phase with
 * GDP decay but retained military output. Deactivation at any point
 * triggers a mandatory Recession phase before returning to Peacetime.
 *
 * **Global Financial Stability Index (FR-1708):** The GFSI is a
 * composite 0-100 score reflecting the cumulative destabilising effects
 * of active sanctions, trade wars, currency attacks, and debt crises.
 * When the index drops below the contagion threshold, every faction
 * suffers a GDP penalty modulated by trade dependency. Safe-haven
 * currencies appreciate during contagion while others depreciate.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.financial`.
 *
 * @module war-economy
 * @see FR-1707 — War Economy Mobilization
 * @see FR-1708 — Global Financial Stability Index
 */

import { GAME_CONFIG } from '@/engine/config';
import { WarEconomyPhase } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the full `GAME_CONFIG.financial` section. */
export type WarEconomyConfig = typeof GAME_CONFIG.financial;

// ---------------------------------------------------------------------------
// FR-1707 — War Economy Mobilization Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating a faction's war-economy phase transition
 * and computing the resulting economic effects for the current turn.
 *
 * @see FR-1707
 */
export interface WarEconomyInput {
  /** Faction whose war economy is being evaluated. */
  readonly factionId: FactionId;
  /** The faction's current war-economy phase entering this turn. */
  readonly currentPhase: WarEconomyPhase;
  /** Cumulative turns the faction has spent in Mobilized or Exhausted phase (0+). */
  readonly turnsMobilized: number;
  /** Cumulative turns the faction has spent in Recession phase (0+). */
  readonly turnsInRecession: number;
  /** `true` if the player is activating the war economy this turn. */
  readonly activating: boolean;
  /** `true` if the player is deactivating the war economy this turn. */
  readonly deactivating: boolean;
  /** Current game turn number. */
  readonly currentTurn: TurnNumber;
}

/**
 * Per-turn economic effects produced by the war-economy evaluation.
 *
 * @see FR-1707
 */
export interface WarEconomyEffects {
  /** Military production multiplier bonus (0.3 when Mobilized/Exhausted, 0 otherwise). */
  readonly militaryProductionBoost: number;
  /** Treasury income multiplier bonus (0.2 when Mobilized, 0 otherwise). */
  readonly treasuryMobilizationBoost: number;
  /** GDP growth rate modifier (0 frozen, negative during Exhausted/Recession). */
  readonly gdpGrowthModifier: number;
  /** Civil-unrest points added per turn (3 when Mobilized/Exhausted, 0 otherwise). */
  readonly civilUnrestPerTurn: number;
  /** One-time legitimacy cost applied only on the activation turn (-5 or 0). */
  readonly legitimacyCost: number;
}

/**
 * Result of evaluating a single faction's war-economy state for one turn.
 * Contains the next phase, all derived effects, and a human-readable reason.
 *
 * @see FR-1707
 */
export interface WarEconomyResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** The phase the faction will occupy after this evaluation. */
  readonly phase: WarEconomyPhase;
  /** Computed economic effects for this turn. */
  readonly effects: WarEconomyEffects;
  /** Human-readable explanation of the phase transition / steady-state. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1708 — Global Financial Stability Index Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing the Global Financial Stability Index.
 *
 * @see FR-1708
 */
export interface GFSIInput {
  /** Number of sanctions regimes currently in effect across all factions. */
  readonly activeSanctionsCount: number;
  /** Number of trade wars currently active between factions. */
  readonly activeTradeWarsCount: number;
  /** Number of active currency-manipulation attacks. */
  readonly activeCurrencyAttacksCount: number;
  /** Number of sovereign debt crises currently unresolved. */
  readonly activeDebtCrisesCount: number;
  /** Current game turn number. */
  readonly currentTurn: TurnNumber;
}

/**
 * Breakdown of how each category of financial disruption degrades the GFSI.
 *
 * @see FR-1708
 */
export interface GFSIImpactBreakdown {
  /** Points deducted due to active sanctions. */
  readonly sanctionsImpact: number;
  /** Points deducted due to trade wars. */
  readonly tradeWarsImpact: number;
  /** Points deducted due to currency attacks. */
  readonly currencyAttacksImpact: number;
  /** Points deducted due to unresolved debt crises. */
  readonly debtCrisesImpact: number;
}

/**
 * Result of the Global Financial Stability Index computation.
 *
 * @see FR-1708
 */
export interface GFSIResult {
  /** Composite stability score (0–100, higher = more stable). */
  readonly score: number;
  /** `true` when the score has dropped below the contagion threshold. */
  readonly contagionActive: boolean;
  /** Per-turn GDP penalty applied globally when contagion is active (-0.02 or 0). */
  readonly globalGDPPenalty: number;
  /** Itemised contribution of each destabilising factor. */
  readonly contributingFactors: GFSIImpactBreakdown;
  /** Human-readable explanation of the score breakdown. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1708 — Contagion Effects Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing per-faction contagion effects based on the
 * current GFSI score and the faction's trade profile.
 *
 * @see FR-1708
 */
export interface ContagionEffectsInput {
  /** Faction to evaluate contagion effects for. */
  readonly factionId: FactionId;
  /** Current GFSI score (0–100). */
  readonly gfsiScore: number;
  /** Fraction of GDP derived from international trade (0–1). */
  readonly factionTradeDependency: number;
  /** `true` if the faction holds a safe-haven currency (e.g. USD, CHF, JPY). */
  readonly isSafeHavenCurrency: boolean;
  /** Current game turn number. */
  readonly currentTurn: TurnNumber;
}

/**
 * Per-faction effects of global financial contagion.
 *
 * @see FR-1708
 */
export interface ContagionEffectsResult {
  /** Faction evaluated. */
  readonly factionId: FactionId;
  /** Whether global contagion is active (GFSI < threshold). */
  readonly contagionActive: boolean;
  /** GDP penalty amplified by trade dependency. */
  readonly gdpPenalty: number;
  /**
   * Currency strength modifier:
   *  +0.1 for safe-haven currencies during contagion,
   *  -0.1 for non-safe-haven currencies during contagion,
   *   0 when contagion is inactive.
   */
  readonly currencyStrengthModifier: number;
  /** Human-readable explanation of contagion effects. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine encapsulating War Economy Mobilization (FR-1707) and
 * Global Financial Stability Index (FR-1708) computations.
 *
 * Every public method is a **pure function** — it reads only its arguments
 * and `GAME_CONFIG.financial`, returning a fresh result object with no
 * external side effects.
 *
 * @see FR-1707 — War Economy Mobilization
 * @see FR-1708 — Global Financial Stability Index
 */
export class WarEconomyEngine {
  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Clamps `value` to the inclusive range [`min`, `max`].
   *
   * @param value - The number to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // -----------------------------------------------------------------------
  // FR-1707 — War Economy Mobilization
  // -----------------------------------------------------------------------

  /**
   * Evaluates a faction's war-economy phase for the current turn and returns
   * the next phase together with all derived economic effects.
   *
   * **Phase transitions** (exhaustive):
   *
   * | Current Phase | Condition                       | Next Phase  |
   * |---------------|---------------------------------|-------------|
   * | Peacetime     | `activating`                    | Mobilized   |
   * | Peacetime     | otherwise                       | Peacetime   |
   * | Mobilized     | `deactivating`                  | Recession   |
   * | Mobilized     | `turnsMobilized ≥ threshold`    | Exhausted   |
   * | Mobilized     | otherwise                       | Mobilized   |
   * | Exhausted     | `deactivating`                  | Recession   |
   * | Exhausted     | otherwise                       | Exhausted   |
   * | Recession     | `turnsInRecession ≥ duration`   | Peacetime   |
   * | Recession     | otherwise                       | Recession   |
   *
   * @param input - Current war-economy state and player intent.
   * @returns The next phase, economic effects, and explanatory reason.
   * @see FR-1707
   */
  static evaluateWarEconomy(input: WarEconomyInput): WarEconomyResult {
    const cfg = GAME_CONFIG.financial.warEconomy;

    switch (input.currentPhase) {
      // -------------------------------------------------------------------
      // Peacetime
      // -------------------------------------------------------------------
      case WarEconomyPhase.Peacetime: {
        if (input.activating) {
          return {
            factionId: input.factionId,
            phase: WarEconomyPhase.Mobilized,
            effects: {
              militaryProductionBoost: cfg.militaryProductionBoost,
              treasuryMobilizationBoost: cfg.treasuryMobilizationBoost,
              gdpGrowthModifier: cfg.gdpGrowthFreeze,
              civilUnrestPerTurn: cfg.civilUnrestPerTurn,
              legitimacyCost: cfg.legitimacyCost,
            },
            reason:
              `${input.factionId} declared a war economy on turn ${String(input.currentTurn)}. ` +
              `Military production boosted by ${String(cfg.militaryProductionBoost * 100)}%, ` +
              `treasury income boosted by ${String(cfg.treasuryMobilizationBoost * 100)}%. ` +
              `GDP growth frozen. Civil unrest rises by ${String(cfg.civilUnrestPerTurn)}/turn. ` +
              `Legitimacy cost: ${String(cfg.legitimacyCost)}.`,
          };
        }

        return {
          factionId: input.factionId,
          phase: WarEconomyPhase.Peacetime,
          effects: {
            militaryProductionBoost: 0,
            treasuryMobilizationBoost: 0,
            gdpGrowthModifier: 0,
            civilUnrestPerTurn: 0,
            legitimacyCost: 0,
          },
          reason: `${input.factionId} remains in peacetime economy.`,
        };
      }

      // -------------------------------------------------------------------
      // Mobilized
      // -------------------------------------------------------------------
      case WarEconomyPhase.Mobilized: {
        if (input.deactivating) {
          return {
            factionId: input.factionId,
            phase: WarEconomyPhase.Recession,
            effects: {
              militaryProductionBoost: 0,
              treasuryMobilizationBoost: 0,
              gdpGrowthModifier: cfg.recessionGDPDecay,
              civilUnrestPerTurn: 0,
              legitimacyCost: 0,
            },
            reason:
              `${input.factionId} deactivated the war economy from Mobilized phase. ` +
              `Entering recession with GDP decay of ${String(cfg.recessionGDPDecay * 100)}%/turn ` +
              `for ${String(cfg.recessionDuration)} turns.`,
          };
        }

        if (input.turnsMobilized >= cfg.exhaustionTurnThreshold) {
          return {
            factionId: input.factionId,
            phase: WarEconomyPhase.Exhausted,
            effects: {
              militaryProductionBoost: cfg.militaryProductionBoost,
              treasuryMobilizationBoost: 0,
              gdpGrowthModifier: cfg.exhaustionGDPDecay,
              civilUnrestPerTurn: cfg.civilUnrestPerTurn,
              legitimacyCost: 0,
            },
            reason:
              `${input.factionId} war economy exhausted after ${String(input.turnsMobilized)} turns of mobilization ` +
              `(threshold: ${String(cfg.exhaustionTurnThreshold)}). Treasury boost lost; ` +
              `GDP now decaying at ${String(cfg.exhaustionGDPDecay * 100)}%/turn.`,
          };
        }

        return {
          factionId: input.factionId,
          phase: WarEconomyPhase.Mobilized,
          effects: {
            militaryProductionBoost: cfg.militaryProductionBoost,
            treasuryMobilizationBoost: cfg.treasuryMobilizationBoost,
            gdpGrowthModifier: cfg.gdpGrowthFreeze,
            civilUnrestPerTurn: cfg.civilUnrestPerTurn,
            legitimacyCost: 0,
          },
          reason:
            `${input.factionId} continues mobilized war economy ` +
            `(${String(input.turnsMobilized)}/${String(cfg.exhaustionTurnThreshold)} turns to exhaustion).`,
        };
      }

      // -------------------------------------------------------------------
      // Exhausted
      // -------------------------------------------------------------------
      case WarEconomyPhase.Exhausted: {
        if (input.deactivating) {
          return {
            factionId: input.factionId,
            phase: WarEconomyPhase.Recession,
            effects: {
              militaryProductionBoost: 0,
              treasuryMobilizationBoost: 0,
              gdpGrowthModifier: cfg.recessionGDPDecay,
              civilUnrestPerTurn: 0,
              legitimacyCost: 0,
            },
            reason:
              `${input.factionId} deactivated the war economy from Exhausted phase. ` +
              `Entering recession with GDP decay of ${String(cfg.recessionGDPDecay * 100)}%/turn ` +
              `for ${String(cfg.recessionDuration)} turns.`,
          };
        }

        return {
          factionId: input.factionId,
          phase: WarEconomyPhase.Exhausted,
          effects: {
            militaryProductionBoost: cfg.militaryProductionBoost,
            treasuryMobilizationBoost: 0,
            gdpGrowthModifier: cfg.exhaustionGDPDecay,
            civilUnrestPerTurn: cfg.civilUnrestPerTurn,
            legitimacyCost: 0,
          },
          reason:
            `${input.factionId} remains in exhausted war economy. Military production ` +
            `still boosted by ${String(cfg.militaryProductionBoost * 100)}% but treasury bonus lost. ` +
            `GDP decaying at ${String(cfg.exhaustionGDPDecay * 100)}%/turn.`,
        };
      }

      // -------------------------------------------------------------------
      // Recession
      // -------------------------------------------------------------------
      case WarEconomyPhase.Recession: {
        if (input.turnsInRecession >= cfg.recessionDuration) {
          return {
            factionId: input.factionId,
            phase: WarEconomyPhase.Peacetime,
            effects: {
              militaryProductionBoost: 0,
              treasuryMobilizationBoost: 0,
              gdpGrowthModifier: 0,
              civilUnrestPerTurn: 0,
              legitimacyCost: 0,
            },
            reason:
              `${input.factionId} recession ended after ${String(input.turnsInRecession)} turns. ` +
              `Economy returns to peacetime.`,
          };
        }

        return {
          factionId: input.factionId,
          phase: WarEconomyPhase.Recession,
          effects: {
            militaryProductionBoost: 0,
            treasuryMobilizationBoost: 0,
            gdpGrowthModifier: cfg.recessionGDPDecay,
            civilUnrestPerTurn: 0,
            legitimacyCost: 0,
          },
          reason:
            `${input.factionId} in post-war recession ` +
            `(${String(input.turnsInRecession)}/${String(cfg.recessionDuration)} turns). ` +
            `GDP decaying at ${String(cfg.recessionGDPDecay * 100)}%/turn.`,
        };
      }

      // -------------------------------------------------------------------
      // Exhaustive check
      // -------------------------------------------------------------------
      default: {
        const _exhaustive: never = input.currentPhase;
        throw new Error(`Unhandled WarEconomyPhase: ${String(_exhaustive)}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // FR-1708 — Global Financial Stability Index
  // -----------------------------------------------------------------------

  /**
   * Computes the Global Financial Stability Index (GFSI) from the current
   * count of destabilising financial events across all factions.
   *
   * The GFSI starts at a baseline of 100 and is degraded by:
   * - Each active sanction regime  → −5 points
   * - Each active trade war        → −8 points
   * - Each currency attack         → −10 points
   * - Each unresolved debt crisis  → −7 points
   *
   * If the resulting score falls below the contagion threshold (default 30),
   * a global GDP penalty is applied to every faction each turn.
   *
   * @param input - Counts of active financial disruptions.
   * @returns Composite score, contagion flag, penalty, and factor breakdown.
   * @see FR-1708
   */
  static computeGFSI(input: GFSIInput): GFSIResult {
    const cfg = GAME_CONFIG.financial.gfsiContagion;
    const baseScore = 100;

    const sanctionsImpact = input.activeSanctionsCount * 5;
    const tradeWarsImpact = input.activeTradeWarsCount * 8;
    const currencyAttacksImpact = input.activeCurrencyAttacksCount * 10;
    const debtCrisesImpact = input.activeDebtCrisesCount * 7;

    const totalImpact =
      sanctionsImpact + tradeWarsImpact + currencyAttacksImpact + debtCrisesImpact;

    const score = WarEconomyEngine.clamp(baseScore - totalImpact, 0, 100);
    const contagionActive = score < cfg.contagionThreshold;
    const globalGDPPenalty = contagionActive ? cfg.gdpPenaltyPerTurn : 0;

    const factorParts: string[] = [];
    if (sanctionsImpact > 0) {
      factorParts.push(`sanctions −${String(sanctionsImpact)}`);
    }
    if (tradeWarsImpact > 0) {
      factorParts.push(`trade wars −${String(tradeWarsImpact)}`);
    }
    if (currencyAttacksImpact > 0) {
      factorParts.push(`currency attacks −${String(currencyAttacksImpact)}`);
    }
    if (debtCrisesImpact > 0) {
      factorParts.push(`debt crises −${String(debtCrisesImpact)}`);
    }

    const factorSummary =
      factorParts.length > 0 ? factorParts.join(', ') : 'no destabilising factors';

    const contagionNote = contagionActive
      ? ` Contagion ACTIVE — global GDP penalty ${String(cfg.gdpPenaltyPerTurn * 100)}%/turn.`
      : ' No contagion.';

    return {
      score,
      contagionActive,
      globalGDPPenalty,
      contributingFactors: {
        sanctionsImpact,
        tradeWarsImpact,
        currencyAttacksImpact,
        debtCrisesImpact,
      },
      reason:
        `GFSI ${String(score)}/100 on turn ${String(input.currentTurn)} ` +
        `(${factorSummary}).${contagionNote}`,
    };
  }

  // -----------------------------------------------------------------------
  // FR-1708 — Contagion Effects
  // -----------------------------------------------------------------------

  /**
   * Computes the per-faction economic effects of global financial contagion
   * given the current GFSI score and the faction's trade profile.
   *
   * When contagion is active (GFSI < threshold):
   * - **GDP penalty** = base penalty × (1 + tradeDependency).
   *   A faction with 80% trade dependency suffers 1.8× the base penalty.
   * - **Currency strength**: safe-haven currencies (USD, CHF, JPY) gain
   *   +0.1; all others lose −0.1.
   *
   * When contagion is inactive all modifiers are zero.
   *
   * @param input - Faction profile and current GFSI score.
   * @returns GDP penalty, currency modifier, and explanatory reason.
   * @see FR-1708
   */
  static computeContagionEffects(input: ContagionEffectsInput): ContagionEffectsResult {
    const cfg = GAME_CONFIG.financial.gfsiContagion;
    const contagionActive = input.gfsiScore < cfg.contagionThreshold;

    if (!contagionActive) {
      return {
        factionId: input.factionId,
        contagionActive: false,
        gdpPenalty: 0,
        currencyStrengthModifier: 0,
        reason:
          `${input.factionId} unaffected by contagion — GFSI ${String(input.gfsiScore)}/100 ` +
          `is above threshold ${String(cfg.contagionThreshold)}.`,
      };
    }

    const gdpPenalty = cfg.gdpPenaltyPerTurn * (1 + input.factionTradeDependency);

    const currencyStrengthModifier = input.isSafeHavenCurrency ? 0.1 : -0.1;

    const currencyNote = input.isSafeHavenCurrency
      ? 'safe-haven currency appreciates (+0.1)'
      : 'non-safe-haven currency depreciates (−0.1)';

    return {
      factionId: input.factionId,
      contagionActive: true,
      gdpPenalty,
      currencyStrengthModifier,
      reason:
        `${input.factionId} hit by global contagion (GFSI ${String(input.gfsiScore)}/100). ` +
        `GDP penalty ${String(gdpPenalty * 100)}%/turn ` +
        `(base ${String(cfg.gdpPenaltyPerTurn * 100)}% × ` +
        `(1 + ${String(input.factionTradeDependency)} trade dependency)); ` +
        `${currencyNote}.`,
    };
  }
}
