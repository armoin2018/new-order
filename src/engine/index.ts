/**
 * Engine barrel export — Simulation engines (game loop, AI, economy, etc.)
 */

export { GAME_CONFIG } from './config';
export { EventLogger } from './event-logger';
export { logger, LogLevel } from './logger';
export type { LogEntry, LoggerConfig } from './logger';
export {
  HexGrid,
  hexIdFromAxial,
  axialFromHexId,
  offsetToAxial,
  axialToOffset,
  createDefaultHexState,
} from './hex-map';
export type { HexCoord } from './hex-map';
export type { CreateEventParams, EventFilter } from './event-logger';
export { SeededRandom } from './rng';
export type { RngState } from './rng';
export { TurnEngine } from './turn-engine';
export type {
  PhaseContext,
  PhaseHandler,
  TurnEngineOptions,
  TurnEngineState,
  TurnResult,
  CalendarDate,
} from './turn-engine';
export { SaveManager } from './save-manager';
export type {
  SaveEnvelope,
  SaveMetadata,
  SaveResult,
  LoadResult,
  SaveManagerOptions,
} from './save-manager';
export { useGameStore, type GameActions } from './store';
export {
  useCurrentTurn,
  usePlayerFaction,
  useNationState,
  useIsGameOver,
  useGameActions,
} from './hooks';
export {
  UNIT_TEMPLATES,
  UnitFactory,
  UnitRegistryManager,
  canBypassSAM,
} from './unit-registry';
export type { UnitTemplate, UnitCategory } from './unit-registry';
export { GeographicPostureEngine } from './geographic-posture';
export type { TerrainModifierResult } from './geographic-posture';
export {
  DEFAULT_CHOKEPOINTS,
  ChokepointManager,
} from './chokepoint';
export type { ChokepointId, ChokepointDefinition } from './chokepoint';
export { InvasionCalculator } from './invasion';
export type {
  DifficultyRating,
  InvasionDifficultyAssessment,
} from './invasion';
export { CombatResolver } from './combat';
export type {
  CombatContext,
  CombatResult,
  SupplyStatus,
} from './combat';
export { UtilityEvaluator } from './ai-evaluator';
export type {
  AIActionCategory,
  AIAction,
  UtilityWeights,
  AIEvaluationContext,
  ScoreBreakdown,
  ScoredAction,
  UtilityLogEntry,
  AIEvaluationResult,
} from './ai-evaluator';
export { AllianceEvaluator } from './alliance-evaluator';
export type {
  DefensePact,
  AllianceObligationContext,
  AllianceObligationResult,
} from './alliance-evaluator';
export {
  STANDARD_AI_ACTIONS,
  AI_FACTION_CONFIGS,
  getAIFactionConfig,
  getStandardActions,
  evaluateFactionTurn,
} from './ai-profiles';
export type {
  AIDifficulty,
  AIFactionConfig,
} from './ai-profiles';
export { EconomicEngine } from './economic-engine';
export type {
  TurnIncomeBreakdown,
  SpendResult,
  EconomicSnapshot,
  GlobalEconomicState,
} from './economic-engine';
export { ResourceDisruptionEngine } from './resource-disruption';
export type {
  StrategicResourceType,
  ResourceDisruption,
  CascadingDecayResult,
  RareEarthRestriction,
  RareEarthTurnResult,
  HormuzDisruptionResult,
} from './resource-disruption';
export { TradeWarfareEngine } from './trade-warfare';
export type {
  ActiveTariff,
  TariffActionResult,
  TradeShieldAgreement,
  TariffTurnResult,
  BlockadeEscalationAssessment,
} from './trade-warfare';
export { HeadlineGenerator } from './headline-generator';
export type { HeadlineGeneratorConfig } from './headline-generator';
export { IntelligenceReliabilityEngine } from './intelligence-reliability';
export type {
  IntelReliabilityConfig,
  GhostUnitRecord,
  FalsePactRecord,
  GhostDecayResult,
  FalsePactRevealResult,
} from './intelligence-reliability';
export { MarketReactionEngine } from './market-reactions';
export type {
  MarketReactionsConfig,
  MarketTriggerMatch,
  MarketReactionResult,
  TriggerCooldownState,
  MarketReactionTurnResult,
} from './market-reactions';
export { CovertInsurgencyEngine } from './covert-insurgency';
export type {
  InsurgencyConfig,
  InsurgencyRecord,
  InsurgencyValidation,
  InsurgencyTurnResult,
  AllInsurgenciesTurnResult,
} from './covert-insurgency';
export { GreyZoneOpsEngine } from './grey-zone-ops';
export type {
  CyberOpTarget,
  BlockadeRecord,
  BlockadeValidation,
  BlockadeTurnResult,
  CyberOpRecord,
  CyberOpValidation,
  CyberOpTurnResult,
  AllCyberOpsTurnResult,
} from './grey-zone-ops';
export { DiscoveryEngine } from './discovery-engine';
export type {
  DiscoveryConfig,
  GreyZoneActionType,
  GreyZoneAction,
  DiscoveryConsequences,
  DiscoveryResult,
  TurnDiscoveryResult,
} from './discovery-engine';
export { NationSelectionEngine } from './nation-selection';
export type {
  NationSelectionConfig,
  NationSummary,
  FactionAssignment,
  NationSelectionValidation,
  NationSelectionResult,
} from './nation-selection';
export { LeaderCreationEngine } from './leader-creation';
export type {
  LeaderCreationConfig,
  LeaderArchetype,
  PersonalVulnerabilityType,
  LeaderCustomization,
  LeaderValidation,
  ProfileConsistencyCheck,
  ArchetypeInfo,
} from './leader-creation';
export { NationBriefingEngine } from './nation-briefing';
export type {
  BriefingSectionId,
  BriefingEntry,
  BriefingSection,
  RelationshipSummary,
  StrategicRecommendation,
  NationBriefing,
} from './nation-briefing';
export { CivilUnrestEngine } from './civil-unrest';
export type {
  CivilUnrestConfig,
  UnrestComputationInput,
  StageEffects,
  EscalationResult,
  EthnicTensionResult,
} from './civil-unrest';
export { RepressionEngine } from './repression-engine';
export type {
  RepressionConfig,
  RepressionAction,
  RepressionResult,
  BacklashFeedback,
  MartialLawResult,
  CoupRiskAssessment,
} from './repression-engine';
export { InequalityMediaEngine } from './inequality-media';
export type {
  InequalityMediaConfig,
  InequalityInput,
  InequalityResult,
  MediaManipulationInput,
  MediaManipulationResult,
  ForeignPropagandaInput,
  ForeignPropagandaResult,
} from './inequality-media';
export { EmotionalStateEngine } from './emotional-state';
export type {
  PsychologyConfig,
  EmotionalEvent,
  EmotionalModifierResult,
  EmotionalUpdateResult,
} from './emotional-state';
export { DecisionFatigueEngine } from './decision-fatigue';
export type {
  DecisionFatigueConfig,
  FatigueState,
  FatigueEffectType,
  FatigueEffectResult,
  FatigueAccumulationResult,
  FatigueResetResult,
} from './decision-fatigue';
export { CognitiveBiasEngine } from './cognitive-bias';
export type {
  CognitiveBiasConfig,
  BiasContext,
  BiasTriggerResult,
  BiasDistortion,
  BiasEvaluationResult,
} from './cognitive-bias';
export { ChemistryTrustEngine } from './chemistry-trust';
export type {
  ChemistryTrustConfig,
  TrustInput,
  TrustResult,
  ChemistryModifierResult,
  DiplomaticEncounterInput,
  DiplomaticEncounterResult,
  GrudgeDecayResult,
  AgreementTier,
} from './chemistry-trust';
export { VictoryPathEngine } from './victory-path';
export type {
  AdvisoryConfig,
  NationMetrics,
  VictoryRequirements,
  VictoryConditionInput,
} from './victory-path';
export { LossWarningEngine } from './loss-warning';
export type {
  LossWarningConfig,
  UrgencyLevel,
  LossConditionStatus,
  LossWarningAssessment,
  LossMetricInput,
  LossTrajectoryInput,
} from './loss-warning';
export { RecommendedActionsEngine } from './recommended-actions';
export type {
  RecommendedActionsConfig,
  ActionCandidate,
  RankedAction,
  PathRecommendation,
  RecommendationAssessment,
  ConsistencyResult,
  ConsistencyActionEntry,
} from './recommended-actions';

