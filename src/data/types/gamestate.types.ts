/**
 * Master Game State — Composes all per-turn subsystem state objects.
 *
 * This is the single source of truth that flows through the Zustand store
 * and is serialized/deserialized via Web Worker postMessage.
 *
 * It composes every data requirement (DR-101 – DR-140) into one coherent type.
 */

import type { FactionId, LeaderId, TurnNumber } from './enums';
import type { RelationshipMatrix, HexMap, EventLog, HeadlineArchive } from './core.types';
import type {
  NationState,
  GeographicPosture,
  CivilUnrestComponents,
  NationFaultLines,
} from './nation.types';
import type {
  LeaderProfile,
  EmotionalStateSnapshot,
  CognitiveBiasRegistry,
  InterpersonalChemistryMatrix,
  GrudgeLedger,
  MassPsychologyIndex,
  PersonalityDriftLog,
} from './leader.types';
import type {
  UnitRegistry,
  IntelligenceCapabilityMatrix,
  MilitaryForceStructure,
} from './military.types';
import type {
  TurnViabilityAssessment,
  StateTrendHistory,
  ActionOutcomePredictionCache,
  StrategicConsistencyLog,
  PostGameAnalysis,
} from './advisory.types';
import type {
  InternationalLegitimacy,
  NarrativeCampaignLog,
  SocialMediaViralityQueue,
  MediaEcosystemConfig,
} from './infowar.types';
import type {
  SanctionsRegistry,
  FinancialNetworkState,
  GlobalFinancialStabilityIndex,
} from './financial.types';
import type {
  TechnologyIndex,
  TechBlocAlignmentMap,
  DualUseTechAccords,
} from './technology.types';
import type {
  ResourceSecurityIndex,
  ClimateEventQueue,
  RefugeeFlowTracker,
} from './resources.types';
import type {
  ProxyNetworkGraph,
  ArmsBazaarTransactionLog,
  NonStateActorRegistry,
} from './proxy.types';
import type { ScenarioDefinition } from './scenario.types';
import type {
  RuntimeMarketState,
  TechModuleRegistryState,
} from './model.types';
import type { MapViewState } from './map-view.types';
import type { ActionSlate } from './action-slate.types';
import type { InnovationState } from './innovation.types';
import type { NationalPolicyState } from './policy.types';
import type { NationCivilWarState } from './civil-war.types';
import type { NationEconomicState, ChaoticEventState } from './economic-state.types';
import type { CurrencyState } from './currency.types';
import type { EmergentTechState } from './emergent-tech.types';

// ---------------------------------------------------------------------------
// GameState — the root of all per-turn data
// ---------------------------------------------------------------------------

/**
 * The master game state that encapsulates the entire simulation.
 *
 * Every field is organized by the data requirement it fulfills.
 * This type is:
 * - Held in the Zustand store on the main thread
 * - Serialized via `structuredClone` or `postMessage` to/from Web Workers
 * - Persisted to local storage for mid-turn saves
 */
export interface GameState {
  // ── Meta ─────────────────────────────────────────────────────────────────
  /** The scenario that seeded this game. */
  scenarioMeta: ScenarioDefinition['meta'];
  /** Current turn number (1-indexed). */
  currentTurn: TurnNumber;
  /** Which faction the player controls. */
  playerFaction: FactionId;
  /** Random seed for deterministic simulation (NFR-402). */
  randomSeed: number;
  /** Whether the game has ended. */
  gameOver: boolean;
  /** Reason for game end (victory condition ID, loss condition ID, or null). */
  gameEndReason: string | null;

  // ── DR-101: Relationship Matrix ──────────────────────────────────────────
  relationshipMatrix: RelationshipMatrix;

  // ── DR-102: Hex Map ──────────────────────────────────────────────────────
  hexMap: HexMap;

  // ── DR-103: Unit Registry ────────────────────────────────────────────────
  unitRegistry: UnitRegistry;

  // ── DR-104: Nation States ────────────────────────────────────────────────
  nationStates: Record<FactionId, NationState>;

  // ── DR-106: Event Log ────────────────────────────────────────────────────
  eventLog: EventLog;

  // ── DR-107: Headline Archive ─────────────────────────────────────────────
  headlineArchive: HeadlineArchive;

  // ── DR-108: Leader Profiles ──────────────────────────────────────────────
  leaderProfiles: Record<LeaderId, LeaderProfile>;

  // ── DR-109: Intelligence Capabilities ────────────────────────────────────
  intelligenceCapabilities: Record<FactionId, IntelligenceCapabilityMatrix>;

  // ── DR-110: Military Force Structures ────────────────────────────────────
  militaryForceStructures: Record<FactionId, MilitaryForceStructure>;

  // ── DR-111: Geographic Postures ──────────────────────────────────────────
  geographicPostures: Record<FactionId, GeographicPosture>;

  // ── DR-112: Civil Unrest Components ──────────────────────────────────────
  civilUnrestComponents: Record<FactionId, CivilUnrestComponents>;

  // ── DR-113: Ethnic/Religious Fault Lines ─────────────────────────────────
  nationFaultLines: Record<FactionId, NationFaultLines>;

  // ── DR-114: Victory Path Viability ───────────────────────────────────────
  currentViability: TurnViabilityAssessment | null;

  // ── DR-115: State Trend Snapshots ────────────────────────────────────────
  stateTrendHistory: StateTrendHistory;

  // ── DR-116: Action-Outcome Prediction Cache ──────────────────────────────
  actionPredictionCache: ActionOutcomePredictionCache;

  // ── DR-117: Strategic Consistency Log ────────────────────────────────────
  strategicConsistency: StrategicConsistencyLog | null;

  // ── DR-118: Post-Game Analysis (populated at game end) ───────────────────
  postGameAnalysis: PostGameAnalysis | null;

