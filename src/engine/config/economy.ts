/**
 * New Order — Economy Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 4b. ECONOMIC ENGINE (FR-600)
  // ─────────────────────────────────────────────────────────

export const economyConfig = {
  /** Treasury replenishment formula weights. @see FR-606 */
  treasury: {
    /** Fraction of GDP that flows into treasury per turn. @see FR-606 */
    gdpIncomeRate: 0.005,
    /** Fraction of trade balance that flows into treasury per turn. @see FR-606 */
    tradeBalanceRate: 0.1,
    /** Fraction of resource exports that flows into treasury per turn. @see FR-606 */
    resourceExportRate: 0.15,
    /** Minimum treasury floor (cannot go below). @see FR-606 */
    minimumTreasury: 0,
  },

  /** Chokepoint resource disruption effects. @see FR-601 */
  chokepointResources: {
    /** MilitaryReadiness decay per turn per disrupted resource. @see FR-601 */
    militaryReadinessDecayPerTurn: -3,
    /** IndustrialStability (techLevel proxy) decay per turn per disrupted resource. @see FR-601 */
    industrialStabilityDecayPerTurn: -2,
    /** Number of turns before cascading decay begins. @see FR-601 */
    cascadeDelayTurns: 1,
  },

  /** Strait of Hormuz energy flow formula. @see FR-603 */
  hormuzOil: {
    /** GlobalInflation coefficient per unit of OilSupplyDisruption. @see FR-603 */
    inflationCoefficient: 0.15,
    /** Maximum oil supply disruption value (fully blockaded). @see FR-603 */
    maxDisruption: 100,
    /** Stability penalty per 10 points of inflation above baseline. @see FR-603 */
    stabilityPenaltyPer10Inflation: -2,
  },

  /** Rare earth restriction effects. @see FR-602 */
  rareEarth: {
    /** HighTechProduction (techLevel) penalty percentage. @see FR-602 */
    techProductionPenalty: -20,
    /** Stability decay per turn during restriction. @see FR-602 */
    stabilityDecayPerTurn: -2,
    /** Turns required to secure alternate source. @see FR-602 */
    alternateSourceTurns: 4,
    /** Treasury cost to initiate alternate sourcing. @see FR-602 */
    alternateSourceCost: 50,
    /** Partial mitigation factor during sourcing (0-1, applied to penalties). @see FR-602 */
    sourcingMitigationFactor: 0.5,
  },

  /** Reciprocal tariff effects. @see FR-604 */
  tariffs: {
    /** US inflation increase per tariff action. @see FR-604 */
    usInflationIncrease: 2,
    /** US stability (popularity) boost per tariff action. @see FR-604 */
    usStabilityBoost: 3,
    /** Target nation treasury drain (billions). @see FR-604 */
    targetTreasuryDrain: 15,
    /** Target nation GDP penalty per active tariff per turn. @see FR-604 */
    targetGDPPenaltyPerTurn: -0.01,
    /** Maximum number of simultaneous tariff targets. @see FR-604 */
    maxSimultaneousTargets: 4,
  },

  /** Trade Shield (ART agreement) mechanics. @see FR-605 */
  tradeShield: {
    /** Treasury cost to initiate ART agreement. @see FR-605 */
    artInitiationCost: 20,
    /** DI bonus from ART formation. @see FR-605 */
    artDIBonus: 5,
    /** China blockade escalation probability when ART is active. @see FR-605 */
    chinaBlockadeEscalationChance: 0.6,
  },

  /** Global inflation effects on stability. @see FR-603 */
  inflationEffects: {
    /** Inflation threshold above which stability penalty begins. @see FR-603 */
    penaltyThreshold: 10,
    /** Stability penalty per point of inflation above threshold. @see FR-603 */
    stabilityPenaltyPerPoint: -0.5,
    /** Maximum inflation-driven stability penalty per turn. @see FR-603 */
    maxStabilityPenalty: -15,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 9. FINANCIAL WARFARE
  // ─────────────────────────────────────────────────────────

export const financialConfig = {
  /** SWIFT disconnection effects. @see FR-1701 */
  swiftDisconnection: {
    /** Diplomatic Influence threshold required to initiate. @see FR-1701 */
    diThreshold: 60,
    /** Coalition GDP share threshold required. @see FR-1701 */
    coalitionGDPThreshold: 0.6,
    /** Trade income reduction on target. @see FR-1701 */
    tradeIncomeReduction: -0.7,
    /** GDP decay per turn on target. @see FR-1701 */
    gdpDecayPerTurn: -0.05,
    /** Initial effectiveness of alternative payment systems. @see FR-1701 */
    altPaymentInitialEffectiveness: 0.3,
    /** Improvement per turn of alternative payment systems. @see FR-1701 */
    altPaymentImprovementPerTurn: 0.05,
  },

  /** Sanction tiers and effects. @see FR-1702 */
  sanctionTiers: {
    /** Targeted sanctions. @see FR-1702 */
    targeted: {
      /** Oligarch power-base hit. @see FR-1702 */
      oligarchsHit: -10,
      /** DI cost to impose. @see FR-1702 */
      diCost: -3,
    },
    /** Sectoral sanctions. @see FR-1702 */
    sectoral: {
      /** GDP decay per turn per sanctioned sector. @see FR-1702 */
      gdpDecayPerTurnPerSector: -0.02,
      /** Own trade reduction (blowback). @see FR-1702 */
      ownTradeReduction: -0.5,
    },
    /** Comprehensive sanctions. @see FR-1702 */
    comprehensive: {
      /** GDP decay per turn on target. @see FR-1702 */
      gdpDecayPerTurn: -0.05,
      /** Treasury hit on target. @see FR-1702 */
      treasuryHit: -0.4,
      /** Civil unrest increase per turn on target. @see FR-1702 */
      civilUnrestPerTurn: 5,
      /** Legitimacy cost to sender if target is weak. @see FR-1702 */
      legitimacyCostIfWeakTarget: -5,
    },
  },

  /** Sanctions fatigue — effectiveness decay per turn. @see FR-1702 */
  sanctionsFatigueDecayPerTurn: 0.05,

  /** Secondary sanctions. @see FR-1703 */
  secondarySanctions: {
    /** DI threshold required. @see FR-1703 */
    diThreshold: 70,
    /** GDP threshold of imposing nation required. @see FR-1703 */
    gdpThreshold: 0.25,
    /** Legitimacy cost to imposing nation. @see FR-1703 */
    legitimacyCost: -5,
    /** Reduction in target evasion network effectiveness. @see FR-1703 */
    evasionNetworkEffectivenessReduction: 0.1,
  },

  /** Crypto evasion network. @see FR-1704 */
  cryptoEvasion: {
    /** Treasury cost to build network. @see FR-1704 */
    buildCost: -10,
    /** Turns required to build network. @see FR-1704 */
    buildTurns: 3,
    /** Sanctions effectiveness reduction once active. @see FR-1704 */
    sanctionsReduction: 0.2,
    /** Corruption-driven civil unrest per turn. @see FR-1704 */
    corruptionUnrestPerTurn: 3,
  },

  /** Debt trap diplomacy. @see FR-1705 */
  debtTrap: {
    /** Duration of initial GDP boost in turns. @see FR-1705 */
    gdpBoostDuration: 3,
    /** GDP boost per turn during initial phase. @see FR-1705 */
    gdpBoostPerTurn: 15,
    /** Legitimacy penalty on default. @see FR-1705 */
    defaultLegitimacyPenalty: -10,
    /** Turns of finance blocked on default. @see FR-1705 */
    defaultFinanceBlockTurns: 5,
    /** DI bonus for lender on default. @see FR-1705 */
    lenderDIBonus: 20,
  },

  /** Currency manipulation mechanics. @see FR-1706 */
  currencyManipulation: {
    /** Trade competitiveness boost from devaluation. @see FR-1706 */
    devaluationTradeBoost: 0.1,
    /** Inflation increase from devaluation. @see FR-1706 */
    devaluationInflationIncrease: 5,
    /** Reserves spend per turn for reserve weaponization. @see FR-1706 */
    reserveWeaponizationSpend: -10,
    /** Target currency value reduction. @see FR-1706 */
    currencyAttackTargetReduction: -0.15,
    /** Reserves required to sustain currency attack. @see FR-1706 */
    currencyAttackReservesRequired: 20,
  },

  /** War economy effects. @see FR-1707 */
  warEconomy: {
    /** Military production boost. @see FR-1707 */
    militaryProductionBoost: 0.3,
    /** Treasury mobilization boost. @see FR-1707 */
    treasuryMobilizationBoost: 0.2,
    /** GDP growth freeze (set to 0). @see FR-1707 */
    gdpGrowthFreeze: 0,
    /** Civil unrest per turn during war economy. @see FR-1707 */
    civilUnrestPerTurn: 3,
    /** Legitimacy cost of war economy declaration. @see FR-1707 */
    legitimacyCost: -5,
    /** Turns before exhaustion effects begin. @see FR-1707 */
    exhaustionTurnThreshold: 12,
    /** GDP decay per turn after exhaustion. @see FR-1707 */
    exhaustionGDPDecay: -0.02,
    /** Duration of post-war recession in turns. @see FR-1707 */
    recessionDuration: 3,
    /** GDP decay per turn during recession. @see FR-1707 */
    recessionGDPDecay: -0.03,
  },

  /** GFSI contagion mechanics. @see FR-1708 */
  gfsiContagion: {
    /** GFSI score threshold that triggers global contagion. @see FR-1708 */
    contagionThreshold: 30,
    /** GDP penalty per turn from contagion. @see FR-1708 */
    gdpPenaltyPerTurn: -0.02,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 8d. MARKET REACTIONS (FR-203)
  // ─────────────────────────────────────────────────────────

export const marketReactionsConfig = {
  /**
   * Trigger keywords scanned in headlines.
   * Each keyword maps to an inflation delta applied when detected.
   * @see FR-203
   */
  triggers: {
    /** Strait of Hormuz disruption trigger. @see FR-203 */
    hormuz: {
      keyword: 'Strait of Hormuz',
      inflationDelta: 5,
    },
    /** Nuclear threshold trigger. @see FR-203 */
    nuclear: {
      keyword: 'Nuclear Threshold',
      inflationDelta: 8,
    },
    /** Rare earth ban trigger. @see FR-203 */
    rareEarth: {
      keyword: 'Rare Earth Ban',
      inflationDelta: 4,
    },
  },
  /** Maximum cumulative inflation delta from market reactions per turn. @see FR-203 */
  maxInflationDeltaPerTurn: 15,
  /** Cooldown turns before the same trigger keyword can fire again. @see FR-203 */
  triggerCooldownTurns: 2,
} as const;


  // ─────────────────────────────────────────────────────────
  // 10. TECHNOLOGY RACE
  // ─────────────────────────────────────────────────────────

export const technologyConfig = {
  /** AI amplification: intelligence effectiveness bonus per 10 AI levels. @see FR-1801 */
  aiAmplification: {
    /** Intelligence effectiveness bonus per 10 AI tech levels. @see FR-1801 */
    intelligenceEffectivenessPerTenAI: 0.01,
  },

  /** Investment base cost: Treasury per +1 level. @see FR-1802 */
  investment: {
    /** Base Treasury cost per +1 tech level. @see FR-1802 */
    baseCostPerLevel: 10,
    /** Tech level above which cost becomes exponential. @see FR-1802 */
    exponentialThreshold: 50,
  },

  /** Tech decay without investment. @see FR-1802 */
  decay: {
    /** Tech level lost per period without investment. @see FR-1802 */
    decayAmount: -1,
    /** Turns without investment before decay triggers. @see FR-1802 */
    decayIntervalTurns: 5,
  },

  /** Tech espionage. @see FR-1803 */
  espionage: {
    /** Tech levels gained from successful espionage. @see FR-1803 */
    levelBonus: 5,
    /** Tension increase if espionage is discovered. @see FR-1803 */
    discoveryTensionIncrease: 20,
    /** Legitimacy penalty if espionage is discovered. @see FR-1803 */
    discoveryLegitimacyPenalty: -10,
  },

  /** Export control costs. @see FR-1804 */
  exportControl: {
    /** DI cost for unilateral export controls. @see FR-1804 */
    unilateralDICost: -3,
    /** Investment cost increase for multilateral controls on target. @see FR-1804 */
    multilateralInvestmentCostIncrease: 0.5,
  },

  /** Semiconductor chokepoint. @see FR-1804 */
  semiconductorChokepoint: {
    /** Production control threshold to leverage semiconductors. @see FR-1804 */
    productionControlThreshold: 0.5,
  },

  /** AI capability thresholds and effects. @see FR-1805 */
  aiThresholds: {
    /** AI level for autonomous drones. @see FR-1805 */
    autonomousDrones: 50,
    /** Military effectiveness bonus from autonomous drones. @see FR-1805 */
    autonomousDronesMilitaryBonus: 0.1,
    /** AI level for predictive intelligence. @see FR-1805 */
    predictiveIntel: 70,
    /** Intelligence reliability bonus from predictive intel. @see FR-1805 */
    predictiveIntelReliabilityBonus: 0.2,
    /** AI level for strategic AI assistance. @see FR-1805 */
    strategicAI: 90,
    /** Decision confidence improvement from strategic AI. @see FR-1805 */
    strategicAIConfidenceImprovement: 0.3,
    /** AI arms race trigger threshold. @see FR-1805 */
    aiArmsRaceThreshold: 80,
    /** Escalation speed multiplier during AI arms race. @see FR-1805 */
    aiArmsRaceEscalationMultiplier: 2,
  },

  /** Quantum computing mechanics. @see FR-1806 */
  quantum: {
    /** Quantum threat threshold. @see FR-1806 */
    threatThreshold: 70,
    /** Intel reliability bonus vs nation with low quantum. @see FR-1806 */
    intelBonusVsLowQuantum: 0.3,
    /** Quantum level required for QRE. @see FR-1806 */
    qreQuantumRequirement: 50,
    /** Cyber level required for QRE. @see FR-1806 */
    qreCyberRequirement: 60,
  },

  /** Tech decoupling mechanics. @see FR-1807 */
  techDecoupling: {
    /** Mutual export control threshold that triggers decoupling. @see FR-1807 */
    mutualExportControlThreshold: 60,
    /** Cost multiplier for non-aligned nations. @see FR-1807 */
    nonAlignedCostMultiplier: 1.5,
    /** Intel bonus within a tech bloc. @see FR-1807 */
    intraBlocIntelBonus: 0.1,
    /** Cyber bonus for cross-bloc operations. @see FR-1807 */
    crossBlocCyberBonus: 0.15,
    /** Global GDP penalty per turn from decoupling. @see FR-1807 */
    globalGDPPenalty: -0.01,
  },

  /** Dual-use dilemma triggers and effects. @see FR-1808 */
  dualUseDilemma: {
    /** AI level that triggers dual-use dilemma. @see FR-1808 */
    aiTrigger: 60,
    /** Biotech level that triggers dual-use dilemma. @see FR-1808 */
    biotechTrigger: 60,
    /** Legitimacy gain from signing accords. @see FR-1808 */
    accordsLegitimacyBonus: 10,
    /** Legitimacy penalty from refusing accords. @see FR-1808 */
    refusalLegitimacyPenalty: -5,
    /** Legitimacy penalty if secret violation discovered. @see FR-1808 */
    secretViolationLegitimacyPenalty: -25,
  },
} as const;

