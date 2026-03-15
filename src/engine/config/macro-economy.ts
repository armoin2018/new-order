/**
 * New Order — Macroeconomic Configuration
 *
 * Configuration for commodity pricing, tariffs, national debt,
 * shipping lanes, consumer behavior, and chaotic events.
 *
 * @see NFR-204 — All game formulas configurable via constants
 */

// ─────────────────────────────────────────────────────────
// FR-7001: Commodity Price Configuration
// ─────────────────────────────────────────────────────────

export const commodityConfig = {
  /** Baseline prices at game start (index = 100). */
  baseline: {
    oil: 100,
    naturalGas: 100,
    food: 100,
    metals: 100,
    consumerGoods: 100,
  },

  /** Per-turn random volatility range (±%). */
  volatility: {
    oil: 5,
    naturalGas: 6,
    food: 4,
    metals: 3,
    consumerGoods: 2,
  },

  /** How tariffs push up commodity prices (multiplier per 10% tariff). */
  tariffPriceImpact: {
    oil: 0.03,
    naturalGas: 0.03,
    food: 0.05,
    metals: 0.04,
    consumerGoods: 0.06,
  },

  /** How shipping disruption pushes up commodity prices (per 10 disruption). */
  shippingDisruptionImpact: {
    oil: 0.04,
    naturalGas: 0.04,
    food: 0.03,
    metals: 0.02,
    consumerGoods: 0.03,
  },

  /** How natural disasters affect commodity prices by severity. */
  disasterPriceShock: {
    /** Per severity point, price boost for food commodities. */
    foodPerSeverity: 0.02,
    /** Per severity point, price boost for oil/gas. */
    energyPerSeverity: 0.015,
    /** Per severity point, price boost for metals. */
    metalsPerSeverity: 0.01,
  },

  /** Price floor and ceiling (prevent runaway). */
  bounds: {
    min: 20,
    max: 500,
  },

  /** How commodity prices feed into inflation (per 10 index points above 100). */
  inflationFeedback: {
    oilWeight: 0.3,
    gasWeight: 0.2,
    foodWeight: 0.3,
    metalsWeight: 0.1,
    consumerGoodsWeight: 0.1,
  },
} as const;

// ─────────────────────────────────────────────────────────
// FR-7002: Tariff & Trade Configuration
// ─────────────────────────────────────────────────────────

export const tariffTradeConfig = {
  /** Default import tariff rate for all nations at game start. */
  defaultImportTariff: 5,
  /** Default export tariff rate. */
  defaultExportTariff: 2,
  /** Maximum tariff rate any nation can impose. */
  maxTariffRate: 60,
  /** Tariff adjustment per AI action (%). */
  tariffAdjustmentStep: 5,

  /** Impact of tariffs on trade volume. */
  tradeVolumeImpact: {
    /** Trade volume reduction per 10% import tariff increase. */
    importReductionPer10Pct: 0.08,
    /** Trade volume reduction per 10% export tariff increase. */
    exportReductionPer10Pct: 0.05,
  },

  /** Retaliatory tariff escalation probability per active tariff. */
  retaliationProbability: 0.3,
  /** Retaliatory tariff magnitude (% of imposed tariff). */
  retaliationMagnitude: 0.8,

  /** Base trade volumes per faction (billions USD). */
  baseTradeVolumes: {
    us: { imports: 320, exports: 260 },
    china: { imports: 280, exports: 340 },
    russia: { imports: 80, exports: 120 },
    japan: { imports: 160, exports: 180 },
    iran: { imports: 30, exports: 60 },
    dprk: { imports: 2, exports: 1 },
    eu: { imports: 300, exports: 310 },
    syria: { imports: 5, exports: 3 },
  } as Record<string, { imports: number; exports: number }>,
} as const;

// ─────────────────────────────────────────────────────────
// FR-7003: National Debt Configuration
// ─────────────────────────────────────────────────────────

