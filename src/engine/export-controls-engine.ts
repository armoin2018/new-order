/**
 * Export Controls & Semiconductor Chokepoint Engine — FR-1803
 *
 * Implements the export-control regime, semiconductor supply-chain
 * leverage, circumvention pathways, and coalition-eligibility checks
 * for the technology-race subsystem.
 *
 * Covers:
 * - Unilateral vs. multilateral export controls with distinct cost profiles
 * - Semiconductor production chokepoint leveraging
 * - Three circumvention methods (espionage, third-party transshipment,
 *   domestic substitution) with cost / time / risk trade-offs
 * - Coalition formation eligibility based on combined domain share
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.technology`.
 *
 * @module export-controls-engine
 * @see FR-1803 — Export Controls & Semiconductor Chokepoint
 */

import { GAME_CONFIG } from '@/engine/config';
import { ExportControlType, CircumventionMethod } from '@/data/types';
import type { FactionId, TurnNumber, TechDomain } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.technology` section. */
export type ExportControlsConfig = typeof GAME_CONFIG.technology;

// ---------------------------------------------------------------------------
// FR-1803 — Export Control Evaluation
// ---------------------------------------------------------------------------

/**
 * Input for evaluating the effects of imposing an export control on a
 * target faction in a given technology domain.
 *
 * @see FR-1803
 */
export interface ExportControlInput {
  /** The faction imposing the export control. */
  readonly imposerFaction: FactionId;
  /** The faction targeted by the export control. */
  readonly targetFaction: FactionId;
  /** Whether the control is unilateral or multilateral. */
  readonly controlType: ExportControlType;
  /** The technology domain being restricted. */
  readonly domain: TechDomain;
  /**
   * Fraction of global capability in {@link domain} controlled by the
   * coalition (0–1).  Only meaningful for multilateral controls.
   */
  readonly coalitionDomainShare: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of an export-control evaluation.  Describes eligibility, costs to the
 * imposer, and effects on the target.
 *
 * @see FR-1803
 */
export interface ExportControlResult {
  /** The control type that was evaluated. */
  readonly controlType: ExportControlType;
  /**
   * Whether the control is eligible to be imposed.
   * - Unilateral: always eligible.
   * - Multilateral: requires `coalitionDomainShare >= 0.6`.
   */
  readonly eligible: boolean;
  /** Costs borne by the imposing faction. */
  readonly imposerEffects: {
    /** Diplomatic Influence cost (negative = loss). */
    readonly diCost: number;
  };
  /** Effects applied to the target faction. */
  readonly targetEffects: {
    /** Fractional increase to investment cost in the controlled domain. */
    readonly investmentCostIncrease: number;
  };
  /** Human-readable explanation of the outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1803 — Semiconductor Chokepoint Evaluation
// ---------------------------------------------------------------------------

/**
 * Input for evaluating whether a faction can leverage its semiconductor
 * production dominance against a target.
 *
 * @see FR-1803
 */
export interface SemiconductorChokepointInput {
  /** The faction controlling semiconductor production. */
  readonly controllerFaction: FactionId;
  /** The faction targeted by the chokepoint. */
  readonly targetFaction: FactionId;
  /**
   * Fraction of global semiconductor production controlled (0–1).
   */
  readonly controllerProductionShare: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a semiconductor-chokepoint evaluation.
 *
 * @see FR-1803
 */
export interface SemiconductorChokepointResult {
  /**
   * Whether the controller holds enough production share to leverage
   * the chokepoint (> threshold).
   */
  readonly eligible: boolean;
  /** Whether the target's military modernisation is halted. */
  readonly targetMilitaryModernizationHalted: boolean;
  /**
   * Fractional increase to the target's AI development cost.
   * +1.0 = +100 % when eligible, 0 otherwise.
   */
  readonly targetAIDevelopmentCostIncrease: number;
  /** Human-readable explanation of the outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1803 — Circumvention Evaluation
// ---------------------------------------------------------------------------

/**
 * Input for evaluating the cost, time, and risk profile of a circumvention
 * method used to bypass export controls.
 *
 * @see FR-1803
 */
export interface CircumventionInput {
  /** The faction attempting circumvention. */
  readonly factionId: FactionId;
  /** The circumvention method employed. */
  readonly method: CircumventionMethod;
  /** The technology domain being circumvented. */
  readonly domain: TechDomain;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a circumvention evaluation.  Describes the cost multiplier,
 * time multiplier, and risk profile of the chosen method.
 *
 * @see FR-1803
 */
export interface CircumventionResult {
  /** The circumvention method that was evaluated. */
  readonly method: CircumventionMethod;
  /**
   * Multiplier applied to the base cost of acquiring the restricted tech.
   * - Espionage: 0 (no direct cost, but risk).
   * - Third-party transshipment: 1.0 (normal cost).
   * - Domestic substitution: 2.0 (+100 % cost).
   */
  readonly costMultiplier: number;
  /**
   * Multiplier applied to the time required for the tech activity.
   * - Domestic substitution: 1.5 (+50 % time).
   * - Others: 1.0 (no additional time).
   */
  readonly timeMultiplier: number;
  /** Qualitative description of the risk entailed by this method. */
  readonly riskDescription: string;
  /** Human-readable explanation of the outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1803 — Coalition Eligibility Evaluation
// ---------------------------------------------------------------------------

/**
 * Input for evaluating whether a coalition of factions holds enough
 * combined share of a domain to impose multilateral controls.
 *
 * @see FR-1803
 */
export interface CoalitionEligibilityInput {
  /** The factions forming the coalition. */
  readonly coalitionFactions: readonly FactionId[];
  /**
   * Maps each {@link FactionId} (as a string key) to its share of global
   * domain capability (0–1).
   */
  readonly domainShares: Readonly<Record<string, number>>;
  /** The technology domain under consideration. */
  readonly domain: TechDomain;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a coalition-eligibility evaluation.
 *
 * @see FR-1803
 */
export interface CoalitionEligibilityResult {
  /** Whether the coalition's combined share meets the 0.6 threshold. */
  readonly eligible: boolean;
  /** The sum of all coalition members' domain shares. */
  readonly combinedShare: number;
  /** Number of factions in the coalition. */
  readonly memberCount: number;
  /** Human-readable explanation of the outcome. */
  readonly reason: string;
}

// ===========================================================================
// Engine
// ===========================================================================

/**
 * Export Controls & Semiconductor Chokepoint Engine.
 *
 * Provides pure-function evaluations for:
 * 1. Export-control imposition (unilateral / multilateral)
 * 2. Semiconductor production chokepoint leverage
 * 3. Circumvention method cost / time / risk analysis
 * 4. Coalition eligibility for multilateral controls
 *
 * @see FR-1803
 */
export class ExportControlsEngine {
  private readonly cfg: ExportControlsConfig;

  /**
   * Create a new ExportControlsEngine.
   *
   * @param config - Technology configuration; defaults to `GAME_CONFIG.technology`.
   */
  constructor(config: ExportControlsConfig = GAME_CONFIG.technology) {
    this.cfg = config;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Clamp a numeric value between an inclusive min and max.
   *
   * @param value - The value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // -------------------------------------------------------------------------
  // FR-1803 — evaluateExportControl
  // -------------------------------------------------------------------------

  /**
   * Evaluate the effects of imposing an export control.
   *
   * - **Unilateral**: always eligible.  The imposer pays a Diplomatic
   *   Influence cost (`unilateralDICost`, default −3).  No investment-cost
   *   increase on the target — the control is only symbolic without
   *   coalition backing.
   * - **Multilateral**: requires `coalitionDomainShare >= 0.6`.  No DI cost
   *   to the imposer.  The target suffers a +50 % investment-cost increase
   *   in the controlled domain.
   *
   * Uses an exhaustive switch on {@link ExportControlType} to guarantee
   * compile-time coverage of all control-type variants.
   *
   * @param input - Export-control parameters.
   * @returns The evaluation result.
   *
   * @see FR-1803
   */
  evaluateExportControl(input: ExportControlInput): ExportControlResult {
    const { controlType, coalitionDomainShare, imposerFaction, targetFaction, domain } = input;
    const share = ExportControlsEngine.clamp(coalitionDomainShare, 0, 1);

    switch (controlType) {
      case ExportControlType.Unilateral: {
        const diCost = this.cfg.exportControl.unilateralDICost;
        return {
          controlType,
          eligible: true,
          imposerEffects: { diCost },
          targetEffects: { investmentCostIncrease: 0 },
          reason:
            `${imposerFaction} imposes unilateral export control on ` +
            `${targetFaction} in ${domain}. DI cost: ${diCost}. ` +
            `No investment-cost increase on target without coalition backing.`,
        };
      }

      case ExportControlType.Multilateral: {
        const eligible = share >= 0.6;
        const investmentCostIncrease = eligible
          ? this.cfg.exportControl.multilateralInvestmentCostIncrease
          : 0;
        return {
          controlType,
          eligible,
          imposerEffects: { diCost: 0 },
          targetEffects: { investmentCostIncrease },
          reason: eligible
            ? `Multilateral export control on ${targetFaction} in ${domain} ` +
              `by coalition led by ${imposerFaction} (share ${(share * 100).toFixed(4)}%). ` +
              `Target investment cost +${(investmentCostIncrease * 100).toFixed(4)}%.`
            : `Coalition share ${(share * 100).toFixed(4)}% is below the 60% ` +
              `threshold required for multilateral controls in ${domain}.`,
        };
      }

      default: {
        // Exhaustiveness guard — forces a compile error if a new type is added.
        const _exhaustive: never = controlType;
        return _exhaustive;
      }
    }
  }

  // -------------------------------------------------------------------------
  // FR-1803 — evaluateSemiconductorChokepoint
  // -------------------------------------------------------------------------

  /**
   * Evaluate whether a faction can leverage semiconductor production dominance
   * against a target.
   *
   * When the controller's production share exceeds the configured threshold
   * (default > 50 %), the following effects apply to the target:
   * - Military modernisation is **halted**.
   * - AI development cost increases by +100 %.
   *
   * @param input - Semiconductor chokepoint parameters.
   * @returns The evaluation result.
   *
   * @see FR-1803
   */
  evaluateSemiconductorChokepoint(
    input: SemiconductorChokepointInput,
  ): SemiconductorChokepointResult {
    const { controllerFaction, targetFaction, controllerProductionShare } = input;
    const share = ExportControlsEngine.clamp(controllerProductionShare, 0, 1);
    const threshold = this.cfg.semiconductorChokepoint.productionControlThreshold;
    const eligible = share > threshold;

    const targetMilitaryModernizationHalted = eligible;
    const targetAIDevelopmentCostIncrease = eligible ? 1.0 : 0;

    return {
      eligible,
      targetMilitaryModernizationHalted,
      targetAIDevelopmentCostIncrease,
      reason: eligible
        ? `${controllerFaction} controls ${(share * 100).toFixed(4)}% of global ` +
          `semiconductor production (> ${(threshold * 100).toFixed(4)}% threshold). ` +
          `${targetFaction}'s military modernisation is halted and AI development ` +
          `cost increases by +100%.`
        : `${controllerFaction}'s semiconductor production share ` +
          `(${(share * 100).toFixed(4)}%) does not exceed the ` +
          `${(threshold * 100).toFixed(4)}% threshold. No chokepoint leverage.`,
    };
  }

  // -------------------------------------------------------------------------
  // FR-1803 — evaluateCircumvention
  // -------------------------------------------------------------------------

  /**
   * Evaluate the cost, time, and risk profile of a circumvention method used
   * to bypass export controls in a given domain.
   *
   * - **Espionage**: no additional cost (`costMultiplier = 0`), no time
   *   penalty, but high risk of discovery.  Consequences (tension increase,
   *   legitimacy penalty) are handled by the espionage engine.
   * - **Third-party transshipment**: normal cost (`costMultiplier = 1.0`),
   *   normal time, moderate risk of detection.
   * - **Domestic substitution**: double cost (`costMultiplier = 2.0`), +50 %
   *   time (`timeMultiplier = 1.5`), no risk.
   *
   * Uses an exhaustive switch on {@link CircumventionMethod} to guarantee
   * compile-time coverage of all method variants.
   *
   * @param input - Circumvention parameters.
   * @returns The evaluation result.
   *
   * @see FR-1803
   */
  evaluateCircumvention(input: CircumventionInput): CircumventionResult {
    const { factionId, method, domain } = input;

    switch (method) {
      case CircumventionMethod.Espionage: {
        return {
          method,
          costMultiplier: 0,
          timeMultiplier: 1.0,
          riskDescription:
            'High risk of discovery. If detected, expect significant tension ' +
            'increase and legitimacy penalty (handled by espionage engine).',
          reason:
            `${factionId} attempts espionage to circumvent export controls in ` +
            `${domain}. No direct cost, no time penalty, but high discovery risk.`,
        };
      }

      case CircumventionMethod.ThirdPartyTransshipment: {
        return {
          method,
          costMultiplier: 1.0,
          timeMultiplier: 1.0,
          riskDescription:
            'Moderate risk of detection. Third-party intermediaries may be ' +
            'identified, triggering secondary sanctions.',
          reason:
            `${factionId} uses third-party transshipment to circumvent export ` +
            `controls in ${domain}. Normal cost, normal time, moderate detection risk.`,
        };
      }

      case CircumventionMethod.DomesticSubstitution: {
        return {
          method,
          costMultiplier: 2.0,
          timeMultiplier: 1.5,
          riskDescription:
            'No risk of external detection. Domestic substitution is a ' +
            'sovereign activity with no diplomatic consequences.',
          reason:
            `${factionId} pursues domestic substitution to circumvent export ` +
            `controls in ${domain}. +100% cost, +50% time, no external risk.`,
        };
      }

      default: {
        // Exhaustiveness guard — forces a compile error if a new method is added.
        const _exhaustive: never = method;
        return _exhaustive;
      }
    }
  }

  // -------------------------------------------------------------------------
  // FR-1803 — evaluateCoalitionEligibility
  // -------------------------------------------------------------------------

  /**
   * Evaluate whether a coalition of factions holds enough combined share of a
   * technology domain to impose multilateral export controls.
   *
   * The coalition is eligible if the sum of all members' domain shares is
   * at least 0.6 (60 %).  Shares are looked up from the provided
   * `domainShares` map; factions absent from the map are treated as having
   * a share of 0.
   *
   * @param input - Coalition eligibility parameters.
   * @returns The evaluation result.
   *
   * @see FR-1803
   */
  evaluateCoalitionEligibility(
    input: CoalitionEligibilityInput,
  ): CoalitionEligibilityResult {
    const { coalitionFactions, domainShares, domain } = input;
    const memberCount = coalitionFactions.length;

    const rawSum = coalitionFactions.reduce<number>((sum, factionId) => {
      const share = domainShares[factionId] ?? 0;
      return sum + ExportControlsEngine.clamp(share, 0, 1);
    }, 0);

    const combinedShare = ExportControlsEngine.clamp(rawSum, 0, 1);
    const eligible = combinedShare >= 0.6;

    return {
      eligible,
      combinedShare,
      memberCount,
      reason: eligible
        ? `Coalition of ${memberCount} faction(s) holds ` +
          `${(combinedShare * 100).toFixed(4)}% of global ${domain} capability ` +
          `(≥ 60% threshold). Multilateral controls are eligible.`
        : `Coalition of ${memberCount} faction(s) holds only ` +
          `${(combinedShare * 100).toFixed(4)}% of global ${domain} capability ` +
          `(< 60% threshold). Multilateral controls are not eligible.`,
    };
  }
}
