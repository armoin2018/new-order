/**
 * Nuclear Escalation Engine — 3-Band Nuclear Threshold Tracker
 *
 * Tracks NuclearThreshold (0–100) per nuclear power through three
 * escalation bands: Deterrence (0–30), Tactical Readiness (31–70),
 * and Threshold Breach (71–100).
 *
 * Pure functions — no side effects, no mutation of input, no Math.random.
 *
 * @see FR-501 — Three-band nuclear threshold tracking
 * @see FR-502 — Deterrence band: signal tests, passive decay
 * @see FR-503 — Tactical Readiness band: existential threats, passive drift
 */

import type {
  FactionId,
  TurnNumber,
  NuclearEscalationBand,
  NuclearActionType,
} from '@/data/types';
import {
  NuclearEscalationBand as NEB,
  NuclearActionType as NAT,
} from '@/data/types';
import type { NationState } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Nuclear escalation configuration shape (derived from GAME_CONFIG.nuclear). */
export type NuclearEscalationConfig = typeof GAME_CONFIG.nuclear;

/** Per-faction nuclear state tracked across turns. */
export interface NuclearFactionState {
  factionId: FactionId;
  /** Current threshold value (0–100). */
  threshold: number;
  /** Current band classification. */
  band: NuclearEscalationBand;
  /** Turn this state was last updated. */
  lastUpdatedTurn: TurnNumber;
  /** Whether mobile launchers have been repositioned (Tactical Readiness). */
  mobileLaunchersRepositioned: boolean;
  /** Whether tactical options have been prepared (Tactical Readiness). */
  tacticalOptionsPrepared: boolean;
}

/** Result of a nuclear action (modifying threshold). */
export interface NuclearActionResult {
  /** Action that was taken. */
  action: NuclearActionType;
  /** Faction that performed the action. */
  actingFaction: FactionId;
  /** Target faction (if applicable). */
  targetFaction: FactionId | null;
  /** Previous threshold value. */
  previousThreshold: number;
  /** New threshold value after action. */
  newThreshold: number;
  /** Previous band. */
  previousBand: NuclearEscalationBand;
  /** New band after action. */
  newBand: NuclearEscalationBand;
  /** Whether a band transition occurred. */
  bandTransition: boolean;
  /** Human-readable description of what happened. */
  description: string;
}

/** Input for per-turn threshold update. */
export interface NuclearTurnInput {
  currentTurn: TurnNumber;
  factionStates: Record<FactionId, NuclearFactionState>;
  nationStates: Record<FactionId, NationState>;
  /** Actions taken this turn by any faction. */
  actionsThisTurn: NuclearActionRequest[];
}

/** A request to perform a nuclear action. */
export interface NuclearActionRequest {
  action: NuclearActionType;
  actingFaction: FactionId;
  targetFaction: FactionId | null;
}

/** Result of processing all nuclear actions for a turn. */
export interface NuclearTurnResult {
  /** Updated faction states (new objects — no mutation). */
  updatedStates: Record<FactionId, NuclearFactionState>;
  /** Results for each action taken this turn. */
  actionResults: NuclearActionResult[];
  /** Band transitions that occurred this turn. */
  bandTransitions: Array<{
    factionId: FactionId;
    from: NuclearEscalationBand;
    to: NuclearEscalationBand;
  }>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that evaluates nuclear escalation each turn.
 *
 * All public methods are pure — they return new objects and never mutate
 * their inputs. Config is injectable via the constructor; defaults to
 * `GAME_CONFIG.nuclear`.
 */
export class NuclearEscalationEngine {
  private readonly cfg: NuclearEscalationConfig;

  constructor(config?: NuclearEscalationConfig) {
    this.cfg = config ?? GAME_CONFIG.nuclear;
  }

  // -----------------------------------------------------------------------
  // Band Classification
  // -----------------------------------------------------------------------

  /** Classify a threshold value into its escalation band. */
  classifyBand(threshold: number): NuclearEscalationBand {
    const clamped = this.clampThreshold(threshold);
    if (clamped <= this.cfg.escalationBands.deterrenceMax) {
      return NEB.Deterrence;
    }
    if (clamped <= this.cfg.escalationBands.tacticalReadinessMax) {
      return NEB.TacticalReadiness;
    }
    return NEB.ThresholdBreach;
  }

  // -----------------------------------------------------------------------
  // Initial State
  // -----------------------------------------------------------------------

  /** Create initial nuclear state for a faction. */
  static createInitialState(
    factionId: FactionId,
    initialThreshold = 0,
  ): NuclearFactionState {
    // Use a temporary engine with default config just for classification.
    const engine = new NuclearEscalationEngine();
    return {
      factionId,
      threshold: Math.max(0, Math.min(100, initialThreshold)),
      band: engine.classifyBand(initialThreshold),
      lastUpdatedTurn: 0 as TurnNumber,
      mobileLaunchersRepositioned: false,
      tacticalOptionsPrepared: false,
    };
  }

  // -----------------------------------------------------------------------
  // Action Validation
  // -----------------------------------------------------------------------

