/**
 * Special Capabilities & Military Modernization — FR-1005, FR-1006
 *
 * Pure-function engine for nation-specific special actions (Drone Swarm,
 * Artillery Barrage Seoul, Carrier Killer Salvo) and per-turn military
 * modernization investment with tech-level milestone unlocks.
 *
 * No side effects, no DOM access, no RNG (deterministic given inputs).
 *
 * @module engine/special-capabilities
 * @see FR-1005 — Special Capabilities
 * @see FR-1006 — Military Modernization
 */

import { GAME_CONFIG } from '@/engine/config';
import { SpecialCapabilityType } from '@/data/types';

import type { FactionId, TurnNumber } from '@/data/types';

// ── Aliases ──────────────────────────────────────────────────────────────────

const SCT = SpecialCapabilityType;

// ── Config Type ──────────────────────────────────────────────────────────────

/**
 * Military configuration slice from {@link GAME_CONFIG}.
 * @see FR-1005
 * @see FR-1006
 */
export type SpecialCapsConfig = typeof GAME_CONFIG.military;

// ── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Input required to execute a special capability action.
 * @see FR-1005
 */
export interface CapabilityExecutionInput {
  /** The type of special capability to execute. */
  readonly capabilityType: SpecialCapabilityType;
  /** The faction attempting to execute the capability. */
  readonly executingFaction: FactionId;
  /** The faction's current treasury balance. */
  readonly currentTreasury: number;
  /** The faction's current military readiness (0–100). */
  readonly currentReadiness: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
  /** Turn the capability was last used, or null if never used. */
  readonly lastUsedTurn: TurnNumber | null;
}

/**
 * Result returned after attempting to execute a special capability.
 * @see FR-1005
 */
export interface CapabilityExecutionResult {
  /** The capability that was attempted. */
  readonly capabilityType: SpecialCapabilityType;
  /** The faction that attempted execution. */
  readonly executingFaction: FactionId;
  /** Whether the capability was executed successfully. */
  readonly success: boolean;
  /** Treasury cost deducted (0 on failure). */
  readonly treasuryCost: number;
  /** Readiness cost deducted (0 on failure). */
  readonly readinessCost: number;
  /** Effects produced by the capability. */
  readonly effects: CapabilityEffect;
  /** Human-readable reason / summary. */
  readonly reason: string;
}

/**
 * Effects produced by a special capability execution.
 * @see FR-1005
 */
export interface CapabilityEffect {
  /** Stability damage inflicted on the target (Artillery Barrage). */
  readonly stabilityDamage: number;
  /** Tension increase from the action (Artillery Barrage). */
  readonly tensionIncrease: number;
  /** Per-turn attrition rate in the denial zone (Drone Swarm). */
  readonly attritionPerTurn: number;
  /** Hex radius of area denial effect (Drone Swarm). */
  readonly areaDenialRadius: number;
  /** Duration of the effect in turns (Drone Swarm). */
  readonly duration: number;
  /** Naval damage multiplier (Carrier Killer Salvo). */
  readonly navalDamageMultiplier: number;
  /** Whether surface escorts are bypassed (Carrier Killer Salvo). */
  readonly bypassesSurfaceEscorts: boolean;
  /** Whether the action causes civilian casualties. */
  readonly civilianCasualties: boolean;
  /** Faction targeted by the capability, if any. */
  readonly targetFaction: FactionId | null;
  /** Human-readable description of the effect. */
  readonly description: string;
}

/**
 * Validation result for a capability execution pre-check.
 * @see FR-1005
 */
export interface CapabilityValidation {
  /** Whether all pre-conditions are met. */
  readonly valid: boolean;
  /** Human-readable reason for the validation outcome. */
  readonly reason: string;
}

/**
 * Input for a single turn of military modernization investment.
 * @see FR-1006
 */
