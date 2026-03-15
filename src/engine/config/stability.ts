/**
 * New Order — Stability Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 2. STABILITY & CIVIL UNREST
  // ─────────────────────────────────────────────────────────

export const stabilityConfig = {
  /** CivilUnrest formula weights. @see FR-1301 */
  civilUnrestWeights: {
    /** Weight of inflation on civil unrest. @see FR-1301 */
    inflation: 0.3,
    /** Weight of inequality on civil unrest. @see FR-1301 */
    inequality: 0.2,
    /** Weight of repression backlash on civil unrest. @see FR-1301 */
    repressionBacklash: 0.2,
    /** Weight of ethnic tension on civil unrest. @see FR-1301 */
    ethnicTension: 0.15,
    /** Weight of foreign propaganda on civil unrest. @see FR-1301 */
    foreignPropaganda: 0.15,
  },

  /** Escalation stage threshold bands. @see FR-1302 */
  escalationThresholds: {
    /** Grumbling range: 0-20. @see FR-1302 */
    grumblingMax: 20,
    /** Protests range: 21-40. @see FR-1302 */
    protestsMin: 21,
    /** Protests range upper bound. @see FR-1302 */
    protestsMax: 40,
    /** Riots range: 41-60. @see FR-1302 */
    riotsMin: 41,
    /** Riots range upper bound. @see FR-1302 */
    riotsMax: 60,
    /** Insurrection range: 61-80. @see FR-1302 */
    insurrectionMin: 61,
    /** Insurrection range upper bound. @see FR-1302 */
    insurrectionMax: 80,
    /** Civil War range: 81-100. @see FR-1302 */
    civilWarMin: 81,
    /** Civil War range upper bound. @see FR-1302 */
    civilWarMax: 100,
  },

  /** Effects during Protests stage. @see FR-1304 */
  protestsEffects: {
    /** Popularity decay per turn during protests. @see FR-1304 */
    popularityDecayPerTurn: -2,
    /** Economic growth decay per turn during protests. @see FR-1304 */
    economicGrowthDecayPerTurn: -1,
  },

  /** Effects during Riots stage. @see FR-1304 */
  riotsEffects: {
    /** Stability decay per turn during riots. @see FR-1304 */
    stabilityDecayPerTurn: -3,
    /** Tourism & FDI reduction during riots. @see FR-1304 */
    tourismFDIReduction: -0.2,
    /** Morale hit in hexes affected by riots. @see FR-1304 */
    moraleHitInRiotHex: -10,
  },

  /** Effects during Insurrection stage. @see FR-1304 */
  insurrectionEffects: {
    /** Stability decay per turn during insurrection. @see FR-1304 */
    stabilityDecayPerTurn: -5,
    /** Military readiness decay per turn during insurrection. @see FR-1304 */
    militaryReadinessDecayPerTurn: -5,
  },

  /** Repression backlash feedback loop threshold. @see FR-1304 */
  repressionBacklashThreshold: 50,

  /** Police deployment effects. @see FR-1302 */
  policeDeployment: {
    /** Immediate civil unrest reduction from deploying police. @see FR-1302 */
    unrestReduction: -10,
    /** Repression backlash added from deploying police. @see FR-1302 */
    backlashIncrease: 5,
  },

  /** Curfew effects. @see FR-1302 */
  curfew: {
    /** Economic activity multiplier during curfew (halved). @see FR-1302 */
    economicActivityMultiplier: 0.5,
  },

  /** Inequality computation parameters. @see FR-1306 */
  inequality: {
    /** GDP growth rate threshold above which inequality rises without social spending. @see FR-1306 */
    growthThreshold: 2,
    /** Inequality growth per turn when GDP grows without social spending. @see FR-1306 */
    growthRate: 3,
    /** Inequality reduction per unit of social spending (Treasury). @see FR-1306 */
    socialSpendingEffect: -0.5,
    /** Maximum inequality value. @see FR-1306 */
    max: 100,
    /** Minimum inequality value. @see FR-1306 */
    min: 0,
  },

  /** Media manipulation parameters. @see FR-1307 */
  mediaManipulation: {
    /** Diplomatic influence cost per manipulation attempt. @see FR-1307 */
    diCost: 5,
    /** Base success probability (0-1). @see FR-1307 */
    baseSuccessProbability: 0.3,
    /** Press freedom modifier: higher press freedom → lower success. Formula: base + (100 − pressFreedom) × modifier. @see FR-1307 */
    pressFreedomModifier: 0.005,
    /** Foreign propaganda risk increase on success (autocracy vulnerability). @see FR-1307 */
    foreignPropagandaRisk: 5,
  },

  /** Foreign propaganda rate. @see FR-1305 */
  foreignPropaganda: {
    /** CivilUnrest increase per turn = targetCovert × rate. @see FR-1305 */
    covertMultiplier: 0.1,
  },

  /** Coup attempt formula parameters. @see FR-1311 */
  coupAttempt: {
    /** Weight of (100 − military) in coup probability. @see FR-1311 */
    militaryWeight: 0.3,
    /** Weight of (100 − securityServices) in coup probability. @see FR-1311 */
    securityServicesWeight: 0.3,
    /** Weight of popularity subtracted from coup probability. @see FR-1311 */
    popularityWeight: 0.2,
    /** PowerBase.military threshold below which coup is possible. @see FR-1311 */
    militaryThreshold: 30,
    /** PowerBase.securityServices threshold below which coup is possible. @see FR-1311 */
    securityServicesThreshold: 30,
  },

  /** Martial law effects. @see FR-1309 */
  martialLaw: {
    /** Immediate civil unrest reduction from martial law. @see FR-1309 */
    unrestReduction: -30,
    /** Popularity decay per turn under martial law. @see FR-1309 */
    popularityDecayPerTurn: -20,
    /** Economic growth reduction under martial law. @see FR-1309 */
    economicGrowthReduction: -0.3,
    /** Tension increase to all factions from martial law. @see FR-1309 */
    tensionIncreaseAllFactions: 10,
    /** Military power-base threshold triggering coup risk. @see FR-1309 */
    coupRiskMilitaryThreshold: 50,
  },

  /** Regime change trigger conditions. @see FR-1308 */
  regimeChange: {
    /** Stability at-or-below which regime change occurs. @see FR-1308 */
    stabilityThreshold: 0,
    /** Civil unrest at-or-above which regime change occurs. @see FR-1308 */
    civilUnrestThreshold: 100,
    /** ±variance applied to all psychological dimensions on regime change. @see FR-1308 */
    personalityRandomizationRange: 20,
    /** SuccessionClarity threshold allowing player to continue as successor. @see FR-1309 */
    successionClarityThreshold: 60,
    /** Power base reduction applied to successor after regime change. @see FR-1309 */
    successorPowerBaseReduction: 20,
  },

  /** Insurrection stage expanded mechanics (Phase 2). @see FR-1302 */
  insurrectionExpanded: {
    /** Number of armed faction units spawned at insurrection onset. @see FR-1302 */
    armedFactionsSpawned: 2,
    /** Strength of each spawned armed faction (0-100). @see FR-1302 */
    armedFactionStrength: 40,
    /** Hexes government loses control of per turn during insurrection. @see FR-1302 */
    hexControlLossPerTurn: 3,
    /** MilitaryReadiness cost for diverting forces to insurrection. @see FR-1302 */
    militaryDiversionCost: -5,
  },

  /** Civil war stage expanded mechanics (Phase 2). @see FR-1302 */
  civilWarExpanded: {
    /** Stability decay per turn during civil war. @see FR-1302 */
    stabilityDecayPerTurn: -10,
    /** Economic growth penalty during civil war. @see FR-1302 */
    economicGrowthMultiplier: -0.5,
    /** Military readiness decay per turn. @see FR-1302 */
    militaryReadinessDecayPerTurn: -10,
    /** Minimum faction split count (nation divides into 2-3 factions). @see FR-1302 */
    minSplitFactions: 2,
    /** Maximum faction split count. @see FR-1302 */
    maxSplitFactions: 3,
    /** Treasury split factor — each faction gets 1/n of treasury. @see FR-1302 */
    treasurySplitEqual: true,
  },

  /** Ethnic fault-line foreign-funded separatism. @see FR-1303 */
  ethnicFunding: {
    /** Tension increase per turn per unit of foreign COVERT funding. @see FR-1303 */
    tensionPerCovertUnit: 0.15,
    /** Maximum tension boost from foreign funding per turn. @see FR-1303 */
    maxFundingBoostPerTurn: 10,
    /** Tension increase from hostile government actions toward minorities. @see FR-1303 */
    hostileActionTensionIncrease: 8,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 14. POWER BASE
  // ─────────────────────────────────────────────────────────

export const powerBaseConfig = {
  /** Faction hostility threshold: factions below this are hostile. @see FR-1310 */
  hostileThreshold: 15,

  /** Coup trigger conditions. @see FR-1311 */
  coup: {
    /** Military power-base threshold (below this enables coup). @see FR-1311 */
    militaryThreshold: 30,
    /** Security services power-base threshold (below this enables coup). @see FR-1311 */
    securityThreshold: 30,
  },

  /** Coup formula weights: CoupChance = (100 - military) * 0.3 + (100 - securityServices) * 0.3 - Popularity * 0.2. @see FR-1311 */
  coupFormula: {
    /** Base value from which military is subtracted. @see FR-1311 */
    base: 100,
    /** Weight of military deficit. @see FR-1311 */
    militaryWeight: 0.3,
    /** Weight of security services deficit. @see FR-1311 */
    securityWeight: 0.3,
    /** Weight of popularity (negative = protective). @see FR-1311 */
    popularityWeight: 0.2,
  },

  /** Power Base erosion per action category. @see FR-1310 */
  erosionPerAction: {
    /** Launching an unpopular war. @see FR-1310 */
    unpopularWar: { military: 5, oligarchs: -3, party: -2, clergy: 0, public: -10, securityServices: 3 },
    /** Economic sanctions imposed on nation. @see FR-1310 */
    economicSanctions: { military: 0, oligarchs: -8, party: -3, clergy: 0, public: -5, securityServices: 0 },
    /** Religious crackdown. @see FR-1310 */
    religiousCrackdown: { military: 0, oligarchs: 0, party: 2, clergy: -12, public: -5, securityServices: 3 },
    /** Social spending / reform. @see FR-1310 */
    socialReform: { military: -2, oligarchs: -3, party: 0, clergy: 0, public: 8, securityServices: 0 },
    /** Military spending increase. @see FR-1310 */
    militarySpending: { military: 6, oligarchs: -2, party: 0, clergy: 0, public: -3, securityServices: 2 },
    /** Intelligence expansion. @see FR-1310 */
    intelligenceExpansion: { military: 0, oligarchs: 0, party: -2, clergy: -1, public: -4, securityServices: 8 },
  },
} as const;