// ── CNFL-0012: Information Warfare & Narrative (FR-1600) ────────────────────
export { LegitimacyEngine } from './legitimacy';
export type {
  LegitimacyInput,
  DiplomaticGating,
  LegitimacyConfig,
  NarrativeBattleInput,
} from './legitimacy';
export { NarrativeCampaignEngine } from './narrative-campaign';
export type {
  CampaignEffects,
  BackfireContext,
  BackfireResult,
  DeployCampaignResult,
  TurnContext,
  AdvanceTurnResult,
  NarrativeCampaignConfig,
} from './narrative-campaign';
export { MediaEcosystemEngine } from './media-ecosystem';
export type {
  PropagandaResult,
  ViralityEventInput,
  EcosystemVulnerability,
  MediaEcosystemEngineConfig,
} from './media-ecosystem';
export { FogOfIntentEngine, IntentType } from './fog-of-intent';
export type {
  TrueIntentType,
  AccuracyLevel,
  IntentProbabilities,
  IntentAssessmentInput,
  IntentAssessment,
  MisreadResult,
  FogOfIntentConfig,
} from './fog-of-intent';

// ── CNFL-0026: Information Warfare Phase 2 (FR-1603, FR-1604, FR-1606, FR-1607)
export { ViralityDeepfakeEngine } from './virality-deepfake-engine';
export type {
  ViralityDeepfakeConfig,
  ViralityComputeInput,
  EffectiveViralityInput,
  EffectiveViralityResult,
  DeepfakePrereqInput,
  DeepfakePrereqResult,
  DeepfakeExecutionInput,
  DeepfakeExecutionResult,
} from './virality-deepfake-engine';
export { NarrativeBattleEngine } from './narrative-battle-engine';
export type {
  AlignmentStance,
  NarrativeBattleConfig,
  NarrativeCombatant,
  NarrativeBattleInput as NarrativeBattleResolveInput,
  NarrativeBattleResult,
  FactionAlignment,
  NeutralPerceptionInput,
  FactionPerception,
  NeutralPerceptionResult,
  WhistleblowerRiskInput,
  WhistleblowerRiskResult,
  WhistleblowerResolutionInput,
  WhistleblowerResolutionResult,
  ActiveNarrativeCampaignEntry,
  ContradictionDetectionInput,
  DetectedContradiction,
  ContradictionDetectionResult,
} from './narrative-battle-engine';