  /**
   * Validate whether an action is allowed given the current band.
   *
   * @returns `{ valid, reason }` — reason describes why the action is
   *          invalid, or confirms it is permitted.
   */
  validateAction(
    state: NuclearFactionState,
    action: NuclearActionType,
  ): { valid: boolean; reason: string } {
    switch (action) {
      case NAT.SignalTest:
        return state.band === NEB.Deterrence
          ? { valid: true, reason: 'Signal tests are permitted in the Deterrence band.' }
          : { valid: false, reason: 'Signal tests are only valid in the Deterrence band (0–30).' };

      case NAT.MobileLauncherReposition:
        return state.band === NEB.TacticalReadiness
          ? { valid: true, reason: 'Mobile launcher repositioning is permitted in the Tactical Readiness band.' }
          : { valid: false, reason: 'Mobile launcher repositioning is only valid in the Tactical Readiness band (31–70).' };

      case NAT.PrepareTacticalOptions:
        return state.band === NEB.TacticalReadiness
          ? { valid: true, reason: 'Preparing tactical options is permitted in the Tactical Readiness band.' }
          : { valid: false, reason: 'Preparing tactical options is only valid in the Tactical Readiness band (31–70).' };

      case NAT.DemonstrationStrike:
        return state.band === NEB.ThresholdBreach
          ? { valid: true, reason: 'Demonstration strike is permitted in the Threshold Breach band.' }
          : { valid: false, reason: 'Demonstration strike is only valid in the Threshold Breach band (71–100).' };

      case NAT.FirstStrike:
        return state.band === NEB.ThresholdBreach
          ? { valid: true, reason: 'First strike is permitted in the Threshold Breach band.' }
          : { valid: false, reason: 'First strike is only valid in the Threshold Breach band (71–100).' };

      case NAT.SecondStrike:
        return { valid: true, reason: 'Second strike is always valid (automated response).' };

      case NAT.RedTelephone:
        return { valid: true, reason: 'Red Telephone de-escalation is always valid.' };

      case NAT.DirtyBomb:
        return { valid: true, reason: 'Dirty bomb is always valid (Iran-specific, handled by nuclear-iran.ts).' };

      default: {
        // Exhaustiveness guard — `action` should be `never` here.
        const _exhaustive: never = action;
        return { valid: false, reason: `Unknown nuclear action type: ${_exhaustive as string}` };
      }
    }
  }

  // -----------------------------------------------------------------------
  // Apply Single Action
  // -----------------------------------------------------------------------

  /**
   * Apply a single nuclear action to a faction's state.
   *
   * Returns a **new** state object and an action result — never mutates
   * the input.
   */
  applyAction(
    state: NuclearFactionState,
    request: NuclearActionRequest,
    _nationState: NationState,
  ): { newState: NuclearFactionState; result: NuclearActionResult } {
    const previousThreshold = state.threshold;
    const previousBand = state.band;
    let newThreshold = state.threshold;
    let mobileLaunchersRepositioned = state.mobileLaunchersRepositioned;
    let tacticalOptionsPrepared = state.tacticalOptionsPrepared;
    let description: string;

    switch (request.action) {
      case NAT.SignalTest: {
        const increase = this.cfg.bandModifiers.deterrence.maxSignalTestIncrease;
        newThreshold += increase;
        description = `${request.actingFaction} conducted a signal test (missile test / submarine launch), threshold +${increase}.`;
        break;
      }

      case NAT.MobileLauncherReposition: {
        const increase = this.cfg.bandModifiers.tacticalReadiness.mobileLauncherIncrease;
        newThreshold += increase;
        mobileLaunchersRepositioned = true;
        description = `${request.actingFaction} repositioned mobile launchers, threshold +${increase}.`;
        break;
      }

      case NAT.PrepareTacticalOptions: {
        const increase = this.cfg.bandModifiers.tacticalReadiness.existentialThreatIncrease;
        newThreshold += increase;
        tacticalOptionsPrepared = true;
        description = `${request.actingFaction} prepared low-yield tactical options, threshold +${increase}.`;
        break;
      }

      case NAT.DemonstrationStrike: {
        const increase = this.cfg.demonstrationStrike.thresholdIncrease;
        newThreshold += increase;
        description = `${request.actingFaction} executed a demonstration strike, threshold +${increase}.`;
        break;
      }

      case NAT.FirstStrike: {
        newThreshold = this.cfg.escalationBands.thresholdBreachMax;
        description = `${request.actingFaction} launched a first strike — threshold set to maximum (${this.cfg.escalationBands.thresholdBreachMax}).`;
        break;
      }

      case NAT.SecondStrike: {
        newThreshold = this.cfg.escalationBands.thresholdBreachMax;
        description = `${request.actingFaction} executed automated second-strike retaliation — threshold set to maximum (${this.cfg.escalationBands.thresholdBreachMax}).`;
        break;
      }

      case NAT.RedTelephone: {
        const reduction = this.cfg.redTelephone.thresholdReduction;
        newThreshold -= reduction;
        description = `${request.actingFaction} initiated Red Telephone de-escalation with ${request.targetFaction ?? 'unknown'}, threshold −${reduction}.`;
        break;
      }

      case NAT.DirtyBomb: {
        const increase = this.cfg.iran.dirtyBombThresholdIncrease;
        newThreshold += increase;
        description = `${request.actingFaction} deployed a dirty bomb, threshold +${increase}.`;
        break;
      }

      default: {
        const _exhaustive: never = request.action;
        description = `Unknown action: ${_exhaustive as string}`;
        break;
      }
    }

    newThreshold = this.clampThreshold(newThreshold);
    const newBand = this.classifyBand(newThreshold);

    const newState: NuclearFactionState = {
      factionId: state.factionId,
      threshold: newThreshold,
      band: newBand,
      lastUpdatedTurn: state.lastUpdatedTurn,
      mobileLaunchersRepositioned,
      tacticalOptionsPrepared,
    };

    const result: NuclearActionResult = {
      action: request.action,
      actingFaction: request.actingFaction,
      targetFaction: request.targetFaction,
      previousThreshold,
      newThreshold,
      previousBand,
      newBand,
      bandTransition: previousBand !== newBand,
      description,
    };

    return { newState, result };
  }

