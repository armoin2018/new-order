/**
 * Type System Barrel Export
 *
 * Re-exports every type, interface, and enum from the New Order data layer.
 * Import from '@/data/types' to access any type in the system.
 */

// ── Shared enums, branded IDs, and constants ────────────────────────────────
export {
  FactionId,
  ALL_FACTIONS,
  FACTION_COUNT,
  UnitType,
  Doctrine,
  DoctrineId,
  SpecialCapabilityType,
  TerrainType,
  DecisionStyle,
  StressResponse,
  BiasType,
  InteractionTone,
  PsyOpType,
  CounterIntelType,
  TraumaType,
  OffenseType,
  EscalationStage,
  CoupOutcome,
  RegimeChangeType,
  NationSplitStatus,
  PowerBaseCategory,
  MediaEcosystemType,
  NarrativeType,
  DeepfakeType,
  ContentCategory,
  WhistleblowerChoice,
  HeadlinePerspective,
  SanctionTier,
  SwiftStatus,
  CurrencyManipulationType,
  DebtTrapStatus,
  WarEconomyPhase,
  SecondarySanctionResponse,
  TechDomain,
  TechBlocAlignment,
  DecouplingStatus,
  ExportControlType,
  CircumventionMethod,
  SpaceAction,
  DualUseChoice,
  ClimateEventType,
  RefugeeResponse,
  RefugeeCause,
  MineralAlternative,
  PandemicResponse,
  EnvironmentalDiplomacyType,
  ProxyEscalationLevel,
  NonStateActorType,
  ProxyOperationType,
  DeniabilitySource,
  NuclearEscalationBand,
  NuclearActionType,
  AgreementType,
  AgreementStatus,
  IntelSubScore,
  IntelOperationType,
  ViabilityLabel,
  TrendDirection,
  ConfidenceLevel,
  ConsistencyState,
  StrategicGrade,
  GrandStrategyPreset,
  ProjectionHorizonType,
  UNResolutionType,
  AIDifficultyLevel,
  DoubleAgentStatus,
  JapanNuclearPhase,
  TutorialPhase,
  EventCategory,
} from './enums';

export type {
  UnitId,
  HexId,
  LeaderId,
  EventId,
  ActorId,
  ActionId,
  TurnNumber,
} from './enums';

// ── Core world state (DR-101, DR-102, DR-106, DR-107) ──────────────────────
export type {
  TensionLevel,
  RelationshipMatrix,
  HexState,
  HexMap,
  EventLogEntry,
  EventLog,
  Headline,
  TurnHeadlines,
  HeadlineArchive,
} from './core.types';

// ── Nation state (DR-104, DR-111, DR-112, DR-113) ───────────────────────────
export type {
  NationState,
  GeographicPosture,
  CivilUnrestComponents,
  EthnicFaultLine,
  NationFaultLines,
} from './nation.types';

// ── Leader psychology (DR-108, DR-119 – DR-124) ─────────────────────────────
export type {
  LeaderIdentity,
  LeaderPsychology,
  LeaderMotivations,
  PowerBase,
  LeaderVulnerabilities,
  LeaderProfile,
  EmotionalStateSnapshot,
  CognitiveBiasDefinition,
  LeaderBiasAssignment,
  CognitiveBiasRegistry,
  InterpersonalChemistry,
  InterpersonalChemistryMatrix,
  Grudge,
  GrudgeLedger,
  MassPsychologyIndex,
  DriftEvent,
  PersonalityDriftLog,
} from './leader.types';

// ── Military & intelligence (DR-103, DR-109, DR-110) ────────────────────────
export type {
  Unit,
  UnitRegistry,
  IntelligenceCapabilities,
  IntelOperation,
  IntelAsset,
  IntelligenceCapabilityMatrix,
  MilitaryForceStructure,
} from './military.types';