// ── CNFL-0015: Victory & Loss Condition System (FR-1300) ────────────────────
export { VictoryLossCoreEngine } from './victory-loss-core';
export type {
  VictoryLossCoreConfig,
  ConditionType,
  ConditionDefinition,
  ConditionCheckResult,
  ConsecutiveTurnTracker,
  CoreConditionInput,
} from './victory-loss-core';
export { VictoryLossExtendedEngine } from './victory-loss-extended';
export type {
  VictoryLossExtConfig,
  ExtendedConditionTracker,
  ExtendedConditionInput,
} from './victory-loss-extended';

// ── CNFL-0013: Resource Security & Strategic Reserves (FR-1900) ─────────────
export { ResourceSecurityEngine, ResourceCrisisLevel } from './resource-security';
export type {
  ResourceSecurityConfig,
  ResourceCrisisDetail,
  CrisisEffects,
  ResourceDelta,
  BufferResult,
  ResourceTurnInput,
  ResourceTurnResult,
  ResourceSummary,
} from './resource-security';
export { StrategicReservesEngine, AdequacyLevel } from './strategic-reserves';
export type {
  ResourceKey,
  StrategicReservesConfig,
  StockpileResult,
  DepleteResult,
  BufferDurationResult,
  TransferResult,
  ReserveAdequacy,
  ReserveUpdateResult,
  ReservesSummary,
} from './strategic-reserves';

// ── CNFL-0016: Nuclear Escalation Sub-system (FR-500) ───────────────────────
export { NuclearEscalationEngine } from './nuclear-escalation';
export type {
  NuclearEscalationConfig,
  NuclearFactionState,
  NuclearActionResult,
  NuclearTurnInput,
  NuclearActionRequest,
  NuclearTurnResult,
} from './nuclear-escalation';
export { NuclearStrikeEngine } from './nuclear-strike';
export type {
  NuclearStrikeConfig,
  DemonstrationStrikeEligibility,
  DemonstrationStrikeResult,
  SecondStrikeResult,
  RedTelephoneResult,
  RedTelephoneInput,
} from './nuclear-strike';
export { IranNuclearEngine } from './nuclear-iran';
export type {
  IranNuclearConfig,
  IranCommandState,
  DirtyBombEligibility,
  DirtyBombResult,
  IranNuclearInput,
} from './nuclear-iran';

// ── CNFL-0017: Diplomacy & Alliances (FR-700) ──────────────────────────────
export { BilateralAgreementEngine } from './diplomacy-agreements';
export type {
  DiplomacyConfig,
  BilateralAgreement,
  ProposalInput,
  UtilityFactors,
  ProposalEvaluation,
  AgreementEffect,
  ProposalResult,
} from './diplomacy-agreements';
export { AllianceCredibilityEngine } from './alliance-credibility';
export type {
  CredibilityConfig,
  CredibilityState,
  BreachRecord,
  BreachInput,
  BreachResult,
  RecoveryResult,
  AcceptanceModifier,
  CredibilityTurnInput,
  CredibilityTurnResult,
  CredibilityTier,
} from './alliance-credibility';

