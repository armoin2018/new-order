/**
 * Iran-Specific Nuclear Mechanics — Decentralized Command & Dirty Bomb
 *
 * Implements FR-506: Iran (post-March 1 strikes) shall have a decentralized
 * nuclear command. The Iran player gains a "Dirty Bomb" option that lowers
 * Israel's Stability but triggers immediate US Strategic Retaliation.
 *
 * Israel is NOT one of the 8 playable factions — the stability penalty is
 * returned as a separate field for the game state manager to apply to
 * scenario state.
 *
 * Pure functions — no side effects, no mutation of input.
 *
 * @see FR-506 — Decentralized nuclear command and dirty bomb action
 */

import type { TurnNumber } from '@/data/types';
import type { NationState } from '@/data/types';
import type { NuclearFactionState } from './nuclear-escalation';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Iran nuclear configuration shape (derived from GAME_CONFIG.nuclear.iran). */
export type IranNuclearConfig = typeof GAME_CONFIG.nuclear.iran;

/** Iran's decentralized command state. */
export interface IranCommandState {
  /** Whether decentralized command is active (post-March 1). */
  decentralizedCommandActive: boolean;
  /** Turn when decentralized command was activated. */
  activatedTurn: TurnNumber | null;
  /** Whether dirty bomb has been used (one-time action). */
  dirtyBombUsed: boolean;
  /** Turn when dirty bomb was used (null if unused). */
  dirtyBombTurn: TurnNumber | null;
}

/** Eligibility check for dirty bomb. */
export interface DirtyBombEligibility {
  eligible: boolean;
  reason: string;
  /** Whether decentralized command is active (prerequisite). */
  decentralizedCommandActive: boolean;
  /** Whether dirty bomb has already been used. */
  alreadyUsed: boolean;
}

/** Comprehensive result of executing a dirty bomb. @see FR-506 */
export interface DirtyBombResult {
  /** Whether the dirty bomb was executed successfully. */
  executed: boolean;
  /** Reason if not executed. */
  blockReason: string | null;

  // ── Effects on Israel (non-playable) ────────────────────
  /** Stability penalty applied to Israel. */
  israelStabilityPenalty: number;

  // ── Effects on Iran ─────────────────────────────────────
  /** DI penalty applied to Iran. */
  iranDiPenalty: number;
  /** Nuclear threshold increase for Iran. */
  iranThresholdIncrease: number;

  // ── US Retaliation ──────────────────────────────────────
  /** Whether US retaliation was triggered. */
  usRetaliationTriggered: boolean;
  /** Stability penalty to Iran from US retaliation. */
  usRetaliationStabilityPenalty: number;
  /** Military readiness penalty to Iran from US retaliation. */
  usRetaliationMilitaryPenalty: number;

  // ── Global effects ──────────────────────────────────────
  /** Global tension increase for all faction pairs involving Iran. */
  globalTensionIncrease: number;

  // ── Updated states ──────────────────────────────────────
  /** Updated Iran command state (dirtyBombUsed=true). */
  updatedCommandState: IranCommandState;

  /** Human-readable description of all effects. */
  description: string;
}

/** Input for evaluating Iran-specific nuclear options. */
export interface IranNuclearInput {
  currentTurn: TurnNumber;
  iranNation: NationState;
  iranNuclearState: NuclearFactionState;
  iranCommandState: IranCommandState;
  /** US nation state (for retaliation context). */
  usNation: NationState;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine for Iran-specific nuclear mechanics.
 *
 * All public methods are pure — they return new objects and never mutate
 * their inputs. Config is injectable via the constructor; defaults to
 * `GAME_CONFIG.nuclear.iran`.
 *
 * @see FR-506
 */
export class IranNuclearEngine {
  private readonly cfg: IranNuclearConfig;

  constructor(config?: IranNuclearConfig) {
    this.cfg = config ?? GAME_CONFIG.nuclear.iran;
  }

