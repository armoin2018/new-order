/**
 * Intelligence Operations & Blowback Engine
 *
 * Implements the four intelligence operation types (Gather, Counterintel,
 * RecruitAsset, Sabotage) with success probability calculations, blowback
 * resolution, and active asset lifecycle management.
 *
 * All functions are pure — no mutation of inputs.
 *
 * @see FR-903 — Intelligence Operations
 * @see FR-904 — Blowback Mechanics
 */

import { GAME_CONFIG } from '@/engine/config';
import { IntelOperationType, IntelSubScore } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';
import { SeededRandom } from '@/engine/rng';
import type { IntelCapability } from '@/engine/intel-capability';

// ── Aliases ──────────────────────────────────────────────────────────────────

const IOT = IntelOperationType;
const ISS = IntelSubScore;

// ── Config type ──────────────────────────────────────────────────────────────

/** Resolved intelligence configuration shape. @see FR-903, FR-904 */
export type IntelOpsConfig = typeof GAME_CONFIG.intelligence;

// ── Domain types ─────────────────────────────────────────────────────────────

/**
 * Input parameters for executing an intelligence operation.
 *
 * @see FR-903
 */
export interface IntelOperationInput {
  /** The type of intelligence operation to perform. */
  readonly operationType: IntelOperationType;
  /** The faction executing the operation. */
  readonly executingFaction: FactionId;
  /** The faction being targeted by the operation. */
  readonly targetFaction: FactionId;
  /** Intelligence capability scores of the executing faction. */
  readonly executorCapability: IntelCapability;
  /** Intelligence capability scores of the target faction. */
  readonly targetCapability: IntelCapability;
  /** Current game turn number. */
  readonly currentTurn: TurnNumber;
  /** Available diplomatic influence to spend. */
  readonly diplomaticInfluence: number;
  /** For Sabotage: which target stat to hit. */
  readonly sabotageTarget?: 'stability' | 'militaryReadiness' | 'treasury';
}

/**
 * Full result of an intelligence operation execution.
 *
 * @see FR-903, FR-904
 */
export interface OperationResult {
  /** The operation type that was executed. */
  readonly operationType: IntelOperationType;
  /** The faction that executed the operation. */
  readonly executingFaction: FactionId;
  /** The faction that was targeted. */
  readonly targetFaction: FactionId;
  /** Whether the operation succeeded. */
  readonly success: boolean;
  /** The RNG roll used for the success check. */
  readonly successRoll: number;
  /** The probability threshold the roll needed to beat. */
  readonly successThreshold: number;
  /** The effects produced by the operation. */
  readonly effect: OperationEffect;
  /** The blowback resolution for this operation. */
  readonly blowback: BlowbackResult;
  /** The DI cost deducted for executing this operation. */
  readonly diCost: number;
}

/**
 * Effects produced by a successful (or failed) intelligence operation.
 *
 * @see FR-903
 */
export interface OperationEffect {
  /** Clarity change: positive for Gather, negative for Counterintel (rival decrease). */
  readonly clarityChange: number;
  /** HUMINT bonus per turn for RecruitAsset. */
  readonly humintBonus: number;
  /** Target stat reduction for Sabotage. */
  readonly targetStatChange: number;
  /** Which stat was targeted (Sabotage only), or null. */
  readonly targetStat: string | null;
  /** Human-readable description of the effect. */
  readonly description: string;
}

/**
 * Result of the blowback resolution for an operation.
 *
 * @see FR-904
 */
export interface BlowbackResult {
  /** Whether blowback occurred. */
  readonly occurred: boolean;
  /** Calculated blowback probability. */
  readonly blowbackChance: number;
  /** The RNG roll used for the blowback check. */
  readonly blowbackRoll: number;
  /** Tension spike applied on blowback. */
  readonly tensionSpike: number;
  /** Legitimacy penalty applied on blowback (public scandal). */
  readonly legitimacyPenalty: number;
  /** DI penalty applied on blowback (diplomat expulsion). */
  readonly diPenalty: number;
  /** Human-readable description of the blowback outcome. */
  readonly description: string;
}

