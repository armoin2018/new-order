/**
 * Model Types — TypeScript interfaces for all external JSON model types.
 *
 * These types correspond to the JSON schemas in `src/data/schemas/` and
 * define the shape of model files stored in `models/`.
 *
 * @module model.types
 * @see FR-2400 — Modular Data Architecture
 * @see DR-141 through DR-168
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Schema version string for migration support. */
export type SchemaVersion = '1.0.0';

// ---------------------------------------------------------------------------
// FR-2100 — MBTI Type Profile (DR-141)
// ---------------------------------------------------------------------------

/** MBTI cognitive function identifier. */
export type CognitiveFunction =
  | 'Te'
  | 'Ti'
  | 'Fe'
  | 'Fi'
  | 'Se'
  | 'Si'
  | 'Ne'
  | 'Ni';

/** MBTI 4-letter type code (e.g., 'INTJ', 'ENFP'). */
export type MBTITypeCode =
  | 'ISTJ' | 'ISFJ' | 'INFJ' | 'INTJ'
  | 'ISTP' | 'ISFP' | 'INFP' | 'INTP'
  | 'ESTP' | 'ESFP' | 'ENFP' | 'ENTP'
  | 'ESTJ' | 'ESFJ' | 'ENFJ' | 'ENTJ';

/** Leadership style derived from MBTI. */
export type LeadershipStyle =
  | 'commanding'
  | 'visionary'
  | 'diplomatic'
  | 'analytical'
  | 'servant'
  | 'charismatic'
  | 'strategic'
  | 'adaptive';

/** Diplomatic approach derived from MBTI. */
export type DiplomaticApproach =
  | 'transactional'
  | 'relational'
  | 'principled'
  | 'pragmatic'
  | 'confrontational'
  | 'collaborative';

/** Conflict response pattern. */
export type ConflictResponse =
  | 'dominate'
  | 'compromise'
  | 'avoid'
  | 'accommodate'
  | 'collaborate'
  | 'escalate';

/** Stress pattern type. */
export type StressPattern = 'grip' | 'loop' | 'shadow' | 'regression';

/** MBTI type profile model (models/leaders/mbti/*.json). */
export interface MBTITypeProfile {
  readonly schemaVersion: SchemaVersion;
  readonly typeCode: MBTITypeCode;
  readonly typeName: string;
  readonly cognitiveStack: readonly [CognitiveFunction, CognitiveFunction, CognitiveFunction, CognitiveFunction];
  readonly strengthDomains: readonly string[];
  readonly blindSpots: readonly string[];
  readonly stressPattern: StressPattern;
  readonly decisionSpeed: number;
  readonly adaptability: number;
  readonly leadershipStyle: LeadershipStyle;
  readonly diplomaticApproach: DiplomaticApproach;
  readonly conflictResponse: ConflictResponse;
  readonly gameplayModifiers?: {
    readonly alliancePreference?: number;
    readonly noveltyPreference?: number;
    readonly outcomeTypeWeight?: Record<string, number>;
    readonly commitmentTiming?: number;
  };
}

// ---------------------------------------------------------------------------
// FR-2200 — Political System Profile (DR-144)
// ---------------------------------------------------------------------------