// ── CNFL-0018: Intelligence & Espionage System (FR-900) ─────────────────────
export { IntelligenceCapabilityEngine } from './intel-capability';
export type {
  IntelConfig,
  IntelCapability,
  CompositeIntelScore,
  ClarityResult,
  ClarityInput,
  IntelAssessment,
  IntelAssessmentInput,
} from './intel-capability';
export { IntelligenceOpsEngine } from './intel-operations';
export type {
  IntelOpsConfig,
  IntelOperationInput,
  OperationResult,
  OperationEffect,
  BlowbackResult,
  ActiveAsset,
} from './intel-operations';
export { IntelSharingEngine } from './intel-sharing';
export type {
  IntelSharingConfig,
  IntelSharingPact,
  SharingBonus,
  SharingInput,
  SharingResult,
  ClarityBonus,
} from './intel-sharing';

// ── CNFL-0019: Military Doctrine & Capabilities (FR-1000) ───────────────────
export { ForceStructureEngine } from './force-structure';
export type {
  MilitaryConfig,
  ForceStructure,
  ProjectionInput,
  ProjectionResult,
  ForceValidationResult,
  RangeCheckInput,
  RangeCheckResult,
} from './force-structure';
export { MilitaryDoctrineEngine } from './military-doctrine';
export type {
  DoctrineConfig,
  HexContext,
  DoctrineBonus,
  ReadinessDecayInput,
  ReadinessDecayResult,
  CombatModifierInput,
  CombatModifierResult,
} from './military-doctrine';
export { SpecialCapabilitiesEngine } from './special-capabilities';
export type {
  SpecialCapsConfig,
  CapabilityExecutionInput,
  CapabilityExecutionResult,
  CapabilityEffect,
  CapabilityValidation,
  ModernizationInput,
  ModernizationResult,
  MilestoneUnlock,
} from './special-capabilities';

// ── CNFL-0020 — Psychological Engine Phase 2 ───────────────────────────────
export { PersonalityDriftEngine } from './personality-drift';
export type {
  PersonalityDriftConfig,
  StressDriftInput,
  StressDriftResult,
  TraumaInput,
  TraumaResult,
  BetrayalDriftInput,
  BetrayalDriftResult,
  VictoryDriftInput,
  VictoryDriftResult,
  NearLossDriftInput,
  NearLossDriftResult,
  InoculationInput,
  InoculationResult,
} from './personality-drift';
export { PsyOpsEngine } from './psyops';
export type {
  PsyOpsConfig,
  PsyOpInput,
  PsyOpResult,
  CounterIntelInput,
  CounterIntelResult,
  BehavioralSignal,
  BehavioralAssessmentInput,
  BehavioralAssessmentResult,
} from './psyops';
export { EchoChamberEngine } from './echo-chamber';
export type {
  EchoChamberConfig,
  EchoChamberInput,
  EchoChamberEffects,
  EchoChamberResult,
  SycophancyInput,
  SycophancyEffects,
  SycophancyResult,
  CombinedAssessmentInput,
  CombinedAssessmentResult,
} from './echo-chamber';
export { MassPsychologyEngine } from './mass-psychology';
export type {
  MassPsychConfig,
  ContagionInput,
  ContagionResult,
  WarWearinessInput,
  WarWearinessResult,
  MassPsychEffectsInput,
  MassPsychEffectsResult,
} from './mass-psychology';
export { GrudgeLedgerEngine } from './grudge-ledger';
export type {
  GrudgeLedgerConfig,
  AddGrudgeInput,
  AddGrudgeResult,
  DecayGrudgesInput,
  DecayGrudgesResult,
  RetaliationUtilityInput,
  RetaliationUtilityResult,
  ResolveGrudgeInput,
  ResolveGrudgeResult,
  DossierSection,
  DossierInput,
  DossierResult,
} from './grudge-ledger';

// ── CNFL-0021 · Sanctions Architecture & Financial Warfare ─────────────
export { SanctionsEngine } from './sanctions-engine';
export type {
  SanctionsConfig,
  SwiftDisconnectionInput,
  SwiftDisconnectionResult,
  SanctionTierInput,
  SanctionTierResult,
  SanctionsFatigueInput,
  SanctionsFatigueResult,
} from './sanctions-engine';
export { SecondarySanctionsEngine } from './secondary-sanctions';
export type {
  SecondarySanctionsConfig,
  SecondarySanctionInput,
  SecondarySanctionResult,
  EvasionNetworkInput,
  EvasionNetworkResult,
  CryptoInfraInput,
  CryptoInfraResult,
  CryptoDisruptionInput,
  CryptoDisruptionResult,
} from './secondary-sanctions';
export { FinancialWarfareEngine } from './financial-warfare';
export type {
  FinancialWarfareConfig,
  DebtTrapInput,
  DebtTrapResult,
  CurrencyManipulationInput,
  CurrencyManipulationResult,
} from './financial-warfare';
export { WarEconomyEngine } from './war-economy';
export type {
  WarEconomyConfig,
  WarEconomyInput,
  WarEconomyEffects,
  WarEconomyResult,
  GFSIInput,
  GFSIImpactBreakdown,
  GFSIResult,
  ContagionEffectsInput,
  ContagionEffectsResult,
} from './war-economy';