/**
 * A planted intelligence asset that provides ongoing HUMINT bonuses.
 *
 * @see FR-903
 */
export interface ActiveAsset {
  /** Unique identifier: `asset-{executingFaction}-{targetFaction}-T{turn}`. */
  readonly id: string;
  /** The faction that planted this asset. */
  readonly executingFaction: FactionId;
  /** The faction in which this asset is embedded. */
  readonly targetFaction: FactionId;
  /** Turn on which the asset was recruited. */
  readonly recruitedTurn: TurnNumber;
  /** HUMINT bonus provided per turn while active. */
  readonly humintBonusPerTurn: number;
  /** Lifespan in turns. 0 = indefinite. */
  readonly lifespan: number;
  /** Whether the asset is currently active. */
  readonly active: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clamp a number to the inclusive range [min, max].
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound.
 * @param max   - Upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ── Operation config shape ───────────────────────────────────────────────────

/** Minimal common shape returned by {@link IntelligenceOpsEngine.getOperationConfig}. */
interface OperationConfigSlice {
  readonly primarySubScore: string;
  readonly baseSuccessProbability: number;
  readonly diCost: number;
  readonly difficultyModifier: number;
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Stateless engine that resolves intelligence operations and blowback.
 *
 * Instantiate with an optional config override (for testing); defaults to
 * `GAME_CONFIG.intelligence`.
 *
 * @see FR-903 — Intelligence Operations
 * @see FR-904 — Blowback Mechanics
 */
export class IntelligenceOpsEngine {
  /** Resolved intelligence configuration. */
  private readonly cfg: IntelOpsConfig;

  /**
   * Create an IntelligenceOpsEngine.
   *
   * @param config - Optional configuration override. Defaults to GAME_CONFIG.intelligence.
   * @see FR-903
   */
  constructor(config?: IntelOpsConfig) {
    this.cfg = config ?? GAME_CONFIG.intelligence;
  }

  // ── Config lookup ────────────────────────────────────────────────────────

