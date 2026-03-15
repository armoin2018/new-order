/**
 * Proxy Autonomy, Blowback, and Deniability Engine
 *
 * Evaluates proxy autonomous operations, defection risk, independence
 * attempts, deniability degradation by source, and blowback consequences
 * when proxy groups are abandoned. All public methods are pure functions —
 * no mutations, no side effects. Every numeric result is clamped to its
 * valid range.
 *
 * @module proxy-autonomy-engine
 * @see FR-2003 — Proxy autonomy, defection, independence, and blowback
 * @see FR-2006 — Deniability degradation by source type
 */

import { GAME_CONFIG } from '@/engine/config';
import { DeniabilitySource } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing proxy autonomy, blowback, and deniability
 * mechanics. Alias for the `proxy` branch of {@link GAME_CONFIG}.
 *
 * @see FR-2003
 * @see FR-2006
 */
export type ProxyAutonomyConfig = typeof GAME_CONFIG.proxy;

// ─────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Input for evaluating whether a proxy group may conduct autonomous
 * operations independent of sponsor direction.
 *
 * @see FR-2003
 */
export interface AutonomousOperationInput {
  /** Faction that sponsors the proxy group. */
  readonly factionId: FactionId;
  /** Current autonomy level of the proxy group (0–100). */
  readonly proxyAutonomy: number;
  /** Current deniability score of the proxy operation (0–100). */
  readonly proxyDeniability: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating the risk that a proxy group defects to a rival.
 *
 * @see FR-2003
 */
export interface DefectionRiskInput {
  /** Faction that sponsors the proxy group. */
  readonly factionId: FactionId;
  /** Current loyalty of the proxy group to the sponsor (0–100). */
  readonly proxyLoyalty: number;
  /** Bonus offered by a rival faction attempting to flip the proxy. */
  readonly rivalOfferBonus: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating whether a proxy group attempts to break free and
 * become an independent actor.
 *
 * @see FR-2003
 */
export interface IndependenceInput {
  /** Faction that sponsors the proxy group. */
  readonly factionId: FactionId;
  /** Current capability score of the proxy group (0–100). */
  readonly proxyCapability: number;
  /** Current autonomy level of the proxy group (0–100). */
  readonly proxyAutonomy: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for computing deniability degradation from a specific source event.
 *
 * @see FR-2006
 */
export interface DeniabilityDegradationInput {
  /** Faction that sponsors the proxy group. */
  readonly factionId: FactionId;
  /** Current deniability score before degradation (0–100). */
  readonly currentDeniability: number;
  /** Source of the deniability degradation event. */
  readonly source: DeniabilitySource;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating blowback consequences when a proxy group is
 * abandoned or turns hostile.
 *
 * @see FR-2003
 */
export interface BlowbackInput {
  /** Faction that originally sponsored the proxy group. */
  readonly factionId: FactionId;
  /** Current capability score of the proxy group (0–100). */
  readonly proxyCapability: number;
  /** Current loyalty of the proxy group to the sponsor (0–100). */
  readonly proxyLoyalty: number;
  /** Whether the sponsor has abandoned the proxy group. */
  readonly wasAbandoned: boolean;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

// ─────────────────────────────────────────────────────────
// Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Result of evaluating autonomous operation eligibility for a proxy group.
 *
 * @see FR-2003
 */
export interface AutonomousOperationResult {
  /** Whether the proxy group is eligible to act autonomously. */
  readonly eligible: boolean;
  /** Chance per turn that the proxy conducts an autonomous operation. */
  readonly operationChance: number;
  /** Whether the sponsor's deniability is used for the operation. */
  readonly useSponsorDeniability: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of evaluating defection risk for a proxy group.
 *
 * @see FR-2003
 */
export interface DefectionRiskResult {
  /** Whether the proxy group is at risk of defection. */
  readonly atRisk: boolean;
  /** Effective loyalty after rival offer bonus is subtracted, in [0, 100]. */
  readonly effectiveLoyalty: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of evaluating whether a proxy group will attempt independence.
 *
 * @see FR-2003
 */
export interface IndependenceResult {
  /** Whether the proxy group meets the thresholds for independence. */
  readonly independent: boolean;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of computing deniability degradation from a source event.
 *
 * @see FR-2006
 */
export interface DeniabilityDegradationResult {
  /** New deniability score after degradation, clamped to [0, 100]. */
  readonly newDeniability: number;
  /** The degradation amount applied (negative value). */
  readonly degradation: number;
  /** Whether deniability has reached zero and the proxy is public knowledge. */
  readonly isPublicKnowledge: boolean;
  /** Human-readable explanation of the degradation. */
  readonly reason: string;
}

/**
 * Result of evaluating blowback consequences for an abandoned proxy group.
 *
 * @see FR-2003
 */
export interface BlowbackResult {
  /** Whether the proxy group has turned hostile toward the former sponsor. */
  readonly hostile: boolean;
  /** Whether a rival faction may capture the abandoned proxy group. */
  readonly capturedByRival: boolean;
  /** Threat level posed by the proxy group, in [0, 100]. */
  readonly threatLevel: number;
  /** Human-readable explanation of the blowback assessment. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────

/**
 * Pure-function engine for proxy autonomy, blowback, and deniability.
 *
 * Evaluates autonomous operation eligibility, defection risk, independence
 * thresholds, deniability degradation by source, and blowback consequences.
 * All public methods return new result objects — no mutations, no side
 * effects.
 *
 * @see FR-2003 — Proxy autonomy, defection, independence, and blowback
 * @see FR-2006 — Deniability degradation by source type
 */
export class ProxyAutonomyEngine {
  /** Proxy configuration values used by all calculations. */
  private readonly config: ProxyAutonomyConfig;

