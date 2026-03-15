/**
 * Zustand Global State Store — CNFL-0101
 *
 * Single source of truth for all New Order game state.
 * Uses Zustand + Immer for immutable updates and localStorage persistence.
 *
 * @see NFR-401 — Save integrity checksum for save file validation
 * @see NFR-402 — Deterministic simulation via randomSeed
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { EscalationStage, SwiftStatus, DecouplingStatus } from '@/data/types';
import { logger } from './logger';
import { MarketTurnIntegration } from './market-turn-integration';
import {
  EXCHANGE_MODELS,
  TICKER_SET_MODELS,
  INDEX_MODELS,
  SENTIMENT_BASELINE,
} from '@/data/model-loader';

import type { GameState, ScenarioDefinition, FactionId, TurnNumber } from '@/data/types';
import { initializeMapViewState } from './map-view-engine';
import { initializeActionSlate } from './action-slate-engine';
import { initializeInnovationState } from './innovation-engine';
import { initializeNationalPolicyState, proposePolicy, enactPolicy, repealPolicy } from './policy-engine';
import { DEFAULT_NATION_POLICIES } from './config/default-policies';
import type { PolicyModel } from '@/data/types/policy.types';
import { initializeNationCivilWarState } from './civil-war-engine';

// ---------------------------------------------------------------------------
// Store action interface
// ---------------------------------------------------------------------------

/** Actions exposed by the game store. */
export interface GameActions {
  /** Initialize full game state from a scenario definition and chosen faction. */
  initializeFromScenario: (
    scenario: ScenarioDefinition,
    playerFaction: FactionId,
  ) => void;
  /** Advance the turn counter (placeholder for full turn processing). */
  advanceTurn: () => void;
  /** End the game with a reason string. */
  setGameOver: (reason: string) => void;
  /** Reset all state to uninitialized defaults. */
  resetGame: () => void;

  // ── FR-5200: Policy Actions ────────────────────────────────────────────
  /** Propose and immediately enact a policy for the player faction. */
  addPolicy: (policy: PolicyModel) => void;
  /** Repeal an active policy for the player faction. */
  removePolicy: (policyId: string) => void;
}

/** Combined store type: full game state + action methods. */
type GameStore = GameState & GameActions;

// ---------------------------------------------------------------------------
// NFR-401 — Save integrity checksum
// ---------------------------------------------------------------------------

/**
 * Compute a djb2-like hash of critical game state fields.
 * Used to validate save file integrity on load.
 */
