/**
 * @module diplomacy-agreements
 * @description Bilateral Agreements system per FR-701.
 * Handles proposal validation, AI utility evaluation, agreement lifecycle,
 * and per-turn effect calculation for NAP, TradeDeal, DefensePact, and
 * IntelSharing agreements between factions.
 */
import { GAME_CONFIG } from '@/engine/config';
import { AgreementType, AgreementStatus } from '@/data/types';
import type { FactionId, TurnNumber, NationState } from '@/data/types';

const AT = AgreementType;
const AS = AgreementStatus;

/* ------------------------------------------------------------------ */
/*  Exported types                                                     */
/* ------------------------------------------------------------------ */

/** Resolved diplomacy configuration block from GAME_CONFIG. */
export type DiplomacyConfig = typeof GAME_CONFIG.diplomacy;

/** A bilateral agreement between two factions. */
export interface BilateralAgreement {
  readonly id: string;
  readonly type: AgreementType;
  readonly status: AgreementStatus;
  readonly proposer: FactionId;
  readonly target: FactionId;
  readonly proposedTurn: TurnNumber;
  readonly activatedTurn: TurnNumber | null;
  readonly expirationTurn: TurnNumber | null;
  /** Duration in turns. 0 = indefinite. */
  readonly duration: number;
}

/** Input bundle required to propose or evaluate an agreement. */
export interface ProposalInput {
  readonly proposer: FactionId;
  readonly target: FactionId;
  readonly agreementType: AgreementType;
  readonly currentTurn: TurnNumber;
  readonly proposerNation: NationState;
  readonly targetNation: NationState;
  /** Trust level 0-100. */
  readonly trust: number;
  /** Chemistry score -100 to 100. */
  readonly chemistry: number;
  readonly existingAgreements: readonly BilateralAgreement[];
}

/** Breakdown of utility sub-scores used during AI acceptance evaluation. */
export interface UtilityFactors {
  readonly trustScore: number;
  readonly chemistryScore: number;
  readonly nationalInterestScore: number;
  readonly militaryBalanceScore: number;
  readonly economicBenefitScore: number;
  readonly credibilityModifier: number;
  readonly sharedEnemyBonus: number;
  readonly ideologicalPenalty: number;
}

/** Result of utility evaluation for a proposal. */
export interface ProposalEvaluation {
  readonly utility: number;
  readonly factors: UtilityFactors;
  readonly accepted: boolean;
  readonly reason: string;
}

/** Per-turn effect produced by a single active agreement. */
export interface AgreementEffect {
  readonly agreementId: string;
  readonly type: AgreementType;
  readonly targetFaction: FactionId;
  readonly stabilityBonus: number;
  readonly gdpBonus: number;
  readonly treasuryBonus: number;
  readonly militaryReadinessBonus: number;
  readonly tensionReduction: number;
}

