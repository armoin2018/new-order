/**
 * Terrorist Dynamics and Proxy Escalation Ladder Engine
 *
 * Evaluates the consequences of terrorist proxy sponsorship discovery,
 * War-on-Terror legitimacy gains, four-rung proxy escalation ladder
 * mechanics, escalation step computation, and terrorist proxy public-
 * acknowledgement constraints. All public methods are pure functions —
 * no mutations, no side effects. Every numeric result is clamped to its
 * valid range.
 *
 * @module terrorist-escalation-engine
 * @see FR-2007 — Terrorist proxy discovery, coalition response, and War on Terror
 * @see FR-2008 — Proxy escalation ladder (Shadow War → Direct Confrontation)
 */

import { GAME_CONFIG } from '@/engine/config';
import { ProxyEscalationLevel } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing terrorist proxy dynamics and escalation
 * ladder mechanics. Alias for the `proxy` branch of {@link GAME_CONFIG}.
 *
 * @see FR-2007
 * @see FR-2008
 */
export type TerroristEscalationConfig = typeof GAME_CONFIG.proxy;

// ─────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating the consequences of discovering a faction's
 * covert sponsorship of a terrorist proxy group.
 *
 * When terrorist proxy support is discovered the sponsor suffers a severe
 * legitimacy penalty and bilateral tension rises with ALL other nations.
 * A coalition response is always triggered.
 *
 * @see FR-2007
 */
export interface TerroristDiscoveryInput {
  /** Faction identified as sponsoring the terrorist proxy. */
  readonly sponsorFaction: FactionId;
  /** Faction whose intelligence uncovered the sponsorship. */
  readonly discoveredByFaction: FactionId;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating legitimacy and military access gains from a
 * War-on-Terror campaign launched by one faction against another.
 *
 * A faction that publicly prosecutes a War on Terror gains a legitimacy
 * bonus and is granted military access to the target's sovereign territory.
 *
 * @see FR-2007
 */
export interface WarOnTerrorInput {
  /** Faction launching the War-on-Terror campaign. */
  readonly prosecutingFaction: FactionId;
  /** Faction or territory targeted by the campaign. */
  readonly targetFaction: FactionId;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating the effects of a specific proxy escalation ladder
 * level on tension, capability, deniability, and military deployment.
 *
 * The four rungs of the escalation ladder — Shadow War, Acknowledged
 * Support, Limited Intervention, and Direct Confrontation — each carry
 * distinct mechanical consequences.
 *
 * @see FR-2008
 */
export interface EscalationLevelInput {
  /** Faction sponsoring the proxy operation. */
  readonly sponsorFaction: FactionId;
  /** Faction targeted by the proxy operation. */
  readonly targetFaction: FactionId;
  /** Current rung on the escalation ladder (1–4). */
  readonly currentLevel: ProxyEscalationLevel;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for computing a one-step change in proxy escalation level.
 *
 * If `escalate` is true and the current level is below the maximum (4),
 * the proxy advances one rung. Otherwise the level remains unchanged.
 *
 * @see FR-2008
 */
export interface EscalationStepInput {
  /** Current rung on the escalation ladder (1–4). */
  readonly currentLevel: ProxyEscalationLevel;
  /** Whether the sponsor elects to escalate this turn. */
  readonly escalate: boolean;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for validating whether a terrorist proxy arrangement satisfies
 * the public-acknowledgement constraint.
 *
 * Terrorist proxy relationships MUST remain covert; a publicly
 * acknowledged terrorist proxy is inherently invalid.
 *
 * @see FR-2007
 */
export interface TerroristProxyConstraintsInput {
  /** Faction sponsoring the terrorist proxy. */
  readonly sponsorFaction: FactionId;
  /** Whether the proxy relationship has been publicly acknowledged. */
  readonly isPubliclyAcknowledged: boolean;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

// ─────────────────────────────────────────────────────────
// Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Result of evaluating the discovery of a faction's terrorist proxy
 * sponsorship.
 *
 * Contains the legitimacy penalty imposed on the sponsor, the tension
 * increase applied to ALL bilateral relationships, whether a coalition
 * response is triggered, and a human-readable explanation.
 *
 * @see FR-2007
 */
export interface TerroristDiscoveryResult {
  /** Legitimacy penalty imposed on the sponsor faction (negative). */
  readonly legitimacyPenalty: number;
  /** Bilateral tension increase applied against ALL other nations. */
  readonly tensionIncreaseAllNations: number;
  /** Whether a coalition counter-terrorism response is triggered. */
  readonly coalitionResponseTriggered: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of evaluating a War-on-Terror campaign.
 *
 * Contains the legitimacy bonus granted to the prosecuting faction,
 * whether military access to the target's sovereign territory is
 * authorised, and a human-readable explanation.
 *
 * @see FR-2007
 */
export interface WarOnTerrorResult {
  /** Legitimacy bonus for the prosecuting faction (positive). */
  readonly legitimacyBonus: number;
  /** Whether the campaign grants military access to sovereign territory. */
  readonly militaryAccessGranted: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of evaluating the mechanical effects of a specific proxy
 * escalation ladder level.
 *
 * Each of the four escalation rungs determines a distinct set of tension,
 * capability, deniability, deployment, and confrontation outcomes.
 *
 * @see FR-2008
 */
export interface EscalationLevelResult {
  /** Tension increase contributed by this escalation level. */
  readonly tensionIncrease: number;
  /** Capability bonus granted at this escalation level. */
  readonly capabilityBonus: number;
  /**
   * Deniability override value, or `null` when deniability is retained.
   * A value of `0` means deniability is fully stripped.
   */
  readonly deniabilityOverride: number | null;
  /** Whether military forces are deployed at this level. */
  readonly militaryDeployed: boolean;
  /** Whether the escalation has reached direct confrontation. */
  readonly directConfrontation: boolean;
  /** Cumulative tension from all escalation levels up to the current. */
  readonly cumulativeTension: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of computing a one-step escalation change.
 *
 * Contains the new escalation level, whether the level actually changed,
 * and a human-readable explanation.
 *
 * @see FR-2008
 */
export interface EscalationStepResult {
  /** Escalation level after the step. */
  readonly newLevel: ProxyEscalationLevel;
  /** Whether the escalation level changed. */
  readonly changed: boolean;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

/**
 * Result of validating terrorist proxy public-acknowledgement constraints.
 *
 * @see FR-2007
 */
export interface TerroristProxyConstraintsResult {
  /** Whether the terrorist proxy arrangement is valid. */
  readonly valid: boolean;
  /** Human-readable explanation of the validation. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────

/**
 * Pure-function engine for terrorist proxy dynamics and the four-rung
 * proxy escalation ladder.
 *
 * Evaluates terrorist discovery consequences, War-on-Terror legitimacy
 * gains, escalation ladder effects, escalation step computation, and
 * terrorist proxy acknowledgement constraints. All public methods return
 * new result objects — no mutations, no side effects.
 *
 * @see FR-2007 — Terrorist proxy discovery, coalition response, and War on Terror
 * @see FR-2008 — Proxy escalation ladder (Shadow War → Direct Confrontation)
 */
export class TerroristEscalationEngine {
  /** Proxy configuration values used by all calculations. */
  private readonly config: TerroristEscalationConfig;

