/**
 * Shared enums and constants for New Order.
 *
 * These enums are referenced across every data-requirement module
 * (DR-101 – DR-140) and form the canonical vocabulary of the simulation.
 */

// ---------------------------------------------------------------------------
// Factions & Nations
// ---------------------------------------------------------------------------

/**
 * The 8 playable / AI-controlled factions.
 * Used as row/column keys in the Relationship Matrix (DR-101) and throughout.
 */
export const FactionId = {
  US: 'us',
  China: 'china',
  Russia: 'russia',
  Japan: 'japan',
  Iran: 'iran',
  DPRK: 'dprk',
  EU: 'eu',
  Syria: 'syria',
} as const;

export type FactionId = (typeof FactionId)[keyof typeof FactionId];

/** Ordered tuple of all faction IDs — useful for matrix iteration. */
export const ALL_FACTIONS: readonly FactionId[] = [
  FactionId.US,
  FactionId.China,
  FactionId.Russia,
  FactionId.Japan,
  FactionId.Iran,
  FactionId.DPRK,
  FactionId.EU,
  FactionId.Syria,
] as const;

/** Total number of factions in the default scenario. */
export const FACTION_COUNT = 8 as const;

// ---------------------------------------------------------------------------
// Military (DR-103, DR-110)
// ---------------------------------------------------------------------------