/** Full result returned from {@link BilateralAgreementEngine.proposeAgreement}. */
export interface ProposalResult {
  readonly agreement: BilateralAgreement;
  readonly evaluation: ProposalEvaluation;
  readonly diCost: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Clamp a value into the [0, 1] range. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Return a {@link UtilityFactors} object with every field set to zero. */
function zeroFactors(): UtilityFactors {
  return {
    trustScore: 0,
    chemistryScore: 0,
    nationalInterestScore: 0,
    militaryBalanceScore: 0,
    economicBenefitScore: 0,
    credibilityModifier: 0,
    sharedEnemyBonus: 0,
    ideologicalPenalty: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

/**
 * Manages the full lifecycle of bilateral agreements between factions.
 * All public methods are **pure** — they never mutate their inputs.
 * @see FR-701 — Bilateral Agreements
 */
export class BilateralAgreementEngine {
  private readonly cfg: DiplomacyConfig;

  constructor(config?: DiplomacyConfig) {
    this.cfg = config ?? GAME_CONFIG.diplomacy;
  }

  /**
   * Return the configuration sub-object for a given agreement type.
   * Uses an exhaustive switch to ensure every {@link AgreementType} is handled.
   * @see GAME_CONFIG.diplomacy.agreements
   */
  getAgreementConfig(type: AgreementType): {
    minTrust: number;
    diCost: number;
    defaultDuration: number;
  } {
    switch (type) {
      case AT.NAP:          return this.cfg.agreements.nap;
      case AT.TradeDeal:    return this.cfg.agreements.tradeDeal;
      case AT.DefensePact:  return this.cfg.agreements.defensePact;
      case AT.IntelSharing: return this.cfg.agreements.intelSharing;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown AgreementType: ${_exhaustive as string}`);
      }
    }
  }

  /**
   * Validate whether a proposal is structurally and diplomatically legal.
   *
   * Checks (in order):
   * 1. Trust meets minimum for the agreement type
   * 2. Proposer has enough DI to pay cost
   * 3. No duplicate active agreement of same type between same factions
   * 4. Max simultaneous agreements not exceeded (3 per pair)
   * 5. Target credibility is not below autoRejectThreshold
   *
   * @see GAME_CONFIG.diplomacy.utility.maxSimultaneousAgreements
   * @see GAME_CONFIG.diplomacy.credibility.autoRejectThreshold
   */
  validateProposal(input: ProposalInput): { valid: boolean; reason: string } {
    const { proposer, target, agreementType, proposerNation, targetNation, trust, existingAgreements } = input;
    const acfg = this.getAgreementConfig(agreementType);

    // 1. Trust check
    if (trust < acfg.minTrust) {
      return { valid: false, reason: `Trust (${trust}) is below minimum (${acfg.minTrust}) for ${agreementType}` };
    }

    // 2. DI cost check
    if (proposerNation.diplomaticInfluence < acfg.diCost) {
      return { valid: false, reason: `Insufficient Diplomatic Influence: need ${acfg.diCost}, have ${proposerNation.diplomaticInfluence}` };
    }

    const isSamePair = (a: BilateralAgreement) =>
      (a.proposer === proposer && a.target === target) ||
      (a.proposer === target && a.target === proposer);

    // 3. Duplicate active agreement check
    const hasDuplicate = existingAgreements.some(
      (a) => a.status === AS.Active && a.type === agreementType && isSamePair(a),
    );
    if (hasDuplicate) {
      return { valid: false, reason: `An active ${agreementType} already exists between ${proposer} and ${target}` };
    }

    // 4. Max simultaneous agreements check
    const pairActiveCount = existingAgreements.filter(
      (a) => a.status === AS.Active && isSamePair(a),
    ).length;
    if (pairActiveCount >= this.cfg.utility.maxSimultaneousAgreements) {
      return { valid: false, reason: `Maximum simultaneous agreements (${this.cfg.utility.maxSimultaneousAgreements}) reached between ${proposer} and ${target}` };
    }

    // 5. Target credibility check
    if (targetNation.allianceCredibility <= this.cfg.credibility.autoRejectThreshold) {
      return { valid: false, reason: `Target credibility (${targetNation.allianceCredibility}) is at or below auto-reject threshold (${this.cfg.credibility.autoRejectThreshold})` };
    }

    return { valid: true, reason: 'Proposal is valid' };
  }

  /**
   * Evaluate the AI utility of a proposal from the **target's** perspective.
   *
   * utility = trustScore + chemistryScore + nationalInterestScore
   *         + militaryBalanceScore + economicBenefitScore
   *         + credibilityModifier + sharedEnemyBonus + ideologicalPenalty
   *
   * Accepted when utility >= acceptanceThreshold AND proposer credibility
   * is above the auto-reject threshold.
   *
   * @see GAME_CONFIG.diplomacy.utility
   * @see GAME_CONFIG.diplomacy.credibility
   */
  evaluateUtility(input: ProposalInput): ProposalEvaluation {
    const { trust, chemistry, proposerNation, targetNation } = input;
    const { utility: uCfg, credibility: cCfg } = this.cfg;

    const trustScore             = (trust / 100) * uCfg.trustWeight;
    const chemistryScore         = (chemistry / 100) * uCfg.chemistryWeight;
    const nationalInterestScore  = this.calculateNationalInterest(input) * uCfg.nationalInterestWeight;
    const militaryBalanceScore   = this.calculateMilitaryBalance(input) * uCfg.militaryBalanceWeight;
    const economicBenefitScore   = this.calculateEconomicBenefit(input) * uCfg.economicBenefitWeight;
    const credibilityModifier    = (proposerNation.allianceCredibility - 50) * cCfg.acceptanceMultiplierPerPoint;

    // Shared-enemy bonus: proxy heuristic — both nations under stability pressure
    const sharedEnemyBonus =
      proposerNation.stability < 50 && targetNation.stability < 50
        ? uCfg.sharedEnemyBonus
        : 0;

    // Ideological penalty: large popularity gap as proxy for ideological distance
    const ideologicalPenalty =
      Math.abs(proposerNation.popularity - targetNation.popularity) > 60
        ? uCfg.ideologicalOppositionPenalty
        : 0;

    const factors: UtilityFactors = {
      trustScore, chemistryScore, nationalInterestScore,
      militaryBalanceScore, economicBenefitScore,
      credibilityModifier, sharedEnemyBonus, ideologicalPenalty,
    };

    const rawUtility =
      trustScore + chemistryScore + nationalInterestScore +
      militaryBalanceScore + economicBenefitScore +
      credibilityModifier + sharedEnemyBonus + ideologicalPenalty;

    // Auto-reject on low credibility
    if (proposerNation.allianceCredibility <= cCfg.autoRejectThreshold) {
      return {
        utility: rawUtility, factors, accepted: false,
        reason: `Proposer credibility (${proposerNation.allianceCredibility}) is at or below auto-reject threshold (${cCfg.autoRejectThreshold})`,
      };
    }

    // Trusted-ally acceptance bonus
    const utility =
      proposerNation.allianceCredibility >= cCfg.trustedAllyThreshold
        ? rawUtility + cCfg.trustedAllyAcceptanceBonus
        : rawUtility;

    const accepted = utility >= uCfg.acceptanceThreshold;
    const reason = accepted
      ? `Utility ${utility.toFixed(3)} meets threshold ${uCfg.acceptanceThreshold}`
      : `Utility ${utility.toFixed(3)} below threshold ${uCfg.acceptanceThreshold}`;

    return { utility, factors, accepted, reason };
  }

  /**
   * Process a complete proposal: validate → evaluate → create agreement.
   *
   * 1. Validates; if invalid returns a Rejected agreement.
   * 2. Evaluates utility → accepted or rejected.
   * 3. Creates {@link BilateralAgreement} with correct status & expiration.
   * 4. Returns result with DI cost (always charged on proposal).
   *
   * @see FR-701
   */
  proposeAgreement(input: ProposalInput): ProposalResult {
    const { proposer, target, agreementType, currentTurn } = input;
    const acfg = this.getAgreementConfig(agreementType);
    const diCost = acfg.diCost;
    const id = BilateralAgreementEngine.generateId(proposer, target, agreementType, currentTurn);

    // Step 1: Validate
    const validation = this.validateProposal(input);
    if (!validation.valid) {
      return {
        agreement: {
          id, type: agreementType, status: AS.Rejected,
          proposer, target, proposedTurn: currentTurn,
          activatedTurn: null, expirationTurn: null, duration: acfg.defaultDuration,
        },
        evaluation: { utility: 0, factors: zeroFactors(), accepted: false, reason: validation.reason },
        diCost,
      };
    }

    // Step 2: Evaluate utility
    const evaluation = this.evaluateUtility(input);

    // Step 3: Build agreement
    const status = evaluation.accepted ? AS.Active : AS.Rejected;
    const activatedTurn = evaluation.accepted ? currentTurn : null;
    const duration = acfg.defaultDuration;
    const expirationTurn =
      evaluation.accepted && duration > 0 ? ((currentTurn + duration) as TurnNumber) : null;

    return {
      agreement: {
        id, type: agreementType, status, proposer, target,
        proposedTurn: currentTurn, activatedTurn, expirationTurn, duration,
      },
      evaluation,
      diCost,
    };
  }

  /**
   * Calculate per-turn effects of every **Active** agreement involving `factionId`.
   *
   * - **NAP** → stabilityBonus + tensionReduction
   * - **TradeDeal** → gdpBonus + treasuryBonus
   * - **DefensePact** → militaryReadinessBonus
   * - **IntelSharing** → no direct NationState effect (delegated to intel engine)
   *
   * @see GAME_CONFIG.diplomacy.agreements
   */
  calculateActiveEffects(
    factionId: FactionId,
    agreements: readonly BilateralAgreement[],
  ): AgreementEffect[] {
    return agreements
      .filter((a) => a.status === AS.Active && (a.proposer === factionId || a.target === factionId))
      .map((a) => {
        const partner = a.proposer === factionId ? a.target : a.proposer;
        return this.buildEffect(a.id, a.type, partner);
      });
  }

  /**
   * Determine whether a single agreement has expired.
   * Duration 0 = never expires. Otherwise: currentTurn >= activatedTurn + duration.
   * @see BilateralAgreement.duration
   */
  checkExpiration(agreement: BilateralAgreement, currentTurn: TurnNumber): boolean {
    if (agreement.duration === 0) return false;
    if (agreement.activatedTurn === null) return false;
    return currentTurn >= (agreement.activatedTurn + agreement.duration);
  }

  /**
   * Scan all agreements and mark expired ones.
   * Returns a new array (no mutation) and a list of newly-expired agreements.
   * @see FR-701
   */
  processExpirations(
    agreements: readonly BilateralAgreement[],
    currentTurn: TurnNumber,
  ): { updated: BilateralAgreement[]; expired: BilateralAgreement[] } {
    const expired: BilateralAgreement[] = [];
    const updated = agreements.map((a) => {
      if (a.status !== AS.Active || !this.checkExpiration(a, currentTurn)) return a;
      const exp: BilateralAgreement = { ...a, status: AS.Expired };
      expired.push(exp);
      return exp;
    });
    return { updated, expired };
  }

  /**
   * Generate a deterministic, unique agreement identifier.
   * Format: `${proposer}-${target}-${type}-T${turn}`
   */
  static generateId(
    proposer: FactionId,
    target: FactionId,
    type: AgreementType,
    turn: TurnNumber,
  ): string {
    return `${proposer}-${target}-${type}-T${turn}`;
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * National-interest score (0-1) from the target's perspective.
   * Averages GDP benefit ratio, stability need, and military parity.
   * @returns clamped 0-1 score
   */
  private calculateNationalInterest(input: ProposalInput): number {
    const { proposerNation: p, targetNation: t } = input;

    const gdpTotal = p.gdp + t.gdp;
    const gdpBenefitRatio = gdpTotal > 0 ? 1 - t.gdp / gdpTotal : 0.5;
    const stabilityNeed = 1 - t.stability / 100;
    const readinessGap = Math.abs(p.militaryReadiness - t.militaryReadiness);
    const militaryParity = 1 - readinessGap / 100;

    return clamp01((gdpBenefitRatio + stabilityNeed + militaryParity) / 3);
  }

  /**
   * Military-balance score (0-1) from the target's perspective.
   * Weaker factions score higher for DefensePact; parity preferred otherwise.
   * @returns clamped 0-1 score
   */
  private calculateMilitaryBalance(input: ProposalInput): number {
    const { agreementType, proposerNation: p, targetNation: t } = input;
    const total = p.militaryReadiness + t.militaryReadiness;
    if (total === 0) return 0.5;

    const strengthRatio = p.militaryReadiness / total;

    if (agreementType === AT.DefensePact) {
      // Weaker target benefits most when proposer is much stronger
      return clamp01(strengthRatio);
    }
    // Non-defence: military parity preferred
    return clamp01(1 - Math.abs(strengthRatio - 0.5) * 2);
  }

  /**
   * Economic-benefit score (0-1) from the target's perspective.
   * Larger GDP gap favours TradeDeal; treasury stress used for other types.
   * @returns clamped 0-1 score
   */
  private calculateEconomicBenefit(input: ProposalInput): number {
    const { agreementType, proposerNation: p, targetNation: t } = input;
    const gdpGap = p.gdp - t.gdp;
    const maxGdp = Math.max(p.gdp, t.gdp, 1);

    if (agreementType === AT.TradeDeal) {
      return clamp01((gdpGap / maxGdp + 1) / 2);
    }
    // Baseline: treasury stress indicator
    const treasuryRatio = t.gdp > 0 ? t.treasury / t.gdp : 0.5;
    return clamp01(1 - treasuryRatio);
  }

  /**
   * Build an {@link AgreementEffect} for a single active agreement.
   * @see calculateActiveEffects
   */
  private buildEffect(agreementId: string, type: AgreementType, targetFaction: FactionId): AgreementEffect {
    const base: AgreementEffect = {
      agreementId, type, targetFaction,
      stabilityBonus: 0, gdpBonus: 0, treasuryBonus: 0,
      militaryReadinessBonus: 0, tensionReduction: 0,
    };

    switch (type) {
      case AT.NAP:
        return {
          ...base,
          stabilityBonus: this.cfg.agreements.nap.stabilityBonusPerTurn,
          tensionReduction: this.cfg.agreements.nap.tensionReduction,
        };
      case AT.TradeDeal:
        return {
          ...base,
          gdpBonus: this.cfg.agreements.tradeDeal.gdpBonusPerTurn,
          treasuryBonus: this.cfg.agreements.tradeDeal.treasuryBonusPerTurn,
        };
      case AT.DefensePact:
        return { ...base, militaryReadinessBonus: this.cfg.agreements.defensePact.militaryReadinessBonus };
      case AT.IntelSharing:
        return base; // No direct NationState effect — handled by intel engine
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown AgreementType: ${_exhaustive as string}`);
      }
    }
  }
}