// ── CNFL-0022 · Technology Race & Strategic Innovation ─────────────────
export { TechIndexEngine } from './tech-index-engine';
export type {
  TechConfig,
  GetDomainLevelInput,
  CompoundingBonusInput,
  CompoundingBonusResult,
  InvestmentCostInput,
  InvestmentCostResult,
  DecayInput,
  DecayedDomain,
  DecayResult,
  TechEspionageInput,
  DiplomaticConsequences,
  TechEspionageResult,
} from './tech-index-engine';
export { ExportControlsEngine } from './export-controls-engine';
export type {
  ExportControlsConfig,
  ExportControlInput,
  ExportControlResult,
  SemiconductorChokepointInput,
  SemiconductorChokepointResult,
  CircumventionInput,
  CircumventionResult,
  CoalitionEligibilityInput,
  CoalitionEligibilityResult,
} from './export-controls-engine';
export { SpaceAIEngine } from './space-ai-engine';
export type {
  SpaceAIConfig,
  SpaceActionInput,
  SpaceActionResult,
  AISupremacyInput,
  AISupremacyResult,
  AIArmsRaceInput,
  AIArmsRaceResult,
  DebrisImpactInput,
  DebrisImpactResult,
} from './space-ai-engine';
export { TechDecouplingEngine } from './tech-decoupling-engine';
export type {
  TechDecouplingConfig,
  DecouplingInput,
  DecouplingResult,
  BlocMembershipInput,
  BlocMembershipResult,
  QuantumThreatInput,
  QuantumThreatResult,
  DualUseDilemmaInput,
  DualUseDilemmaResult,
} from './tech-decoupling-engine';

// ── CNFL-0023 · Climate, Resources & Humanitarian Crises ───────────────
export { MineralFoodEngine } from './mineral-food-engine';
export type {
  ResourcesConfig,
  ResourceSecurityInput,
  ResourceSecurityResult,
  MineralLeverageInput,
  MineralLeverageResult,
  MineralAlternativeInput,
  MineralAlternativeResult,
  FoodWeaponInput,
  FoodWeaponResult,
  StockpilingInput,
  StockpilingResult,
  ReserveDepletionInput,
  ReserveDepletionResult,
} from './mineral-food-engine';
export { ClimateRefugeeEngine } from './climate-refugee-engine';
export type {
  ClimateRefugeeConfig,
  ClimateEventInput,
  ClimateEventEffects,
  ClimateEventResult,
  ClimateEventProbabilityInput,
  ClimateEventProbabilityResult,
  RefugeeFlowInput,
  RefugeeFlowResult,
  RefugeeResponseInput,
  RefugeeResponseResult,
  WeaponizedMigrationInput,
  WeaponizedMigrationResult,
} from './climate-refugee-engine';
export { PandemicDiplomacyEngine } from './pandemic-diplomacy-engine';
export type {
  PandemicDiplomacyConfig,
  PandemicRiskInput,
  PandemicRiskResult,
  PandemicEffectsInput,
  PandemicEffectsResult,
  PandemicResponseInput,
  PandemicResponseResult,
  EnvironmentalDiplomacyInput,
  EnvironmentalDiplomacyResult,
  EnvironmentalPariahInput,
  EnvironmentalPariahResult,
} from './pandemic-diplomacy-engine';

// ── CNFL-0024 — Proxy War Network & Non-State Actors (FR-2000) ──────────────
export { ProxyNetworkEngine } from './proxy-network-engine';
export type {
  ProxyConfig,
  DiscoveryProbabilityInput,
  DiscoveryProbabilityResult,
  DiscoveryConsequencesInput,
  DiscoveryConsequencesResult,
  ProxyOperationInput,
  ProxyOperationResult,
  ArmingEffectsInput,
  ArmingEffectsResult,
} from './proxy-network-engine';
export { ProxyAutonomyEngine } from './proxy-autonomy-engine';
export type {
  ProxyAutonomyConfig,
  AutonomousOperationInput,
  AutonomousOperationResult,
  DefectionRiskInput,
  DefectionRiskResult,
  IndependenceInput,
  IndependenceResult,
  DeniabilityDegradationInput,
  DeniabilityDegradationResult,
  BlowbackInput,
  BlowbackResult as ProxyBlowbackResult,
} from './proxy-autonomy-engine';
export { ArmsFailedStateEngine } from './arms-failedstate-engine';
export type {
  ArmsFailedStateConfig,
  BlackMarketPurchaseInput,
  BlackMarketPurchaseResult,
  SurplusSaleInput,
  SurplusSaleResult,
  FailedStateInput,
  FailedStateResult,
  FailedStateExploitationInput,
  FailedStateExploitationResult,
  StabilizationEffortInput,
  StabilizationEffortResult,
  ProxySpawnCheckInput,
  ProxySpawnCheckResult,
} from './arms-failedstate-engine';
export { TerroristEscalationEngine } from './terrorist-escalation-engine';
export type {
  TerroristEscalationConfig,
  TerroristDiscoveryInput,
  TerroristDiscoveryResult,
  WarOnTerrorInput,
  WarOnTerrorResult,
  EscalationLevelInput,
  EscalationLevelResult,
  EscalationStepInput,
  EscalationStepResult,
  TerroristProxyConstraintsInput,
  TerroristProxyConstraintsResult,
} from './terrorist-escalation-engine';