/** Unit classifications present on the hex map. */
export const UnitType = {
  Infantry: 'Infantry',
  Armor: 'Armor',
  Naval: 'Naval',
  Air: 'Air',
  CyberWarfare: 'CyberWarfare',
  HypersonicMissile: 'HypersonicMissile',
  FishingFleet: 'FishingFleet',
  MobileNuclearLauncher: 'MobileNuclearLauncher',
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

/** Military doctrine archetypes. */
export const Doctrine = {
  Defensive: 'Defensive',
  Offensive: 'Offensive',
  Hybrid: 'Hybrid',
  Asymmetric: 'Asymmetric',
  Nuclear: 'Nuclear',
} as const;

export type Doctrine = (typeof Doctrine)[keyof typeof Doctrine];

/** Named national military doctrine identifiers. @see FR-1003 */
export const DoctrineId = {
  A2AD: 'A2AD',
  AsymmetricSwarm: 'AsymmetricSwarm',
  FortressKorea: 'FortressKorea',
  GlobalReach: 'GlobalReach',
  EscalationDominance: 'EscalationDominance',
  CollectiveDefense: 'CollectiveDefense',
  MaritimeShield: 'MaritimeShield',
  StrategicPatience: 'StrategicPatience',
} as const;

export type DoctrineId = (typeof DoctrineId)[keyof typeof DoctrineId];

/** Special capability action identifiers. @see FR-1005 */
export const SpecialCapabilityType = {
  DroneSwarm: 'DroneSwarm',
  ArtilleryBarrageSeoul: 'ArtilleryBarrageSeoul',
  CarrierKillerSalvo: 'CarrierKillerSalvo',
} as const;

export type SpecialCapabilityType = (typeof SpecialCapabilityType)[keyof typeof SpecialCapabilityType];

// ---------------------------------------------------------------------------
// Terrain (DR-102)
// ---------------------------------------------------------------------------

/** Terrain classification for each hex. */
export const TerrainType = {
  Mountain: 'Mountain',
  Urban: 'Urban',
  Desert: 'Desert',
  Plains: 'Plains',
  Forest: 'Forest',
  Coastal: 'Coastal',
  Island: 'Island',
  Arctic: 'Arctic',
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

// ---------------------------------------------------------------------------
// Leader Psychology (DR-108, DR-119 – DR-124)
// ---------------------------------------------------------------------------

/** How a leader approaches decisions. */
export const DecisionStyle = {
  Transactional: 'Transactional',
  Analytical: 'Analytical',
  Intuitive: 'Intuitive',
  Ideological: 'Ideological',
} as const;

export type DecisionStyle = (typeof DecisionStyle)[keyof typeof DecisionStyle];

/** How a leader responds under pressure. */
export const StressResponse = {
  Escalate: 'Escalate',
  Consolidate: 'Consolidate',
  Deflect: 'Deflect',
  Retreat: 'Retreat',
} as const;

export type StressResponse = (typeof StressResponse)[keyof typeof StressResponse];

/** Cognitive bias archetypes (DR-120). */
export const BiasType = {
  SunkCost: 'SunkCost',
  ConfirmationBias: 'ConfirmationBias',
  Groupthink: 'Groupthink',
  Anchoring: 'Anchoring',
  LossAversion: 'LossAversion',
  Optimism: 'Optimism',
  AvailabilityHeuristic: 'AvailabilityHeuristic',
  DunningKruger: 'DunningKruger',
  Recency: 'Recency',
  EscalationOfCommitment: 'EscalationOfCommitment',
} as const;

export type BiasType = (typeof BiasType)[keyof typeof BiasType];

/** Interaction tone (used in chemistry & grudge ledger). */
export const InteractionTone = {
  Friendly: 'Friendly',
  Neutral: 'Neutral',
  Cold: 'Cold',
  Hostile: 'Hostile',
  Threatening: 'Threatening',
} as const;

export type InteractionTone = (typeof InteractionTone)[keyof typeof InteractionTone];

// ---------------------------------------------------------------------------
// Psychological Operations (FR-1512)
// ---------------------------------------------------------------------------

/** PsyOp action types that target rival leader emotional states. @see FR-1512 */
export const PsyOpType = {
  PublicHumiliation: 'PublicHumiliation',
  StrategicAmbiguity: 'StrategicAmbiguity',
  DiplomaticGhosting: 'DiplomaticGhosting',
  ProvocativePosturing: 'ProvocativePosturing',
} as const;

export type PsyOpType = (typeof PsyOpType)[keyof typeof PsyOpType];

/** Psychological counter-intelligence action types. @see FR-1513 */
export const CounterIntelType = {
  MediaCounterNarrative: 'MediaCounterNarrative',
  EmotionalDiscipline: 'EmotionalDiscipline',
  IntelligenceInoculation: 'IntelligenceInoculation',
} as const;

export type CounterIntelType = (typeof CounterIntelType)[keyof typeof CounterIntelType];

// ---------------------------------------------------------------------------
// Trauma & Personality Drift (FR-1505, FR-1506)
// ---------------------------------------------------------------------------

/** Catastrophic event types that trigger trauma response. @see FR-1506 */
export const TraumaType = {
  NuclearStrike: 'NuclearStrike',
  AssassinationAttempt: 'AssassinationAttempt',
  CapitalSiege: 'CapitalSiege',
} as const;

export type TraumaType = (typeof TraumaType)[keyof typeof TraumaType];

/** Offense types that create grudge ledger entries. @see FR-1510 */
export const OffenseType = {
  Betrayal: 'Betrayal',
  Insult: 'Insult',
  Aggression: 'Aggression',
  Sanctions: 'Sanctions',
  EspionageDiscovered: 'EspionageDiscovered',
} as const;

export type OffenseType = (typeof OffenseType)[keyof typeof OffenseType];

// ---------------------------------------------------------------------------
// Civil Unrest & Domestic (DR-112)
// ---------------------------------------------------------------------------

/** Progressive escalation stages for civil unrest. */
export const EscalationStage = {
  Grumbling: 'Grumbling',
  Protests: 'Protests',
  Riots: 'Riots',
  Insurrection: 'Insurrection',
  CivilWar: 'CivilWar',
} as const;

export type EscalationStage = (typeof EscalationStage)[keyof typeof EscalationStage];

/** Outcome of a coup attempt. @see FR-1311 */
export const CoupOutcome = {
  Success: 'Success',
  Failed: 'Failed',
  Averted: 'Averted',
} as const;

export type CoupOutcome = (typeof CoupOutcome)[keyof typeof CoupOutcome];

/** How a regime change occurred. @see FR-1309 */
export const RegimeChangeType = {
  CivilUnrest: 'CivilUnrest',
  StabilityCollapse: 'StabilityCollapse',
  Coup: 'Coup',
  Exile: 'Exile',
} as const;

export type RegimeChangeType = (typeof RegimeChangeType)[keyof typeof RegimeChangeType];

/** Nation split status during civil war. @see FR-1302 */
export const NationSplitStatus = {
  Intact: 'Intact',
  Split: 'Split',
  Reunified: 'Reunified',
} as const;

export type NationSplitStatus = (typeof NationSplitStatus)[keyof typeof NationSplitStatus];

/** Power base sub-faction categories. @see FR-1310 */
export const PowerBaseCategory = {
  Military: 'Military',
  Oligarchs: 'Oligarchs',
  Party: 'Party',
  Clergy: 'Clergy',
  Public: 'Public',
  SecurityServices: 'SecurityServices',
} as const;

export type PowerBaseCategory = (typeof PowerBaseCategory)[keyof typeof PowerBaseCategory];

// ---------------------------------------------------------------------------
// Information Warfare (DR-125 – DR-127, DR-139)
// ---------------------------------------------------------------------------

/** Media ecosystem classification per-nation. */
export const MediaEcosystemType = {
  FreePress: 'FreePress',
  StateMedia: 'StateMedia',
  ClosedSystem: 'ClosedSystem',
  Fragmented: 'Fragmented',
} as const;

export type MediaEcosystemType = (typeof MediaEcosystemType)[keyof typeof MediaEcosystemType];

/** Narrative campaign archetypes. */
export const NarrativeType = {
  Victimhood: 'Victimhood',
  Liberation: 'Liberation',
  EconomicJustice: 'EconomicJustice',
  HistoricalGrievance: 'HistoricalGrievance',
} as const;

export type NarrativeType = (typeof NarrativeType)[keyof typeof NarrativeType];

/** Deepfake operation types. @see FR-1604 */
export const DeepfakeType = {
  FabricateStatements: 'FabricateStatements',
  FakeAtrocityEvidence: 'FakeAtrocityEvidence',
  SyntheticIntelligence: 'SyntheticIntelligence',
} as const;

export type DeepfakeType = (typeof DeepfakeType)[keyof typeof DeepfakeType];

/** Content categories driving virality. @see FR-1603 */
export const ContentCategory = {
  Violence: 'Violence',
  Scandal: 'Scandal',
  Triumph: 'Triumph',
} as const;

export type ContentCategory = (typeof ContentCategory)[keyof typeof ContentCategory];

/** Player choice when confronted with a whistleblower event. @see FR-1607 */
export const WhistleblowerChoice = {
  Suppress: 'Suppress',
  Acknowledge: 'Acknowledge',
} as const;

export type WhistleblowerChoice = (typeof WhistleblowerChoice)[keyof typeof WhistleblowerChoice];

/** Headline perspective outlets (DR-107). */
export const HeadlinePerspective = {
  WesternPress: 'WesternPress',
  StatePropaganda: 'StatePropaganda',
  Intelligence: 'Intelligence',
} as const;

export type HeadlinePerspective = (typeof HeadlinePerspective)[keyof typeof HeadlinePerspective];

// ---------------------------------------------------------------------------
// Sanctions & Finance (DR-128, DR-129, DR-137)
// ---------------------------------------------------------------------------

/** Sanction severity tiers. */
export const SanctionTier = {
  Targeted: 'Targeted',
  Sectoral: 'Sectoral',
  Comprehensive: 'Comprehensive',
} as const;

export type SanctionTier = (typeof SanctionTier)[keyof typeof SanctionTier];

/** SWIFT connection status for a nation. */
export const SwiftStatus = {
  Connected: 'Connected',
  PartiallyDisconnected: 'PartiallyDisconnected',
  FullyDisconnected: 'FullyDisconnected',
} as const;

export type SwiftStatus = (typeof SwiftStatus)[keyof typeof SwiftStatus];

/** Currency manipulation action types. @see FR-1706 */
export const CurrencyManipulationType = {
  Devaluation: 'Devaluation',
  ReserveWeaponization: 'ReserveWeaponization',
  CurrencyAttack: 'CurrencyAttack',
} as const;

export type CurrencyManipulationType = (typeof CurrencyManipulationType)[keyof typeof CurrencyManipulationType];

/** Debt-trap loan lifecycle status. @see FR-1705 */
export const DebtTrapStatus = {
  BoostPhase: 'BoostPhase',
  RepaymentDue: 'RepaymentDue',
  Servicing: 'Servicing',
  Defaulted: 'Defaulted',
  BailedOut: 'BailedOut',
} as const;

export type DebtTrapStatus = (typeof DebtTrapStatus)[keyof typeof DebtTrapStatus];

/** War economy mobilization phase. @see FR-1707 */
export const WarEconomyPhase = {
  Peacetime: 'Peacetime',
  Mobilized: 'Mobilized',
  Exhausted: 'Exhausted',
  Recession: 'Recession',
} as const;

export type WarEconomyPhase = (typeof WarEconomyPhase)[keyof typeof WarEconomyPhase];

/** Third-party response to secondary sanctions. @see FR-1703 */
export const SecondarySanctionResponse = {
  Comply: 'Comply',
  Defy: 'Defy',
} as const;

export type SecondarySanctionResponse = (typeof SecondarySanctionResponse)[keyof typeof SecondarySanctionResponse];

// ---------------------------------------------------------------------------
// Technology Race (DR-130, DR-131, DR-138)
// ---------------------------------------------------------------------------

/** The six technology domains tracked per nation. */
export const TechDomain = {
  AI: 'AI',
  Semiconductors: 'Semiconductors',
  Space: 'Space',
  Cyber: 'Cyber',
  Biotech: 'Biotech',
  Quantum: 'Quantum',
} as const;

export type TechDomain = (typeof TechDomain)[keyof typeof TechDomain];

/** Tech bloc alignment categories. */
export const TechBlocAlignment = {
  USLed: 'US-led',
  ChinaLed: 'China-led',
  NonAligned: 'non-aligned',
} as const;

export type TechBlocAlignment = (typeof TechBlocAlignment)[keyof typeof TechBlocAlignment];

/** Global technology ecosystem decoupling status. */
export const DecouplingStatus = {
  Unified: 'unified',
  Bifurcated: 'bifurcated',
} as const;

export type DecouplingStatus = (typeof DecouplingStatus)[keyof typeof DecouplingStatus];

/** Export control enforcement type. @see FR-1803 */
export const ExportControlType = {
  Unilateral: 'unilateral',
  Multilateral: 'multilateral',
} as const;

export type ExportControlType = (typeof ExportControlType)[keyof typeof ExportControlType];

/** Circumvention methods for bypassing export controls. @see FR-1803 */
export const CircumventionMethod = {
  Espionage: 'espionage',
  ThirdPartyTransshipment: 'third-party-transshipment',
  DomesticSubstitution: 'domestic-substitution',
} as const;

export type CircumventionMethod = (typeof CircumventionMethod)[keyof typeof CircumventionMethod];

/** Space domain action types. @see FR-1804 */
export const SpaceAction = {
  DeploySatellite: 'deploy-satellite',
  ASAT: 'asat',
  GPSDisruption: 'gps-disruption',
} as const;

export type SpaceAction = (typeof SpaceAction)[keyof typeof SpaceAction];

/** Dual-use technology dilemma choices. @see FR-1808 */
export const DualUseChoice = {
  Sign: 'sign',
  Refuse: 'refuse',
  SecretViolate: 'secret-violate',
} as const;

export type DualUseChoice = (typeof DualUseChoice)[keyof typeof DualUseChoice];

// ---------------------------------------------------------------------------
// Climate & Resources (DR-132 – DR-134)
// ---------------------------------------------------------------------------

/** Climate event categories. */
export const ClimateEventType = {
  HeatWave: 'HeatWave',
  Flooding: 'Flooding',
  Drought: 'Drought',
  Typhoon: 'Typhoon',
  ArcticCollapse: 'ArcticCollapse',
  Wildfire: 'Wildfire',
  Earthquake: 'Earthquake',
} as const;

export type ClimateEventType = (typeof ClimateEventType)[keyof typeof ClimateEventType];

/** Refugee flow response type. */
export const RefugeeResponse = {
  Accept: 'accept',
  Reject: 'reject',
  Weaponized: 'weaponized',
} as const;

export type RefugeeResponse = (typeof RefugeeResponse)[keyof typeof RefugeeResponse];

/** Cause of refugee displacement. */
export const RefugeeCause = {
  War: 'war',
  Famine: 'famine',
  Climate: 'climate',
  Unrest: 'unrest',
} as const;

export type RefugeeCause = (typeof RefugeeCause)[keyof typeof RefugeeCause];

/** Methods for bypassing mineral import dependency. @see FR-1902 */
export const MineralAlternative = {
  DomesticMining: 'DomesticMining',
  DeepSeaMining: 'DeepSeaMining',
  Recycling: 'Recycling',
} as const;

export type MineralAlternative = (typeof MineralAlternative)[keyof typeof MineralAlternative];

/** National response to a global pandemic. @see FR-1905 */
export const PandemicResponse = {
  Cooperate: 'Cooperate',
  Hoard: 'Hoard',
  BorderClose: 'BorderClose',
} as const;

export type PandemicResponse = (typeof PandemicResponse)[keyof typeof PandemicResponse];

/** Types of environmental diplomacy agreements. @see FR-1908 */
export const EnvironmentalDiplomacyType = {
  ClimateAccords: 'ClimateAccords',
  ResourceSharingTreaty: 'ResourceSharingTreaty',
  JointDisasterResponse: 'JointDisasterResponse',
} as const;

export type EnvironmentalDiplomacyType =
  (typeof EnvironmentalDiplomacyType)[keyof typeof EnvironmentalDiplomacyType];

// ---------------------------------------------------------------------------
// Nuclear Escalation (FR-500)
// ---------------------------------------------------------------------------

/** Three-band nuclear escalation classification. @see FR-501 */
export const NuclearEscalationBand = {
  /** 0–30: Signal tests, posturing. No launch authorization. */
  Deterrence: 'Deterrence',
  /** 31–70: Existential threat zone. Mobile launchers, low-yield options. */
  TacticalReadiness: 'TacticalReadiness',
  /** 71–100: Capital threatened or stability critical. Strike possible. */
  ThresholdBreach: 'ThresholdBreach',
} as const;

export type NuclearEscalationBand =
  (typeof NuclearEscalationBand)[keyof typeof NuclearEscalationBand];

/** Types of nuclear-related actions. @see FR-500 */
export const NuclearActionType = {
  /** Signal test or posturing (Deterrence band only). @see FR-502 */
  SignalTest: 'SignalTest',
  /** Reposition mobile launchers (Tactical Readiness). @see FR-503 */
  MobileLauncherReposition: 'MobileLauncherReposition',
  /** Prepare low-yield tactical options (Tactical Readiness). @see FR-503 */
  PrepareTacticalOptions: 'PrepareTacticalOptions',
  /** Demonstration strike on remote military target (Threshold Breach). @see FR-504 */
  DemonstrationStrike: 'DemonstrationStrike',
  /** Full first strike (Threshold Breach). @see FR-505 */
  FirstStrike: 'FirstStrike',
  /** Automated second-strike counter-attack. @see FR-505 */
  SecondStrike: 'SecondStrike',
  /** Red Telephone de-escalation. @see FR-507 */
  RedTelephone: 'RedTelephone',
  /** Iran dirty bomb. @see FR-506 */
  DirtyBomb: 'DirtyBomb',
} as const;

export type NuclearActionType =
  (typeof NuclearActionType)[keyof typeof NuclearActionType];

// ---------------------------------------------------------------------------
// Intelligence & Espionage (FR-900)
// ---------------------------------------------------------------------------

/** Intelligence sub-score categories. @see FR-901 */
export const IntelSubScore = {
  /** Human intelligence — agents, assets, informants. */
  HUMINT: 'HUMINT',
  /** Signals intelligence — communications intercepts, electronic surveillance. */
  SIGINT: 'SIGINT',
  /** Cyber intelligence — network exploitation, digital espionage. */
  CYBER: 'CYBER',
  /** Covert operations — clandestine action, plausible deniability. */
  COVERT: 'COVERT',
} as const;

export type IntelSubScore = (typeof IntelSubScore)[keyof typeof IntelSubScore];

/** Intelligence operation types available to factions. @see FR-903 */
export const IntelOperationType = {
  /** Increase clarity on a target nation. */
  Gather: 'Gather',
  /** Reduce rival clarity on own nation. */
  Counterintel: 'Counterintel',
  /** Plant a long-term source for +5 HUMINT per turn. */
  RecruitAsset: 'RecruitAsset',
  /** Reduce a target stat via CYBER or COVERT roll. */
  Sabotage: 'Sabotage',
} as const;

export type IntelOperationType = (typeof IntelOperationType)[keyof typeof IntelOperationType];

// ---------------------------------------------------------------------------
// Diplomacy & Alliances (FR-700)
// ---------------------------------------------------------------------------

/** Types of bilateral agreements between factions. @see FR-701 */
export const AgreementType = {
  /** Non-Aggression Pact — parties agree not to attack each other. */
  NAP: 'NAP',
  /** Trade Deal — economic cooperation and shared growth. */
  TradeDeal: 'TradeDeal',
  /** Defense Pact — mutual defense obligation. */
  DefensePact: 'DefensePact',
  /** Intelligence Sharing — joint intel gathering and sharing. */
  IntelSharing: 'IntelSharing',
} as const;

export type AgreementType = (typeof AgreementType)[keyof typeof AgreementType];

/** Lifecycle status of a bilateral agreement. @see FR-701 */
export const AgreementStatus = {
  /** Proposed but not yet accepted. */
  Proposed: 'Proposed',
  /** Active and in effect. */
  Active: 'Active',
  /** Rejected by target. */
  Rejected: 'Rejected',
  /** Expired after duration elapsed. */
  Expired: 'Expired',
  /** Breached/broken by one party. */
  Breached: 'Breached',
  /** Mutually terminated. */
  Terminated: 'Terminated',
} as const;

export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];

// ---------------------------------------------------------------------------
// Proxy Wars & Non-State Actors (DR-135, DR-136, DR-140)
// ---------------------------------------------------------------------------

/** Proxy escalation ladder (1–4 mapped to semantic labels). */
export const ProxyEscalationLevel = {
  ShadowWar: 1,
  AcknowledgedSupport: 2,
  LimitedIntervention: 3,
  DirectConfrontation: 4,
} as const;

export type ProxyEscalationLevel =
  (typeof ProxyEscalationLevel)[keyof typeof ProxyEscalationLevel];

/** Non-state actor categories. */
export const NonStateActorType = {
  Militia: 'Militia',
  TerroristGroup: 'TerroristGroup',
  SeparatistMovement: 'SeparatistMovement',
  CyberCollective: 'CyberCollective',
  MercenaryGroup: 'MercenaryGroup',
  PoliticalMovement: 'PoliticalMovement',
} as const;

export type NonStateActorType = (typeof NonStateActorType)[keyof typeof NonStateActorType];

/** Proxy operation types available to sponsors. @see FR-2002 */
export const ProxyOperationType = {
  Activate: 'Activate',
  Arm: 'Arm',
  PoliticalCampaign: 'PoliticalCampaign',
} as const;

export type ProxyOperationType = (typeof ProxyOperationType)[keyof typeof ProxyOperationType];

/** Sources of deniability degradation. @see FR-2006 */
export const DeniabilitySource = {
  Arming: 'Arming',
  Directing: 'Directing',
  MediaExposure: 'MediaExposure',
  Humint: 'Humint',
} as const;

export type DeniabilitySource = (typeof DeniabilitySource)[keyof typeof DeniabilitySource];

// ---------------------------------------------------------------------------
// Strategic Advisory (DR-114 – DR-118)
// ---------------------------------------------------------------------------

/** Qualitative victory path viability labels. */
export const ViabilityLabel = {
  Foreclosed: 'foreclosed',
  Difficult: 'difficult',
  Viable: 'viable',
  Favorable: 'favorable',
  Imminent: 'imminent',
} as const;

export type ViabilityLabel = (typeof ViabilityLabel)[keyof typeof ViabilityLabel];

/** Metric trend direction arrows. */
export const TrendDirection = {
  RisingFast: 'rising_fast',
  Rising: 'rising',
  Stable: 'stable',
  Falling: 'falling',
  FallingFast: 'falling_fast',
} as const;

export type TrendDirection = (typeof TrendDirection)[keyof typeof TrendDirection];

/** Confidence levels for predictions. */
export const ConfidenceLevel = {
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];

/** Strategic consistency state. */
export const ConsistencyState = {
  FocusBonus: 'FocusBonus',
  Normal: 'Normal',
  DriftPenalty: 'DriftPenalty',
} as const;

export type ConsistencyState = (typeof ConsistencyState)[keyof typeof ConsistencyState];

/** Strategic grade for post-game analysis. */
export const StrategicGrade = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
} as const;