export const debtConfig = {
  /** Starting debt-to-GDP ratios per faction (%). */
  initialDebtToGDP: {
    us: 125,
    china: 80,
    russia: 20,
    japan: 260,
    iran: 45,
    dprk: 10,
    eu: 85,
    syria: 130,
  } as Record<string, number>,

  /** Interest rate tiers by credit rating (annual, applied per turn as fraction). */
  interestRates: {
    AAA: 0.002,
    AA: 0.003,
    A: 0.004,
    BBB: 0.006,
    BB: 0.01,
    B: 0.015,
    CCC: 0.025,
    D: 0.04,
  } as Record<string, number>,

  /** Credit rating thresholds (debt-to-GDP breakpoints). */
  creditRatingThresholds: [
    { maxDebtToGDP: 40, rating: 'AAA' as const },
    { maxDebtToGDP: 60, rating: 'AA' as const },
    { maxDebtToGDP: 80, rating: 'A' as const },
    { maxDebtToGDP: 100, rating: 'BBB' as const },
    { maxDebtToGDP: 130, rating: 'BB' as const },
    { maxDebtToGDP: 180, rating: 'B' as const },
    { maxDebtToGDP: 250, rating: 'CCC' as const },
  ],

  /** Default rating if above all thresholds. */
  defaultRating: 'D' as const,

  /** Stability penalty per credit downgrade step. */
  stabilityPenaltyPerDowngrade: -2,

  /** GDP growth penalty at high debt (per 10% above 100% debt-to-GDP). */
  gdpPenaltyPer10PctAbove100: -0.002,

  /** Debt increase from military spending per $1B. */
  militaryDebtFactor: 0.3,

  /** Debt increase from disaster response per $1B cost. */
  disasterDebtFactor: 1.0,

  /** Maximum consecutive deficits before forced austerity / credit collapse. */
  maxConsecutiveDeficits: 12,
} as const;

// ─────────────────────────────────────────────────────────
// FR-7004: Consumer Behavior Configuration
// ─────────────────────────────────────────────────────────

export const consumerConfig = {
  /** Base consumer confidence at game start. */
  baseConfidence: 65,
  /** Base savings rate at game start (%). */
  baseSavingsRate: 15,

  /** Inflation impact on consumer confidence (per point above 5%). */
  inflationConfidencePenalty: -1.5,
  /** Commodity price impact on confidence (per 10 index above 100). */
  commodityPriceConfidencePenalty: -0.8,
  /** Disaster impact on confidence (per severity point of active disaster). */
  disasterConfidencePenalty: -3,
  /** GDP growth boosts confidence. */
  gdpGrowthConfidenceBoost: 2.0,

  /** Confidence → spending multiplier curve. */
  spendingMultiplier: {
    /** Confidence below this → reduced spending. */
    lowThreshold: 40,
    /** Confidence above this → boosted spending. */
    highThreshold: 70,
    /** Minimum spending multiplier (deep recession). */
    minMultiplier: 0.6,
    /** Maximum spending multiplier (boom). */
    maxMultiplier: 1.4,
  },

  /** How much consumer pullback affects GDP (multiplier). */
  spendingGDPImpact: 0.01,
} as const;

// ─────────────────────────────────────────────────────────
// FR-7005: Shipping & Transportation Configuration
// ─────────────────────────────────────────────────────────

export const shippingConfig = {
  /** Base domestic transport cost index. */
  baseDomesticTransport: 100,
  /** Base international shipping cost index. */
  baseInternationalShipping: 100,

  /** Key global shipping lanes and which factions they affect. */
  shippingLanes: [
    { name: 'Strait of Hormuz', affectedFactions: ['japan', 'eu', 'china', 'iran'], oilImpact: 0.3 },
    { name: 'Strait of Malacca', affectedFactions: ['japan', 'china', 'eu'], oilImpact: 0.2 },
    { name: 'Suez Canal', affectedFactions: ['eu', 'us', 'china', 'japan'], oilImpact: 0.15 },
    { name: 'Panama Canal', affectedFactions: ['us', 'china', 'japan', 'eu'], oilImpact: 0.1 },
    { name: 'Black Sea Routes', affectedFactions: ['russia', 'eu', 'syria'], oilImpact: 0.1 },
    { name: 'South China Sea', affectedFactions: ['china', 'japan', 'us'], oilImpact: 0.15 },
  ],

  /** Transport cost increase per commodity price index point above 100 (fuel cost). */
  fuelCostPassthrough: 0.005,

  /** Disruption decay rate per turn (natural recovery). */
  disruptionDecayPerTurn: 5,

  /** Disruption from natural disaster (per severity point). */
  disasterDisruptionPerSeverity: 8,
} as const;

// ─────────────────────────────────────────────────────────
// FR-7005: Chaotic Events Configuration
// ─────────────────────────────────────────────────────────