  // -----------------------------------------------------------------------
  // Default State
  // -----------------------------------------------------------------------

  /** Create default Iran command state (pre-activation). */
  static createDefaultState(): IranCommandState {
    return {
      decentralizedCommandActive: false,
      activatedTurn: null,
      dirtyBombUsed: false,
      dirtyBombTurn: null,
    };
  }

  // -----------------------------------------------------------------------
  // Decentralized Command Activation
  // -----------------------------------------------------------------------

  /**
   * Activate decentralized command (post-March 1). Returns new state.
   *
   * If already active, returns a copy with no changes.
   */
  activateDecentralizedCommand(
    state: IranCommandState,
    currentTurn: TurnNumber,
  ): IranCommandState {
    return {
      ...state,
      decentralizedCommandActive: true,
      activatedTurn: state.activatedTurn ?? currentTurn,
    };
  }

  // -----------------------------------------------------------------------
  // Dirty Bomb Eligibility
  // -----------------------------------------------------------------------

  /** Check if dirty bomb is available. */
  checkDirtyBombEligibility(input: IranNuclearInput): DirtyBombEligibility {
    const { iranCommandState } = input;
    const decentralizedCommandActive = iranCommandState.decentralizedCommandActive;
    const alreadyUsed = iranCommandState.dirtyBombUsed;

    if (!decentralizedCommandActive) {
      return {
        eligible: false,
        reason: 'Decentralized command must be active (post-March 1) before dirty bomb can be used.',
        decentralizedCommandActive,
        alreadyUsed,
      };
    }

    if (alreadyUsed) {
      return {
        eligible: false,
        reason: `Dirty bomb has already been used (turn ${iranCommandState.dirtyBombTurn ?? 'unknown'}). It is a one-time action.`,
        decentralizedCommandActive,
        alreadyUsed,
      };
    }

    return {
      eligible: true,
      reason: 'Dirty bomb is available. Decentralized command is active and the weapon has not been used.',
      decentralizedCommandActive,
      alreadyUsed,
    };
  }

  // -----------------------------------------------------------------------
  // Execute Dirty Bomb
  // -----------------------------------------------------------------------

  /**
   * Execute dirty bomb action. Returns full consequence cascade.
   *
   * If the action is not eligible, returns a blocked result with no effects.
   * If eligible, computes the full cascade:
   * - Israel stability penalty (non-playable, returned for scenario state)
   * - Iran DI penalty
   * - Iran nuclear threshold increase
   * - US strategic retaliation (if configured)
   * - Global tension increase
   *
   * @see FR-506
   */
  executeDirtyBomb(input: IranNuclearInput): DirtyBombResult {
    const eligibility = this.checkDirtyBombEligibility(input);

    if (!eligibility.eligible) {
      return this.buildBlockedResult(eligibility.reason, input.iranCommandState);
    }

    // ── Compute effects from config ─────────────────────────
    const israelStabilityPenalty = this.cfg.dirtyBombIsraelStabilityPenalty;
    const iranDiPenalty = this.cfg.dirtyBombIranDiPenalty;
    const iranThresholdIncrease = this.cfg.dirtyBombThresholdIncrease;
    const globalTensionIncrease = this.cfg.dirtyBombGlobalTensionIncrease;

    // ── US Retaliation ──────────────────────────────────────
    const usRetaliationTriggered = this.cfg.dirtyBombTriggersUSRetaliation;
    const usRetaliationStabilityPenalty = usRetaliationTriggered
      ? this.cfg.usRetaliationIranStabilityPenalty
      : 0;
    const usRetaliationMilitaryPenalty = usRetaliationTriggered
      ? this.cfg.usRetaliationIranMilitaryPenalty
      : 0;

    // ── Updated command state ───────────────────────────────
    const updatedCommandState: IranCommandState = {
      ...input.iranCommandState,
      dirtyBombUsed: true,
      dirtyBombTurn: input.currentTurn,
    };

    // ── Description ─────────────────────────────────────────
    const description = this.buildDescription({
      israelStabilityPenalty,
      iranDiPenalty,
      iranThresholdIncrease,
      globalTensionIncrease,
      usRetaliationTriggered,
      usRetaliationStabilityPenalty,
      usRetaliationMilitaryPenalty,
      currentTurn: input.currentTurn,
    });

    return {
      executed: true,
      blockReason: null,
      israelStabilityPenalty,
      iranDiPenalty,
      iranThresholdIncrease,
      usRetaliationTriggered,
      usRetaliationStabilityPenalty,
      usRetaliationMilitaryPenalty,
      globalTensionIncrease,
      updatedCommandState,
      description,
    };
  }