// ── Strategic advisory (DR-114 – DR-118) ────────────────────────────────────
export type {
  VictoryPathViability,
  TurnViabilityAssessment,
  StateTrendSnapshot,
  StateTrendHistory,
  ActionOutcomePrediction,
  AiResponseProjection,
  ActionOutcomePredictionCache,
  ConsistencyAction,
  StrategicConsistencyLog,
  InflectionPoint,
  RoadNotTaken,
  StrategicGradeRubric,
  PostGameAnalysis,
} from './advisory.types';

// ── Information warfare (DR-125 – DR-127, DR-139) ───────────────────────────
export type {
  NarrativeBattleEntry,
  InternationalLegitimacy,
  NarrativeCampaign,
  NarrativeCampaignLog,
  ViralityEvent,
  SocialMediaViralityQueue,
  MediaEcosystemConfig,
} from './infowar.types';

// ── Financial warfare (DR-128, DR-129, DR-137) ──────────────────────────────
export type {
  SecondarySanction,
  Sanction,
  SanctionsRegistry,
  NationFinancialState,
  CurrencyAttack,
  FinancialNetworkState,
  GFSIContributingFactors,
  GlobalFinancialStabilityIndex,
} from './financial.types';

// ── Technology race (DR-130, DR-131, DR-138) ────────────────────────────────
export type {
  ActiveResearch,
  ExportControls,
  TechnologyIndex,
  NationTechBlocInfo,
  TechBlocAlignmentMap,
  AccordViolation,
  NationAccordCompliance,
  DualUseTechAccords,
} from './technology.types';

// ── Climate & resources (DR-132 – DR-134) ───────────────────────────────────
export type {
  StrategicReserves,
  ImportDependency,
  ResourceLeverage,
  ResourceSecurityIndex,
  ClimateEvent,
  ClimateEventQueue,
  RefugeeFlow,
  RefugeeFlowTracker,
} from './resources.types';

// ── Proxy wars & non-state actors (DR-135, DR-136, DR-140) ─────────────────
export type {
  ProxyOperation,
  ProxyRelationship,
  ProxyNetworkGraph,
  ArmsBazaarTransaction,
  ArmsBazaarTransactionLog,
  NonStateActor,
  NonStateActorRegistry,
} from './proxy.types';

// ── Scenario definition (DR-105) ────────────────────────────────────────────
export type {
  FlashpointVariable,
  VictoryConditionDef,
  LossConditionDef,
  TimelineEvent,
  MapConfig,
  AIProfileConfig,
  ScenarioDefinition,
} from './scenario.types';

// ── External model types (DR-141 – DR-168) ──────────────────────────────────
export type {
  SchemaVersion,
  CognitiveFunction,
  MBTITypeCode,
  LeadershipStyle,
  DiplomaticApproach,
  ConflictResponse,
  StressPattern,
  MBTITypeProfile,
  PoliticalSystemProfile,
  EquipmentCategory,
  EquipmentAbility,
  MilitaryEquipment,
  TechDomainKey,
  ImpactLevel,
  ExportRestrictionLevel,
  TechnologyModel,
  EducationCategory,
  EducationType,
  PopulationDemographics,
  PoliticalInfluenceLevel,
  DemographicTrend,
  TensionLevelReligion,
  ReligionProfile,
  MBTIDichotomyScores,
  ExtendedLeaderProfile,
  AnyModel,
  ModelCollectionType,
  ModelTypeMap,
  // Country model types (DR-190)
  SuccessionType,
  CountryLeaderRefs,
  CountryReligiousEntry,
  CountryPsychographics,
  CountryPolicyRef,
  ResourceAbundance,
  StrategicImportance,
  NaturalResourceEntry,
  CountryResources,
  TradeCommodityEntry,
  TradingPartnerEntry,
  CountryTradeProfile,
  ModernizationStatus,
  MilitaryEquipmentEntry,
  NuclearCapability,
  MilitaryBranches,
  PowerProjection,
  CountryMilitaryBreakdown,
  AgeDistribution,
  EthnicGroupEntry,
  PopulationSocialIndicators,
  PopulationGameplayModifiers,
  CountryPopulation,
  CountryModel,
  // Policy model types (DR-191)
  PolicyCategory,
  PolicyScope,
  PolicyTargetEffects,
  PolicyEffects,
  PolicyPrerequisite,
  PolicyModel,
} from './model.types';

