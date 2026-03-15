/**
 * Tech Decoupling, Quantum Threat & Dual-Use Dilemma Engine
 *
 * Implements three tightly-coupled technology-geopolitics subsystems:
 *
 * 1. **Tech Decoupling** (FR-1806) — Models the bifurcation of the global
 *    technology ecosystem into rival blocs when mutual export controls reach
 *    critical mass. Aligned nations receive intra-bloc intelligence bonuses
 *    and cross-bloc cyber advantages, while non-aligned nations pay a cost
 *    premium. Decoupling inflicts a per-turn global GDP penalty.
 *
 * 2. **Quantum Threat** (FR-1807) — Evaluates how quantum-computing supremacy
 *    destabilises classical encryption. Factions that exceed the threat
 *    threshold gain intelligence bonuses against quantum-laggards and can
 *    intercept encrypted communications (including SWIFT financial traffic).
 *    Quantum-Resistant Encryption (QRE) serves as the countermeasure.
 *
 * 3. **Dual-Use Dilemma** (FR-1808) — Once a faction's AI or Biotech level
 *    reaches trigger thresholds, it must choose to sign international accords
 *    (gaining legitimacy but restricting military applications), refuse
 *    (small legitimacy loss, full military access), or secretly violate
 *    (risk of catastrophic exposure if espionage detects the breach).
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Thresholds and modifiers are drawn from `GAME_CONFIG.technology`.
 *
 * @module tech-decoupling-engine
 * @see FR-1806 — Tech Decoupling
 * @see FR-1807 — Quantum Threat
 * @see FR-1808 — Dual-Use Dilemma
 */