  // -----------------------------------------------------------------------
  // Passive Per-Turn Effects
  // -----------------------------------------------------------------------

  /**
   * Apply passive per-turn effects based on the current band:
   * - Deterrence: threshold decays (trends down)
   * - Tactical Readiness: threshold drifts up
   * - Threshold Breach: threshold drifts up faster
   *
   * Returns a new state object — never mutates the input.
   */
  applyPassiveEffects(
    state: NuclearFactionState,
    currentTurn: TurnNumber,
  ): NuclearFactionState {
    let delta: number;

    switch (state.band) {
      case NEB.Deterrence:
        delta = this.cfg.bandModifiers.deterrence.passiveDecayPerTurn;
        break;
      case NEB.TacticalReadiness:
        delta = this.cfg.bandModifiers.tacticalReadiness.passiveDriftPerTurn;
        break;
      case NEB.ThresholdBreach:
        delta = this.cfg.bandModifiers.thresholdBreach.passiveDriftPerTurn;
        break;
      default: {
        const _exhaustive: never = state.band;
        delta = 0;
        void _exhaustive;
        break;
      }
    }

    const newThreshold = this.clampThreshold(state.threshold + delta);
    const newBand = this.classifyBand(newThreshold);

    return {
      factionId: state.factionId,
      threshold: newThreshold,
      band: newBand,
      lastUpdatedTurn: currentTurn,
      mobileLaunchersRepositioned: state.mobileLaunchersRepositioned,
      tacticalOptionsPrepared: state.tacticalOptionsPrepared,
    };
  }

  // -----------------------------------------------------------------------
  // Full Turn Processing
  // -----------------------------------------------------------------------

  /**
   * Process all nuclear actions and passive effects for a single turn.
   *
   * 1. Start with copies of all faction states.
   * 2. Apply each action in order → collect results.
   * 3. Apply passive effects to each faction's final state.
   * 4. Reclassify bands.
   * 5. Detect band transitions.
   * 6. Return `NuclearTurnResult`.
   *
   * All outputs are new objects — no mutation of input.
   */
  processTurn(input: NuclearTurnInput): NuclearTurnResult {
    const { currentTurn, factionStates, nationStates, actionsThisTurn } = input;

    // 1. Deep-copy faction states (shallow per-value is sufficient since
    //    NuclearFactionState contains only primitives and string literals).
    const working: Record<string, NuclearFactionState> = {};
    const originalBands: Record<string, NuclearEscalationBand> = {};

    for (const factionId of Object.keys(factionStates)) {
      const src = factionStates[factionId];
      if (src == null) continue;
      working[factionId] = { ...src };
      originalBands[factionId] = src.band;
    }

    // 2. Apply each action in order.
    const actionResults: NuclearActionResult[] = [];

    for (const request of actionsThisTurn) {
      const currentState = working[request.actingFaction];
      if (currentState == null) continue;

      const nationState = nationStates[request.actingFaction];
      if (nationState == null) continue;

      const { newState, result } = this.applyAction(
        currentState,
        request,
        nationState,
      );
      working[request.actingFaction] = newState;
      actionResults.push(result);
    }

    // 3. Apply passive effects to each faction's final state.
    for (const factionId of Object.keys(working)) {
      const currentState = working[factionId];
      if (currentState == null) continue;
      working[factionId] = this.applyPassiveEffects(currentState, currentTurn);
    }

    // 4 & 5. Reclassify bands and detect transitions.
    const bandTransitions: NuclearTurnResult['bandTransitions'] = [];

    for (const factionId of Object.keys(working)) {
      const state = working[factionId];
      if (state == null) continue;

      const original = originalBands[factionId];
      if (original != null && original !== state.band) {
        bandTransitions.push({
          factionId: factionId as FactionId,
          from: original,
          to: state.band,
        });
      }
    }

    // 6. Return result — cast back to the Record<FactionId, …> shape.
    return {
      updatedStates: working as Record<FactionId, NuclearFactionState>,
      actionResults,
      bandTransitions,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Clamp a threshold value to the 0–100 range. */
  private clampThreshold(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}