// ── Stock market & runtime state types (DR-169 – DR-182) ────────────────────
export type {
  VolatilityProfile,
  MarketSector,
  MarketEventType,
  MarketSentiment,
  MarketTrend,
  IndexType,
  LetterGrade,
  ScoringDimension,
  StockExchangeModel,
  SectorTicker,
  NationTickerSet,
  IndexConstituent,
  MarketIndexModel,
  TickerPricePoint,
  TickerRuntimeState,
  IndexRuntimeState,
  ExchangeSentimentState,
  MarketEventLogEntry,
  MarketContagionEvent,
  DimensionScore,
  ScenarioScore,
  ScenarioExportManifest,
  RuntimeMarketState,
  TechModuleRecord,
  TechModuleRegistryState,
  TechModuleDiscoveryEntry,
} from './model.types';

// ── Master game state ───────────────────────────────────────────────────────
export type { GameState } from './gamestate.types';

// ── Temporal / turn-duration types (DR-183) ─────────────────────────────────
export type {
  TurnDurationUnit,
  TurnDurationConfig,
  TemporalScalingResult,
} from './temporal.types';

// ── Currency exchange rate types (DR-184, FR-3800) ──────────────────────────
export type {
  CurrencyManipulationAction,
  CurrencyRecord,
  CurrencyState,
  CurrencyManipulationResult,
  CurrencyEvent,
  CurrencyDefinition,
} from './currency.types';

// ── Turn budget & investment allocation types (DR-185, FR-3900) ─────────────
export {
  BUDGET_DIMENSIONS,
  type BudgetDimension,
  type InvestmentLevel,
  type DimensionAllocation,
  type TurnBudgetAllocation,
  type BudgetRecommendation,
  type BudgetState,
} from './budget.types';

// ── AI dimension prompt types (DR-186, FR-4000) ─────────────────────────────
export * from './prompt.types';

// ── Dynamic rankings & composite scoring (DR-197, DR-198, FR-4700) ──────────
export type {
  RankingScoringDimension,
  RankingDimensionScore,
  RankTrend,
  CompositeNationScore,
  RankingAlertType,
  RankingAlert,
  RankingState,
} from './ranking.types';

// ── Enhanced AI configuration & persistence (DR-187, FR-4100) ───────────────
export type {
  AIProviderId,
  OllamaModelInfo,
  ConnectionTestResult,
  PersistedAIConfig,
  SanitizedAIConfig,
  AIConfigState,
} from './ai-config.types';

// ── Leader elections & leadership transitions (FR-4501 – FR-4506) ───────────
export type {
  PoliticalSystemType,
  ElectionState,
  ElectionResult,
  ElectionFormulaBreakdown,
  LeadershipTransitionType,
  LeadershipTransitionRecord,
  TransitionEffect,
} from './election.types';

// ── Simulation persistence types (DR-188, DR-189, FR-4200) ──────────────────
export type {
  SimulationId,
  SimulationStatus,
  SimulationMetadata,
  SimulationSaveManifest,
  AutoSaveConfig,
  RunningContextSection,
  RunningContextDocument,
  SaveResult,
  PersistenceState,
} from './persistence.types';

// ── Web state gathering types (DR-190, FR-4300) ─────────────────────────────
export {
  GATHERING_DIMENSIONS,
  type GatheringDimension,
  type GatheringStatus,
  type DataSource,
  type GatheringQuery,
  type DataPoint,
  type EnrichmentModel,
  type GatheringResult,
  type ApplicationMode,
  type ApplicationRequest,
  type ApplicationResult,
  type WebGatheringState,
} from './web-gathering.types';

// ── Queue-based scenario runner types (FR-4400) ─────────────────────────────
export type {
  QueueItemId,
  QueueItemStatus,
  QueueItem,
  BatchConfig,
  SharedScenarioParams,
  ConcurrencyConfig,
  QueueProgress,
  DimensionComparison,
  DivergencePoint,
  BatchAnalysis,
  ScenarioQueueState,
} from './queue.types';