import { GAME_CONFIG } from '@/engine/config';
import { DualUseChoice, DecouplingStatus, TechBlocAlignment } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.technology` section. */
export type TechDecouplingConfig = typeof GAME_CONFIG.technology;

// ---------------------------------------------------------------------------
// FR-1806 — evaluateDecoupling  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating whether the global technology ecosystem has
 * bifurcated into rival blocs.
 *
 * Both factions must have tech levels at or above the mutual export-control
 * threshold **and** both must have imposed export controls on one another.
 *
 * @see FR-1806
 */
export interface DecouplingInput {
  /** First faction in the rivalry. */
  readonly factionA: FactionId;
  /** Second faction in the rivalry. */
  readonly factionB: FactionId;
  /** Faction A's relevant tech level (AI or Semiconductors, 0–100). */
  readonly factionATechLevel: number;
  /** Faction B's relevant tech level (AI or Semiconductors, 0–100). */
  readonly factionBTechLevel: number;
  /** Whether both factions have imposed export controls on each other. */
  readonly mutualExportControls: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a tech-decoupling evaluation.
 *
 * When triggered the global ecosystem is marked as `Bifurcated`, and a
 * per-turn GDP penalty is applied to every nation.
 *
 * @see FR-1806
 */
export interface DecouplingResult {
  /** Whether decoupling conditions are met. */
  readonly triggered: boolean;
  /** Current ecosystem status — Bifurcated when triggered, Unified otherwise. */
  readonly decouplingStatus: DecouplingStatus;
  /** Per-turn global GDP penalty (negative when triggered, 0 otherwise). */
  readonly globalGDPPenalty: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1806 — evaluateBlocMembership  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating a single faction's tech-bloc membership effects.
 *
 * During active decoupling, aligned factions enjoy intelligence and cyber
 * bonuses while non-aligned factions pay a technology-cost premium.
 *
 * @see FR-1806
 */
export interface BlocMembershipInput {
  /** The faction being evaluated. */
  readonly factionId: FactionId;
  /** Faction's current bloc alignment, or `null` if undeclared. */
  readonly currentAlignment: TechBlocAlignment | null;
  /** Whether global decoupling is currently active. */
  readonly decouplingActive: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a tech-bloc membership evaluation.
 *
 * Determines the cost multiplier for technology investments and any
 * intelligence / cyber bonuses conferred by bloc membership.
 *
 * @see FR-1806
 */
export interface BlocMembershipResult {
  /** The faction that was evaluated. */
  readonly factionId: FactionId;
  /** Faction's effective alignment (null if undeclared). */
  readonly alignment: TechBlocAlignment | null;
  /** Technology-investment cost multiplier (1.0 = normal, 1.5 = non-aligned surcharge). */
  readonly costMultiplier: number;
  /** Intra-bloc intelligence bonus (0.1 if aligned during decoupling, 0 otherwise). */
  readonly intraBlocIntelBonus: number;
  /** Cross-bloc cyber-operations bonus (0.15 if aligned during decoupling, 0 otherwise). */
  readonly crossBlocCyberBonus: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1807 — evaluateQuantumThreat  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating quantum-computing threat dynamics between two factions.
 *
 * A faction whose quantum level exceeds the threat threshold can exploit
 * classical-encryption weaknesses in a target that lacks Quantum-Resistant
 * Encryption (QRE).
 *
 * @see FR-1807
 */
export interface QuantumThreatInput {
  /** The faction being evaluated (attacker). */
  readonly factionId: FactionId;
  /** Faction's quantum-computing tech level (0–100). */
  readonly factionQuantumLevel: number;
  /** Faction's cyber-warfare tech level (0–100). */
  readonly factionCyberLevel: number;
  /** The target faction (defender). */
  readonly targetFaction: FactionId;
  /** Target faction's quantum-computing tech level (0–100). */
  readonly targetQuantumLevel: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a quantum-threat evaluation.
 *
 * Details whether the attacking faction has quantum supremacy, whether the
 * target is vulnerable (lacks QRE), and quantifies intelligence and
 * financial-warfare bonuses.
 *
 * @see FR-1807
 */
export interface QuantumThreatResult {
  /** Whether the attacking faction's quantum level exceeds the threat threshold (≥ 70). */
  readonly threatActive: boolean;
  /** Intelligence bonus against the target (0.3 if threat active & target quantum < 50, 0 otherwise). */
  readonly intelBonusVsTarget: number;
  /** Whether the faction has deployed Quantum-Resistant Encryption (quantum ≥ 50 & cyber ≥ 60). */
  readonly hasQRE: boolean;
  /** Whether the target is vulnerable — no QRE possible (quantum < 50). */
  readonly targetVulnerable: boolean;
  /** Whether the target's encrypted comms can be intercepted (threat active & target lacks QRE). */
  readonly targetCommsInterceptable: boolean;
  /** Financial-warfare bonus when target comms are interceptable (SWIFT vulnerable — 0.2, else 0). */
  readonly financialWarfareBonus: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1808 — evaluateDualUseDilemma  I/O
// ---------------------------------------------------------------------------

/**
 * Input for evaluating the dual-use technology dilemma.
 *
 * Once a faction's AI or Biotech level reaches the trigger threshold, it
 * must make a policy choice about international weapons-application accords.
 *
 * @see FR-1808
 */
export interface DualUseDilemmaInput {
  /** The faction facing the dilemma. */
  readonly factionId: FactionId;
  /** Faction's AI tech level (0–100). */
  readonly factionAILevel: number;
  /** Faction's Biotech tech level (0–100). */
  readonly factionBiotechLevel: number;
  /** The policy choice the faction is making. */
  readonly choice: DualUseChoice;
  /** Whether espionage has uncovered a secret violation (only relevant for SecretViolate). */
  readonly discoveredByEspionage: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a dual-use dilemma evaluation.
 *
 * Quantifies legitimacy changes, military-application restrictions, and
 * the catastrophic consequences of a discovered secret violation.
 *
 * @see FR-1808
 */
export interface DualUseDilemmaResult {
  /** Whether the dilemma is active (AI ≥ 60 OR Biotech ≥ 60). */
  readonly triggered: boolean;
  /** The policy choice that was evaluated. */
  readonly choice: DualUseChoice;
  /** Change in legitimacy from this choice. */
  readonly legitimacyChange: number;
  /** Whether military applications of dual-use tech are restricted (true if Sign). */
  readonly militaryApplicationsRestricted: boolean;
  /** Whether all tech agreements are voided (true if SecretViolate AND discovered). */
  readonly allTechAgreementsVoided: boolean;
  /** Whether the faction faces coalition sanctions risk (true if SecretViolate AND discovered). */
  readonly coalitionSanctionsRisk: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure-function engine for Tech Decoupling, Quantum Threat, and Dual-Use
 * Dilemma mechanics.
 *
 * Provides:
 * - Global tech-ecosystem decoupling evaluation
 * - Bloc-membership cost / bonus calculations
 * - Quantum-supremacy threat and QRE assessment
 * - Dual-use dilemma policy-choice evaluation
 *
 * @see FR-1806 — Tech Decoupling
 * @see FR-1807 — Quantum Threat
 * @see FR-1808 — Dual-Use Dilemma
 */
export class TechDecouplingEngine {
  private readonly cfg: TechDecouplingConfig;

  /**
   * Create a new TechDecouplingEngine.
   *
   * @param config - Technology configuration; defaults to `GAME_CONFIG.technology`.
   */
  constructor(config: TechDecouplingConfig = GAME_CONFIG.technology) {
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
  // FR-1806 — Tech Decoupling
  // -------------------------------------------------------------------------

  /**
   * Evaluate whether the global technology ecosystem has bifurcated.
   *
   * Decoupling is triggered when **both** of the following conditions are met:
   * 1. Both factions' tech levels are ≥ the mutual-export-control threshold (60).
   * 2. Both factions have imposed export controls on each other.
   *
   * When active, a per-turn GDP penalty is applied globally.
   *
   * @param input - The decoupling evaluation parameters.
   * @returns An immutable result describing decoupling status and GDP effects.
   *
   * @see FR-1806
   */
  public evaluateDecoupling(input: DecouplingInput): DecouplingResult {
    const threshold = this.cfg.techDecoupling.mutualExportControlThreshold;
    const clampedA = TechDecouplingEngine.clamp(input.factionATechLevel, 0, 100);
    const clampedB = TechDecouplingEngine.clamp(input.factionBTechLevel, 0, 100);

    const bothAboveThreshold = clampedA >= threshold && clampedB >= threshold;
    const triggered = bothAboveThreshold && input.mutualExportControls;

    if (triggered) {
      return {
        triggered: true,
        decouplingStatus: DecouplingStatus.Bifurcated,
        globalGDPPenalty: this.cfg.techDecoupling.globalGDPPenalty,
        reason:
          `Tech decoupling triggered between ${input.factionA} and ` +
          `${input.factionB}: both tech levels ≥ ${threshold} ` +
          `(${clampedA}, ${clampedB}) with mutual export controls. ` +
          `Global GDP penalty of ${this.cfg.techDecoupling.globalGDPPenalty} ` +
          `per turn applied (turn ${input.currentTurn}).`,
      };
    }

    const reasons: string[] = [];
    if (!bothAboveThreshold) {
      reasons.push(
        `tech levels (${clampedA}, ${clampedB}) do not both meet ` +
        `threshold ${threshold}`,
      );
    }
    if (!input.mutualExportControls) {
      reasons.push('mutual export controls not in effect');
    }

    return {
      triggered: false,
      decouplingStatus: DecouplingStatus.Unified,
      globalGDPPenalty: 0,
      reason:
        `Tech decoupling NOT triggered between ${input.factionA} and ` +
        `${input.factionB}: ${reasons.join('; ')} (turn ${input.currentTurn}).`,
    };
  }

  /**
   * Evaluate a faction's tech-bloc membership effects during (or outside of)
   * active decoupling.
   *
   * During active decoupling:
   * - **Aligned factions** (US-led or China-led) pay normal costs (1.0×) and
   *   receive an intra-bloc intelligence bonus and a cross-bloc cyber bonus.
   * - **Non-aligned factions** pay a cost premium (1.5×) and receive no bonuses.
   *
   * Outside of decoupling all factions pay normal costs with no bonuses.
   *
   * @param input - The bloc-membership evaluation parameters.
   * @returns An immutable result describing cost multipliers and bonuses.
   *
   * @see FR-1806
   */
  public evaluateBlocMembership(input: BlocMembershipInput): BlocMembershipResult {
    const { factionId, currentAlignment, decouplingActive, currentTurn } = input;
    const cfg = this.cfg.techDecoupling;

    // No decoupling — everyone operates normally
    if (!decouplingActive) {
      return {
        factionId,
        alignment: currentAlignment,
        costMultiplier: 1.0,
        intraBlocIntelBonus: 0,
        crossBlocCyberBonus: 0,
        reason:
          `No active tech decoupling — ${factionId} operates at normal ` +
          `cost (1.0×) with no bloc bonuses (turn ${currentTurn}).`,
      };
    }

    // Decoupling active — check alignment
    const isAligned =
      currentAlignment === TechBlocAlignment.USLed ||
      currentAlignment === TechBlocAlignment.ChinaLed;

    if (isAligned) {
      return {
        factionId,
        alignment: currentAlignment,
        costMultiplier: 1.0,
        intraBlocIntelBonus: cfg.intraBlocIntelBonus,
        crossBlocCyberBonus: cfg.crossBlocCyberBonus,
        reason:
          `${factionId} is aligned (${currentAlignment}) during active ` +
          `decoupling: normal cost (1.0×), intra-bloc intel bonus ` +
          `+${cfg.intraBlocIntelBonus}, cross-bloc cyber bonus ` +
          `+${cfg.crossBlocCyberBonus} (turn ${currentTurn}).`,
      };
    }

    // Non-aligned during decoupling
    return {
      factionId,
      alignment: currentAlignment,
      costMultiplier: cfg.nonAlignedCostMultiplier,
      intraBlocIntelBonus: 0,
      crossBlocCyberBonus: 0,
      reason:
        `${factionId} is non-aligned (${currentAlignment ?? 'null'}) ` +
        `during active decoupling: cost premium ` +
        `${cfg.nonAlignedCostMultiplier}×, no bloc bonuses ` +
        `(turn ${currentTurn}).`,
    };
  }

  // -------------------------------------------------------------------------
  // FR-1807 — Quantum Threat
  // -------------------------------------------------------------------------

  /**
   * Evaluate quantum-computing threat dynamics between an attacking faction
   * and a target faction.
   *
   * A faction achieves **quantum threat** when its quantum level reaches the
   * threat threshold (≥ 70). Against a target that lacks Quantum-Resistant
   * Encryption (QRE requires quantum ≥ 50 **and** cyber ≥ 60), the attacker
   * gains:
   * - An intelligence bonus of 0.3 (when target quantum < 50).
   * - Communications interception capability.
   * - A financial-warfare bonus of 0.2 (SWIFT vulnerability).
   *
   * The attacking faction's own QRE status is also reported.
   *
   * @param input - The quantum-threat evaluation parameters.
   * @returns An immutable result describing threat status and bonuses.
   *
   * @see FR-1807
   */
  public evaluateQuantumThreat(input: QuantumThreatInput): QuantumThreatResult {
    const qCfg = this.cfg.quantum;

    const factionQuantum = TechDecouplingEngine.clamp(input.factionQuantumLevel, 0, 100);
    const factionCyber = TechDecouplingEngine.clamp(input.factionCyberLevel, 0, 100);
    const targetQuantum = TechDecouplingEngine.clamp(input.targetQuantumLevel, 0, 100);

    // Core assessments
    const threatActive = factionQuantum >= qCfg.threatThreshold;
    const hasQRE =
      factionQuantum >= qCfg.qreQuantumRequirement &&
      factionCyber >= qCfg.qreCyberRequirement;
    const targetVulnerable = targetQuantum < qCfg.qreQuantumRequirement;
    const targetHasQRE = targetQuantum >= qCfg.qreQuantumRequirement;
    const targetCommsInterceptable = threatActive && !targetHasQRE;

    // Bonus calculations
    const intelBonusVsTarget =
      threatActive && targetVulnerable
        ? qCfg.intelBonusVsLowQuantum
        : 0;
    const financialWarfareBonus = targetCommsInterceptable ? 0.2 : 0;

    // Build reason string
    const parts: string[] = [];
    parts.push(
      `Quantum threat evaluation — ${input.factionId} (quantum ${factionQuantum}, ` +
      `cyber ${factionCyber}) vs ${input.targetFaction} (quantum ${targetQuantum})`,
    );
    if (threatActive) {
      parts.push(`threat ACTIVE (quantum ≥ ${qCfg.threatThreshold})`);
    } else {
      parts.push(`threat INACTIVE (quantum < ${qCfg.threatThreshold})`);
    }
    if (hasQRE) {
      parts.push(`${input.factionId} has QRE`);
    }
    if (targetVulnerable) {
      parts.push(`${input.targetFaction} is vulnerable (no QRE possible)`);
    }
    if (targetCommsInterceptable) {
      parts.push(
        `${input.targetFaction} comms interceptable — SWIFT vulnerable ` +
        `(financial-warfare bonus +${financialWarfareBonus})`,
      );
    }
    if (intelBonusVsTarget > 0) {
      parts.push(`intel bonus +${intelBonusVsTarget} vs target`);
    }
    parts.push(`(turn ${input.currentTurn})`);

    return {
      threatActive,
      intelBonusVsTarget,
      hasQRE,
      targetVulnerable,
      targetCommsInterceptable,
      financialWarfareBonus,
      reason: parts.join('; ') + '.',
    };
  }

  // -------------------------------------------------------------------------
  // FR-1808 — Dual-Use Dilemma
  // -------------------------------------------------------------------------

  /**
   * Evaluate the dual-use technology dilemma for a faction.
   *
   * The dilemma is **triggered** when the faction's AI tech level ≥ 60 OR
   * Biotech tech level ≥ 60. Once triggered the faction must choose:
   *
   * - **Sign** — Gains legitimacy (+10), but military applications are
   *   restricted.
   * - **Refuse** — Loses legitimacy (−5), retains full military access.
   * - **SecretViolate** — If discovered by espionage: catastrophic legitimacy
   *   loss (−25), all tech agreements voided, coalition sanctions risk.
   *   If not discovered: no immediate effect (player keeps both benefits).
   *
   * If the dilemma is not triggered (both levels below thresholds), the
   * result reflects no effects regardless of the stated choice.
   *
   * @param input - The dual-use dilemma evaluation parameters.
   * @returns An immutable result describing legitimacy changes and restrictions.
   *
   * @see FR-1808
   */
  public evaluateDualUseDilemma(input: DualUseDilemmaInput): DualUseDilemmaResult {
    const dCfg = this.cfg.dualUseDilemma;

    const aiLevel = TechDecouplingEngine.clamp(input.factionAILevel, 0, 100);
    const biotechLevel = TechDecouplingEngine.clamp(input.factionBiotechLevel, 0, 100);

    const triggered = aiLevel >= dCfg.aiTrigger || biotechLevel >= dCfg.biotechTrigger;

    // If not triggered, return inert result regardless of choice
    if (!triggered) {
      return {
        triggered: false,
        choice: input.choice,
        legitimacyChange: 0,
        militaryApplicationsRestricted: false,
        allTechAgreementsVoided: false,
        coalitionSanctionsRisk: false,
        reason:
          `Dual-use dilemma NOT triggered for ${input.factionId}: ` +
          `AI level ${aiLevel} < ${dCfg.aiTrigger} and Biotech level ` +
          `${biotechLevel} < ${dCfg.biotechTrigger}. No effects applied ` +
          `(turn ${input.currentTurn}).`,
      };
    }

    // Dilemma is triggered — evaluate the choice exhaustively
    const choice = input.choice;
    switch (choice) {
      case DualUseChoice.Sign:
        return {
          triggered: true,
          choice,
          legitimacyChange: dCfg.accordsLegitimacyBonus,
          militaryApplicationsRestricted: true,
          allTechAgreementsVoided: false,
          coalitionSanctionsRisk: false,
          reason:
            `${input.factionId} signs international dual-use accords ` +
            `(AI ${aiLevel}, Biotech ${biotechLevel}): legitimacy ` +
            `+${dCfg.accordsLegitimacyBonus}, military applications ` +
            `restricted (turn ${input.currentTurn}).`,
        };

      case DualUseChoice.Refuse:
        return {
          triggered: true,
          choice,
          legitimacyChange: dCfg.refusalLegitimacyPenalty,
          militaryApplicationsRestricted: false,
          allTechAgreementsVoided: false,
          coalitionSanctionsRisk: false,
          reason:
            `${input.factionId} refuses international dual-use accords ` +
            `(AI ${aiLevel}, Biotech ${biotechLevel}): legitimacy ` +
            `${dCfg.refusalLegitimacyPenalty}, full military applications ` +
            `retained (turn ${input.currentTurn}).`,
        };

      case DualUseChoice.SecretViolate: {
        if (input.discoveredByEspionage) {
          return {
            triggered: true,
            choice,
            legitimacyChange: dCfg.secretViolationLegitimacyPenalty,
            militaryApplicationsRestricted: false,
            allTechAgreementsVoided: true,
            coalitionSanctionsRisk: true,
            reason:
              `${input.factionId} secretly violates dual-use accords and ` +
              `is DISCOVERED by espionage (AI ${aiLevel}, Biotech ` +
              `${biotechLevel}): legitimacy ` +
              `${dCfg.secretViolationLegitimacyPenalty}, all tech ` +
              `agreements voided, coalition sanctions risk ` +
              `(turn ${input.currentTurn}).`,
          };
        }

        // Not discovered — no immediate consequences
        return {
          triggered: true,
          choice,
          legitimacyChange: 0,
          militaryApplicationsRestricted: false,
          allTechAgreementsVoided: false,
          coalitionSanctionsRisk: false,
          reason:
            `${input.factionId} secretly violates dual-use accords ` +
            `UNDETECTED (AI ${aiLevel}, Biotech ${biotechLevel}): no ` +
            `immediate effect — player retains both benefits ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      default: {
        // Exhaustive check — should never be reached
        const _exhaustive: never = choice;
        return _exhaustive;
      }
    }
  }
}