  /**
   * Create a new ProxyAutonomyEngine.
   *
   * @param config - Proxy configuration values. Defaults to
   *   `GAME_CONFIG.proxy`.
   * @see FR-2003
   * @see FR-2006
   */
  constructor(config: ProxyAutonomyConfig = GAME_CONFIG.proxy) {
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
   * Evaluate whether a proxy group is eligible to conduct autonomous
   * operations independent of its sponsor's direction.
   *
   * A proxy group becomes eligible when its autonomy exceeds the configured
   * threshold (`autonomousOperation.autonomyThreshold`, default 60). When
   * eligible, the per-turn chance of autonomous action is drawn from
   * `autonomousOperation.operationChancePerTurn` (default 0.3), and the
   * sponsor's deniability shield is engaged.
   *
   * @param input - Autonomous operation evaluation parameters.
   * @returns Eligibility, operation chance, deniability usage, and reason.
   * @see FR-2003
   */
  evaluateAutonomousOperation(
    input: AutonomousOperationInput,
  ): AutonomousOperationResult {
    const threshold = this.config.autonomousOperation.autonomyThreshold;
    const eligible = input.proxyAutonomy > threshold;
    const operationChance = eligible
      ? this.config.autonomousOperation.operationChancePerTurn
      : 0;
    const useSponsorDeniability = eligible;

    const reason = eligible
      ? 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' is eligible for autonomous operations: autonomy ' +
        String(input.proxyAutonomy) +
        ' > threshold ' +
        String(threshold) +
        ', operationChance=' +
        String(operationChance) +
        ', deniability=' +
        String(input.proxyDeniability) +
        '.'
      : 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' is NOT eligible for autonomous operations: autonomy ' +
        String(input.proxyAutonomy) +
        ' <= threshold ' +
        String(threshold) +
        '.';

    return { eligible, operationChance, useSponsorDeniability, reason };
  }

  /**
   * Evaluate the defection risk of a proxy group based on its loyalty and
   * any rival offer bonus.
   *
   * Effective loyalty is computed as `clamp(proxyLoyalty - rivalOfferBonus,
   * 0, 100)`. The proxy is at risk of defection when the raw loyalty (before
   * rival offers) falls below the configured `loyaltyDefection.loyaltyThreshold`
   * (default 30).
   *
   * @param input - Defection risk evaluation parameters.
   * @returns Risk flag, effective loyalty, and explanatory reason.
   * @see FR-2003
   */
  evaluateDefectionRisk(
    input: DefectionRiskInput,
  ): DefectionRiskResult {
    const threshold = this.config.loyaltyDefection.loyaltyThreshold;
    const effectiveLoyalty = ProxyAutonomyEngine.clamp(
      input.proxyLoyalty - input.rivalOfferBonus,
      0,
      100,
    );
    const atRisk = input.proxyLoyalty < threshold;

    const reason = atRisk
      ? 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' is AT RISK of defection: loyalty ' +
        String(input.proxyLoyalty) +
        ' < threshold ' +
        String(threshold) +
        ', effectiveLoyalty=' +
        String(effectiveLoyalty) +
        ' (rivalOfferBonus=' +
        String(input.rivalOfferBonus) +
        ').'
      : 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' is NOT at risk of defection: loyalty ' +
        String(input.proxyLoyalty) +
        ' >= threshold ' +
        String(threshold) +
        ', effectiveLoyalty=' +
        String(effectiveLoyalty) +
        '.';

    return { atRisk, effectiveLoyalty, reason };
  }

  /**
   * Evaluate whether a proxy group meets the thresholds required to break
   * free from its sponsor and become an independent actor.
   *
   * Independence is triggered when both the proxy's capability exceeds
   * `independence.capabilityThreshold` (default 80) AND its autonomy exceeds
   * `independence.autonomyThreshold` (default 80).
   *
   * @param input - Independence evaluation parameters.
   * @returns Independence flag and explanatory reason.
   * @see FR-2003
   */
  evaluateIndependence(
    input: IndependenceInput,
  ): IndependenceResult {
    const capThreshold = this.config.independence.capabilityThreshold;
    const autThreshold = this.config.independence.autonomyThreshold;
    const independent =
      input.proxyCapability > capThreshold &&
      input.proxyAutonomy > autThreshold;

    const reason = independent
      ? 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' declares INDEPENDENCE: capability ' +
        String(input.proxyCapability) +
        ' > ' +
        String(capThreshold) +
        ' AND autonomy ' +
        String(input.proxyAutonomy) +
        ' > ' +
        String(autThreshold) +
        '.'
      : 'Proxy for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ' does NOT meet independence thresholds: capability ' +
        String(input.proxyCapability) +
        ' (need >' +
        String(capThreshold) +
        '), autonomy ' +
        String(input.proxyAutonomy) +
        ' (need >' +
        String(autThreshold) +
        ').';

    return { independent, reason };
  }

  /**
   * Compute deniability degradation from a specific source event.
   *
   * Dispatches on {@link DeniabilitySource} with an exhaustive switch to
   * determine the degradation amount:
   *
   * - **Arming** — degradation from arming supply chain exposure.
   * - **Directing** — degradation from directing operations exposure.
   * - **MediaExposure** — degradation from media reporting.
   * - **Humint** — degradation from human intelligence discovery.
   *
   * New deniability is clamped to [0, 100]. The proxy becomes public
   * knowledge when deniability reaches zero.
   *
   * @param input - Deniability degradation parameters.
   * @returns New deniability, degradation amount, public knowledge flag, and
   *   explanatory reason.
   * @see FR-2006
   */
  evaluateDeniabilityDegradation(
    input: DeniabilityDegradationInput,
  ): DeniabilityDegradationResult {
    const src: DeniabilitySource = input.source;
    let degradation: number;

    switch (src) {
      case DeniabilitySource.Arming: {
        degradation = this.config.deniabilityDegradation.arming;
        break;
      }

      case DeniabilitySource.Directing: {
        degradation = this.config.deniabilityDegradation.directing;
        break;
      }

      case DeniabilitySource.MediaExposure: {
        degradation = this.config.deniabilityDegradation.mediaExposure;
        break;
      }

      case DeniabilitySource.Humint: {
        degradation = this.config.deniabilityDegradation.humint;
        break;
      }

      default: {
        const _exhaustive: never = src;
        return _exhaustive;
      }
    }

    const newDeniability = ProxyAutonomyEngine.clamp(
      input.currentDeniability + degradation,
      0,
      100,
    );
    const isPublicKnowledge = newDeniability <= 0;

    const reason =
      'Deniability degradation for ' +
      String(input.factionId) +
      ' on turn ' +
      String(input.currentTurn) +
      ' from source ' +
      String(input.source) +
      ': ' +
      String(input.currentDeniability) +
      ' + (' +
      String(degradation) +
      ') = ' +
      String(newDeniability) +
      (isPublicKnowledge ? ' — proxy is now PUBLIC KNOWLEDGE.' : '.');

    return { newDeniability, degradation, isPublicKnowledge, reason };
  }

  /**
   * Evaluate blowback consequences when a proxy group is abandoned or turns
   * hostile toward its former sponsor.
   *
   * - **Hostile**: the proxy turns against the sponsor when it was abandoned
   *   AND loyalty is below the defection threshold (30).
   * - **Captured by rival**: a rival faction may seize the abandoned proxy
   *   when it was abandoned AND its capability exceeds 50.
   * - **Threat level**: when hostile, equals `clamp(capability - loyalty,
   *   0, 100)`; otherwise 0.
   *
   * @param input - Blowback evaluation parameters.
   * @returns Hostile flag, rival capture flag, threat level, and reason.
   * @see FR-2003
   */
  evaluateBlowback(
    input: BlowbackInput,
  ): BlowbackResult {
    const loyaltyThreshold = this.config.loyaltyDefection.loyaltyThreshold;
    const capabilityRivalThreshold = 50;

    const hostile =
      input.wasAbandoned && input.proxyLoyalty < loyaltyThreshold;
    const capturedByRival =
      input.wasAbandoned && input.proxyCapability > capabilityRivalThreshold;
    const threatLevel = hostile
      ? ProxyAutonomyEngine.clamp(
          input.proxyCapability - input.proxyLoyalty,
          0,
          100,
        )
      : 0;

    const parts: string[] = [];

    parts.push(
      'Blowback assessment for ' +
        String(input.factionId) +
        ' on turn ' +
        String(input.currentTurn) +
        ': wasAbandoned=' +
        String(input.wasAbandoned) +
        ', loyalty=' +
        String(input.proxyLoyalty) +
        ', capability=' +
        String(input.proxyCapability) +
        '.',
    );

    if (hostile) {
      parts.push(
        ' Proxy is HOSTILE (loyalty ' +
          String(input.proxyLoyalty) +
          ' < ' +
          String(loyaltyThreshold) +
          '): threatLevel=' +
          String(threatLevel) +
          '.',
      );
    } else {
      parts.push(' Proxy is NOT hostile.');
    }

    if (capturedByRival) {
      parts.push(
        ' Proxy may be CAPTURED BY RIVAL (capability ' +
          String(input.proxyCapability) +
          ' > ' +
          String(capabilityRivalThreshold) +
          ').',
      );
    }

    const reason = parts.join('');

    return { hostile, capturedByRival, threatLevel, reason };
  }
}
