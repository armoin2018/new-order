/**
 * New Order — Systems Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 13. STRATEGIC ADVISORY
  // ─────────────────────────────────────────────────────────

export const advisoryConfig = {
  /** Victory condition viability labels. @see FR-1401 */
  viabilityLabels: {
    /** Foreclosed viability range max. @see FR-1401 */
    foreclosedMax: 9,
    /** Difficult viability range min. @see FR-1401 */
    difficultMin: 10,
    /** Difficult viability range max. @see FR-1401 */
    difficultMax: 30,
    /** Viable viability range min. @see FR-1401 */
    viableMin: 31,
    /** Viable viability range max. @see FR-1401 */
    viableMax: 60,
    /** Favorable viability range min. @see FR-1401 */
    favorableMin: 61,
    /** Favorable viability range max. @see FR-1401 */
    favorableMax: 80,
    /** Imminent viability range min. @see FR-1401 */
    imminentMin: 81,
    /** Imminent viability range max. @see FR-1401 */
    imminentMax: 100,
  },

  /** Projection time horizons (in turns). @see FR-1402 */
  projectionHorizons: {
    /** Immediate-term projection horizon in turns. @see FR-1402 */
    immediate: 3,
    /** Medium-term projection horizon in turns. @see FR-1402 */
    mediumTerm: 12,
    /** Endgame projection: remaining turns (up to 60). @see FR-1402 */
    endgame: 60,
  },

  /** Loss warning urgency thresholds (in turns). @see FR-1403 */
  lossWarning: {
    /** Watch-level warning: turns remaining. @see FR-1403 */
    watch: 12,
    /** Warning-level warning: turns remaining. @see FR-1403 */
    warning: 6,
    /** Critical-level warning: turns remaining. @see FR-1403 */
    critical: 3,
    /** Critical-level percentage trigger. @see FR-1403 */
    criticalPercentage: 0.1,
  },

  /** Composite strategy formula weights. @see FR-1413 */
  compositeStrategy: {
    /** Weight of top viability score. @see FR-1413 */
    topViabilityWeight: 0.4,
    /** Weight of strategy consistency. @see FR-1413 */
    consistencyWeight: 0.3,
    /** Weight of loss margin. @see FR-1413 */
    lossMarginWeight: 0.3,
  },

  /** Strategy consistency window in turns. @see FR-1413 */
  consistencyWindow: 6,

  /** Focus bonus when consistency > 70%. @see FR-1414 */
  focusBonus: {
    /** Consistency threshold for focus bonus. @see FR-1414 */
    consistencyThreshold: 0.7,
    /** Effectiveness bonus from focus. @see FR-1414 */
    effectivenessBonus: 0.05,
  },

  /** Drift penalty when consistency < 30%. @see FR-1414 */
  driftPenalty: {
    /** Consistency threshold for drift penalty. @see FR-1414 */
    consistencyThreshold: 0.3,
    /** Effectiveness penalty from drift. @see FR-1414 */
    effectivenessPenalty: -0.05,
    /** Popularity decay per turn from drift. @see FR-1414 */
    popularityDecayPerTurn: -2,
  },

  /** Grand Strategy presets. @see FR-1413 */
  grandStrategyPresets: {
    /** Economic Hegemon preset label. @see FR-1413 */
    economicHegemon: "EconomicHegemon",
    /** Military Superpower preset label. @see FR-1413 */
    militarySuperpower: "MilitarySuperpower",
    /** Diplomatic Broker preset label. @see FR-1413 */
    diplomaticBroker: "DiplomaticBroker",
    /** Survival Mode preset label. @see FR-1413 */
    survivalMode: "SurvivalMode",
    /** Adaptive preset label. @see FR-1413 */
    adaptive: "Adaptive",
  },

  /** Rival trajectory fog-accuracy bands (±turns). @see FR-1405 */
  rivalTrajectory: {
    /** Accuracy band for high-clarity rivals (±turns). @see FR-1405 */
    highClarityAccuracyBand: 3,
    /** Accuracy band for low-clarity rivals (±turns). @see FR-1405 */
    lowClarityAccuracyBand: 8,
    /** Clarity threshold separating high from low accuracy. @see FR-1405 */
    clarityThreshold: 50,
  },

  /** Strategic pivot detection thresholds. @see FR-1406 */
  pivotDetection: {
    /** Consecutive turns top path must change before pivot fires. @see FR-1406 */
    consecutiveTurnsThreshold: 2,
  },

  /** Strategy grade thresholds (minimum score for each grade). @see FR-1410 */
  gradeThresholds: {
    /** Minimum composite score for S grade. @see FR-1410 */
    S: 90,
    /** Minimum composite score for A grade. @see FR-1410 */
    A: 75,
    /** Minimum composite score for B grade. @see FR-1410 */
    B: 60,
    /** Minimum composite score for C grade. @see FR-1410 */
    C: 45,
    /** Minimum composite score for D grade. @see FR-1410 */
    D: 30,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 15. VICTORY & LOSS CONDITIONS (§13)
  // ─────────────────────────────────────────────────────────

export const victoryLossConfig = {
  // ── Core Victory Conditions ──────────────────────────────

  /** VC-01 Hegemonic Dominance thresholds. @see §13 */
  vc01_hegemonicDominance: {
    stabilityMin: 80,
    diplomaticInfluenceMin: 70,
    militaryReadinessMin: 60,
    consecutiveTurns: 6,
  },

  /** VC-02 Economic Supremacy thresholds. @see §13 */
  vc02_economicSupremacy: {
    /** Player GDP must exceed combined top-2 rival GDPs. */
    rivalCountForComparison: 2,
    consecutiveTurns: 12,
  },

  /** VC-03 Pax [Nation] thresholds. @see §13 */
  vc03_pax: {
    /** All bilateral tensions must be below this. */
    tensionMax: 20,
    consecutiveTurns: 12,
  },

  // ── Core Loss Conditions ─────────────────────────────────

  /** VC-04 Government Collapse triggers. @see §13, FR-1309 */
  vc04_governmentCollapse: {
    stabilityTrigger: 0,
    civilUnrestTrigger: 100,
    /** SuccessionClarity threshold to survive regime change. */
    successionClarityThreshold: 60,
  },

  /** VC-05 Nuclear Winter: any nuclearThreshold reaching this triggers all-lose. @see §13 */
  vc05_nuclearWinter: {
    nuclearThresholdTrigger: 100,
    /** Second-strike counter-attack probability. @see FR-505 */
    secondStrikeProbability: 0.9,
  },

  /** VC-06 Isolation thresholds. @see §13 */
  vc06_isolation: {
    tensionMin: 80,
    /** All factions must be above this tension. */
    consecutiveTurns: 6,
  },

  /** VC-07 Survival (conditional): turn limit and scoring. @see §13 */
  vc07_survival: {
    /** Composite score = Stability + GDP + DiplomaticInfluence. */
    scoreWeights: { stability: 1, gdp: 1, diplomaticInfluence: 1 },
  },

  // ── Extended Loss Conditions ─────────────────────────────

  /** VC-08 Coup d'État thresholds. @see §13 */
  vc08_coup: {
    powerBaseMilitaryMax: 30,
    powerBaseSecurityMax: 30,
    successionClarityThreshold: 60,
  },

  /** VC-09 People's Revolution trigger. @see §13 */
  vc09_peoplesRevolution: {
    civilUnrestTrigger: 100,
  },

  // ── Extended Victory Conditions ──────────────────────────

  /** VC-10 Iron Fist thresholds. @see §13 */
  vc10_ironFist: {
    /** CivilUnrest must never drop below this. */
    civilUnrestFloor: 40,
    /** Stability must never rise above this. */
    stabilityCeiling: 50,
    /** Must maintain for full game duration (60 turns). */
    requiredTurns: 60,
  },

  /** VC-11 Grand Strategist requirements. @see §13, FR-1410 */
  vc11_grandStrategist: {
    /** Must achieve a base victory (VC-01, VC-02, VC-03, or VC-10). */
    eligibleBaseVictories: ['VC-01', 'VC-02', 'VC-03', 'VC-10'],
    requiredGrade: 'S',
  },

  /** VC-12 Puppet Master requirements. @see §13 */
  vc12_puppetMaster: {
    /** Min rival leaders manipulated via PsyOps. */
    minManipulatedLeaders: 3,
    emotionalThreshold: 70,
    /** Must not be discovered. */
    discoveryAllowed: false,
  },

  /** VC-13 Unbreakable requirements. @see §13 */
  vc13_unbreakable: {
    minTraumaEvents: 3,
    finalStabilityMin: 60,
    finalResolveMin: 80,
  },

  /** VC-14 Information Hegemon requirements. @see §13 */
  vc14_informationHegemon: {
    legitimacyMin: 90,
    consecutiveTurns: 12,
    minNarrativeBattleWins: 5,
    /** Must have zero successful deepfakes against player. */
    maxSuccessfulDeepfakes: 0,
  },

  /** VC-15 Shadow Emperor requirements. @see §13 */
  vc15_shadowEmperor: {
    minStrategicObjectives: 3,
    /** Must not deploy conventional military in direct combat. */
    maxDirectCombatActions: 0,
  },

  /** VC-16 Tech Singularity thresholds. @see §13, FR-1801 */
  vc16_techSingularity: {
    aiMin: 90,
    quantumMin: 70,
    semiconductorsMin: 80,
    stabilityMin: 60,
  },

  /** VC-17 Resource Lord requirements. @see §13 */
  vc17_resourceLord: {
    /** Min resource categories at ≥50% control. */
    minResourceCategories: 2,
    resourceControlThreshold: 50,
    diplomaticInfluenceMin: 70,
    /** Must not use direct military coercion. */
    maxMilitaryCoercionActions: 0,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 18. POST-GAME ANALYSIS (§13 FR-1410, FR-1522)
  // ─────────────────────────────────────────────────────────

export const postGameAnalysisConfig = {
  /** Inflection point threshold: viability shift >= this triggers identification. @see FR-1410 */
  inflectionPointThreshold: 15,

  /** Minimum inflection points expected per game. @see FR-1410 */
  minInflectionPointsPerGame: 3,

  /** Time limit for report generation (ms). @see FR-1410 */
  reportGenerationTimeoutMs: 2000,

  /** Road Not Taken: max alternative projections to compute. @see FR-1410 */
  roadNotTakenMaxProjections: 10,

  /** Road Not Taken: projection horizon (turns ahead). @see FR-1410 */
  roadNotTakenHorizon: 5,

  /** Psychological turning point: emotion threshold that triggers identification. @see FR-1522 */
  psychologicalTurningPointThreshold: 80,

  /** Minimum emotional shift (delta) to qualify as a turning point. @see FR-1522 */
  psychologicalShiftMinDelta: 20,

  /** Radar chart dimensions for personality drift. @see FR-1522 */
  radarDimensions: [
    'riskTolerance',
    'paranoia',
    'narcissism',
    'pragmatism',
    'patience',
    'vengefulIndex',
  ] as const,

  /** Grudge timeline: max grudges to show in summary. @see FR-1522 */
  grudgeTimelineMaxEntries: 20,
} as const;


  // ─────────────────────────────────────────────────────────
  // 22. SCENARIO SELECTION (FR-104)
  // ─────────────────────────────────────────────────────────

export const scenarioSelectionConfig = {
  /** Default scenario ID. @see FR-104 */
  defaultScenarioId: 'march-2026',

  /** Maximum number of scenarios listed. @see FR-104 */
  maxScenarioListSize: 20,
} as const;


  // ─────────────────────────────────────────────────────────
  // 23. TUTORIAL & ACCESSIBILITY (NFR-301, NFR-302, NFR-303)
  // ─────────────────────────────────────────────────────────

export const tutorialConfig = {
  /** Number of advisory overlay turns. @see CNFL-2805 */
  advisoryOverlayTurns: 3,

  /** Tutorial auto-skip after this many games. */
  autoSkipAfterGames: 1,

  /** Keyboard navigation: action panel hotkey. */
  hotkeys: {
    strategicDashboard: 'Tab',
    actionMenu: 'a',
    diplomacyPanel: 'd',
    intelligencePanel: 'i',
    endTurn: 'Enter',
    saveGame: 'ctrl+s',
    loadGame: 'ctrl+l',
  } as const,
} as const;


  // ─────────────────────────────────────────────────────────
  // 24. MODDING & EXTENSIBILITY (NFR-202, NFR-203)
  // ─────────────────────────────────────────────────────────

export const moddingConfig = {
  /** Maximum custom leaders that can be exported. */
  maxCustomLeaders: 50,

  /** Maximum custom scenarios. */
  maxCustomScenarios: 20,

  /** Schema version for export/import compatibility. */
  exportSchemaVersion: '1.0.0',

  /** Maximum pluggable event handlers. @see NFR-203 */
  maxEventHandlers: 100,
} as const;


  // ─────────────────────────────────────────────────────────
  // 25. VISUALIZATION DATA (CNFL-2804)
  // ─────────────────────────────────────────────────────────

export const visualizationConfig = {
  /** Max nodes in proxy network graph. */
  proxyGraphMaxNodes: 50,

  /** Tech race dashboard refresh interval (turns). */
  techDashboardRefreshInterval: 1,

  /** Resource security map: critical threshold. */
  resourceCriticalThreshold: 20,

  /** Sanctions impact: max data points in timeline. */
  sanctionsTimelineMaxPoints: 60,

  /** Narrative battle replay: max entries. */
  narrativeReplayMaxEntries: 100,
} as const;