  /**
   * Create a new TerroristEscalationEngine.
   *
   * @param config - Proxy configuration values. Defaults to
   *   `GAME_CONFIG.proxy`.
   * @see FR-2007
   * @see FR-2008
   */
  constructor(config: TerroristEscalationConfig = GAME_CONFIG.proxy) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   *
   * @param value - The value to clamp.
   * @param min   - Minimum allowed value.
   * @param max   - Maximum allowed value.
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  // ───────────────────────────────────────────────────────
  // Public Methods
  // ───────────────────────────────────────────────────────

  /**
   * Evaluate the consequences of discovering that a faction is covertly
   * sponsoring a terrorist proxy group.
   *
   * The sponsor faction suffers a severe legitimacy penalty drawn from
   * `terrorist.discoveryLegitimacyPenalty` (default −20). Bilateral
   * tension increases with ALL other nations by
   * `terrorist.sponsorDiscoveryTensionIncrease` (default 20). A coalition
   * counter-terrorism response is ALWAYS triggered upon terrorist proxy
   * discovery.
   *
   * @param input - Terrorist discovery evaluation parameters.
   * @returns Legitimacy penalty, tension increase, coalition flag, and reason.
   * @see FR-2007
   */
  evaluateTerroristDiscovery(
    input: TerroristDiscoveryInput,
  ): TerroristDiscoveryResult {
    const legitimacyPenalty = TerroristEscalationEngine.clamp(
      this.config.terrorist.discoveryLegitimacyPenalty,
      -100,
      0,
    );

    const tensionIncreaseAllNations = TerroristEscalationEngine.clamp(
      this.config.terrorist.sponsorDiscoveryTensionIncrease,
      0,
      100,
    );

    const coalitionResponseTriggered = true;

    const reason =
      'Faction ' +
      String(input.sponsorFaction) +
      ' terrorist proxy support discovered by ' +
      String(input.discoveredByFaction) +
      ' on turn ' +
      String(input.currentTurn) +
      ': legitimacyPenalty=' +
      String(legitimacyPenalty) +
      ', tensionIncreaseAllNations=' +
      String(tensionIncreaseAllNations) +
      ', coalitionResponseTriggered=' +
      String(coalitionResponseTriggered) +
      '. Terrorist sponsorship discovery always triggers coalition response.';

    return {
      legitimacyPenalty,
      tensionIncreaseAllNations,
      coalitionResponseTriggered,
      reason,
    };
  }