/** Political system profile model (models/political-systems/*.json). */
export interface PoliticalSystemProfile {
  readonly schemaVersion: SchemaVersion;
  readonly systemId: string;
  readonly systemName: string;
  readonly description: string;
  readonly decisionSpeedModifier: number;
  readonly stabilityBaseline: number;
  readonly civilLibertyIndex: number;
  readonly pressFreedomIndex: number;
  readonly corruptionBaseline: number;
  readonly successionRisk: number;
  readonly reformCapacity: number;
  readonly gameplayModifiers?: {
    readonly stabilityRecoveryRate?: number;
    readonly crisisResistance?: number;
    readonly intelligenceModifier?: number;
    readonly controversialActionDelay?: number;
    readonly propagandaEffectiveness?: number;
    readonly civilUnrestThreshold?: number;
  };
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-2300 — Military Equipment (DR-145)
// ---------------------------------------------------------------------------

/** Military equipment category. */
export type EquipmentCategory =
  | 'air'
  | 'sea'
  | 'ground'
  | 'spy-covert'
  | 'drone'
  | 'domestic'
  | 'cyber-offense'
  | 'cyber-defense';

/** Special ability on a piece of equipment. */
export interface EquipmentAbility {
  readonly abilityId: string;
  readonly name: string;
  readonly description: string;
  readonly modifier?: Record<string, unknown>;
}

/** Military equipment model (models/military/{category}/*.json). */
export interface MilitaryEquipment {
  readonly schemaVersion: SchemaVersion;
  readonly equipmentId: string;
  readonly name: string;
  readonly category: EquipmentCategory;
  readonly subcategory?: string;
  readonly description: string;
  readonly nation?: string;
  readonly purchaseCost: number;
  readonly maintenanceCostPerTurn: number;
  readonly attackPower: number;
  readonly defensePower: number;
  readonly range?: number;
  readonly speed?: number;
  readonly specialAbilities?: readonly EquipmentAbility[];
  readonly techRequirements?: Partial<Record<TechDomainKey, number>>;
  readonly crewRequirement?: number;
  readonly buildTime: number;
  readonly operationalLifespan?: number;
  readonly stealthRating?: number;
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-2800 — Technology Model (DR-148)
// ---------------------------------------------------------------------------

/** Technology domain key (matches TechDomain enum values). */
export type TechDomainKey =
  | 'ai'
  | 'semiconductors'
  | 'space'
  | 'cyber'
  | 'biotech'
  | 'quantum';

/** Impact level for a technology breakthrough. */
export type ImpactLevel =
  | 'incremental'
  | 'significant'
  | 'breakthrough'
  | 'paradigm-shift';

/** Export restriction level for technology. */
export type ExportRestrictionLevel =
  | 'unrestricted'
  | 'allied-only'
  | 'embargo-restricted'
  | 'classified';

/** Technology model (models/technology/*.json). */
export interface TechnologyModel {
  readonly schemaVersion: SchemaVersion;
  readonly techId: string;
  readonly name: string;
  readonly domain: TechDomainKey;
  readonly secondaryDomains?: readonly TechDomainKey[];
  readonly description: string;
  readonly tier?: number;
  readonly researchCost: number;
  readonly researchDurationTurns: number;
  readonly impactLevel: ImpactLevel;
  readonly prerequisites?: readonly {
    readonly techId: string;
    readonly minimumLevel?: number;
  }[];
  readonly domainLevelRequirement?: Partial<Record<TechDomainKey, number>>;
  readonly effects?: {
    readonly domainBoosts?: Partial<Record<TechDomainKey, number>>;
    readonly militaryModifiers?: {
      readonly attackBonus?: number;
      readonly defenseBonus?: number;
      readonly unlocksEquipment?: readonly string[];
    };
    readonly economicModifiers?: {
      readonly gdpGrowthBonus?: number;
      readonly tradeEfficiencyBonus?: number;
      readonly revenueMultiplier?: number;
    };
    readonly socialModifiers?: {
      readonly stabilityBonus?: number;
      readonly softPowerBonus?: number;
      readonly educationBonus?: number;
    };
  };
  readonly knowledgeTransfer?: {
    readonly canExport?: boolean;
    readonly exportRestrictionLevel?: ExportRestrictionLevel;
    readonly espionageValue?: number;
  };
  readonly combinationBonuses?: readonly {
    readonly partnerTechId: string;
    readonly bonusDescription: string;
    readonly bonusMultiplier?: number;
  }[];
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-2900 — Education Type (DR-157)
// ---------------------------------------------------------------------------

/** Education program category. */
export type EducationCategory =
  | 'primary'
  | 'secondary'
  | 'higher-education'
  | 'vocational'
  | 'stem'
  | 'military-academy'
  | 'intelligence-training'
  | 'research-institution'
  | 'digital-literacy'
  | 'propaganda';

/** Education type model (models/education/*.json). */
export interface EducationType {
  readonly schemaVersion: SchemaVersion;
  readonly educationId: string;
  readonly name: string;
  readonly category: EducationCategory;
  readonly description: string;
  readonly annualCostPerCapita: number;
  readonly implementationTurns: number;
  readonly maturityTurns?: number;
  readonly maxEffectivenessPercent?: number;
  readonly effects?: {
    readonly technologyDomainBoosts?: Partial<Record<TechDomainKey, number>>;
    readonly workforceQuality?: number;
    readonly innovationRate?: number;
    readonly stabilityModifier?: number;
    readonly softPowerModifier?: number;
    readonly militaryReadinessModifier?: number;
    readonly espionageModifier?: number;
  };
  readonly prerequisites?: readonly {
    readonly type: 'education' | 'technology' | 'gdp-per-capita' | 'stability';
    readonly value: string;
    readonly minimumLevel?: number;
  }[];
  readonly exclusiveWith?: readonly string[];
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-3000 — Population Demographics (DR-159)
// ---------------------------------------------------------------------------

/** Population demographics model (models/population/*.json). */
export interface PopulationDemographics {
  readonly schemaVersion: SchemaVersion;
  readonly nationId: string;
  readonly populationMillions: number;
  readonly growthRatePercent: number;
  readonly urbanizationPercent: number;
  readonly medianAge: number;
  readonly lifeExpectancy: number;
  readonly literacyRatePercent: number;
  readonly ageDistribution?: {
    readonly youth: number;
    readonly workingAge: number;
    readonly elderly: number;
  };
  readonly ethnicComposition?: readonly {
    readonly groupName: string;
    readonly percentOfPopulation: number;
    readonly socialCohesion?: number;
  }[];
  readonly socialIndicators?: {
    readonly giniCoefficient?: number;
    readonly humanDevelopmentIndex?: number;
    readonly healthcareAccessPercent?: number;
    readonly internetPenetrationPercent?: number;
    readonly unemploymentRatePercent?: number;
  };
  readonly gameplayModifiers?: {
    readonly workforceQuality?: number;
    readonly conscriptionPool?: number;
    readonly socialStabilityBaseline?: number;
    readonly innovationPotential?: number;
    readonly consumptionDemandMultiplier?: number;
  };
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-3000 — Religion Profile (DR-161)
// ---------------------------------------------------------------------------

/** Political influence level of a religion. */
export type PoliticalInfluenceLevel =
  | 'none'
  | 'minimal'
  | 'moderate'
  | 'significant'
  | 'dominant'
  | 'theocratic';

/** Demographic trend direction. */
export type DemographicTrend =
  | 'growing'
  | 'stable'
  | 'declining'
  | 'rapid-growth'
  | 'rapid-decline';

/** Inter-religious tension level. */
export type TensionLevelReligion =
  | 'harmonious'
  | 'tolerant'
  | 'wary'
  | 'hostile'
  | 'violent';

/** Religion profile model (models/religion/*.json). */
export interface ReligionProfile {
  readonly schemaVersion: SchemaVersion;
  readonly religionId: string;
  readonly name: string;
  readonly parentTradition?: string;
  readonly description: string;
  readonly adherentsGlobalPercent: number;
  readonly socialCohesionModifier: number;
  readonly politicalInfluence: PoliticalInfluenceLevel;
  readonly demographicTrend?: DemographicTrend;
  readonly interReligiousTensions?: readonly {
    readonly targetReligionId: string;
    readonly tensionLevel: TensionLevelReligion;
    readonly historicalBasis?: string;
  }[];
  readonly gameplayModifiers?: {
    readonly stabilityModifier?: number;
    readonly reformResistance?: number;
    readonly educationAttitude?: 'pro-education' | 'neutral' | 'selective' | 'restrictive';
    readonly scienceAttitude?: 'pro-science' | 'neutral' | 'selective' | 'anti-science';
    readonly theocracyPotential?: number;
    readonly martyrdomFactor?: number;
    readonly charityModifier?: number;
  };
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// Extended Leader Profile (DR-142, DR-143)
// ---------------------------------------------------------------------------

/** MBTI dichotomy scores (0–100 scale). */
export interface MBTIDichotomyScores {
  /** 0 = extreme Extravert, 100 = extreme Introvert */
  readonly EI: number;
  /** 0 = extreme Sensing, 100 = extreme Intuition */
  readonly SN: number;
  /** 0 = extreme Thinking, 100 = extreme Feeling */
  readonly TF: number;
  /** 0 = extreme Judging, 100 = extreme Perceiving */
  readonly JP: number;
}

/**
 * Extended leader profile model (models/leaders/*.json).
 * Combines existing LeaderProfile fields with MBTI integration.
 */
export interface ExtendedLeaderProfile {
  readonly schemaVersion: SchemaVersion;
  readonly leaderId: string;
  readonly name: string;
  readonly title?: string;
  readonly factionId: string;
  readonly mbtiType: MBTITypeCode;
  readonly mbtiDichotomyScores?: MBTIDichotomyScores;
  readonly psychology: {
    readonly decisionStyle: 'analytical' | 'intuitive' | 'consultative' | 'autocratic' | 'consensus';
    readonly stressResponse: 'escalate' | 'withdraw' | 'delegate' | 'freeze' | 'innovate';
    readonly riskTolerance: number;
    readonly paranoia: number;
    readonly narcissism: number;
    readonly pragmatism: number;
    readonly patience: number;
    readonly vengefulIndex: number;
    readonly charisma?: number;
    readonly empathy?: number;
    readonly ideologicalRigidity?: number;
    readonly corruptibility?: number;
  };
  readonly motivations: {
    readonly primary?: 'power' | 'legacy' | 'ideology' | 'security' | 'prosperity' | 'revenge' | 'reform';
    readonly secondary?: 'power' | 'legacy' | 'ideology' | 'security' | 'prosperity' | 'revenge' | 'reform';
    readonly fear?: 'overthrow' | 'irrelevance' | 'humiliation' | 'war' | 'economic-collapse' | 'betrayal';
  };
  readonly powerBase: {
    readonly source?: 'military' | 'party' | 'dynasty' | 'popular' | 'religious' | 'economic' | 'intelligence';
    readonly consolidation?: number;
    readonly legitimacy?: number;
    readonly succession?: 'clear' | 'contested' | 'undefined' | 'hereditary' | 'appointed';
  };
  readonly vulnerabilities?: {
    readonly health?: number;
    readonly scandals?: readonly string[];
    readonly internalOpposition?: number;
    readonly externalPressure?: number;
  };
  readonly compatibilityOverrides?: readonly {
    readonly targetLeaderId: string;
    readonly modifier: number;
    readonly reason?: string;
  }[];
  readonly biography?: string;
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-3300 — Stock Exchange (DR-169)
// ---------------------------------------------------------------------------

/** Volatility profile for a stock exchange. */
export type VolatilityProfile = 'low' | 'medium' | 'high' | 'extreme';

/** Market sector name. */
export type MarketSector =
  | 'defense'
  | 'energy'
  | 'technology'
  | 'finance'
  | 'consumer'
  | 'healthcare'
  | 'infrastructure'
  | 'mining';

/** Game event types that affect stock prices. */
export type MarketEventType =
  | 'military-conflict'
  | 'sanctions-imposed'
  | 'tech-breakthrough'
  | 'civil-unrest'
  | 'trade-deal'
  | 'oil-disruption'
  | 'regime-change'
  | 'natural-disaster';

/** Market sentiment direction. */
export type MarketSentiment = 'bullish' | 'neutral' | 'bearish';

/** Market trend direction. */
export type MarketTrend = 'rising' | 'falling' | 'flat';

/** Stock exchange model (models/markets/exchanges/*.json). */
export interface StockExchangeModel {
  readonly schemaVersion: SchemaVersion;
  readonly exchangeId: string;
  readonly exchangeName: string;
  readonly nationId: string;
  readonly baseIndexValue: number;
  readonly volatilityProfile: VolatilityProfile;
  readonly currencyCode: string;
  readonly marketCapBillions?: number;
  readonly sectorWeights?: Partial<Record<MarketSector, number>>;
  readonly tags?: readonly string[];
}

/** Event sensitivity weights mapping event types to price impact multipliers. */
export type EventSensitivityWeights = Partial<Record<MarketEventType, number>>;

/** Single sector ticker within an exchange. */
export interface SectorTicker {
  readonly tickerId: string;
  readonly sectorName: MarketSector;
  readonly initialPrice: number;
  readonly eventSensitivityWeights: EventSensitivityWeights;
  readonly volatilityMultiplier?: number;
}

/** Nation's full set of tickers for their exchange (models/markets/tickers/*.json). */
export interface NationTickerSet {
  readonly schemaVersion: SchemaVersion;
  readonly nationId: string;
  readonly exchangeId: string;
  readonly tickers: readonly SectorTicker[];
}

// ---------------------------------------------------------------------------
// FR-3400 — Market Index (DR-172)
// ---------------------------------------------------------------------------

/** Index type (preset by system or custom by player). */
export type IndexType = 'preset' | 'custom';

/** A constituent ticker in a market index with its weight. */
export interface IndexConstituent {
  readonly tickerId: string;
  readonly exchangeId: string;
  readonly weight: number;
}

/** Market index model (models/markets/indexes/*.json). */
export interface MarketIndexModel {
  readonly schemaVersion: SchemaVersion;
  readonly indexId: string;
  readonly indexName: string;
  readonly indexType: IndexType;
  readonly constituentTickers: readonly IndexConstituent[];
  readonly baseValue: number;
  readonly description?: string;
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-3300 — Runtime Market State (not persisted as models)
// ---------------------------------------------------------------------------

/** Ticker price snapshot for a single turn (DR-171). */
export interface TickerPricePoint {
  readonly turn: number;
  readonly openPrice: number;
  readonly closePrice: number;
  readonly highPrice: number;
  readonly lowPrice: number;
  readonly change: number;
  readonly changePercent: number;
  readonly triggeringEvents: readonly string[];
}

/** Runtime state for a single ticker during gameplay. */
export interface TickerRuntimeState {
  readonly tickerId: string;
  readonly exchangeId: string;
  readonly currentPrice: number;
  readonly previousPrice: number;
  readonly allTimeHigh: number;
  readonly allTimeLow: number;
  readonly trendDirection: MarketTrend;
  readonly volume: number;
  readonly priceHistory: readonly TickerPricePoint[];
}

/** Runtime state for a market index during gameplay (DR-173). */
export interface IndexRuntimeState {
  readonly indexId: string;
  readonly currentValue: number;
  readonly allTimeHigh: number;
  readonly allTimeLow: number;
  readonly trendDirection: MarketTrend;
  readonly createdOnTurn: number;
  readonly history: readonly { turn: number; value: number; change: number; changePercent: number }[];
}

/** Per-exchange sentiment state (DR-174). */
export interface ExchangeSentimentState {
  readonly exchangeId: string;
  readonly sentiment: MarketSentiment;
  readonly sentimentScore: number; // -100 to +100
  readonly trendStrength: number; // 0-100
  readonly volatilityIndex: number; // 0-100
  readonly majorEvents: readonly string[];
}

/** Market event log entry (DR-175). */
export interface MarketEventLogEntry {
  readonly eventId: string;
  readonly turn: number;
  readonly eventType: 'crash' | 'rally' | 'contagion' | 'sector-rotation' | 'bubble' | 'correction';
  readonly affectedExchanges: readonly string[];
  readonly magnitude: number;
  readonly cause: string;
  readonly duration?: number;
  readonly resolved: boolean;
}

/** Market contagion event (DR-181). */
export interface MarketContagionEvent {
  readonly sourceExchange: string;
  readonly triggerEvent: string;
  readonly affectedExchanges: readonly { exchangeId: string; impactPercent: number }[];
  readonly hopDepth: number;
  readonly gfsiAtTime: number;
  readonly totalMarketCapLoss: number;
  readonly turn: number;
  readonly recoveryTurns?: number;
}

// ---------------------------------------------------------------------------
// FR-3600 — Scenario Scoring (DR-179)
// ---------------------------------------------------------------------------

/** Letter grade for a scoring dimension. */
export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

/** Scoring dimension identifier. */
export type ScoringDimension =
  | 'stability'
  | 'economic'
  | 'military'
  | 'diplomatic'
  | 'technology'
  | 'market'
  | 'strategic';

/** Per-dimension score breakdown. */
export interface DimensionScore {
  readonly dimension: ScoringDimension;
  readonly rawScore: number; // 0-100
  readonly letterGrade: LetterGrade;
  readonly weight: number;
  readonly weightedScore: number;
  readonly keyEvents: readonly string[];
  /** Turn-over-turn trend direction (FR-3602). */
  readonly trend?: 'improving' | 'declining' | 'stable';
}

/** Complete scenario score (DR-179). */
export interface ScenarioScore {
  readonly totalScore: number; // 0-1000
  readonly dimensions: readonly DimensionScore[];
  readonly percentileRanking?: number;
  readonly comparisonToAI?: Record<string, number>;
}

/** Scenario export manifest (DR-182). */
export interface ScenarioExportManifest {
  readonly exportId: string;
  readonly format: 'json' | 'html' | 'csv';
  readonly exportedAt: string;
  readonly scenarioId: string;
  readonly includesHistory: boolean;
  readonly includesMarketData: boolean;
  readonly includesScores: boolean;
  readonly fileSizeBytes?: number;
  readonly checksum?: string;
}

// ---------------------------------------------------------------------------
// FR-3300–3600 — Composite Runtime State (stored in GameState)
// ---------------------------------------------------------------------------

/**
 * Composite runtime market state stored in GameState.
 * Serialisable — uses Records instead of Maps.
 *
 * @see DR-169 through DR-175, DR-181
 */
export interface RuntimeMarketState {
  /** Loaded exchange model definitions. */
  readonly exchanges: readonly StockExchangeModel[];
  /** Loaded ticker set definitions. */
  readonly tickerSets: readonly NationTickerSet[];
  /** Per-ticker runtime state keyed by tickerId. */
  readonly tickerStates: Readonly<Record<string, TickerRuntimeState>>;
  /** Per-exchange sentiment state keyed by exchangeId. */
  readonly sentimentStates: Readonly<Record<string, ExchangeSentimentState>>;
  /** Chronological market event log. */
  readonly marketEventLog: readonly MarketEventLogEntry[];
  /** Chronological contagion event log. */
  readonly contagionLog: readonly MarketContagionEvent[];
  /** Preset (system-defined) market indexes. */
  readonly presetIndexes: readonly MarketIndexModel[];
  /** Player-created custom market indexes. */
  readonly customIndexes: readonly MarketIndexModel[];
  /** Per-index runtime state keyed by indexId. */
  readonly indexStates: Readonly<Record<string, IndexRuntimeState>>;
  /** 10-year pre-simulation OHLC history keyed by indexId (lazy-generated). */
  readonly historicalData?: Readonly<Record<string, import('@/engine/market-history-generator').HistoricalSeries>>;
}

/**
 * Generated tech module record stored in GameState.
 * Minimal subset of GeneratedTechModule for serialisation.
 *
 * @see DR-176
 */
export interface TechModuleRecord {
  readonly techId: string;
  readonly name: string;
  readonly domain: TechDomainKey;
  readonly tier?: number;
  readonly generatedBy: string; // factionId
  readonly generatedOnTurn: number;
  readonly scenarioId: string;
  readonly actualCostPaid: number;
  readonly effectiveDurationTurns: number;
  readonly synergyBonuses: readonly string[];
  readonly exportable: boolean;
}

/**
 * Tech module registry stored in GameState.
 *
 * @see DR-176
 */
export interface TechModuleRegistryState {
  /** All generated tech modules keyed by `${techId}-${factionId}`. */
  readonly modules: Readonly<Record<string, TechModuleRecord>>;
  /** Discovery log entries in chronological order. */
  readonly discoveryLog: readonly TechModuleDiscoveryEntry[];
}

/**
 * Minimal discovery log entry for GameState serialisation.
 *
 * @see DR-176
 */
export interface TechModuleDiscoveryEntry {
  readonly techId: string;
  readonly factionId: string;
  readonly turnDiscovered: number;
  readonly actualCost: number;
  readonly actualDuration: number;
}

// ---------------------------------------------------------------------------
// Union type for any model
// ---------------------------------------------------------------------------

/** Discriminated union of all model types. */
export type AnyModel =
  | MBTITypeProfile
  | PoliticalSystemProfile
  | MilitaryEquipment
  | TechnologyModel
  | EducationType
  | PopulationDemographics
  | ReligionProfile
  | ExtendedLeaderProfile
  | StockExchangeModel
  | NationTickerSet
  | MarketIndexModel;

/** Model collection type identifiers. */
export type ModelCollectionType =
  | 'mbti'
  | 'political-system'
  | 'military-equipment'
  | 'technology'
  | 'education'
  | 'population'
  | 'religion'
  | 'leader'
  | 'stock-exchange'
  | 'stock-ticker'
  | 'market-index';

/** Maps collection type to its model interface. */
export interface ModelTypeMap {
  'mbti': MBTITypeProfile;
  'political-system': PoliticalSystemProfile;
  'military-equipment': MilitaryEquipment;
  'technology': TechnologyModel;
  'education': EducationType;
  'population': PopulationDemographics;
  'religion': ReligionProfile;
  'leader': ExtendedLeaderProfile;
  'stock-exchange': StockExchangeModel;
  'stock-ticker': NationTickerSet;
  'market-index': MarketIndexModel;
}
