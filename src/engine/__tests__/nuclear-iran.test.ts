import { describe, it, expect } from 'vitest';
import { IranNuclearEngine } from '@/engine/nuclear-iran';
import type {
  IranCommandState,
  IranNuclearInput,
  DirtyBombResult,
  DirtyBombEligibility,
} from '@/engine/nuclear-iran';
import { FactionId, NuclearEscalationBand } from '@/data/types';
import type { NationState, TurnNumber } from '@/data/types';
import type { NuclearFactionState } from '@/engine/nuclear-escalation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNation(overrides?: Partial<NationState>): NationState {
  return {
    factionId: FactionId.Iran,
    stability: 60,
    treasury: 200,
    gdp: 1500,
    inflation: 18,
    militaryReadiness: 55,
    nuclearThreshold: 20,
    diplomaticInfluence: 35,
    popularity: 40,
    allianceCredibility: 25,
    techLevel: 45,
    ...overrides,
  };
}

function makeNuclearState(overrides?: Partial<NuclearFactionState>): NuclearFactionState {
  return {
    factionId: FactionId.Iran,
    threshold: 50,
    band: NuclearEscalationBand.TacticalReadiness,
    lastUpdatedTurn: 0 as TurnNumber,
    mobileLaunchersRepositioned: false,
    tacticalOptionsPrepared: false,
    ...overrides,
  };
}