  /**
   * Evaluate the legitimacy and military-access effects of a faction
   * launching a War-on-Terror campaign against another faction.
   *
   * The prosecuting faction receives a legitimacy bonus from
   * `terrorist.warOnTerrorLegitimacyBonus` (default +15). Military access
   * to the target faction's sovereign territory is always granted as the
   * campaign justifies cross-border operations.
   *
   * @param input - War-on-Terror evaluation parameters.
   * @returns Legitimacy bonus, military access flag, and reason.
   * @see FR-2007
   */
  evaluateWarOnTerror(input: WarOnTerrorInput): WarOnTerrorResult {
    const legitimacyBonus = TerroristEscalationEngine.clamp(
      this.config.terrorist.warOnTerrorLegitimacyBonus,
      0,
      100,
    );

    const militaryAccessGranted = true;

    const reason =
      'Faction ' +
      String(input.prosecutingFaction) +
      ' prosecutes War on Terror against ' +
      String(input.targetFaction) +
      ' on turn ' +
      String(input.currentTurn) +
      ': legitimacyBonus=' +
      String(legitimacyBonus) +
      ', militaryAccessGranted=' +
      String(militaryAccessGranted) +
      '. War on Terror justifies operations in sovereign territory.';

    return {
      legitimacyBonus,
      militaryAccessGranted,
      reason,
    };
  }

  /**
   * Evaluate the mechanical effects of a specific rung on the four-level
   * proxy escalation ladder.
   *
   * The ladder defines four rungs with distinct outcomes:
   *
   * | Level | Tension | Capability | Deniability | Military | Confrontation |
   * |-------|---------|------------|-------------|----------|---------------|
   * | 1 — Shadow War            | +15 | 0   | null | No  | No  |
   * | 2 — Acknowledged Support  | +15 | +15 | 0    | No  | No  |
   * | 3 — Limited Intervention  | +15 | 0   | 0    | Yes | No  |
   * | 4 — Direct Confrontation  | +15 | 0   | 0    | Yes | Yes |
   *
   * Cumulative tension equals `currentLevel × escalationLadderTensionPerLevel`.
   *
   * @param input - Escalation level evaluation parameters.
   * @returns Tension, capability, deniability, deployment, confrontation,
   *   cumulative tension, and reason.
   * @see FR-2008
   */
  evaluateEscalationLevel(input: EscalationLevelInput): EscalationLevelResult {
    const tensionPerLevel = this.config.escalationLadderTensionPerLevel;
    const ackCapBonus =
      this.config.escalationLadder.acknowledgedSupportCapabilityBonus;

    const cumulativeTension = input.currentLevel * tensionPerLevel;

    let tensionIncrease: number;
    let capabilityBonus: number;
    let deniabilityOverride: number | null;
    let militaryDeployed: boolean;
    let directConfrontation: boolean;
    let levelLabel: string;

    switch (input.currentLevel) {
      case ProxyEscalationLevel.ShadowWar: {
        tensionIncrease = tensionPerLevel;
        capabilityBonus = 0;
        deniabilityOverride = null;
        militaryDeployed = false;
        directConfrontation = false;
        levelLabel = 'ShadowWar (1)';
        break;
      }
      case ProxyEscalationLevel.AcknowledgedSupport: {
        tensionIncrease = tensionPerLevel;
        capabilityBonus = TerroristEscalationEngine.clamp(ackCapBonus, 0, 100);
        deniabilityOverride = 0;
        militaryDeployed = false;
        directConfrontation = false;
        levelLabel = 'AcknowledgedSupport (2)';
        break;
      }
      case ProxyEscalationLevel.LimitedIntervention: {
        tensionIncrease = tensionPerLevel;
        capabilityBonus = 0;
        deniabilityOverride = 0;
        militaryDeployed = true;
        directConfrontation = false;
        levelLabel = 'LimitedIntervention (3)';
        break;
      }
      case ProxyEscalationLevel.DirectConfrontation: {
        tensionIncrease = tensionPerLevel;
        capabilityBonus = 0;
        deniabilityOverride = 0;
        militaryDeployed = true;
        directConfrontation = true;
        levelLabel = 'DirectConfrontation (4)';
        break;
      }
      default: {
        const _exhaustive: never = input.currentLevel;
        return _exhaustive;
      }
    }

    const reason =
      'Faction ' +
      String(input.sponsorFaction) +
      ' proxy against ' +
      String(input.targetFaction) +
      ' at escalation level ' +
      levelLabel +
      ' on turn ' +
      String(input.currentTurn) +
      ': tensionIncrease=' +
      String(tensionIncrease) +
      ', capabilityBonus=' +
      String(capabilityBonus) +
      ', deniabilityOverride=' +
      String(deniabilityOverride) +
      ', militaryDeployed=' +
      String(militaryDeployed) +
      ', directConfrontation=' +
      String(directConfrontation) +
      ', cumulativeTension=' +
      String(cumulativeTension) +
      '.';

    return {
      tensionIncrease,
      capabilityBonus,
      deniabilityOverride,
      militaryDeployed,
      directConfrontation,
      cumulativeTension,
      reason,
    };
  }