export const chaoticEventsConfig = {
  /** Base probability of a chaotic event per faction per turn (0–1). */
  baseProbabilityPerTurn: 0.06,

  /** Probability increase per game turn (accelerating instability). */
  probabilityIncreasePerTurn: 0.002,

  /** Maximum probability cap. */
  maxProbability: 0.25,

  /** Maximum simultaneous active events globally. */
  maxActiveEvents: 4,

  /** Event type definitions with base severity range and duration. */
  eventTypes: {
    earthquake: { minSeverity: 3, maxSeverity: 9, minDuration: 1, maxDuration: 3, economicDamagePerSeverity: 15, populationPerSeverity: 50, infraPerSeverity: 8 },
    tornado: { minSeverity: 2, maxSeverity: 7, minDuration: 1, maxDuration: 1, economicDamagePerSeverity: 8, populationPerSeverity: 20, infraPerSeverity: 5 },
    hurricane: { minSeverity: 3, maxSeverity: 10, minDuration: 1, maxDuration: 3, economicDamagePerSeverity: 20, populationPerSeverity: 80, infraPerSeverity: 10 },
    flood: { minSeverity: 2, maxSeverity: 8, minDuration: 1, maxDuration: 4, economicDamagePerSeverity: 12, populationPerSeverity: 60, infraPerSeverity: 7 },
    virus: { minSeverity: 2, maxSeverity: 10, minDuration: 3, maxDuration: 12, economicDamagePerSeverity: 25, populationPerSeverity: 200, infraPerSeverity: 2 },
    tsunami: { minSeverity: 4, maxSeverity: 9, minDuration: 1, maxDuration: 2, economicDamagePerSeverity: 18, populationPerSeverity: 100, infraPerSeverity: 12 },
    volcanic_eruption: { minSeverity: 3, maxSeverity: 8, minDuration: 1, maxDuration: 4, economicDamagePerSeverity: 14, populationPerSeverity: 40, infraPerSeverity: 9 },
    wildfire: { minSeverity: 2, maxSeverity: 7, minDuration: 1, maxDuration: 5, economicDamagePerSeverity: 10, populationPerSeverity: 30, infraPerSeverity: 6 },
    drought: { minSeverity: 2, maxSeverity: 8, minDuration: 3, maxDuration: 8, economicDamagePerSeverity: 8, populationPerSeverity: 40, infraPerSeverity: 1 },
    blizzard: { minSeverity: 2, maxSeverity: 6, minDuration: 1, maxDuration: 2, economicDamagePerSeverity: 6, populationPerSeverity: 15, infraPerSeverity: 3 },
  } as Record<string, {
    minSeverity: number;
    maxSeverity: number;
    minDuration: number;
    maxDuration: number;
    economicDamagePerSeverity: number;
    populationPerSeverity: number;
    infraPerSeverity: number;
  }>,

  /** Regional disaster vulnerability (multiplier on base probability). */
  regionalVulnerability: {
    us: { hurricane: 1.5, tornado: 2.0, wildfire: 1.3, earthquake: 1.2, flood: 1.0 },
    china: { flood: 1.8, earthquake: 1.5, typhoon: 1.3, drought: 1.2 },
    russia: { wildfire: 1.5, blizzard: 2.0, flood: 1.0 },
    japan: { earthquake: 2.5, tsunami: 2.0, typhoon: 1.5 },
    iran: { earthquake: 2.0, drought: 1.8, flood: 1.2 },
    dprk: { flood: 1.5, drought: 1.3, blizzard: 1.2 },
    eu: { flood: 1.3, wildfire: 1.2, blizzard: 1.0 },
    syria: { earthquake: 1.5, drought: 2.0 },
  } as Record<string, Record<string, number>>,

  /** Disaster response: treasury cost multiplier per severity point. */
  responseCostPerSeverity: 5,

  /** Response effectiveness: reduces damage by this fraction. */
  responseEffectiveness: 0.4,

  /** Impact on nation state per turn of active disaster. */
  nationStateImpact: {
    stabilityPerSeverity: -1.5,
    popularityPerSeverity: -1.0,
    inflationPerSeverity: 0.5,
    gdpPenaltyPerSeverityPct: -0.003,
  },

  /** Virus-specific: spread probability to trade partners per turn. */
  virusSpreadProbability: 0.15,
  /** Virus severity reduction on spread. */
  virusSpreadSeverityReduction: 2,
} as const;

// ─────────────────────────────────────────────────────────
// Composite export
// ─────────────────────────────────────────────────────────

export const macroEconomicConfig = {
  commodity: commodityConfig,
  tariffTrade: tariffTradeConfig,
  debt: debtConfig,
  consumer: consumerConfig,
  shipping: shippingConfig,
  chaoticEvents: chaoticEventsConfig,
} as const;