// ─────────────────────────────────────────────────────────────────────────────
// CNFL-0025 — Strategic Advisory Phase 2 (FR-1400 Expansion)
// ─────────────────────────────────────────────────────────────────────────────

export { ProjectionWhatIfEngine } from './projection-whatif-engine';
export type {
  ProjectionConfig,
  MetricProjection,
  HorizonProjection,
  MultiHorizonProjectionInput,
  MultiHorizonProjectionResult,
  WhatIfActionDelta,
  WhatIfSimulationInput,
  WhatIfSimulationResult,
  SingleHorizonInput,
} from './projection-whatif-engine';

export { RivalPivotEngine } from './rival-pivot-engine';
export type {
  RivalPivotConfig,
  RivalVictoryEstimate,
  RivalTrajectoryInput,
  RivalLeaderboardEntry,
  RivalLeaderboardInput,
  RivalLeaderboardResult,
  PivotHistoryEntry,
  StrategicPivotInput,
  StrategicPivotResult,
  CrossroadsNotificationInput,
  CrossroadsNotificationResult,
} from './rival-pivot-engine';

export { StrategyScoringEngine } from './strategy-scoring-engine';
export type {
  StrategyScoringConfig,
  ConsistencyWindowEntry,
  ConsistencyEvaluationInput,
  ConsistencyEvaluationResult,
  CompositeScoreInput,
  CompositeScoreResult,
  PresetWeighting,
  PresetSelectionInput,
  PresetSelectionResult,
  PresetSwitchInput,
  PresetSwitchResult,
} from './strategy-scoring-engine';

export { InsurrectionCivilWarEngine } from './insurrection-civilwar-engine';
export type {
  InsurrectionCivilWarConfig,
  InsurrectionOnsetResult,
  InsurrectionEffectsResult,
  CivilWarOnsetResult,
  CivilWarEffectsResult,
  EthnicFundingResult,
  MilitaryLoyaltySplitResult,
} from './insurrection-civilwar-engine';

export { RegimePowerBaseEngine } from './regime-powerbase-engine';
export type {
  RegimePowerBaseConfig,
  MartialLawResult as RegimeMartialLawResult,
  RegimeChangeTriggerResult,
  RegimeChangeResult,
  PowerBaseErosionResult,
  HostileFactionResult,
  CoupAttemptResult,
  PowerBaseSnapshotResult,
} from './regime-powerbase-engine';

export { AiPerceptionEngine } from './ai-perception-engine';
export type {
  AiPerceptionConfig,
  AiPerceptionEntry,
  AiPerceptionState,
  CounterStrategyResult,
  PerceivedProfileResult,
  FactionAiProfile,
  DesperationModeResult,
  PerceptionDriftSummary,
} from './ai-perception-engine';

export { LeaderExpansionEngine } from './leader-expansion-engine';
export type {
  LeaderExpansionConfig,
  SliderMetadata,
  SliderMetadataCollection,
  SliderPreviewResult,
  VulnerabilityTriggerResult,
  VulnerabilityEffectResult,
  OngoingVulnerabilityResult,
  LeaderBalanceAssessment,
  ArchetypeDeviationResult,
} from './leader-expansion-engine';

// ─────────────────────────────────────────────────────────────────────────────
// CNFL-0028 — Phase 3: Polish, Post-Game Analysis & Extensibility
// ─────────────────────────────────────────────────────────────────────────────

export { StrategicAnalysisEngine } from './strategic-analysis-engine';
export type {
  StrategicAnalysisConfig,
  TurnViabilitySnapshot,
  ViabilityTimelineResult,
  InflectionPoint,
  InflectionPointResult,
  RoadNotTakenProjection,
  RoadNotTakenResult,
  StrategicGradeResult,
  ReportSummaryResult,
} from './strategic-analysis-engine';