export interface ModernizationInput {
  /** The investing faction. */
  readonly factionId: FactionId;
  /** The faction's current tech level (0–100). */
  readonly currentTechLevel: number;
  /** The faction's current treasury balance. */
  readonly currentTreasury: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of a military modernization investment turn.
 * @see FR-1006
 */
export interface ModernizationResult {
  /** The faction that invested. */
  readonly factionId: FactionId;
  /** Whether the investment was made. */
  readonly invested: boolean;
  /** Treasury cost deducted (0 if not invested). */
  readonly treasuryCost: number;
  /** Tech level before investment. */
  readonly previousTechLevel: number;
  /** Tech level after investment (clamped 0–100). */
  readonly newTechLevel: number;
  /** Net tech level gain this turn. */
  readonly techLevelGain: number;
  /** Milestones newly unlocked by this investment. */
  readonly milestonesUnlocked: readonly MilestoneUnlock[];
  /** Human-readable summary of the investment outcome. */
  readonly reason: string;
}

/**
 * A single tech-level milestone unlock.
 * @see FR-1006
 */
export interface MilestoneUnlock {
  /** Tech level threshold at which this milestone unlocks. */
  readonly threshold: number;
  /** Identifier of the unlocked capability. */
  readonly unlock: string;
  /** Human-readable description of the unlocked capability. */
  readonly description: string;
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Stateless engine for special capability execution and military modernization.
 *
 * All methods are pure — no mutation of inputs, no side effects.
 *
 * @see FR-1005 — Special Capabilities
 * @see FR-1006 — Military Modernization
 */
export class SpecialCapabilitiesEngine {
  private readonly cfg: SpecialCapsConfig;

  constructor(config?: SpecialCapsConfig) {
    this.cfg = config ?? GAME_CONFIG.military;
  }

  // ── Capability Config ──────────────────────────────────────────────────