function makeCommandState(overrides?: Partial<IranCommandState>): IranCommandState {
  return {
    decentralizedCommandActive: false,
    activatedTurn: null,
    dirtyBombUsed: false,
    dirtyBombTurn: null,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<IranNuclearInput>): IranNuclearInput {
  return {
    currentTurn: 5 as TurnNumber,
    iranNation: makeNation({ factionId: FactionId.Iran }),
    iranNuclearState: makeNuclearState({ factionId: FactionId.Iran }),
    iranCommandState: makeCommandState(),
    usNation: makeNation({ factionId: FactionId.US, stability: 75, militaryReadiness: 85 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IranNuclearEngine', () => {
  const engine = new IranNuclearEngine();

  // -----------------------------------------------------------------------
  // createDefaultState
  // -----------------------------------------------------------------------

  describe('createDefaultState', () => {
    it('decentralizedCommandActive is false', () => {
      const state = IranNuclearEngine.createDefaultState();
      expect(state.decentralizedCommandActive).toBe(false);
    });

    it('dirtyBombUsed is false', () => {
      const state = IranNuclearEngine.createDefaultState();
      expect(state.dirtyBombUsed).toBe(false);
    });

    it('activatedTurn is null', () => {
      const state = IranNuclearEngine.createDefaultState();
      expect(state.activatedTurn).toBeNull();
    });

    it('dirtyBombTurn is null', () => {
      const state = IranNuclearEngine.createDefaultState();
      expect(state.dirtyBombTurn).toBeNull();
    });

    it('returns a new object each call', () => {
      const a = IranNuclearEngine.createDefaultState();
      const b = IranNuclearEngine.createDefaultState();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // activateDecentralizedCommand
  // -----------------------------------------------------------------------

  describe('activateDecentralizedCommand', () => {
    it('sets decentralizedCommandActive to true', () => {
      const state = makeCommandState();
      const result = engine.activateDecentralizedCommand(state, 3 as TurnNumber);
      expect(result.decentralizedCommandActive).toBe(true);
    });

    it('records activatedTurn correctly', () => {
      const state = makeCommandState();
      const result = engine.activateDecentralizedCommand(state, 7 as TurnNumber);
      expect(result.activatedTurn).toBe(7);
    });

    it('does not mutate the original state', () => {
      const state = makeCommandState();
      const originalActive = state.decentralizedCommandActive;
      const originalTurn = state.activatedTurn;
      engine.activateDecentralizedCommand(state, 3 as TurnNumber);
      expect(state.decentralizedCommandActive).toBe(originalActive);
      expect(state.activatedTurn).toBe(originalTurn);
    });

    it('returns a new object reference', () => {
      const state = makeCommandState();
      const result = engine.activateDecentralizedCommand(state, 3 as TurnNumber);
      expect(result).not.toBe(state);
    });

    it('is idempotent — calling on already-active state preserves original activatedTurn', () => {
      const state = makeCommandState({
        decentralizedCommandActive: true,
        activatedTurn: 2 as TurnNumber,
      });
      const result = engine.activateDecentralizedCommand(state, 10 as TurnNumber);
      expect(result.decentralizedCommandActive).toBe(true);
      expect(result.activatedTurn).toBe(2);
    });

    it('preserves other state fields', () => {
      const state = makeCommandState({ dirtyBombUsed: true, dirtyBombTurn: 4 as TurnNumber });
      const result = engine.activateDecentralizedCommand(state, 5 as TurnNumber);
      expect(result.dirtyBombUsed).toBe(true);
      expect(result.dirtyBombTurn).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // checkDirtyBombEligibility
  // -----------------------------------------------------------------------

  describe('checkDirtyBombEligibility', () => {
    it('eligible: command active, not used', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
        }),
      });
      const result: DirtyBombEligibility = engine.checkDirtyBombEligibility(input);
      expect(result.eligible).toBe(true);
      expect(result.decentralizedCommandActive).toBe(true);
      expect(result.alreadyUsed).toBe(false);
    });

    it('not eligible: command not active → reason mentions command not active', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({ decentralizedCommandActive: false }),
      });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.eligible).toBe(false);
      expect(result.decentralizedCommandActive).toBe(false);
      expect(result.reason.toLowerCase()).toContain('active');
    });

    it('not eligible: already used → reason mentions already used', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
          dirtyBombUsed: true,
          dirtyBombTurn: 3 as TurnNumber,
        }),
      });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.eligible).toBe(false);
      expect(result.alreadyUsed).toBe(true);
      expect(result.reason.toLowerCase()).toContain('already');
    });

    it('not eligible: command not active (primary check) → short-circuits before used check', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: false,
          dirtyBombUsed: true,
          dirtyBombTurn: 2 as TurnNumber,
        }),
      });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.eligible).toBe(false);
      expect(result.decentralizedCommandActive).toBe(false);
    });

    it('eligible right after activation', () => {
      const commandState = engine.activateDecentralizedCommand(
        makeCommandState(),
        4 as TurnNumber,
      );
      const input = makeInput({ iranCommandState: commandState });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.eligible).toBe(true);
    });

    it('returns decentralizedCommandActive = true when active', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
        }),
      });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.decentralizedCommandActive).toBe(true);
    });

    it('returns alreadyUsed = false when not used', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
          dirtyBombUsed: false,
        }),
      });
      const result = engine.checkDirtyBombEligibility(input);
      expect(result.alreadyUsed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // executeDirtyBomb
  // -----------------------------------------------------------------------

  describe('executeDirtyBomb', () => {
    function makeEligibleInput(overrides?: Partial<IranNuclearInput>): IranNuclearInput {
      return makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
        }),
        ...overrides,
      });
    }

    it('blocked when not eligible — returns executed: false', () => {
      const input = makeInput(); // default: command not active
      const result: DirtyBombResult = engine.executeDirtyBomb(input);
      expect(result.executed).toBe(false);
      expect(result.blockReason).not.toBeNull();
    });

    it('blocked result has zero penalties', () => {
      const input = makeInput();
      const result = engine.executeDirtyBomb(input);
      expect(result.israelStabilityPenalty).toBe(0);
      expect(result.iranDiPenalty).toBe(0);
      expect(result.iranThresholdIncrease).toBe(0);
      expect(result.globalTensionIncrease).toBe(0);
      expect(result.usRetaliationTriggered).toBe(false);
      expect(result.usRetaliationStabilityPenalty).toBe(0);
      expect(result.usRetaliationMilitaryPenalty).toBe(0);
    });

    it('full cascade: executed is true when eligible', () => {
      const input = makeEligibleInput();
      const result = engine.executeDirtyBomb(input);
      expect(result.executed).toBe(true);
      expect(result.blockReason).toBeNull();
    });

    it('full cascade: israelStabilityPenalty is -25', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.israelStabilityPenalty).toBe(-25);
    });

    it('full cascade: iranDiPenalty is -40', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.iranDiPenalty).toBe(-40);
    });

    it('full cascade: iranThresholdIncrease is 30', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.iranThresholdIncrease).toBe(30);
    });

    it('full cascade: globalTensionIncrease is 30', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.globalTensionIncrease).toBe(30);
    });

    it('full cascade: usRetaliationTriggered is true', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.usRetaliationTriggered).toBe(true);
    });

    it('full cascade: usRetaliationStabilityPenalty is -30', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.usRetaliationStabilityPenalty).toBe(-30);
    });

    it('full cascade: usRetaliationMilitaryPenalty is -40', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.usRetaliationMilitaryPenalty).toBe(-40);
    });

    it('sets dirtyBombUsed to true on returned updatedCommandState', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(result.updatedCommandState.dirtyBombUsed).toBe(true);
    });

    it('records dirtyBombTurn on returned updatedCommandState', () => {
      const input = makeEligibleInput({ currentTurn: 8 as TurnNumber });
      const result = engine.executeDirtyBomb(input);
      expect(result.updatedCommandState.dirtyBombTurn).toBe(8);
    });

    it('does not mutate the input command state', () => {
      const commandState = makeCommandState({
        decentralizedCommandActive: true,
        activatedTurn: 1 as TurnNumber,
      });
      const input = makeInput({ iranCommandState: commandState });
      engine.executeDirtyBomb(input);
      expect(commandState.dirtyBombUsed).toBe(false);
      expect(commandState.dirtyBombTurn).toBeNull();
    });

    it('cannot execute twice — second attempt is blocked', () => {
      const input = makeEligibleInput();
      const first = engine.executeDirtyBomb(input);
      expect(first.executed).toBe(true);

      const secondInput = makeInput({
        iranCommandState: first.updatedCommandState,
      });
      const second = engine.executeDirtyBomb(secondInput);
      expect(second.executed).toBe(false);
      expect(second.blockReason).not.toBeNull();
    });

    it('returns a description string when executed', () => {
      const result = engine.executeDirtyBomb(makeEligibleInput());
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('blocked result includes a description', () => {
      const result = engine.executeDirtyBomb(makeInput());
      expect(typeof result.description).toBe('string');
      expect(result.description.toLowerCase()).toContain('blocked');
    });
  });

  // -----------------------------------------------------------------------
  // getAvailableActions
  // -----------------------------------------------------------------------

  describe('getAvailableActions', () => {
    it('initial state: activate_decentralized_command is eligible', () => {
      const input = makeInput(); // default: command not active
      const actions = engine.getAvailableActions(input);
      const activate = actions.find(a => a.action === 'activate_decentralized_command');
      expect(activate).toBeDefined();
      expect(activate!.eligible).toBe(true);
    });

    it('initial state: dirty_bomb is not eligible', () => {
      const input = makeInput();
      const actions = engine.getAvailableActions(input);
      const dirtyBomb = actions.find(a => a.action === 'dirty_bomb');
      expect(dirtyBomb).toBeDefined();
      expect(dirtyBomb!.eligible).toBe(false);
    });

    it('after activation: activate_decentralized_command is not eligible', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 2 as TurnNumber,
        }),
      });
      const actions = engine.getAvailableActions(input);
      const activate = actions.find(a => a.action === 'activate_decentralized_command');
      expect(activate).toBeDefined();
      expect(activate!.eligible).toBe(false);
    });

    it('after activation: dirty_bomb is eligible', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 2 as TurnNumber,
        }),
      });
      const actions = engine.getAvailableActions(input);
      const dirtyBomb = actions.find(a => a.action === 'dirty_bomb');
      expect(dirtyBomb).toBeDefined();
      expect(dirtyBomb!.eligible).toBe(true);
    });

    it('after dirty bomb used: both actions are not eligible', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
          dirtyBombUsed: true,
          dirtyBombTurn: 3 as TurnNumber,
        }),
      });
      const actions = engine.getAvailableActions(input);
      const activate = actions.find(a => a.action === 'activate_decentralized_command');
      const dirtyBomb = actions.find(a => a.action === 'dirty_bomb');
      expect(activate!.eligible).toBe(false);
      expect(dirtyBomb!.eligible).toBe(false);
    });

    it('returns exactly 2 actions', () => {
      const actions = engine.getAvailableActions(makeInput());
      expect(actions).toHaveLength(2);
    });

    it('returns correct action names', () => {
      const actions = engine.getAvailableActions(makeInput());
      const names = actions.map(a => a.action);
      expect(names).toContain('activate_decentralized_command');
      expect(names).toContain('dirty_bomb');
    });

    it('returns reasons for unavailability', () => {
      const input = makeInput({
        iranCommandState: makeCommandState({
          decentralizedCommandActive: true,
          activatedTurn: 1 as TurnNumber,
          dirtyBombUsed: true,
          dirtyBombTurn: 3 as TurnNumber,
        }),
      });
      const actions = engine.getAvailableActions(input);
      for (const action of actions) {
        expect(typeof action.reason).toBe('string');
        expect(action.reason.length).toBeGreaterThan(0);
      }
    });

    it('each action has action, eligible, and reason fields', () => {
      const actions = engine.getAvailableActions(makeInput());
      for (const action of actions) {
        expect(action).toHaveProperty('action');
        expect(action).toHaveProperty('eligible');
        expect(action).toHaveProperty('reason');
      }
    });
  });
});