  // ── DR-119: Emotional State Snapshots ────────────────────────────────────
  emotionalStates: Record<LeaderId, EmotionalStateSnapshot>;

  // ── DR-120: Cognitive Bias Registry ──────────────────────────────────────
  cognitiveBiasRegistry: CognitiveBiasRegistry;

  // ── DR-121: Interpersonal Chemistry Matrix ───────────────────────────────
  interpersonalChemistry: InterpersonalChemistryMatrix;

  // ── DR-122: Grudge Ledgers ───────────────────────────────────────────────
  grudgeLedgers: Record<LeaderId, GrudgeLedger>;

  // ── DR-123: Mass Psychology Indices ──────────────────────────────────────
  massPsychology: Record<FactionId, MassPsychologyIndex>;

  // ── DR-124: Personality Drift Logs ───────────────────────────────────────
  personalityDriftLogs: Record<LeaderId, PersonalityDriftLog>;

  // ── DR-125: International Legitimacy ─────────────────────────────────────
  internationalLegitimacy: Record<FactionId, InternationalLegitimacy>;

  // ── DR-126: Narrative Campaign Logs ──────────────────────────────────────
  narrativeCampaignLogs: Record<FactionId, NarrativeCampaignLog>;

  // ── DR-127: Social Media Virality Queue ──────────────────────────────────
  viralityQueue: SocialMediaViralityQueue;

  // ── DR-128: Sanctions Registry ───────────────────────────────────────────
  sanctionsRegistry: SanctionsRegistry;

  // ── DR-129: Financial Network State ──────────────────────────────────────
  financialNetworkState: FinancialNetworkState;

  // ── DR-130: Technology Indices ───────────────────────────────────────────
  technologyIndices: Record<FactionId, TechnologyIndex>;

  // ── DR-131: Tech Bloc Alignment Map ──────────────────────────────────────
  techBlocAlignmentMap: TechBlocAlignmentMap;

  // ── DR-132: Resource Security Indices ────────────────────────────────────
  resourceSecurity: Record<FactionId, ResourceSecurityIndex>;

  // ── DR-133: Climate Event Queue ──────────────────────────────────────────
  climateEventQueue: ClimateEventQueue;

  // ── DR-134: Refugee Flow Tracker ─────────────────────────────────────────
  refugeeFlowTracker: RefugeeFlowTracker;

  // ── DR-135: Proxy Network Graph ──────────────────────────────────────────
  proxyNetworkGraph: ProxyNetworkGraph;

  // ── DR-136: Arms Bazaar Transaction Log ──────────────────────────────────
  armsBazaarLog: ArmsBazaarTransactionLog;

  // ── DR-137: Global Financial Stability Index ─────────────────────────────
  globalFinancialStability: GlobalFinancialStabilityIndex;

  // ── DR-138: Dual-Use Technology Accords ──────────────────────────────────
  dualUseTechAccords: DualUseTechAccords;

  // ── DR-139: Media Ecosystem Configs ──────────────────────────────────────
  mediaEcosystems: Record<FactionId, MediaEcosystemConfig>;

  // ── DR-140: Non-State Actor Registry ─────────────────────────────────────
  nonStateActorRegistry: NonStateActorRegistry;

  // ── DR-169–175, DR-181: Stock Market State ──────────────────────────────
  /** Runtime market state (exchanges, tickers, sentiment, indexes). Null before game start. */
  marketState: RuntimeMarketState | null;

  // ── DR-176: Technology Module Registry ──────────────────────────────────
  /** Auto-generated tech modules and discovery log. Null before first discovery. */
  techModuleRegistry: TechModuleRegistryState | null;

  // ── DR-211: Mini Dashboard Data / Map View State ─────────────────────────
  /** Interactive map view state with zoom/pan and country overlays. Null before game start. */
  mapViewState: MapViewState | null;

  // ── DR-215: Action Slate ─────────────────────────────────────────────────
  /** Multi-action turn slate for the player's queued actions. Null before game start. */
  actionSlate: ActionSlate | null;

  // ── DR-212: Innovation State ─────────────────────────────────────────────
  /** Future innovations research and discovery tracking per nation. Null before game start. */
  innovationState: InnovationState | null;

  // ── DR-213–214: National Policy State ────────────────────────────────────
  /** Per-nation policy management state. Key is FactionId. */
  nationalPolicies: Record<FactionId, NationalPolicyState>;

  // ── DR-216–217: Civil War & Protest State ────────────────────────────────
  /** Per-nation civil war and protest movement tracking. Key is FactionId. */
  civilWarStates: Record<FactionId, NationCivilWarState>;

  // ── FR-3800: Currency / Forex State ───────────────────────────────────────
  /** Per-nation currency exchange rates, reserves, and history. Null before game start. */
  currencyState: CurrencyState | null;

  // ── FR-7000: Macroeconomic State ──────────────────────────────────────────
  /** Per-nation economic state (commodities, trade, debt, shipping, consumer). */
  economicStates: Record<FactionId, NationEconomicState> | null;

  // ── FR-7005: Chaotic Events ──────────────────────────────────────────────
  /** Global chaotic event state (natural disasters, pandemics). */
  chaoticEventState: ChaoticEventState | null;

  // ── FR-5406: Multi-Vector AI Pipeline Summary ────────────────────────────
  /** Per-faction AI evaluation metadata from the last turn's multi-vector pipeline. */
  multiVectorSummary: import('@/engine/game-controller').AIFactionSummary[] | null;

  // ── FR-6100: Emergent Technology State ───────────────────────────────────
  /** Per-nation tech profiles, AI-generated emergent techs, and cross-industry impacts. */
  emergentTechState: EmergentTechState | null;
}