  /**
   * Get the configuration object for a specific capability type.
   *
   * Uses an exhaustive switch to guarantee every {@link SpecialCapabilityType}
   * variant is handled.
   *
   * @see FR-1005
   */
  getCapabilityConfig(type: SpecialCapabilityType):
    | SpecialCapsConfig['specialCapabilities']['droneSwarm']
    | SpecialCapsConfig['specialCapabilities']['artilleryBarragSeoul']
    | SpecialCapsConfig['specialCapabilities']['carrierKillerSalvo'] {
    switch (type) {
      case SCT.DroneSwarm:
        return this.cfg.specialCapabilities.droneSwarm;
      case SCT.ArtilleryBarrageSeoul:
        return this.cfg.specialCapabilities.artilleryBarragSeoul;
      case SCT.CarrierKillerSalvo:
        return this.cfg.specialCapabilities.carrierKillerSalvo;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown capability type: ${String(_exhaustive)}`);
      }
    }
  }

  // ── Available Capabilities ─────────────────────────────────────────────

  /**
   * Get which special capabilities a faction has access to.
   *
   * Matches {@link FactionId} against each capability's configured faction.
   *
   * @see FR-1005
   */
  getAvailableCapabilities(factionId: FactionId): readonly SpecialCapabilityType[] {
    const caps = this.cfg.specialCapabilities;
    const result: SpecialCapabilityType[] = [];

    if (factionMatchesConfig(factionId, caps.droneSwarm.factionId)) {
      result.push(SCT.DroneSwarm);
    }
    if (factionMatchesConfig(factionId, caps.artilleryBarragSeoul.factionId)) {
      result.push(SCT.ArtilleryBarrageSeoul);
    }
    if (factionMatchesConfig(factionId, caps.carrierKillerSalvo.factionId)) {
      result.push(SCT.CarrierKillerSalvo);
    }

    return result;
  }

  // ── Validation ─────────────────────────────────────────────────────────

  /**
   * Validate whether a special capability can be executed with the given inputs.
   *
   * Checks:
   * 1. Faction ownership
   * 2. Treasury sufficiency
   * 3. Readiness sufficiency
   * 4. Cooldown status (Carrier Killer Salvo only)
   *
   * @see FR-1005
   */
  validateExecution(input: CapabilityExecutionInput): CapabilityValidation {
    const capConfig = this.getCapabilityConfig(input.capabilityType);

    // 1. Faction ownership
    if (!factionMatchesConfig(input.executingFaction, capConfig.factionId)) {
      return {
        valid: false,
        reason: `Faction '${input.executingFaction}' does not have access to this capability`,
      };
    }

    // 2. Treasury
    if (input.currentTreasury < capConfig.treasuryCost) {
      return {
        valid: false,
        reason: `Insufficient treasury: need ${String(capConfig.treasuryCost)}, have ${String(input.currentTreasury)}`,
      };
    }

    // 3. Readiness
    if (input.currentReadiness < capConfig.readinessCost) {
      return {
        valid: false,
        reason: `Insufficient readiness: need ${String(capConfig.readinessCost)}, have ${String(input.currentReadiness)}`,
      };
    }

    // 4. Cooldown (Carrier Killer Salvo)
    if (this.isCooldownActive(input.capabilityType, input.lastUsedTurn, input.currentTurn)) {
      return { valid: false, reason: 'Capability is on cooldown' };
    }

    return { valid: true, reason: 'All pre-conditions met' };
  }

  // ── Execution ──────────────────────────────────────────────────────────

  /**
   * Execute a special capability action.
   *
   * Validates inputs first; if invalid, returns a failure result with zeroed
   * costs and a neutral effect. On success, builds a {@link CapabilityEffect}
   * based on the capability type.
   *
   * @see FR-1005
   */
  executeCapability(input: CapabilityExecutionInput): CapabilityExecutionResult {
    const validation = this.validateExecution(input);

    if (!validation.valid) {
      return {
        capabilityType: input.capabilityType,
        executingFaction: input.executingFaction,
        success: false,
        treasuryCost: 0,
        readinessCost: 0,
        effects: nullEffect(),
        reason: validation.reason,
      };
    }

    const capConfig = this.getCapabilityConfig(input.capabilityType);
    const effects = buildEffect(input.capabilityType, this.cfg);

    return {
      capabilityType: input.capabilityType,
      executingFaction: input.executingFaction,
      success: true,
      treasuryCost: capConfig.treasuryCost,
      readinessCost: capConfig.readinessCost,
      effects,
      reason: `${capConfig.label} executed successfully`,
    };
  }

  // ── Cooldown ───────────────────────────────────────────────────────────

  /**
   * Check whether a capability is currently on cooldown.
   *
   * Only {@link SpecialCapabilityType.CarrierKillerSalvo} has a cooldown
   * (3 turns). All other capabilities have no cooldown.
   *
   * @see FR-1005
   */
  isCooldownActive(
    capabilityType: SpecialCapabilityType,
    lastUsedTurn: TurnNumber | null,
    currentTurn: TurnNumber,
  ): boolean {
    if (lastUsedTurn === null) {
      return false;
    }

    switch (capabilityType) {
      case SCT.CarrierKillerSalvo: {
        const cooldown = this.cfg.specialCapabilities.carrierKillerSalvo.cooldownTurns;
        return (currentTurn - lastUsedTurn) < cooldown;
      }
      case SCT.DroneSwarm:
      case SCT.ArtilleryBarrageSeoul:
        return false;
      default: {
        const _exhaustive: never = capabilityType;
        throw new Error(`Unknown capability type: ${String(_exhaustive)}`);
      }
    }
  }

  // ── Modernization ─────────────────────────────────────────────────────

  /**
   * Compute the result of a single turn of military modernization investment.
   *
   * If the faction has sufficient treasury (≥ {@link investmentPerTurn}),
   * tech level advances by {@link techLevelGainPerInvestment} (clamped 0–100).
   * Any milestones crossed by the new tech level are reported as unlocked.
   *
   * @see FR-1006
   */
  computeModernization(input: ModernizationInput): ModernizationResult {
    const mod = this.cfg.modernization;

    if (input.currentTreasury < mod.investmentPerTurn) {
      return {
        factionId: input.factionId,
        invested: false,
        treasuryCost: 0,
        previousTechLevel: input.currentTechLevel,
        newTechLevel: input.currentTechLevel,
        techLevelGain: 0,
        milestonesUnlocked: [],
        reason: `Insufficient treasury: need ${String(mod.investmentPerTurn)}, have ${String(input.currentTreasury)}`,
      };
    }

    const previousTechLevel = input.currentTechLevel;
    const newTechLevel = clamp(
      previousTechLevel + mod.techLevelGainPerInvestment,
      0,
      100,
    );
    const techLevelGain = newTechLevel - previousTechLevel;

    // Milestones newly crossed by this investment
    const milestonesUnlocked: MilestoneUnlock[] = mod.milestones
      .filter((m) => m.threshold > previousTechLevel && m.threshold <= newTechLevel)
      .map((m) => ({
        threshold: m.threshold,
        unlock: m.unlock,
        description: m.description,
      }));

    const milestoneText =
      milestonesUnlocked.length > 0
        ? ` Unlocked: ${milestonesUnlocked.map((m) => m.unlock).join(', ')}.`
        : '';

    return {
      factionId: input.factionId,
      invested: true,
      treasuryCost: mod.investmentPerTurn,
      previousTechLevel,
      newTechLevel,
      techLevelGain,
      milestonesUnlocked,
      reason: `Tech level ${String(previousTechLevel)} → ${String(newTechLevel)} (+${String(techLevelGain)}).${milestoneText}`,
    };
  }

  // ── Milestone Queries ──────────────────────────────────────────────────

  /**
   * Get all milestones that are unlocked at the given tech level.
   * @see FR-1006
   */
  getUnlockedMilestones(techLevel: number): readonly MilestoneUnlock[] {
    return this.cfg.modernization.milestones
      .filter((m) => m.threshold <= techLevel)
      .map((m) => ({
        threshold: m.threshold,
        unlock: m.unlock,
        description: m.description,
      }));
  }

  /**
   * Get the next milestone to unlock after the given tech level.
   *
   * Returns `null` if all milestones have already been unlocked.
   * @see FR-1006
   */
  getNextMilestone(techLevel: number): MilestoneUnlock | null {
    const next = this.cfg.modernization.milestones.find(
      (m) => m.threshold > techLevel,
    );

    if (!next) {
      return null;
    }

    return {
      threshold: next.threshold,
      unlock: next.unlock,
      description: next.description,
    };
  }
}

// ── Private Helpers ──────────────────────────────────────────────────────────

/** Clamp a numeric value to the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compare a {@link FactionId} value against a config-level faction identifier.
 *
 * The config stores faction identifiers as display-cased strings (e.g. 'Iran')
 * while {@link FactionId} values are lowercase (e.g. 'iran'). This helper
 * normalises both to lowercase for comparison.
 */
function factionMatchesConfig(factionId: FactionId, configFactionId: string): boolean {
  return (factionId as string).toLowerCase() === configFactionId.toLowerCase();
}

/** Construct a zeroed / neutral {@link CapabilityEffect}. */
function nullEffect(): CapabilityEffect {
  return {
    stabilityDamage: 0,
    tensionIncrease: 0,
    attritionPerTurn: 0,
    areaDenialRadius: 0,
    duration: 0,
    navalDamageMultiplier: 1,
    bypassesSurfaceEscorts: false,
    civilianCasualties: false,
    targetFaction: null,
    description: '',
  };
}

/**
 * Build the {@link CapabilityEffect} for a given capability type from config.
 *
 * Uses an exhaustive switch to ensure every {@link SpecialCapabilityType}
 * variant produces a correct effect object.
 */
function buildEffect(
  type: SpecialCapabilityType,
  cfg: SpecialCapsConfig,
): CapabilityEffect {
  switch (type) {
    case SCT.DroneSwarm: {
      const ds = cfg.specialCapabilities.droneSwarm;
      return {
        stabilityDamage: 0,
        tensionIncrease: 0,
        attritionPerTurn: ds.attritionPerTurn,
        areaDenialRadius: ds.areaDenialRadius,
        duration: ds.duration,
        navalDamageMultiplier: 1,
        bypassesSurfaceEscorts: false,
        civilianCasualties: false,
        targetFaction: null,
        description: ds.description,
      };
    }
    case SCT.ArtilleryBarrageSeoul: {
      const ab = cfg.specialCapabilities.artilleryBarragSeoul;
      return {
        stabilityDamage: ab.stabilityDamage,
        tensionIncrease: ab.tensionIncrease,
        attritionPerTurn: 0,
        areaDenialRadius: 0,
        duration: 0,
        navalDamageMultiplier: 1,
        bypassesSurfaceEscorts: false,
        civilianCasualties: ab.civilianCasualties,
        targetFaction: ab.targetFaction as string as FactionId,
        description: ab.description,
      };
    }
    case SCT.CarrierKillerSalvo: {
      const ck = cfg.specialCapabilities.carrierKillerSalvo;
      return {
        stabilityDamage: 0,
        tensionIncrease: 0,
        attritionPerTurn: 0,
        areaDenialRadius: 0,
        duration: 0,
        navalDamageMultiplier: ck.navalDamageMultiplier,
        bypassesSurfaceEscorts: ck.bypassesSurfaceEscorts,
        civilianCasualties: false,
        targetFaction: null,
        description: ck.description,
      };
    }
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown capability type: ${String(_exhaustive)}`);
    }
  }
}