export type StrategicGrade = (typeof StrategicGrade)[keyof typeof StrategicGrade];

/** Grand strategy presets available at game start. @see FR-1414 */
export const GrandStrategyPreset = {
  EconomicHegemon: 'EconomicHegemon',
  MilitarySuperpower: 'MilitarySuperpower',
  DiplomaticBroker: 'DiplomaticBroker',
  SurvivalMode: 'SurvivalMode',
  Adaptive: 'Adaptive',
} as const;

export type GrandStrategyPreset = (typeof GrandStrategyPreset)[keyof typeof GrandStrategyPreset];

/** Projection horizon time scales. @see FR-1402 */
export const ProjectionHorizonType = {
  Immediate: 'Immediate',
  MediumTerm: 'MediumTerm',
  Endgame: 'Endgame',
} as const;

export type ProjectionHorizonType = (typeof ProjectionHorizonType)[keyof typeof ProjectionHorizonType];

// ---------------------------------------------------------------------------
// UN Resolution System (FR-703)
// ---------------------------------------------------------------------------

/** Types of UN-style resolutions that factions can propose. @see FR-703 */
export const UNResolutionType = {
  Sanctions: 'Sanctions',
  Peacekeeping: 'Peacekeeping',
  Condemnation: 'Condemnation',
} as const;