  /**
   * Compute the next proxy escalation level after a potential one-step
   * escalation.
   *
   * If `escalate` is `true` and the current level is below the maximum
   * (4 — Direct Confrontation), the level advances by one rung. If the
   * current level is already at the maximum or `escalate` is `false`, the
   * level remains unchanged and `changed` is `false`.
   *
   * @param input - Escalation step computation parameters.
   * @returns New level, change flag, and reason.
   * @see FR-2008
   */
  computeEscalationStep(input: EscalationStepInput): EscalationStepResult {
    const maxLevel = ProxyEscalationLevel.DirectConfrontation;

    if (input.escalate && input.currentLevel < maxLevel) {
      const newLevel = (input.currentLevel + 1) as ProxyEscalationLevel;
      const reason =
        'Escalation on turn ' +
        String(input.currentTurn) +
        ': proxy escalation advanced from level ' +
        String(input.currentLevel) +
        ' to level ' +
        String(newLevel) +
        '.';
      return {
        newLevel,
        changed: true,
        reason,
      };
    }

    if (input.escalate && input.currentLevel >= maxLevel) {
      const reason =
        'Escalation on turn ' +
        String(input.currentTurn) +
        ': proxy already at maximum escalation level ' +
        String(maxLevel) +
        '. No change.';
      return {
        newLevel: maxLevel,
        changed: false,
        reason,
      };
    }

    const reason =
      'No escalation on turn ' +
      String(input.currentTurn) +
      ': proxy remains at escalation level ' +
      String(input.currentLevel) +
      '.';
    return {
      newLevel: input.currentLevel,
      changed: false,
      reason,
    };
  }

  /**
   * Validate whether a terrorist proxy arrangement satisfies the
   * public-acknowledgement constraint.
   *
   * Terrorist proxy relationships are inherently covert. A proxy that has
   * been publicly acknowledged is invalid — terrorist proxies CANNOT be
   * publicly acknowledged. The result is `valid = !isPubliclyAcknowledged`.
   *
   * @param input - Terrorist proxy constraints evaluation parameters.
   * @returns Validity flag and reason.
   * @see FR-2007
   */
  evaluateTerroristProxyConstraints(
    input: TerroristProxyConstraintsInput,
  ): TerroristProxyConstraintsResult {
    const valid = !input.isPubliclyAcknowledged;

    const reason = valid
      ? 'Faction ' +
        String(input.sponsorFaction) +
        ' terrorist proxy on turn ' +
        String(input.currentTurn) +
        ' is valid: relationship remains covert (isPubliclyAcknowledged=' +
        String(input.isPubliclyAcknowledged) +
        ').'
      : 'Faction ' +
        String(input.sponsorFaction) +
        ' terrorist proxy on turn ' +
        String(input.currentTurn) +
        ' is INVALID: terrorist proxies cannot be publicly acknowledged (isPubliclyAcknowledged=' +
        String(input.isPubliclyAcknowledged) +
        '). Covert status is mandatory for terrorist proxy arrangements.';

    return {
      valid,
      reason,
    };
  }
}
