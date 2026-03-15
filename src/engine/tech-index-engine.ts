/**
 * Technology Index Engine — CNFL-1800
 *
 * Implements the Technology Index subsystem for the simulation.
 * Covers tech-domain level extraction, compounding bonuses across
 * all six tech pillars, investment cost calculation with exponential
 * scaling and export-control penalties, periodic decay without
 * investment, and technology espionage with diplomatic consequences.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.technology`.
 *
 * @module tech-index-engine
 * @see FR-1801 — Technology Index
 * @see FR-1802 — Tech Investment & Espionage
 */

import { GAME_CONFIG } from '@/engine/config';
import { TechDomain } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';
import type { TechnologyIndex } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.technology` section. */
export type TechConfig = typeof GAME_CONFIG.technology;

// ---------------------------------------------------------------------------
// FR-1801 — Get Domain Level
// ---------------------------------------------------------------------------

/**
 * Input for extracting a numeric tech level from a {@link TechnologyIndex}
 * by {@link TechDomain}.
 *
 * @see FR-1801
 */
export interface GetDomainLevelInput {
  /** The full technology index for a faction. */
  readonly techIndex: TechnologyIndex;
  /** The domain whose level is requested. */
  readonly domain: TechDomain;
}

// ---------------------------------------------------------------------------
// FR-1801 — Compounding Bonuses
// ---------------------------------------------------------------------------

/**
 * Input for computing cross-domain compounding bonuses.
 *
 * @see FR-1801
 */
export interface CompoundingBonusInput {
  /** The full technology index for a faction. */
  readonly techIndex: TechnologyIndex;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of compounding bonus evaluation.  Each field describes a derived
 * effect that other subsystems can consume.
 *
 * @see FR-1801
 */
export interface CompoundingBonusResult {
  /** Faction whose bonuses were computed. */
  readonly factionId: FactionId;
  /**
   * Intelligence-effectiveness bonus from AI capability.
   * +1 % per 10 AI levels (e.g. AI 70 → +7 % = 0.07).
   */
  readonly aiIntelligenceBonus: number;
  /** Whether semiconductors level > 0, enabling military modernisation downstream. */
  readonly semiconductorsGateMilitary: boolean;
  /** Whether space level > 0, enabling satellite intelligence. */
  readonly spaceEnablesSatelliteIntel: boolean;
  /** Whether cyber level > 0, enabling information-warfare operations. */
  readonly cyberEnablesInfoWar: boolean;
  /** Pandemic resilience fraction derived from biotech (biotech / 100). */
  readonly biotechPandemicResilience: number;
  /** Whether quantum level ≥ 70, activating quantum threat mechanics. */
  readonly quantumThreatActive: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1802 — Investment Cost
// ---------------------------------------------------------------------------

/**
 * Input for computing the treasury cost of investing in a tech domain.
 *
 * @see FR-1802
 */
export interface InvestmentCostInput {
  /** Current domain level (0–100). */
  readonly currentLevel: number;
  /** Desired level after investment. */
  readonly targetLevel: number;
  /** Domain being invested in. */
  readonly domain: TechDomain;
  /** Whether the faction faces multilateral export controls in this domain. */
  readonly isUnderExportControls: boolean;
  /** Whether a semiconductor chokepoint applies (cost +100 % for AI). */
  readonly isSemiconductorChokepoint: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed treasury cost breakdown of a tech investment.
 *
 * @see FR-1802
 */
export interface InvestmentCostResult {
  /** Cumulative base cost for levels at or below the exponential threshold. */
  readonly baseCost: number;
  /** Cumulative exponential cost for levels above the exponential threshold. */
  readonly exponentialCost: number;
  /** Additional cost applied by export controls and/or semiconductor chokepoint. */
  readonly controlsPenalty: number;
  /** Grand total: baseCost + exponentialCost + controlsPenalty. */
  readonly totalCost: number;
  /** Number of levels gained (targetLevel − currentLevel). */
  readonly levelsGained: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1802 — Tech Decay
// ---------------------------------------------------------------------------

/**
 * Input for computing periodic tech-level decay when a faction stops
 * investing in a domain.
 *
 * @see FR-1802
 */
export interface DecayInput {
  /** Faction whose tech index is evaluated. */
  readonly factionId: FactionId;
  /** Full technology index snapshot. */
  readonly techIndex: TechnologyIndex;
  /** Maps each {@link TechDomain} value to the number of turns since last investment. */
  readonly turnsSinceInvestment: Record<string, number>;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/** A single domain that experienced decay. */
export interface DecayedDomain {
  /** Domain that decayed. */
  readonly domain: TechDomain;
  /** Level before decay. */
  readonly previousLevel: number;
  /** Level after decay. */
  readonly newLevel: number;
  /** Turns without investment that triggered the decay. */
  readonly turnsWithout: number;
}

/**
 * Result of tech-decay evaluation.
 *
 * @see FR-1802
 */
export interface DecayResult {
  /** Faction whose decay was evaluated. */
  readonly factionId: FactionId;
  /** Domains that actually lost a level this evaluation. */
  readonly decayedDomains: ReadonlyArray<DecayedDomain>;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1802 — Tech Espionage
// ---------------------------------------------------------------------------

/**
 * Input for evaluating a technology-espionage operation.
 *
 * @see FR-1802
 */
export interface TechEspionageInput {
  /** Faction conducting espionage. */
  readonly spyFaction: FactionId;
  /** Faction being spied upon. */
  readonly targetFaction: FactionId;
  /** Domain targeted by espionage. */
  readonly domain: TechDomain;
  /** Spy faction's current level in the domain. */
  readonly spyCurrentLevel: number;
  /** Target faction's current level — must be superior for eligibility. */
  readonly targetCurrentLevel: number;
  /** Whether the covert operation succeeded. */
  readonly operationSucceeded: boolean;
  /** Whether the target faction discovered the operation. */
  readonly discoveredByTarget: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/** Diplomatic fallout from a discovered espionage operation. */
export interface DiplomaticConsequences {
  /** Bilateral tension increase (0 if undiscovered). */
  readonly tensionIncrease: number;
  /** Legitimacy penalty for spy faction (0 if undiscovered). */
  readonly legitimacyPenalty: number;
}

/**
 * Result of a technology-espionage evaluation.
 *
 * @see FR-1802
 */
export interface TechEspionageResult {
  /** Whether the target has a superior level (precondition for espionage). */
  readonly eligible: boolean;
  /** Levels gained from successful espionage (0 if failed or ineligible). */
  readonly levelGained: number;
  /** Spy's new level after espionage (clamped to 100). */
  readonly newLevel: number;
  /** Whether the target discovered the operation. */
  readonly discovered: boolean;
  /** Tension and legitimacy consequences if discovered. */
  readonly diplomaticConsequences: DiplomaticConsequences;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// All TechDomain values (used for iteration)
// ---------------------------------------------------------------------------

/** Ordered array of every {@link TechDomain} value for deterministic iteration. */
const ALL_TECH_DOMAINS: readonly TechDomain[] = [
  TechDomain.AI,
  TechDomain.Semiconductors,
  TechDomain.Space,
  TechDomain.Cyber,
  TechDomain.Biotech,
  TechDomain.Quantum,
] as const;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure-function engine for the Technology Index subsystem.
 *
 * Provides:
 * - Domain-level extraction from a {@link TechnologyIndex}
 * - Cross-domain compounding bonus computation
 * - Investment cost calculation with exponential scaling
 * - Periodic decay evaluation
 * - Tech-espionage adjudication with diplomatic consequences
 *
 * @see FR-1801 — Technology Index
 * @see FR-1802 — Tech Investment & Espionage
 */
export class TechIndexEngine {
  private readonly cfg: TechConfig;

  /**
   * Create a new TechIndexEngine.
   *
   * @param config - Technology configuration; defaults to `GAME_CONFIG.technology`.
   */
  constructor(config: TechConfig = GAME_CONFIG.technology) {
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
  // FR-1801 — getDomainLevel
  // -------------------------------------------------------------------------

  /**
   * Extract the numeric level (0–100) of a specific {@link TechDomain} from a
   * {@link TechnologyIndex}.
   *
   * Uses an exhaustive switch to guarantee compile-time coverage of all
   * domain variants.
   *
   * @param input - The tech index and domain to query.
   * @returns The domain's level (0–100).
   *
   * @see FR-1801
   */
  getDomainLevel(input: GetDomainLevelInput): number {
    const { techIndex, domain } = input;

    switch (domain) {
      case TechDomain.AI:
        return techIndex.ai;
      case TechDomain.Semiconductors:
        return techIndex.semiconductors;
      case TechDomain.Space:
        return techIndex.space;
      case TechDomain.Cyber:
        return techIndex.cyber;
      case TechDomain.Biotech:
        return techIndex.biotech;
      case TechDomain.Quantum:
        return techIndex.quantum;
      default: {
        // Exhaustiveness guard — forces a compile error if a new domain is added.
        const _exhaustive: never = domain;
        return _exhaustive;
      }
    }
  }

  // -------------------------------------------------------------------------
  // FR-1801 — computeCompoundingBonuses
  // -------------------------------------------------------------------------

  /**
   * Compute the cross-domain compounding bonuses derived from a faction's
   * {@link TechnologyIndex}.
   *
   * Bonuses include AI-driven intelligence amplification, semiconductor
   * military-modernisation gating, satellite-intel enablement from space,
   * cyber info-war enablement, biotech pandemic resilience, and the quantum
   * threat flag.
   *
   * @param input - The faction's tech index and the current turn.
   * @returns A {@link CompoundingBonusResult} describing all derived effects.
   *
   * @see FR-1801
   */
  computeCompoundingBonuses(input: CompoundingBonusInput): CompoundingBonusResult {
    const { techIndex, currentTurn } = input;

    const aiLevel = techIndex.ai;
    const semiLevel = techIndex.semiconductors;
    const spaceLevel = techIndex.space;
    const cyberLevel = techIndex.cyber;
    const biotechLevel = techIndex.biotech;
    const quantumLevel = techIndex.quantum;

    const aiIntelligenceBonus =
      Math.floor(aiLevel / 10) * this.cfg.aiAmplification.intelligenceEffectivenessPerTenAI;

    const semiconductorsGateMilitary = semiLevel > 0;
    const spaceEnablesSatelliteIntel = spaceLevel > 0;
    const cyberEnablesInfoWar = cyberLevel > 0;
    const biotechPandemicResilience = biotechLevel / 100;
    const quantumThreatActive = quantumLevel >= 70;

    const parts: string[] = [];
    parts.push(`Turn ${currentTurn as number}: Compounding bonuses for ${techIndex.factionId}.`);
    parts.push(`AI ${aiLevel} → intel bonus ${(aiIntelligenceBonus * 100).toFixed(4)}%.`);
    if (semiconductorsGateMilitary) parts.push('Semiconductors gate military modernisation: enabled.');
    if (spaceEnablesSatelliteIntel) parts.push('Space enables satellite intel: enabled.');
    if (cyberEnablesInfoWar) parts.push('Cyber enables info-war: enabled.');
    parts.push(`Biotech pandemic resilience: ${(biotechPandemicResilience * 100).toFixed(4)}%.`);
    if (quantumThreatActive) parts.push('Quantum threat ACTIVE (≥ 70).');

    return {
      factionId: techIndex.factionId,
      aiIntelligenceBonus,
      semiconductorsGateMilitary,
      spaceEnablesSatelliteIntel,
      cyberEnablesInfoWar,
      biotechPandemicResilience,
      quantumThreatActive,
      reason: parts.join(' '),
    };
  }

  // -------------------------------------------------------------------------
  // FR-1802 — computeInvestmentCost
  // -------------------------------------------------------------------------

  /**
   * Compute the treasury cost of raising a tech domain from its current
   * level to a target level.
   *
   * Cost model:
   * - Levels 1–50: linear at {@link TechConfig.investment.baseCostPerLevel} per level.
   * - Levels 51–100: exponential — `baseCostPerLevel × 2^((level − 50) / 10)`.
   * - Export controls add +50 % to the raw cost.
   * - Semiconductor chokepoint adds +100 % to raw cost when domain is AI.
   *
   * @param input - Current level, target level, domain, and modifier flags.
   * @returns A {@link InvestmentCostResult} with a full cost breakdown.
   *
   * @see FR-1802
   */
  computeInvestmentCost(input: InvestmentCostInput): InvestmentCostResult {
    const {
      currentLevel,
      targetLevel,
      domain,
      isUnderExportControls,
      isSemiconductorChokepoint,
      currentTurn,
    } = input;

    const { baseCostPerLevel, exponentialThreshold } = this.cfg.investment;

    const clampedCurrent = TechIndexEngine.clamp(currentLevel, 0, 100);
    const clampedTarget = TechIndexEngine.clamp(targetLevel, clampedCurrent, 100);
    const levelsGained = clampedTarget - clampedCurrent;

    let baseCost = 0;
    let exponentialCost = 0;

    for (let level = clampedCurrent + 1; level <= clampedTarget; level++) {
      if (level <= exponentialThreshold) {
        baseCost += baseCostPerLevel;
      } else {
        exponentialCost += baseCostPerLevel * Math.pow(2, (level - exponentialThreshold) / 10);
      }
    }

    let controlsPenalty = 0;
    const rawCost = baseCost + exponentialCost;

    if (isUnderExportControls) {
      controlsPenalty += rawCost * 0.5;
    }
    if (isSemiconductorChokepoint && domain === TechDomain.AI) {
      controlsPenalty += rawCost * 1.0;
    }

    const totalCost = rawCost + controlsPenalty;

    const parts: string[] = [];
    parts.push(
      `Turn ${currentTurn as number}: Investment cost for ${domain} ${clampedCurrent}→${clampedTarget} (${levelsGained} levels).`,
    );
    parts.push(`Base cost: ${baseCost.toFixed(1)}, exponential cost: ${exponentialCost.toFixed(1)}.`);
    if (controlsPenalty > 0) {
      parts.push(`Controls penalty: +${controlsPenalty.toFixed(1)}.`);
    }
    parts.push(`Total: ${totalCost.toFixed(1)}.`);

    return {
      baseCost,
      exponentialCost,
      controlsPenalty,
      totalCost,
      levelsGained,
      reason: parts.join(' '),
    };
  }

  // -------------------------------------------------------------------------
  // FR-1802 — computeDecay
  // -------------------------------------------------------------------------

  /**
   * Evaluate tech-level decay for every domain of a faction that has not
   * received investment for {@link TechConfig.decay.decayIntervalTurns} or
   * more turns.
   *
   * Each decayed domain loses {@link TechConfig.decay.decayAmount} (clamped
   * to 0).  Only domains that actually lose a level (previous > 0 and turns
   * without investment ≥ threshold) are reported.
   *
   * @param input - Faction, tech index, turns-since-investment map, and turn.
   * @returns A {@link DecayResult} listing all domains that decayed.
   *
   * @see FR-1802
   */
  computeDecay(input: DecayInput): DecayResult {
    const { factionId, techIndex, turnsSinceInvestment, currentTurn } = input;
    const { decayAmount, decayIntervalTurns } = this.cfg.decay;

    const decayedDomains: DecayedDomain[] = [];

    for (const domain of ALL_TECH_DOMAINS) {
      const turnsWithout = turnsSinceInvestment[domain] ?? 0;

      if (turnsWithout < decayIntervalTurns) {
        continue;
      }

      const previousLevel = this.getDomainLevel({ techIndex, domain });

      if (previousLevel <= 0) {
        continue;
      }

      const newLevel = TechIndexEngine.clamp(previousLevel + decayAmount, 0, 100);

      decayedDomains.push({
        domain,
        previousLevel,
        newLevel,
        turnsWithout,
      });
    }

    const parts: string[] = [];
    parts.push(`Turn ${currentTurn as number}: Decay evaluation for ${factionId}.`);

    if (decayedDomains.length === 0) {
      parts.push('No domains decayed.');
    } else {
      for (const d of decayedDomains) {
        parts.push(`${d.domain}: ${d.previousLevel}→${d.newLevel} (${d.turnsWithout} turns idle).`);
      }
    }

    return {
      factionId,
      decayedDomains,
      reason: parts.join(' '),
    };
  }

  // -------------------------------------------------------------------------
  // FR-1802 — evaluateTechEspionage
  // -------------------------------------------------------------------------

  /**
   * Adjudicate a technology-espionage operation.
   *
   * Prerequisites:
   * - The target must have a **superior** level in the domain
   *   (`targetCurrentLevel > spyCurrentLevel`).
   *
   * On success the spy gains {@link TechConfig.espionage.levelBonus} levels
   * (capped at 100).  If the operation is discovered, bilateral tension
   * increases by {@link TechConfig.espionage.discoveryTensionIncrease} and
   * the spy faction takes a legitimacy penalty of
   * {@link TechConfig.espionage.discoveryLegitimacyPenalty}.
   *
   * @param input - Spy / target factions, domain, levels, and outcome flags.
   * @returns A {@link TechEspionageResult} with level changes and diplomatic fallout.
   *
   * @see FR-1802
   */
  evaluateTechEspionage(input: TechEspionageInput): TechEspionageResult {
    const {
      spyFaction,
      targetFaction,
      domain,
      spyCurrentLevel,
      targetCurrentLevel,
      operationSucceeded,
      discoveredByTarget,
      currentTurn,
    } = input;

    const eligible = targetCurrentLevel > spyCurrentLevel;

    // Determine level gained
    let levelGained = 0;
    if (eligible && operationSucceeded) {
      levelGained = this.cfg.espionage.levelBonus;
    }

    const newLevel = TechIndexEngine.clamp(spyCurrentLevel + levelGained, 0, 100);

    // Diplomatic consequences
    const tensionIncrease = discoveredByTarget
      ? this.cfg.espionage.discoveryTensionIncrease
      : 0;
    const legitimacyPenalty = discoveredByTarget
      ? this.cfg.espionage.discoveryLegitimacyPenalty
      : 0;

    const diplomaticConsequences: DiplomaticConsequences = {
      tensionIncrease,
      legitimacyPenalty,
    };

    // Build reason
    const parts: string[] = [];
    parts.push(
      `Turn ${currentTurn as number}: ${spyFaction} espionage vs ${targetFaction} in ${domain}.`,
    );

    if (!eligible) {
      parts.push(
        `Ineligible — spy level (${spyCurrentLevel}) is not inferior to target level (${targetCurrentLevel}).`,
      );
    } else if (!operationSucceeded) {
      parts.push('Operation failed — no tech gained.');
    } else {
      parts.push(`Success — gained ${levelGained} levels (${spyCurrentLevel}→${newLevel}).`);
    }

    if (discoveredByTarget) {
      parts.push(
        `Discovered! Tension +${tensionIncrease}, legitimacy ${legitimacyPenalty}.`,
      );
    }

    return {
      eligible,
      levelGained,
      newLevel,
      discovered: discoveredByTarget,
      diplomaticConsequences,
      reason: parts.join(' '),
    };
  }
}