// ── Scenario lifecycle management types (FR-4600) ───────────────────────────
export type {
  ScenarioLifecycleStatus,
  TerminationReason,
  TerminationRecord,
  PauseRecord,
  ForkRecord,
  ScenarioLifecycleState,
  LifecycleTransition,
} from './lifecycle.types';

// ── Expanded nation roster types (FR-4800) ──────────────────────────────────
export type {
  ExpandedNationId,
  NationRosterEntry,
  FlashpointDefinition,
  ExpandedRelationshipSeed,
  NationCapabilitySummary,
  NationRosterState,
} from './nation-roster.types';

export {
  ORIGINAL_NATIONS,
  NEW_NATIONS,
  ALL_NATIONS,
  EXPANDED_NATION_COUNT,
} from './nation-roster.types';

// ── Interactive map view types (DR-211, DR-218, FR-4900) ────────────────────
export type {
  ZoomLevel,
  PanOffset,
  MapViewState,
  TrendDirection,
  RelationshipCategory,
  MiniDashboardData,
  CountryFlagOverlay,
  RelationshipLine,
  FlashpointIcon,
  MapInteractionEvent,
} from './map-view.types';

// ── Multi-action turn system types (DR-215, FR-5000) ────────────────────────
export type {
  ActionType,
  ActionId,
  ActionPriority,
  InteractionEffectType,
  ActionDefinition,
  InteractionEffect,
  ActionSlate,
  ActionResolutionResult,
  TurnActionSummary,
} from './action-slate.types';

// ── Future innovations & discovery system types (DR-212, FR-5100) ───────────
export type {
  InnovationCategory,
  InnovationTier,
  ImpactOrder,
  MultiOrderImpact,
  InnovationModel,
  InnovationResearchState,
  InnovationDiscoveryEvent,
  InnovationBriefingReport,
  InnovationDependencyNode,
  InnovationState,
} from './innovation.types';

// ── National policy system types (DR-213, DR-214, FR-5200) ──────────────────
export type {
  PolicyStatus,
  PolicyScope,
  PolicyCreator,
  DimensionalImpact,
  PolicyInteractionType,
  PolicyModel,
  PolicyState,
  PolicyInteraction,
  PolicyProposal,
  NationalPolicyState,
} from './policy.types';

// ── Civil war & protest scenario types (DR-216, DR-217, FR-5300) ────────────
export type {
  ProtestCause,
  OrganizationLevel,
  UnrestResponseType,
  GovernmentResponseStatus,
  CivilWarResolutionType,
  ProtestMovement,
  CivilWarState,
  UnrestReactionOption,
  UnrestResponseResult,
  InternationalCivilWarResponse,
  NationCivilWarState,
} from './civil-war.types';

// ── Live data types (FR-4400) ───────────────────────────────────────────────
export type {
  LiveDataStatus,
  LiveDataCategory,
  FactionCountryMap,
  EconomicDataPoint,
  MilitaryDataPoint,
  MarketDataPoint,
  DiplomaticDataPoint,
  TechnologyDataPoint,
  LeaderDataPoint,
  CategoryFetchResult,
  LiveDataResult,
  LiveDataConfig,
  LiveDataProgress,
} from './live-data.types';

export {
  LIVE_DATA_CATEGORIES,
} from './live-data.types';

// ── Economic state types (FR-7000) ──────────────────────────────────────────
export type {
  CommodityPrices,
  ShippingState,
  TradeLedger,
  CreditRating,
  NationalDebt,
  ConsumerBehavior,
  ChaoticEvent,
  ChaoticEventState,
  NationEconomicState,
} from './economic-state.types';

export {
  ChaoticEventType,
} from './economic-state.types';

// ── Emergent technology types (FR-6100) ─────────────────────────────────────
export type {
  ResearchFocus,
  NationTechProfile,
  EmergentTechMaturity,
  IndustrySector,
  CrossIndustryImpact,
  EmergentTechnology,
  EmergentTechEvent,
  EmergentTechState,
} from './emergent-tech.types';