function computeChecksum(state: Record<string, unknown>): string {
  const critical = JSON.stringify({
    ct: state['currentTurn'],
    pf: state['playerFaction'],
    rs: state['randomSeed'],
    go: state['gameOver'],
    gr: state['gameEndReason'],
  });
  let hash = 0;
  for (let i = 0; i < critical.length; i++) {
    hash = ((hash << 5) - hash + critical.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Custom localStorage wrapper that embeds a checksum on write
 * and validates integrity on read (NFR-401).
 */
function createChecksumStorage() {
  return {
    getItem(name: string) {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        const envelope = JSON.parse(raw) as {
          state: GameStore;
          version?: number;
          checksum?: string;
        };
        if (typeof envelope.checksum === 'string') {
          const actual = computeChecksum(
            envelope.state as unknown as Record<string, unknown>,
          );
          if (actual !== envelope.checksum) {
            logger.warn('Save integrity check failed — checksum mismatch.', {
              expected: envelope.checksum,
              actual,
            });
          }
        }
        return { state: envelope.state, version: envelope.version };
      } catch {
        logger.warn('Failed to parse save data.');
        return null;
      }
    },
    setItem(name: string, value: { state: GameStore; version?: number }) {
      const checksum = computeChecksum(
        value.state as unknown as Record<string, unknown>,
      );
      localStorage.setItem(name, JSON.stringify({ ...value, checksum }));
    },
    removeItem(name: string) {
      localStorage.removeItem(name);
    },
  };
}

// ---------------------------------------------------------------------------
// Default empty state (pre-initialization)
// ---------------------------------------------------------------------------

const EMPTY_GAME_STATE: GameState = {
  // ── Meta ─────────────────────────────────────────────────────────────────
  scenarioMeta: {
    id: '',
    name: '',
    version: '',
    author: '',
    description: '',
    maxTurns: 0,
  },
  currentTurn: 0 as TurnNumber,
  playerFaction: '' as FactionId,
  randomSeed: 0,
  gameOver: false,
  gameEndReason: null,

  // ── DR-101 ───────────────────────────────────────────────────────────────
  relationshipMatrix: {} as GameState['relationshipMatrix'],

  // ── DR-102 ───────────────────────────────────────────────────────────────
  hexMap: {},

  // ── DR-103 ───────────────────────────────────────────────────────────────
  unitRegistry: {},

  // ── DR-104 ───────────────────────────────────────────────────────────────
  nationStates: {} as GameState['nationStates'],

  // ── DR-106 ───────────────────────────────────────────────────────────────
  eventLog: [],

  // ── DR-107 ───────────────────────────────────────────────────────────────
  headlineArchive: [],

  // ── DR-108 ───────────────────────────────────────────────────────────────
  leaderProfiles: {} as GameState['leaderProfiles'],

  // ── DR-109 ───────────────────────────────────────────────────────────────
  intelligenceCapabilities: {} as GameState['intelligenceCapabilities'],

  // ── DR-110 ───────────────────────────────────────────────────────────────
  militaryForceStructures: {} as GameState['militaryForceStructures'],

  // ── DR-111 ───────────────────────────────────────────────────────────────
  geographicPostures: {} as GameState['geographicPostures'],

  // ── DR-112 ───────────────────────────────────────────────────────────────
  civilUnrestComponents: {} as GameState['civilUnrestComponents'],

  // ── DR-113 ───────────────────────────────────────────────────────────────
  nationFaultLines: {} as GameState['nationFaultLines'],

  // ── DR-114 ───────────────────────────────────────────────────────────────
  currentViability: null,

  // ── DR-115 ───────────────────────────────────────────────────────────────
  stateTrendHistory: [],

  // ── DR-116 ───────────────────────────────────────────────────────────────
  actionPredictionCache: [],

  // ── DR-117 ───────────────────────────────────────────────────────────────
  strategicConsistency: null,

  // ── DR-118 ───────────────────────────────────────────────────────────────
  postGameAnalysis: null,

  // ── DR-119 ───────────────────────────────────────────────────────────────
  emotionalStates: {} as GameState['emotionalStates'],

  // ── DR-120 ───────────────────────────────────────────────────────────────
  cognitiveBiasRegistry: {
    definitions: [],
    assignments: {} as GameState['cognitiveBiasRegistry']['assignments'],
  },

  // ── DR-121 ───────────────────────────────────────────────────────────────
  interpersonalChemistry: [],

  // ── DR-122 ───────────────────────────────────────────────────────────────
  grudgeLedgers: {} as GameState['grudgeLedgers'],

  // ── DR-123 ───────────────────────────────────────────────────────────────
  massPsychology: {} as GameState['massPsychology'],

  // ── DR-124 ───────────────────────────────────────────────────────────────
  personalityDriftLogs: {} as GameState['personalityDriftLogs'],

  // ── DR-125 ───────────────────────────────────────────────────────────────
  internationalLegitimacy: {} as GameState['internationalLegitimacy'],

  // ── DR-126 ───────────────────────────────────────────────────────────────
  narrativeCampaignLogs: {} as GameState['narrativeCampaignLogs'],

  // ── DR-127 ───────────────────────────────────────────────────────────────
  viralityQueue: { turn: 0 as TurnNumber, events: [] },

  // ── DR-128 ───────────────────────────────────────────────────────────────
  sanctionsRegistry: [],

  // ── DR-129 ───────────────────────────────────────────────────────────────
  financialNetworkState: {
    nations: {} as GameState['financialNetworkState']['nations'],
    gfsi: 75,
    currencyAttacks: [],
  },

  // ── DR-130 ───────────────────────────────────────────────────────────────
  technologyIndices: {} as GameState['technologyIndices'],

  // ── DR-131 ───────────────────────────────────────────────────────────────
  techBlocAlignmentMap: {
    nations: {} as GameState['techBlocAlignmentMap']['nations'],
    exportControlCoalitions: [],
    decouplingStatus: DecouplingStatus.Unified,
  },

  // ── DR-132 ───────────────────────────────────────────────────────────────
  resourceSecurity: {} as GameState['resourceSecurity'],

  // ── DR-133 ───────────────────────────────────────────────────────────────
  climateEventQueue: { upcoming: [], historical: [] },

  // ── DR-134 ───────────────────────────────────────────────────────────────
  refugeeFlowTracker: { turn: 0 as TurnNumber, activeFlows: [] },

  // ── DR-135 ───────────────────────────────────────────────────────────────
  proxyNetworkGraph: [],

  // ── DR-136 ───────────────────────────────────────────────────────────────
  armsBazaarLog: [],

  // ── DR-137 ───────────────────────────────────────────────────────────────
  globalFinancialStability: {
    turn: 0 as TurnNumber,
    gfsi: 75,
    contributingFactors: {
      sanctions: 0,
      tradeWars: 0,
      currencyAttacks: 0,
      debtCrises: 0,
    },
    contagionActive: false,
    affectedNations: [],
    recoveryTrajectory: 'Stable',
  },

  // ── DR-138 ───────────────────────────────────────────────────────────────
  dualUseTechAccords: {
    signatories: [],
    violations: [],
    nationCompliance: {} as GameState['dualUseTechAccords']['nationCompliance'],
  },

  // ── DR-139 ───────────────────────────────────────────────────────────────
  mediaEcosystems: {} as GameState['mediaEcosystems'],

  // ── DR-140 ───────────────────────────────────────────────────────────────
  nonStateActorRegistry: {},

  // ── DR-169–175, DR-181: Market State ─────────────────────────────────────
  marketState: null,

  // ── DR-176–177: Tech Module Registry ─────────────────────────────────────
  techModuleRegistry: null,

  // ── DR-211: Map View State ───────────────────────────────────────────────
  mapViewState: null,

  // ── DR-215: Action Slate ─────────────────────────────────────────────────
  actionSlate: null,

  // ── DR-212: Innovation State ─────────────────────────────────────────────
  innovationState: null,

  // ── DR-213–214: National Policy State ────────────────────────────────────
  nationalPolicies: {} as GameState['nationalPolicies'],

  // ── DR-216–217: Civil War & Protest State ────────────────────────────────
  civilWarStates: {} as GameState['civilWarStates'],

  // ── FR-5406: Multi-Vector AI Pipeline Summary ──────────────────────────
  multiVectorSummary: null,

  // ── FR-6100: Emergent Technology State ────────────────────────────────
  emergentTechState: null,

  // ── FR-3800: Currency Exchange Rate State ─────────────────────────────
  currencyState: null,
};

// ---------------------------------------------------------------------------
// Store creation — persist(immer(...))
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>()(
  persist(
    immer((set) => ({
      // ── Spread default state ─────────────────────────────────────────
      ...EMPTY_GAME_STATE,

      // ── Actions ──────────────────────────────────────────────────────

      initializeFromScenario: (
        scenario: ScenarioDefinition,
        playerFaction: FactionId,
      ) => {
        set((state) => {
          const turnOne = 1 as TurnNumber;

          // ── Meta ─────────────────────────────────────────────────────
          state.scenarioMeta = scenario.meta;
          state.currentTurn = turnOne;
          state.playerFaction = playerFaction;
          state.randomSeed = Date.now();
          state.gameOver = false;
          state.gameEndReason = null;

          // ── DR-101: Relationship Matrix ──────────────────────────────
          state.relationshipMatrix = scenario.relationshipMatrix;

          // ── DR-102: Hex Map ──────────────────────────────────────────
          if (scenario.hexMap) {
            state.hexMap = scenario.hexMap;
          } else {
            state.hexMap = {};
            for (const hex of scenario.mapConfig.hexOverrides) {
              state.hexMap[hex.id] = hex;
            }
          }

          // ── DR-103: Unit Registry ────────────────────────────────────
          state.unitRegistry = {};
          for (const unit of scenario.units) {
            state.unitRegistry[unit.id] = unit;
          }

          // ── DR-104: Nation States ────────────────────────────────────
          state.nationStates = scenario.nationStates;

          // ── DR-106 / DR-107: Event & Headline logs (empty at start) ─
          state.eventLog = [];
          state.headlineArchive = [];

          // ── DR-108: Leader Profiles — extracted from AI profiles ─────
          state.leaderProfiles = {} as GameState['leaderProfiles'];
          for (const fid of scenario.factions) {
            const ai = scenario.aiProfiles[fid];
            if (ai) {
              state.leaderProfiles[ai.leader.id] = ai.leader;
            }
          }

          // ── DR-109: Intelligence Capabilities ───────────────────────
          state.intelligenceCapabilities = scenario.intelligenceCapabilities;

          // ── DR-110: Military Force Structures ───────────────────────
          state.militaryForceStructures = scenario.militaryForceStructures;

          // ── DR-111: Geographic Postures ──────────────────────────────
          state.geographicPostures = scenario.geographicPostures;

          // ── DR-112: Civil Unrest Components — sensible defaults ──────
          state.civilUnrestComponents =
            {} as GameState['civilUnrestComponents'];
          for (const fid of scenario.factions) {
            state.civilUnrestComponents[fid] = {
              factionId: fid,
              turn: turnOne,
              civilUnrest: 0,
              inflation: 0,
              inequality: 0,
              repressionBacklash: 0,
              ethnicTension: 0,
              foreignPropaganda: 0,
              escalationStage: EscalationStage.Grumbling,
            };
          }

          // ── DR-113: Nation Fault Lines ───────────────────────────────
          state.nationFaultLines = scenario.nationFaultLines;

          // ── DR-114 – DR-118: Advisory (null/empty until engine runs) ─
          state.currentViability = null;
          state.stateTrendHistory = [];
          state.actionPredictionCache = [];
          state.strategicConsistency = null;
          state.postGameAnalysis = null;

          // ── DR-119: Emotional States — initial from AI profiles ──────
          state.emotionalStates = {} as GameState['emotionalStates'];
          for (const fid of scenario.factions) {
            const ai = scenario.aiProfiles[fid];
            if (ai) {
              state.emotionalStates[ai.leader.id] = {
                ...ai.initialEmotionalState,
                turn: turnOne,
              };
            }
          }

          // ── DR-120: Cognitive Bias Registry ─────────────────────────
          const biasAssignments =
            {} as GameState['cognitiveBiasRegistry']['assignments'];
          for (const fid of scenario.factions) {
            const ai = scenario.aiProfiles[fid];
            if (ai) {
              biasAssignments[ai.leader.id] = ai.biasAssignments;
            }
          }
          state.cognitiveBiasRegistry = {
            definitions: scenario.cognitiveBiasDefinitions,
            assignments: biasAssignments,
          };

          // ── DR-121: Interpersonal Chemistry ─────────────────────────
          state.interpersonalChemistry = scenario.interpersonalChemistry;

          // ── DR-122: Grudge Ledgers — empty per leader ───────────────
          state.grudgeLedgers = {} as GameState['grudgeLedgers'];
          for (const fid of scenario.factions) {
            const ai = scenario.aiProfiles[fid];
            if (ai) {
              state.grudgeLedgers[ai.leader.id] = {
                leaderId: ai.leader.id,
                grudges: [],
              };
            }
          }

          // ── DR-123: Mass Psychology ─────────────────────────────────
          state.massPsychology = scenario.massPsychology;

          // ── DR-124: Personality Drift Logs — snapshot per leader ─────
          state.personalityDriftLogs =
            {} as GameState['personalityDriftLogs'];
          for (const fid of scenario.factions) {
            const ai = scenario.aiProfiles[fid];
            if (ai) {
              state.personalityDriftLogs[ai.leader.id] = {
                leaderId: ai.leader.id,
                originalProfile: { ...ai.leader.psychology },
                driftEvents: [],
                currentDriftMagnitude: 0,
                stressInoculationTurn: null,
              };
            }
          }

          // ── DR-125: International Legitimacy — 50/100 defaults ──────
          state.internationalLegitimacy =
            {} as GameState['internationalLegitimacy'];
          for (const fid of scenario.factions) {
            state.internationalLegitimacy[fid] = {
              factionId: fid,
              turn: turnOne,
              legitimacy: 50,
              legitimacyDelta: 0,
              narrativeActive: null,
              narrativeBattleHistory: [],
              whistleblowerRisk: 0,
            };
          }

          // ── DR-126: Narrative Campaign Logs — empty per faction ──────
          state.narrativeCampaignLogs =
            {} as GameState['narrativeCampaignLogs'];
          for (const fid of scenario.factions) {
            state.narrativeCampaignLogs[fid] = {
              factionId: fid,
              activeCampaigns: [],
              historicalCampaigns: [],
            };
          }

          // ── DR-127: Social Media Virality Queue ─────────────────────
          state.viralityQueue = { turn: turnOne, events: [] };

          // ── DR-128: Sanctions Registry (empty at start) ─────────────
          state.sanctionsRegistry = [];

          // ── DR-129: Financial Network State — defaults per faction ───
          const finNations =
            {} as GameState['financialNetworkState']['nations'];
          for (const fid of scenario.factions) {
            finNations[fid] = {
              factionId: fid,
              swiftStatus: SwiftStatus.Connected,
              altPaymentMaturity: 0,
              cryptoInfrastructure: 0,
              warEconomy: false,
            };
          }
          state.financialNetworkState = {
            nations: finNations,
            gfsi: 75,
            currencyAttacks: [],
          };

          // ── DR-130: Technology Indices ───────────────────────────────
          state.technologyIndices = scenario.technologyIndices;

          // ── DR-131: Tech Bloc Alignment Map ─────────────────────────
          state.techBlocAlignmentMap = {
            nations: scenario.techBlocInfo,
            exportControlCoalitions: [],
            decouplingStatus: DecouplingStatus.Unified,
          };

          // ── DR-132: Resource Security ───────────────────────────────
          state.resourceSecurity = scenario.resourceSecurity;

          // ── DR-133: Climate Event Queue ──────────────────────────────
          state.climateEventQueue = {
            upcoming: [...scenario.climateEvents],
            historical: [],
          };

          // ── DR-134: Refugee Flow Tracker ─────────────────────────────
          state.refugeeFlowTracker = { turn: turnOne, activeFlows: [] };

          // ── DR-135: Proxy Network Graph ──────────────────────────────
          state.proxyNetworkGraph = [...scenario.proxyRelationships];

          // ── DR-136: Arms Bazaar (empty at start) ─────────────────────
          state.armsBazaarLog = [];

          // ── DR-137: Global Financial Stability Index ─────────────────
          state.globalFinancialStability = {
            turn: turnOne,
            gfsi: 75,
            contributingFactors: {
              sanctions: 0,
              tradeWars: 0,
              currencyAttacks: 0,
              debtCrises: 0,
            },
            contagionActive: false,
            affectedNations: [],
            recoveryTrajectory: 'Stable',
          };

          // ── DR-138: Dual-Use Technology Accords ──────────────────────
          const signatories: FactionId[] = [];
          const compliance =
            {} as GameState['dualUseTechAccords']['nationCompliance'];
          for (const fid of scenario.factions) {
            const blocInfo = scenario.techBlocInfo[fid];
            const signed = blocInfo?.ethicsAccordSignatory ?? false;
            if (signed) signatories.push(fid);
            compliance[fid] = {
              factionId: fid,
              signed,
              compliance: signed ? 100 : 0,
              secretViolation: false,
            };
          }
          state.dualUseTechAccords = {
            signatories,
            violations: [],
            nationCompliance: compliance,
          };

          // ── DR-139: Media Ecosystems ─────────────────────────────────
          state.mediaEcosystems = scenario.mediaEcosystems;

          // ── DR-140: Non-State Actor Registry ─────────────────────────
          state.nonStateActorRegistry = {};
          for (const actor of scenario.nonStateActors) {
            state.nonStateActorRegistry[actor.id] = actor;
          }

          // ── DR-169–175: Market State Initialisation ──────────────────
          // Market models are loaded from JSON via model-loader.
          // Initialise the runtime market state so it's available from
          // turn 1 (prevents processMarketTurn from throwing on null).
          try {
            if (EXCHANGE_MODELS.length > 0 && TICKER_SET_MODELS.length > 0) {
              const mti = new MarketTurnIntegration();
              const ms = mti.initialiseMarketState(
                EXCHANGE_MODELS,
                TICKER_SET_MODELS,
                INDEX_MODELS,
                turnOne as number,
              );
              // Apply sentiment baselines from JSON config
              const baselines = SENTIMENT_BASELINE.exchangeBaselines;
              const patched = { ...ms.sentimentStates };
              for (const [exId, base] of Object.entries(baselines)) {
                if (patched[exId]) {
                  patched[exId] = {
                    ...patched[exId]!,
                    sentiment: base.sentiment as any,
                    sentimentScore: base.sentimentScore,
                    trendStrength: base.trendStrength,
                  };
                }
              }
              state.marketState = { ...ms, sentimentStates: patched } as any;
            }
          } catch (err) {
            // Market initialisation is non-critical — game still works
            console.error('[store] Market state initialisation failed:', err);
            logger.warn('Market state initialisation skipped (model data unavailable).');
          }

          // ── DR-211: Map View State ───────────────────────────────────────
          state.mapViewState = initializeMapViewState(playerFaction);

          // ── DR-215: Action Slate ─────────────────────────────────────────
          state.actionSlate = initializeActionSlate(playerFaction, turnOne);

          // ── DR-212: Innovation State ─────────────────────────────────────
          state.innovationState = initializeInnovationState([]);

          // ── DR-213–214: National Policy State ────────────────────────────
          state.nationalPolicies = {} as GameState['nationalPolicies'];
          for (const fid of scenario.factions) {
            let pState = initializeNationalPolicyState(fid);
            // ── FR-5200: Load and enact default policies for each nation ──
            const defaults = DEFAULT_NATION_POLICIES[fid] ?? [];
            for (const policyModel of defaults) {
              pState = proposePolicy(pState, policyModel);
              pState = enactPolicy(pState, policyModel.policyId, turnOne);
            }
            state.nationalPolicies[fid] = pState;
          }

          // ── DR-216–217: Civil War & Protest State ────────────────────────
          state.civilWarStates = {} as GameState['civilWarStates'];
          for (const fid of scenario.factions) {
            state.civilWarStates[fid] = initializeNationCivilWarState(fid);
          }

          // ── FR-6100: Emergent Technology State ───────────────────────────
          // Initialised to null — will be lazily initialised on first
          // processTurn call when technologyIndices are available.
          state.emergentTechState = null;
        });
      },

      advanceTurn: () => {
        set((state) => {
          state.currentTurn = (state.currentTurn + 1) as TurnNumber;
        });
      },

      setGameOver: (reason: string) => {
        set((state) => {
          state.gameOver = true;
          state.gameEndReason = reason;
        });
      },

      resetGame: () => {
        set((state) => {
          Object.assign(state, structuredClone(EMPTY_GAME_STATE));
        });
      },

      // ── FR-5200: Policy Actions ──────────────────────────────────────
      addPolicy: (policy: PolicyModel) => {
        set((state) => {
          const fid = state.playerFaction;
          if (!fid || !state.nationalPolicies[fid]) return;
          let pState = structuredClone(state.nationalPolicies[fid]);
          // Already active? skip
          if (pState.activePolicies.some((ps) => ps.policyId === policy.policyId)) return;
          // Already proposed? just enact
          if (pState.proposedPolicies.some((pp) => pp.policyId === policy.policyId)) {
            pState = enactPolicy(pState, policy.policyId, state.currentTurn as number);
          } else {
            pState = proposePolicy(pState, policy);
            pState = enactPolicy(pState, policy.policyId, state.currentTurn as number);
          }
          state.nationalPolicies[fid] = pState;
        });
      },

      removePolicy: (policyId: string) => {
        set((state) => {
          const fid = state.playerFaction;
          if (!fid || !state.nationalPolicies[fid]) return;
          let pState = structuredClone(state.nationalPolicies[fid]);
          const isActive = pState.activePolicies.some((ps) => ps.policyId === policyId);
          if (!isActive) return;
          pState = repealPolicy(pState, policyId, state.currentTurn as number);
          state.nationalPolicies[fid] = pState;
        });
      },
    })),
    {
      name: 'new-order-save',
      storage: createChecksumStorage(),
    },
  ),
);