  // -----------------------------------------------------------------------
  // Available Actions
  // -----------------------------------------------------------------------

  /**
   * Get available nuclear actions for Iran this turn.
   *
   * Includes dirty bomb eligibility and decentralized command activation.
   */
  getAvailableActions(
    input: IranNuclearInput,
  ): Array<{ action: string; eligible: boolean; reason: string }> {
    const actions: Array<{ action: string; eligible: boolean; reason: string }> = [];

    // Decentralized command activation
    if (!input.iranCommandState.decentralizedCommandActive) {
      actions.push({
        action: 'activate_decentralized_command',
        eligible: true,
        reason: 'Decentralized command can be activated (post-March 1 strikes).',
      });
    } else {
      actions.push({
        action: 'activate_decentralized_command',
        eligible: false,
        reason: `Decentralized command is already active (activated turn ${input.iranCommandState.activatedTurn ?? 'unknown'}).`,
      });
    }

    // Dirty bomb
    const dirtyBombEligibility = this.checkDirtyBombEligibility(input);
    actions.push({
      action: 'dirty_bomb',
      eligible: dirtyBombEligibility.eligible,
      reason: dirtyBombEligibility.reason,
    });

    return actions;
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Build a blocked (not-executed) dirty bomb result. */
  private buildBlockedResult(
    blockReason: string,
    commandState: IranCommandState,
  ): DirtyBombResult {
    return {
      executed: false,
      blockReason,
      israelStabilityPenalty: 0,
      iranDiPenalty: 0,
      iranThresholdIncrease: 0,
      usRetaliationTriggered: false,
      usRetaliationStabilityPenalty: 0,
      usRetaliationMilitaryPenalty: 0,
      globalTensionIncrease: 0,
      updatedCommandState: { ...commandState },
      description: `Dirty bomb blocked: ${blockReason}`,
    };
  }

  /** Build a human-readable description of all dirty bomb effects. */
  private buildDescription(params: {
    israelStabilityPenalty: number;
    iranDiPenalty: number;
    iranThresholdIncrease: number;
    globalTensionIncrease: number;
    usRetaliationTriggered: boolean;
    usRetaliationStabilityPenalty: number;
    usRetaliationMilitaryPenalty: number;
    currentTurn: TurnNumber;
  }): string {
    const lines: string[] = [
      `[Turn ${params.currentTurn}] Iran executed a dirty bomb against Israel (FR-506).`,
      `  Israel stability: ${params.israelStabilityPenalty} (non-playable entity).`,
      `  Iran diplomatic influence: ${params.iranDiPenalty}.`,
      `  Iran nuclear threshold: +${params.iranThresholdIncrease}.`,
      `  Global tension increase: +${params.globalTensionIncrease} for all Iran-related pairs.`,
    ];

    if (params.usRetaliationTriggered) {
      lines.push(
        `  US Strategic Retaliation triggered:`,
        `    Iran stability: ${params.usRetaliationStabilityPenalty}.`,
        `    Iran military readiness: ${params.usRetaliationMilitaryPenalty}.`,
      );
    }

    return lines.join('\n');
  }
}