  /**
   * Get the common operation config for a specific operation type.
   *
   * Uses an exhaustive switch on {@link IntelOperationType} to guarantee
   * every variant is handled at compile time.
   *
   * @param type - The intel operation type.
   * @returns The primary sub-score, base success probability, DI cost, and difficulty modifier.
   * @see FR-903
   */
  getOperationConfig(type: IntelOperationType): OperationConfigSlice {
    switch (type) {
      case IOT.Gather:
        return this.cfg.operations.gather;
      case IOT.Counterintel:
        return this.cfg.operations.counterintel;
      case IOT.RecruitAsset:
        return this.cfg.operations.recruitAsset;
      case IOT.Sabotage:
        return this.cfg.operations.sabotage;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown IntelOperationType: ${String(_exhaustive)}`);
      }
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate that an operation can be executed given the current game state.
   *
   * Checks:
   * 1. Executing faction has enough DI to pay the operation cost.
   * 2. For Sabotage, a valid sabotageTarget must be specified.
   * 3. A faction cannot target itself.
   *
   * @param input - The operation input to validate.
   * @returns An object with `valid` flag and explanatory `reason`.
   * @see FR-903
   */
  validateOperation(input: IntelOperationInput): { valid: boolean; reason: string } {
    // Cannot target self
    if (input.executingFaction === input.targetFaction) {
      return { valid: false, reason: 'Cannot execute an intelligence operation against own faction.' };
    }

    // DI cost check
    const opConfig = this.getOperationConfig(input.operationType);
    if (input.diplomaticInfluence < opConfig.diCost) {
      return {
        valid: false,
        reason: `Insufficient diplomatic influence: requires ${String(opConfig.diCost)}, have ${String(input.diplomaticInfluence)}.`,
      };
    }

    // Sabotage requires a valid target stat
    if (input.operationType === IOT.Sabotage) {
      if (input.sabotageTarget == null) {
        return { valid: false, reason: 'Sabotage operation requires a sabotageTarget to be specified.' };
      }
      const validTargets: readonly string[] = this.cfg.operations.sabotage.validTargets;
      if (!validTargets.includes(input.sabotageTarget)) {
        return {
          valid: false,
          reason: `Invalid sabotageTarget "${input.sabotageTarget}". Valid targets: ${validTargets.join(', ')}.`,
        };
      }
    }

    return { valid: true, reason: 'Operation is valid.' };
  }

  // ── Probability calculations ─────────────────────────────────────────────

  /**
   * Calculate the success probability for an operation.
   *
   * Formula:
   * ```
   * successProbability = baseSuccessProbability + (relevantSubScore / 100) * 0.5
   * ```
   * Clamped to [0.05, 0.95].
   *
   * @param input - The operation input.
   * @returns The calculated success probability in [0.05, 0.95].
   * @see FR-903
   */
  calculateSuccessProbability(input: IntelOperationInput): number {
    const opConfig = this.getOperationConfig(input.operationType);
    const relevantScore = this.getRelevantSubScore(input.executorCapability, input.operationType);
    const raw = opConfig.baseSuccessProbability + (relevantScore / 100) * 0.5;
    return clamp(raw, 0.05, 0.95);
  }

  /**
   * Calculate blowback chance for an operation.
   *
   * Formula:
   * ```
   * blowbackChance = ((100 - executorCovert) / 100) * difficultyModifier
   * ```
   * Clamped to [0, 1].
   *
   * @param input - The operation input.
   * @returns The calculated blowback probability in [0, 1].
   * @see FR-904
   */
  calculateBlowbackChance(input: IntelOperationInput): number {
    const opConfig = this.getOperationConfig(input.operationType);
    const covert = input.executorCapability.covert;
    const raw = ((this.cfg.blowback.base - covert) / 100) * opConfig.difficultyModifier;
    return clamp(raw, 0, 1);
  }

  // ── Execution ────────────────────────────────────────────────────────────

  /**
   * Execute a full intelligence operation.
   *
   * Steps:
   * 1. Validate the operation; if invalid, return a failed result.
   * 2. Roll for success: `rng.next() < successProbability`.
   * 3. If success, apply effects based on operation type.
   * 4. Roll for blowback (always, regardless of success): `rng.next() < blowbackChance`.
   * 5. If blowback, apply consequences (tensionSpike, publicScandal, diplomatExpulsion).
   * 6. Return the full {@link OperationResult}.
   *
   * @param input - The operation input.
   * @param rng   - Seeded random number generator for deterministic rolls.
   * @returns The complete operation result.
   * @see FR-903, FR-904
   */
  executeOperation(input: IntelOperationInput, rng: SeededRandom): OperationResult {
    const opConfig = this.getOperationConfig(input.operationType);

    // Step 1: Validate
    const validation = this.validateOperation(input);
    if (!validation.valid) {
      return {
        operationType: input.operationType,
        executingFaction: input.executingFaction,
        targetFaction: input.targetFaction,
        success: false,
        successRoll: -1,
        successThreshold: -1,
        effect: {
          clarityChange: 0,
          humintBonus: 0,
          targetStatChange: 0,
          targetStat: null,
          description: `Operation invalid: ${validation.reason}`,
        },
        blowback: {
          occurred: false,
          blowbackChance: 0,
          blowbackRoll: -1,
          tensionSpike: 0,
          legitimacyPenalty: 0,
          diPenalty: 0,
          description: 'No blowback (operation invalid).',
        },
        diCost: 0,
      };
    }

    // Step 2: Roll for success
    const successProbability = this.calculateSuccessProbability(input);
    const successRoll = rng.next();
    const success = successRoll < successProbability;

    // Step 3: Build effect
    const effect = this.buildEffect(input, success);

    // Step 4-5: Resolve blowback (independent of success)
    const blowback = this.resolveBlowback(input, rng);

    // Step 6: Return full result
    return {
      operationType: input.operationType,
      executingFaction: input.executingFaction,
      targetFaction: input.targetFaction,
      success,
      successRoll,
      successThreshold: successProbability,
      effect,
      blowback,
      diCost: opConfig.diCost,
    };
  }

  // ── Effect building ──────────────────────────────────────────────────────

  /**
   * Build the operation effect based on operation type and success/failure.
   *
   * - **Gather success**: clarityChange = +10 (from config).
   * - **Counterintel success**: clarityChange = -10 (rival's clarity decrease).
   * - **RecruitAsset success**: humintBonus = 5 (from config).
   * - **Sabotage success**: targetStatChange = -10, targetStat = sabotageTarget.
   * - **Any failure**: all values zero.
   *
   * @param input   - The operation input.
   * @param success - Whether the operation succeeded.
   * @returns The computed operation effect.
   * @see FR-903
   */
  private buildEffect(input: IntelOperationInput, success: boolean): OperationEffect {
    if (!success) {
      return {
        clarityChange: 0,
        humintBonus: 0,
        targetStatChange: 0,
        targetStat: null,
        description: `${input.operationType} operation against ${String(input.targetFaction)} failed.`,
      };
    }

    switch (input.operationType) {
      case IOT.Gather:
        return {
          clarityChange: this.cfg.operations.gather.clarityIncrease,
          humintBonus: 0,
          targetStatChange: 0,
          targetStat: null,
          description: `Gather succeeded: +${String(this.cfg.operations.gather.clarityIncrease)} clarity on ${String(input.targetFaction)}.`,
        };

      case IOT.Counterintel:
        return {
          clarityChange: -this.cfg.operations.counterintel.rivalClarityDecrease,
          humintBonus: 0,
          targetStatChange: 0,
          targetStat: null,
          description: `Counterintel succeeded: -${String(this.cfg.operations.counterintel.rivalClarityDecrease)} rival clarity from ${String(input.targetFaction)}.`,
        };

      case IOT.RecruitAsset:
        return {
          clarityChange: 0,
          humintBonus: this.cfg.operations.recruitAsset.humintBonusPerTurn,
          targetStatChange: 0,
          targetStat: null,
          description: `Asset recruited in ${String(input.targetFaction)}: +${String(this.cfg.operations.recruitAsset.humintBonusPerTurn)} HUMINT/turn.`,
        };

      case IOT.Sabotage: {
        const target = input.sabotageTarget ?? 'stability';
        return {
          clarityChange: 0,
          humintBonus: 0,
          targetStatChange: this.cfg.operations.sabotage.targetStatReduction,
          targetStat: target,
          description: `Sabotage succeeded: ${String(this.cfg.operations.sabotage.targetStatReduction)} to ${target} of ${String(input.targetFaction)}.`,
        };
      }

      default: {
        const _exhaustive: never = input.operationType;
        throw new Error(`Unknown IntelOperationType: ${String(_exhaustive)}`);
      }
    }
  }

  // ── Blowback resolution ─────────────────────────────────────────────────

  /**
   * Resolve blowback for an operation independently of its success or failure.
   *
   * Rolls `rng.next()` against the calculated blowback chance. If blowback
   * occurs, applies the configured consequences:
   * - `tensionSpike`: bilateral tension increase.
   * - `publicScandal`: legitimacy penalty for the executing faction.
   * - `diplomatExpulsion`: DI penalty for the executing faction.
   *
   * @param input - The operation input.
   * @param rng   - Seeded random number generator.
   * @returns The blowback result.
   * @see FR-904
   */
  private resolveBlowback(input: IntelOperationInput, rng: SeededRandom): BlowbackResult {
    const blowbackChance = this.calculateBlowbackChance(input);
    const blowbackRoll = rng.next();
    const occurred = blowbackRoll < blowbackChance;

    if (!occurred) {
      return {
        occurred: false,
        blowbackChance,
        blowbackRoll,
        tensionSpike: 0,
        legitimacyPenalty: 0,
        diPenalty: 0,
        description: 'No blowback occurred.',
      };
    }

    const consequences = this.cfg.blowbackConsequences;
    return {
      occurred: true,
      blowbackChance,
      blowbackRoll,
      tensionSpike: consequences.tensionSpike,
      legitimacyPenalty: consequences.publicScandal,
      diPenalty: consequences.diplomatExpulsion,
      description:
        `Blowback! Tension +${String(consequences.tensionSpike)}, ` +
        `legitimacy ${String(consequences.publicScandal)}, ` +
        `DI ${String(consequences.diplomatExpulsion)} ` +
        `for ${String(input.executingFaction)} against ${String(input.targetFaction)}.`,
    };
  }

  // ── Asset management (static) ────────────────────────────────────────────

  /**
   * Create an active asset record for a successful RecruitAsset operation.
   *
   * Asset ID format: `asset-{executingFaction}-{targetFaction}-T{turn}`.
   *
   * @param input - The operation input that produced the recruitment.
   * @param turn  - The turn on which the asset was recruited.
   * @returns A new {@link ActiveAsset} record.
   * @see FR-903
   */
  static createAsset(input: IntelOperationInput, turn: TurnNumber): ActiveAsset {
    return {
      id: `asset-${String(input.executingFaction)}-${String(input.targetFaction)}-T${String(turn)}`,
      executingFaction: input.executingFaction,
      targetFaction: input.targetFaction,
      recruitedTurn: turn,
      humintBonusPerTurn: GAME_CONFIG.intelligence.operations.recruitAsset.humintBonusPerTurn,
      lifespan: GAME_CONFIG.intelligence.operations.recruitAsset.defaultLifespan,
      active: true,
    };
  }

  /**
   * Check whether an asset has expired based on its lifespan.
   *
   * A lifespan of 0 means the asset never expires (indefinite).
   * Otherwise, the asset expires when `currentTurn >= recruitedTurn + lifespan`.
   *
   * @param asset       - The asset to check.
   * @param currentTurn - The current game turn.
   * @returns `true` if the asset has expired, `false` otherwise.
   * @see FR-903
   */
  static isAssetExpired(asset: ActiveAsset, currentTurn: TurnNumber): boolean {
    if (asset.lifespan === 0) {
      return false;
    }
    return (currentTurn as number) >= (asset.recruitedTurn as number) + asset.lifespan;
  }

  // ── Sub-score resolution ─────────────────────────────────────────────────

  /**
   * Get the relevant sub-score value for an operation based on its primary
   * sub-score configuration.
   *
   * Maps the operation type's `primarySubScore` config field to the
   * corresponding field on the {@link IntelCapability} interface:
   * - `'sigint'` → `capability.sigint` (Gather)
   * - `'covert'` → `capability.covert` (Counterintel)
   * - `'humint'` → `capability.humint` (RecruitAsset)
   * - `'cyber'`  → `capability.cyber`  (Sabotage)
   *
   * @param capability    - The faction's intelligence capability scores.
   * @param operationType - The operation type to resolve the sub-score for.
   * @returns The numeric sub-score value (0-100).
   * @see FR-901, FR-903
   */
  private getRelevantSubScore(capability: IntelCapability, operationType: IntelOperationType): number {
    const opConfig = this.getOperationConfig(operationType);
    const key = opConfig.primarySubScore;

    switch (key) {
      case ISS.HUMINT.toLowerCase():
        return capability.humint;
      case ISS.SIGINT.toLowerCase():
        return capability.sigint;
      case ISS.CYBER.toLowerCase():
        return capability.cyber;
      case ISS.COVERT.toLowerCase():
        return capability.covert;
      default:
        throw new Error(`Unknown primarySubScore: ${key}`);
    }
  }
}
