import { describe, it, expect } from 'vitest';
import { NuclearEscalationEngine } from '@/engine/nuclear-escalation';
import type {
  NuclearFactionState,
  NuclearActionRequest,
  NuclearTurnInput,
} from '@/engine/nuclear-escalation';
import { FactionId, NuclearEscalationBand, NuclearActionType } from '@/data/types';
import type { TurnNumber, NationState } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNation(overrides?: Partial<NationState>): NationState {
  return {
    factionId: FactionId.US,
    stability: 70,
    treasury: 500,
    gdp: 21000,
    inflation: 3,
    militaryReadiness: 80,
    nuclearThreshold: 10,
    diplomaticInfluence: 60,
    popularity: 55,
    allianceCredibility: 75,
    techLevel: 90,
    ...overrides,
  };
}

function makeState(overrides?: Partial<NuclearFactionState>): NuclearFactionState {
  return {
    factionId: FactionId.US,
    threshold: 0,
    band: NuclearEscalationBand.Deterrence,
    lastUpdatedTurn: 0 as TurnNumber,
    mobileLaunchersRepositioned: false,
    tacticalOptionsPrepared: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NuclearEscalationEngine', () => {
  const engine = new NuclearEscalationEngine();

  // -----------------------------------------------------------------------
  // classifyBand
  // -----------------------------------------------------------------------

  describe('classifyBand', () => {
    it('classifies threshold 0 as Deterrence', () => {
      expect(engine.classifyBand(0)).toBe(NuclearEscalationBand.Deterrence);
    });

    it('classifies threshold 30 (boundary) as Deterrence', () => {
      expect(engine.classifyBand(30)).toBe(NuclearEscalationBand.Deterrence);
    });

    it('classifies threshold 31 as TacticalReadiness', () => {
      expect(engine.classifyBand(31)).toBe(NuclearEscalationBand.TacticalReadiness);
    });

    it('classifies threshold 70 (boundary) as TacticalReadiness', () => {
      expect(engine.classifyBand(70)).toBe(NuclearEscalationBand.TacticalReadiness);
    });

    it('classifies threshold 71 as ThresholdBreach', () => {
      expect(engine.classifyBand(71)).toBe(NuclearEscalationBand.ThresholdBreach);
    });

    it('classifies threshold 100 as ThresholdBreach', () => {
      expect(engine.classifyBand(100)).toBe(NuclearEscalationBand.ThresholdBreach);
    });

    it('clamps negative values to Deterrence', () => {
      expect(engine.classifyBand(-10)).toBe(NuclearEscalationBand.Deterrence);
    });

    it('clamps values above 100 to ThresholdBreach', () => {
      expect(engine.classifyBand(150)).toBe(NuclearEscalationBand.ThresholdBreach);
    });
  });

  // -----------------------------------------------------------------------
  // createInitialState
  // -----------------------------------------------------------------------

  describe('createInitialState', () => {
    it('creates state with default threshold 0 and Deterrence band', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.US);
      expect(state.threshold).toBe(0);
      expect(state.band).toBe(NuclearEscalationBand.Deterrence);
    });

    it('correctly classifies a custom threshold', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.Russia, 50);
      expect(state.threshold).toBe(50);
      expect(state.band).toBe(NuclearEscalationBand.TacticalReadiness);
    });

    it('assigns the factionId correctly', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.China);
      expect(state.factionId).toBe(FactionId.China);
    });

    it('defaults all flags to false', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.DPRK);
      expect(state.mobileLaunchersRepositioned).toBe(false);
      expect(state.tacticalOptionsPrepared).toBe(false);
    });

    it('sets lastUpdatedTurn to 0', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.US);
      expect(state.lastUpdatedTurn).toBe(0);
    });

    it('clamps initial threshold above 100 to 100', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.US, 200);
      expect(state.threshold).toBe(100);
      expect(state.band).toBe(NuclearEscalationBand.ThresholdBreach);
    });

    it('clamps negative initial threshold to 0', () => {
      const state = NuclearEscalationEngine.createInitialState(FactionId.US, -5);
      expect(state.threshold).toBe(0);
      expect(state.band).toBe(NuclearEscalationBand.Deterrence);
    });
  });

  // -----------------------------------------------------------------------
  // validateAction
  // -----------------------------------------------------------------------

  describe('validateAction', () => {
    const deterrenceState = makeState({ threshold: 10, band: NuclearEscalationBand.Deterrence });
    const tacticalState = makeState({ threshold: 50, band: NuclearEscalationBand.TacticalReadiness });
    const breachState = makeState({ threshold: 80, band: NuclearEscalationBand.ThresholdBreach });

    // SignalTest
    it('allows SignalTest in Deterrence band', () => {
      const result = engine.validateAction(deterrenceState, NuclearActionType.SignalTest);
      expect(result.valid).toBe(true);
    });

    it('rejects SignalTest in TacticalReadiness band', () => {
      const result = engine.validateAction(tacticalState, NuclearActionType.SignalTest);
      expect(result.valid).toBe(false);
    });

    it('rejects SignalTest in ThresholdBreach band', () => {
      const result = engine.validateAction(breachState, NuclearActionType.SignalTest);
      expect(result.valid).toBe(false);
    });

    // MobileLauncherReposition
    it('allows MobileLauncherReposition in TacticalReadiness band', () => {
      const result = engine.validateAction(tacticalState, NuclearActionType.MobileLauncherReposition);
      expect(result.valid).toBe(true);
    });

    it('rejects MobileLauncherReposition in Deterrence band', () => {
      const result = engine.validateAction(deterrenceState, NuclearActionType.MobileLauncherReposition);
      expect(result.valid).toBe(false);
    });

    it('rejects MobileLauncherReposition in ThresholdBreach band', () => {
      const result = engine.validateAction(breachState, NuclearActionType.MobileLauncherReposition);
      expect(result.valid).toBe(false);
    });

    // PrepareTacticalOptions
    it('allows PrepareTacticalOptions in TacticalReadiness band', () => {
      const result = engine.validateAction(tacticalState, NuclearActionType.PrepareTacticalOptions);
      expect(result.valid).toBe(true);
    });

    it('rejects PrepareTacticalOptions in Deterrence band', () => {
      const result = engine.validateAction(deterrenceState, NuclearActionType.PrepareTacticalOptions);
      expect(result.valid).toBe(false);
    });

    // DemonstrationStrike
    it('allows DemonstrationStrike in ThresholdBreach band', () => {
      const result = engine.validateAction(breachState, NuclearActionType.DemonstrationStrike);
      expect(result.valid).toBe(true);
    });

    it('rejects DemonstrationStrike in Deterrence band', () => {
      const result = engine.validateAction(deterrenceState, NuclearActionType.DemonstrationStrike);
      expect(result.valid).toBe(false);
    });

    // FirstStrike
    it('allows FirstStrike in ThresholdBreach band', () => {
      const result = engine.validateAction(breachState, NuclearActionType.FirstStrike);
      expect(result.valid).toBe(true);
    });

    it('rejects FirstStrike in TacticalReadiness band', () => {
      const result = engine.validateAction(tacticalState, NuclearActionType.FirstStrike);
      expect(result.valid).toBe(false);
    });

    // SecondStrike — always valid
    it('allows SecondStrike in Deterrence band', () => {
      expect(engine.validateAction(deterrenceState, NuclearActionType.SecondStrike).valid).toBe(true);
    });

    it('allows SecondStrike in TacticalReadiness band', () => {
      expect(engine.validateAction(tacticalState, NuclearActionType.SecondStrike).valid).toBe(true);
    });

    it('allows SecondStrike in ThresholdBreach band', () => {
      expect(engine.validateAction(breachState, NuclearActionType.SecondStrike).valid).toBe(true);
    });

    // RedTelephone — always valid
    it('allows RedTelephone in any band', () => {
      expect(engine.validateAction(deterrenceState, NuclearActionType.RedTelephone).valid).toBe(true);
      expect(engine.validateAction(tacticalState, NuclearActionType.RedTelephone).valid).toBe(true);
      expect(engine.validateAction(breachState, NuclearActionType.RedTelephone).valid).toBe(true);
    });

    // DirtyBomb — always valid
    it('allows DirtyBomb in any band', () => {
      expect(engine.validateAction(deterrenceState, NuclearActionType.DirtyBomb).valid).toBe(true);
      expect(engine.validateAction(tacticalState, NuclearActionType.DirtyBomb).valid).toBe(true);
      expect(engine.validateAction(breachState, NuclearActionType.DirtyBomb).valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // applyAction
  // -----------------------------------------------------------------------

  describe('applyAction', () => {
    const nation = makeNation();

    it('SignalTest increases threshold by 5', () => {
      const state = makeState({ threshold: 10, band: NuclearEscalationBand.Deterrence });
      const request: NuclearActionRequest = {
        action: NuclearActionType.SignalTest,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { newState, result } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(15);
      expect(result.previousThreshold).toBe(10);
      expect(result.newThreshold).toBe(15);
    });

    it('MobileLauncherReposition increases threshold by 5 and sets flag', () => {
      const state = makeState({ threshold: 40, band: NuclearEscalationBand.TacticalReadiness });
      const request: NuclearActionRequest = {
        action: NuclearActionType.MobileLauncherReposition,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { newState } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(45);
      expect(newState.mobileLaunchersRepositioned).toBe(true);
    });

    it('PrepareTacticalOptions increases threshold by 10 and sets flag', () => {
      const state = makeState({ threshold: 40, band: NuclearEscalationBand.TacticalReadiness });
      const request: NuclearActionRequest = {
        action: NuclearActionType.PrepareTacticalOptions,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { newState } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(50);
      expect(newState.tacticalOptionsPrepared).toBe(true);
    });

    it('DemonstrationStrike increases threshold by 15', () => {
      const state = makeState({ threshold: 75, band: NuclearEscalationBand.ThresholdBreach });
      const request: NuclearActionRequest = {
        action: NuclearActionType.DemonstrationStrike,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { newState } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(90);
    });

    it('FirstStrike sets threshold to 100', () => {
      const state = makeState({ threshold: 75, band: NuclearEscalationBand.ThresholdBreach });
      const request: NuclearActionRequest = {
        action: NuclearActionType.FirstStrike,
        actingFaction: FactionId.US,
        targetFaction: FactionId.Russia,
      };
      const { newState, result } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(100);
      expect(result.newBand).toBe(NuclearEscalationBand.ThresholdBreach);
    });

    it('SecondStrike sets threshold to 100', () => {
      const state = makeState({ threshold: 50, band: NuclearEscalationBand.TacticalReadiness });
      const request: NuclearActionRequest = {
        action: NuclearActionType.SecondStrike,
        actingFaction: FactionId.Russia,
        targetFaction: FactionId.US,
      };
      const nationRu = makeNation({ factionId: FactionId.Russia });
      const { newState } = engine.applyAction(state, request, nationRu);
      expect(newState.threshold).toBe(100);
    });

    it('RedTelephone decreases threshold by 15', () => {
      const state = makeState({ threshold: 80, band: NuclearEscalationBand.ThresholdBreach });
      const request: NuclearActionRequest = {
        action: NuclearActionType.RedTelephone,
        actingFaction: FactionId.US,
        targetFaction: FactionId.Russia,
      };
      const { newState, result } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(65);
      expect(result.previousThreshold).toBe(80);
      expect(result.newThreshold).toBe(65);
    });

    it('DirtyBomb increases threshold by 30', () => {
      const state = makeState({
        factionId: FactionId.Iran,
        threshold: 20,
        band: NuclearEscalationBand.Deterrence,
      });
      const request: NuclearActionRequest = {
        action: NuclearActionType.DirtyBomb,
        actingFaction: FactionId.Iran,
        targetFaction: null,
      };
      const nationIr = makeNation({ factionId: FactionId.Iran });
      const { newState } = engine.applyAction(state, request, nationIr);
      expect(newState.threshold).toBe(50);
    });

    it('clamps threshold to 0 on RedTelephone from low threshold', () => {
      const state = makeState({ threshold: 5, band: NuclearEscalationBand.Deterrence });
      const request: NuclearActionRequest = {
        action: NuclearActionType.RedTelephone,
        actingFaction: FactionId.US,
        targetFaction: FactionId.China,
      };
      const { newState } = engine.applyAction(state, request, nation);
      expect(newState.threshold).toBe(0);
    });

    it('clamps threshold to 100 on large increase', () => {
      const state = makeState({ threshold: 90, band: NuclearEscalationBand.ThresholdBreach });
      const request: NuclearActionRequest = {
        action: NuclearActionType.DemonstrationStrike,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { newState } = engine.applyAction(state, request, nation);
      // 90 + 15 = 105 → clamped to 100
      expect(newState.threshold).toBe(100);
    });

    it('reports band transition when threshold crosses boundary', () => {
      const state = makeState({ threshold: 28, band: NuclearEscalationBand.Deterrence });
      const request: NuclearActionRequest = {
        action: NuclearActionType.SignalTest,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      const { result } = engine.applyAction(state, request, nation);
      // 28 + 5 = 33 → TacticalReadiness
      expect(result.previousBand).toBe(NuclearEscalationBand.Deterrence);
      expect(result.newBand).toBe(NuclearEscalationBand.TacticalReadiness);
      expect(result.bandTransition).toBe(true);
    });

    it('does not mutate the input state', () => {
      const state = makeState({ threshold: 20, band: NuclearEscalationBand.Deterrence });
      const original = { ...state };
      const request: NuclearActionRequest = {
        action: NuclearActionType.SignalTest,
        actingFaction: FactionId.US,
        targetFaction: null,
      };
      engine.applyAction(state, request, nation);
      expect(state).toEqual(original);
    });
  });

  // -----------------------------------------------------------------------
  // applyPassiveEffects
  // -----------------------------------------------------------------------

  describe('applyPassiveEffects', () => {
    it('decreases threshold by 1 in Deterrence band', () => {
      const state = makeState({ threshold: 10, band: NuclearEscalationBand.Deterrence });
      const result = engine.applyPassiveEffects(state, 2 as TurnNumber);
      expect(result.threshold).toBe(9);
    });

    it('increases threshold by 1 in TacticalReadiness band', () => {
      const state = makeState({ threshold: 50, band: NuclearEscalationBand.TacticalReadiness });
      const result = engine.applyPassiveEffects(state, 3 as TurnNumber);
      expect(result.threshold).toBe(51);
    });

    it('increases threshold by 2 in ThresholdBreach band', () => {
      const state = makeState({ threshold: 80, band: NuclearEscalationBand.ThresholdBreach });
      const result = engine.applyPassiveEffects(state, 4 as TurnNumber);
      expect(result.threshold).toBe(82);
    });

    it('does not mutate the input state', () => {
      const state = makeState({ threshold: 50, band: NuclearEscalationBand.TacticalReadiness });
      const original = { ...state };
      engine.applyPassiveEffects(state, 5 as TurnNumber);
      expect(state).toEqual(original);
    });

    it('updates lastUpdatedTurn to the current turn', () => {
      const state = makeState({
        threshold: 20,
        band: NuclearEscalationBand.Deterrence,
        lastUpdatedTurn: 1 as TurnNumber,
      });
      const result = engine.applyPassiveEffects(state, 7 as TurnNumber);
      expect(result.lastUpdatedTurn).toBe(7);
    });

    it('clamps threshold to 0 when Deterrence decay would go negative', () => {
      const state = makeState({ threshold: 0, band: NuclearEscalationBand.Deterrence });
      const result = engine.applyPassiveEffects(state, 2 as TurnNumber);
      expect(result.threshold).toBe(0);
    });

    it('clamps threshold to 100 when ThresholdBreach drift would exceed', () => {
      const state = makeState({ threshold: 99, band: NuclearEscalationBand.ThresholdBreach });
      const result = engine.applyPassiveEffects(state, 2 as TurnNumber);
      expect(result.threshold).toBe(100);
    });

    it('reclassifies band after passive drift crosses boundary', () => {
      // 70 + 1 = 71 → ThresholdBreach
      const state = makeState({ threshold: 70, band: NuclearEscalationBand.TacticalReadiness });
      const result = engine.applyPassiveEffects(state, 2 as TurnNumber);
      expect(result.threshold).toBe(71);
      expect(result.band).toBe(NuclearEscalationBand.ThresholdBreach);
    });
  });

  // -----------------------------------------------------------------------
  // processTurn
  // -----------------------------------------------------------------------

  describe('processTurn', () => {
    it('applies actions then passive effects', () => {
      const factionStates = {
        [FactionId.US]: makeState({
          factionId: FactionId.US,
          threshold: 10,
          band: NuclearEscalationBand.Deterrence,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.US]: makeNation({ factionId: FactionId.US }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 3 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [
          {
            action: NuclearActionType.SignalTest,
            actingFaction: FactionId.US,
            targetFaction: null,
          },
        ],
      };

      const result = engine.processTurn(input);
      const usState = result.updatedStates[FactionId.US];
      // 10 + 5 (SignalTest) = 15, then −1 (Deterrence passive) = 14
      expect(usState?.threshold).toBe(14);
    });

    it('detects band transitions', () => {
      const factionStates = {
        [FactionId.Russia]: makeState({
          factionId: FactionId.Russia,
          threshold: 28,
          band: NuclearEscalationBand.Deterrence,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.Russia]: makeNation({ factionId: FactionId.Russia }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 4 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [
          {
            action: NuclearActionType.SignalTest,
            actingFaction: FactionId.Russia,
            targetFaction: null,
          },
        ],
      };

      const result = engine.processTurn(input);
      // 28 + 5 = 33 (TacticalReadiness), then +1 passive = 34
      expect(result.bandTransitions.length).toBeGreaterThanOrEqual(1);
      const transition = result.bandTransitions.find(
        (t) => t.factionId === FactionId.Russia,
      );
      expect(transition).toBeDefined();
      expect(transition?.from).toBe(NuclearEscalationBand.Deterrence);
      expect(transition?.to).toBe(NuclearEscalationBand.TacticalReadiness);
    });

    it('processes multiple factions independently', () => {
      const factionStates = {
        [FactionId.US]: makeState({
          factionId: FactionId.US,
          threshold: 10,
          band: NuclearEscalationBand.Deterrence,
        }),
        [FactionId.Russia]: makeState({
          factionId: FactionId.Russia,
          threshold: 50,
          band: NuclearEscalationBand.TacticalReadiness,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.US]: makeNation({ factionId: FactionId.US }),
        [FactionId.Russia]: makeNation({ factionId: FactionId.Russia }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 5 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [
          {
            action: NuclearActionType.SignalTest,
            actingFaction: FactionId.US,
            targetFaction: null,
          },
          {
            action: NuclearActionType.MobileLauncherReposition,
            actingFaction: FactionId.Russia,
            targetFaction: null,
          },
        ],
      };

      const result = engine.processTurn(input);
      const usState = result.updatedStates[FactionId.US];
      const ruState = result.updatedStates[FactionId.Russia];
      // US: 10 + 5 (signal) = 15, −1 (passive deterrence) = 14
      expect(usState?.threshold).toBe(14);
      // Russia: 50 + 5 (mobile launcher) = 55, +1 (passive tactical) = 56
      expect(ruState?.threshold).toBe(56);
      expect(ruState?.mobileLaunchersRepositioned).toBe(true);
    });

    it('does not mutate input faction states', () => {
      const usOriginal = makeState({
        factionId: FactionId.US,
        threshold: 10,
        band: NuclearEscalationBand.Deterrence,
      });
      const usSnapshot = { ...usOriginal };

      const factionStates = {
        [FactionId.US]: usOriginal,
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.US]: makeNation({ factionId: FactionId.US }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 2 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [
          {
            action: NuclearActionType.SignalTest,
            actingFaction: FactionId.US,
            targetFaction: null,
          },
        ],
      };

      engine.processTurn(input);
      expect(usOriginal).toEqual(usSnapshot);
    });

    it('applies only passive effects when there are no actions', () => {
      const factionStates = {
        [FactionId.China]: makeState({
          factionId: FactionId.China,
          threshold: 45,
          band: NuclearEscalationBand.TacticalReadiness,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.China]: makeNation({ factionId: FactionId.China }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 6 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [],
      };

      const result = engine.processTurn(input);
      const cnState = result.updatedStates[FactionId.China];
      // 45 + 1 (passive tactical drift) = 46
      expect(cnState?.threshold).toBe(46);
      expect(result.actionResults).toHaveLength(0);
    });

    it('returns action results for every action processed', () => {
      const factionStates = {
        [FactionId.US]: makeState({
          factionId: FactionId.US,
          threshold: 10,
          band: NuclearEscalationBand.Deterrence,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.US]: makeNation({ factionId: FactionId.US }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 1 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [
          {
            action: NuclearActionType.SignalTest,
            actingFaction: FactionId.US,
            targetFaction: null,
          },
        ],
      };

      const result = engine.processTurn(input);
      expect(result.actionResults).toHaveLength(1);
      expect(result.actionResults[0]?.action).toBe(NuclearActionType.SignalTest);
      expect(result.actionResults[0]?.actingFaction).toBe(FactionId.US);
    });

    it('updates lastUpdatedTurn on all faction states', () => {
      const factionStates = {
        [FactionId.Japan]: makeState({
          factionId: FactionId.Japan,
          threshold: 5,
          band: NuclearEscalationBand.Deterrence,
          lastUpdatedTurn: 0 as TurnNumber,
        }),
      } as Record<FactionId, NuclearFactionState>;

      const nationStates = {
        [FactionId.Japan]: makeNation({ factionId: FactionId.Japan }),
      } as Record<FactionId, NationState>;

      const input: NuclearTurnInput = {
        currentTurn: 10 as TurnNumber,
        factionStates,
        nationStates,
        actionsThisTurn: [],
      };

      const result = engine.processTurn(input);
      expect(result.updatedStates[FactionId.Japan]?.lastUpdatedTurn).toBe(10);
    });
  });
});