export { PsychologicalJourneyEngine } from './psychological-journey-engine';
export type {
  PsychologicalJourneyConfig,
  EmotionalTimelineEntry,
  EmotionalTimelineResult,
  RadarDimension,
  PersonalityRadarResult,
  GrudgeTimelineInput,
  GrudgeTimelineEntry,
  GrudgeTimelineResult,
  PsychologicalTurningPoint,
  TurningPointResult,
  DriftEventSummary,
  DriftSummaryResult,
  JourneySummaryResult,
} from './psychological-journey-engine';

export { ScenarioDifficultyUNEngine } from './scenario-difficulty-un-engine';
export type {
  ScenarioDifficultyUNConfig,
  ScenarioEntry,
  ScenarioListResult,
  ScenarioValidationResult,
  DifficultyScalingResult,
  ResolutionProposalResult,
  FactionVoteResult,
  ResolutionEffects,
  ResolutionOutcomeResult,
  ResolutionExpiryResult,
} from './scenario-difficulty-un-engine';

export { DoubleAgentJapanEngine } from './double-agent-japan-engine';
export type {
  DoubleAgentJapanConfig,
  DetectionResult,
  TurnAttemptResult,
  DisinformationResult,
  ExpulsionResult,
  NuclearRnDResult,
  AmendmentResult,
  NuclearCascadeResult,
} from './double-agent-japan-engine';

export { VisualizationDataEngine } from './visualization-data-engine';
export type {
  VisualizationConfig,
  ProxyNodeInput,
  ProxyEdgeInput,
  TechScoreInput,
  ResourceSecurityInput as VizResourceSecurityInput,
  SanctionsDataPoint,
  NarrativeEventInput,
  VisualizationSummaryInput,
  ProxyNodeOutput,
  ProxyEdgeOutput,
  ProxyNetworkGraphResult,
  TechRanking,
  TechRaceDashboardResult,
  ResourceSecurityEntry,
  ResourceSecurityMapResult,
  SanctionsTimelineResult,
  NarrativeReplayEntry,
  NarrativeBattleReplayResult,
  VisualizationSummaryResult,
} from './visualization-data-engine';

export { TutorialModdingEngine } from './tutorial-modding-engine';
export type {
  TutorialModdingConfig,
  TutorialPhaseResult,
  TutorialSkipResult,
  HotkeyEntry,
  KeyboardNavigationResult,
  AccessibilityReportResult,
  LeaderExportPayload,
  ExportLeaderResult,
  ImportValidationResult,
  EventHandlerResult,
} from './tutorial-modding-engine';

// ── Stock Market & Index Integration (CNFL-4106, CNFL-4203) ─────────────
export { MarketTurnIntegration } from './market-turn-integration';
export type {
  MarketSignals,
  MarketTurnInput,
  MarketTurnOutput,
} from './market-turn-integration';
export { IndexCrossFeed } from './index-cross-feed';
export type {
  IndexFeedModifier,
  FactionCrossFeeds,
  CrossFeedConfig,
} from './index-cross-feed';

// ── Tech–Research Integration (CNFL-4303) ───────────────────────────────
export { TechResearchIntegration } from './tech-research-integration';
export type {
  TechResearchIntegrationInput,
  TechResearchIntegrationResult,
  ResearchSpeedInput,
} from './tech-research-integration';

// ── Standalone Engines (CNFL-4000–4402) ─────────────────────────────────
export { StockMarketEngine } from './stock-market-engine';
export type {
  StockMarketConfig,
  GameMarketEvent,
  TradeLinkage,
  GlobalSentiment,
  MarketTurnResult,
} from './stock-market-engine';
export { MarketIndexEngine } from './market-index-engine';
export type { MarketIndexConfig } from './market-index-engine';
export { TechModuleFactory } from './tech-module-factory';
export type {
  DiscoveryContext,
  ComputedResearchFields,
  GeneratedTechModule,
  TechDiscoveryLogEntry,
  GenerateModuleResult,
  ImportModuleResult,
  TechPackage,
  TechLeaderboardEntry,
} from './tech-module-factory';
export { ScenarioScoringEngine } from './scenario-scoring-engine';
export type {
  ScoringWeights,
  GameMetrics,
  GradeCutoffs,
  HistoricalScore,
  AIComparisonResult,
  ScoreBreakdown as ScoringScoreBreakdown,
} from './scenario-scoring-engine';
export { ScenarioHistoryRecorder } from './scenario-history-recorder';
export type {
  GameAction as HistoryGameAction,
  GameEvent as HistoryGameEvent,
  TurnMetricsSnapshot,
  TurnRecord,
  ScenarioHistoryArchive,
  TimeSeriesRow,
  ScenarioComparisonData,
  DivergencePoint,
  MarketTimelineEntry,
  ScenarioComparisonResult as HistoryComparisonResult,
} from './scenario-history-recorder';