export type UNResolutionType = (typeof UNResolutionType)[keyof typeof UNResolutionType];

/** AI difficulty levels that scale risk_tolerance and aggression. @see FR-305 */
export const AIDifficultyLevel = {
  Cautious: 'Cautious',
  Balanced: 'Balanced',
  Aggressive: 'Aggressive',
} as const;

export type AIDifficultyLevel = (typeof AIDifficultyLevel)[keyof typeof AIDifficultyLevel];

/** Status of a double agent operation. @see FR-906 */
export const DoubleAgentStatus = {
  Undetected: 'Undetected',
  Detected: 'Detected',
  Turned: 'Turned',
  Expelled: 'Expelled',
} as const;

export type DoubleAgentStatus = (typeof DoubleAgentStatus)[keyof typeof DoubleAgentStatus];

/** Japan's latent nuclear development phase. @see FR-1007 */
export const JapanNuclearPhase = {
  Dormant: 'Dormant',
  RnDInProgress: 'RnDInProgress',
  AmendmentPending: 'AmendmentPending',
  Active: 'Active',
  Failed: 'Failed',
} as const;

export type JapanNuclearPhase = (typeof JapanNuclearPhase)[keyof typeof JapanNuclearPhase];

/** Tutorial phase for onboarding flow. @see CNFL-2805 */
export const TutorialPhase = {
  NotStarted: 'NotStarted',
  Introduction: 'Introduction',
  FirstTurn: 'FirstTurn',
  SecondTurn: 'SecondTurn',
  ThirdTurn: 'ThirdTurn',
  Completed: 'Completed',
  Skipped: 'Skipped',
} as const;

export type TutorialPhase = (typeof TutorialPhase)[keyof typeof TutorialPhase];

// ---------------------------------------------------------------------------
// Event System (DR-106)
// ---------------------------------------------------------------------------

/** Broad categories of game events logged per turn. */
export const EventCategory = {
  Diplomatic: 'Diplomatic',
  Military: 'Military',
  Economic: 'Economic',
  Intelligence: 'Intelligence',
  Domestic: 'Domestic',
  Nuclear: 'Nuclear',
  Information: 'Information',
  Climate: 'Climate',
  Technology: 'Technology',
  Proxy: 'Proxy',
} as const;

export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

// ---------------------------------------------------------------------------
// Shared branded-ID helpers
// ---------------------------------------------------------------------------

/**
 * Branded type helper — creates opaque ID types that prevent accidental
 * mixing of e.g. UnitId with HexId at the type level.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique identifier for a unit on the map (DR-103). */
export type UnitId = Brand<string, 'UnitId'>;

/** Unique identifier for a hex cell (DR-102). */
export type HexId = Brand<string, 'HexId'>;

/** Unique identifier for a leader (DR-108). */
export type LeaderId = Brand<string, 'LeaderId'>;

/** Unique identifier for an event log entry (DR-106). */
export type EventId = Brand<string, 'EventId'>;

/** Unique identifier for a non-state actor (DR-140). */
export type ActorId = Brand<string, 'ActorId'>;

/** Unique identifier for an action evaluated by the advisory system (DR-116). */
export type ActionId = Brand<string, 'ActionId'>;

/** Turn number — 1-indexed. */
export type TurnNumber = Brand<number, 'TurnNumber'>;