// ── Scenario Comparison Engine (CNFL-4403) ──────────────────────────────
export { ScenarioComparisonEngine } from './scenario-comparison-engine';
export type {
  ScenarioSummary,
  TrajectoryPoint,
  TrajectoryComparison,
  ScenarioMarketPerformance,
  MarketComparisonResult,
  ComparisonDivergencePoint,
  PairwiseDelta,
  ComparisonReport,
  ComparisonConfig,
} from './scenario-comparison-engine';

// ── Scenario Turn Integration (CNFL-4404) ───────────────────────────────
export { ScenarioTurnIntegration } from './scenario-turn-integration';
export type {
  RecordTurnInput,
  RecordTurnResult,
  CompleteScenarioInput,
  CompleteScenarioResult,
  ScenarioIntegrationConfig,
} from './scenario-turn-integration';

// ── AI Integration Layer (CNFL-0036) ────────────────────────────────────
export {
  // Core
  type AIProvider,
  type AIMessage,
  type AIRequest,
  type AIResponse,
  type AIChunk,
  type ModelInfo,
  type AIProviderConfig,
  type AIErrorCode,
  type AIAdapter,
  AIError,
  createAdapter,
  getRegisteredProviders,
  costTracker,
  CostTracker,
  // Provider adapters
  OpenAIAdapter,
  GeminiAdapter,
  ClaudeAdapter,
  OpenRouterAdapter,
  OllamaAdapter,
  // Suggestion Engine
  type AISuggestion,
  type SuggestionResult,
  type SuggestionContext,
  AISuggestionEngine,
  // Diplomacy Engine
  type DiplomacyPersonality,
  type DiplomacyEmotions,
  type DiplomacyRelationship,
  type NegotiationSession,
  type NegotiationResponse,
  type ExtractedAction,
  AIDiplomacyEngine,
} from './ai/index';

// ── Headless Runner (CNFL-3900) ─────────────────────────────────────────
export { runHeadless } from './headless-runner';
export type {
  HeadlessRunConfig,
  HeadlessRunResult,
  TurnSnapshot,
  TurnStatEntry,
  ExecutionMode,
  ExecutionSpeed,
  DecisionCallback,
  ProgressCallback,
} from './headless-runner';

// ── AI Autonomous Player (CNFL-3901) ────────────────────────────────────
export { AutonomousPlayer } from './ai/ai-autonomous-player';
export type { AutonomousPlayerConfig, TurnDecisions } from './ai/ai-autonomous-player';

// ── Results Analyzer (CNFL-3903) ────────────────────────────────────────
export { ResultsAnalyzer } from './results-analyzer';
export type {
  AnalysisResult,
  ExecutiveSummary,
  NationScorecard,
  EventTimeline,
  StatisticalSummary,
  ComparisonMetrics,
} from './results-analyzer';

// ── Live Data Engine (FR-4400) ──────────────────────────────────────────
export {
  blendValue,
  applyEconomicData,
  applyMilitaryData,
  applyTechnologyData,
  applyCurrencyData,
  applyLiveDataToScenario,
  cacheLiveData,
  getCachedLiveData,
  clearLiveDataCache,
  createDefaultLiveDataConfig,
} from './live-data-engine';
export type { LiveDataPatchSummary } from './live-data-engine';

// ── Currency Exchange Rate Engine (FR-3800) ─────────────────────────────
export {
  initializeCurrencyState,
  applyEventToRate,
  applyCurrencyManipulation,
  processEndOfTurnCurrency,
  getCurrencyTopMovers,
  getCrossRateMatrix,
} from './currency-engine';

export {
  fetchAllLiveData,
  fetchEconomicData,
  fetchMilitaryData,
  fetchDiplomaticData,
  fetchTechnologyData,
  fetchMarketData,
} from './live-data-fetcher';

// ── Macroeconomic Expansion (FR-7000–7005) ──────────────────────────────
export {
  initCommodityPrices,
  initShippingState,
  initTradeLedger,
  initConsumerBehavior,
  initNationEconomicState,
  updateCommodityPrices,
  updateShippingState,
  updateTradeLedger,
  updateConsumerBehavior,
  computeCommodityInflationDelta,
  avgCommodityIndex,
  processCommodityTurn,
} from './commodity-engine';
export {
  initNationalDebt,
  computeCreditRating,
  processDebtTurn,
  computeGlobalDebt,
} from './national-debt-engine';
export {
  initChaoticEventState,
  generateChaoticEvents,
  processChaoticEvents,
  activateDisasterResponse,
  getActiveSeverityForFaction,
} from './chaotic-events-engine';
export type {
  EventGenerationContext,
  ChaoticEventTurnResult,
  ProcessEventsInput,
} from './chaotic-events-engine';