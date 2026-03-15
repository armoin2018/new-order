/**
 * New Order — Geopolitics Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 11. RESOURCES & CLIMATE
  // ─────────────────────────────────────────────────────────

export const resourcesConfig = {
  /** Resource security thresholds and effects. @see FR-1901 */
  securityThresholds: {
    /** Warning level threshold. @see FR-1901 */
    warning: 30,
    /** Inflation increase at warning level. @see FR-1901 */
    warningInflationIncrease: 5,
    /** Civil unrest increase at warning level. @see FR-1901 */
    warningCivilUnrestIncrease: 3,
    /** Critical level threshold. @see FR-1901 */
    critical: 15,
    /** Civil unrest increase at critical level (rationing). @see FR-1901 */
    criticalCivilUnrestIncrease: 10,
    /** Popularity penalty at critical level. @see FR-1901 */
    criticalPopularityPenalty: -10,
    /** Catastrophic level threshold. @see FR-1901 */
    catastrophic: 5,
    /** Stability decay per turn at catastrophic level. @see FR-1901 */
    catastrophicStabilityDecayPerTurn: -10,
  },

  /** Mineral leverage mechanics. @see FR-1902 */
  mineralLeverage: {
    /** Control share threshold to leverage minerals. @see FR-1902 */
    controlThreshold: 0.4,
    /** Semiconductor cost increase on target. @see FR-1902 */
    semiconductorCostIncrease: 0.3,
    /** GDP reduction on target per turn. @see FR-1902 */
    targetGDPReduction: -0.03,
  },

  /** Refugee flow effects. @see FR-1904 */
  refugeeFlow: {
    /** Source nation effects. @see FR-1904 */
    source: {
      /** Labor pool reduction. @see FR-1904 */
      laborReduction: -0.05,
      /** GDP reduction. @see FR-1904 */
      gdpReduction: -0.02,
      /** Legitimacy boost (brain drain narrative). @see FR-1904 */
      legitimacyBoost: 5,
    },
    /** Receiver nation effects per wave. @see FR-1904 */
    receiver: {
      /** Civil unrest per refugee wave. @see FR-1904 */
      civilUnrestPerWave: 5,
      /** Treasury cost per refugee wave. @see FR-1904 */
      treasuryPerWave: -3,
    },
  },

  /** Food weapon mechanics. @see FR-1907 */
  foodWeapon: {
    /** Food production control threshold. @see FR-1907 */
    controlThreshold: 0.3,
    /** Target food supply reduction. @see FR-1907 */
    targetFoodReduction: -20,
    /** Civil unrest increase on target. @see FR-1907 */
    civilUnrestIncrease: 10,
    /** Stability decay on target. @see FR-1907 */
    stabilityDecay: -5,
    /** Legitimacy cost to wielder. @see FR-1907 */
    legitimacyCost: -15,
  },

  /** Strategic reserves mechanics. @see FR-1907 */
  strategicReserves: {
    /** Treasury cost per 10 units of reserves. @see FR-1907 */
    costPer10Units: -5,
  },

  /** Mineral alternative methods and costs. @see FR-1902 */
  mineralAlternatives: {
    /** Domestic mining cost multiplier (+200%). @see FR-1902 */
    domesticMiningCostMultiplier: 3.0,
    /** Deep-sea mining Space tech requirement. @see FR-1902 */
    deepSeaSpaceRequirement: 40,
    /** Deep-sea mining time in turns. @see FR-1902 */
    deepSeaTimeTurns: 5,
    /** Recycling dependency reduction (fraction). @see FR-1902 */
    recyclingDependencyReduction: 0.2,
  },

  /** Per-type climate event effects. @see FR-1903 */
  climateEffects: {
    /** Extreme heat: food production reduction (fraction). @see FR-1903 */
    heatFoodReduction: -0.3,
    /** Extreme heat: duration in turns. @see FR-1903 */
    heatDurationTurns: 2,
    /** Extreme heat: civil unrest increase. @see FR-1903 */
    heatCivilUnrestIncrease: 5,
    /** Catastrophic flooding: infrastructure damage (fraction). @see FR-1903 */
    floodInfrastructureDamage: -0.2,
    /** Catastrophic flooding: treasury cost. @see FR-1903 */
    floodTreasuryCost: -10,
    /** Drought: water supply reduction. @see FR-1903 */
    droughtWaterReduction: -20,
    /** Drought: agricultural GDP reduction (fraction). @see FR-1903 */
    droughtAgricultureGDPReduction: -0.15,
    /** Drought: civil unrest increase. @see FR-1903 */
    droughtCivilUnrestIncrease: 10,
    /** Typhoon: military installation inoperable turns. @see FR-1903 */
    typhoonMilitaryInoperableTurns: 1,
    /** Arctic collapse: chokepoint dependency reduction (fraction). @see FR-1903 */
    arcticChokepointDependencyReduction: 0.25,
  },

  /** Refugee response choice effects. @see FR-1904 */
  refugeeResponseEffects: {
    /** Legitimacy gain from accepting refugees. @see FR-1904 */
    acceptLegitimacyGain: 5,
    /** Civil unrest from accepting refugees. @see FR-1904 */
    acceptCivilUnrestIncrease: 3,
    /** Legitimacy penalty from rejecting refugees. @see FR-1904 */
    rejectLegitimacyPenalty: -10,
    /** Border tension increase from rejecting refugees. @see FR-1904 */
    rejectBorderTensionIncrease: 10,
    /** Pragmatism threshold for weaponized migration. @see FR-1904 */
    weaponizedPragmatismThreshold: 70,
    /** Stability threshold for weaponized migration. @see FR-1904 */
    weaponizedStabilityThreshold: 25,
  },

  /** Pandemic risk and response. @see FR-1905 */
  pandemic: {
    /** Minimum active war theaters to increase risk. @see FR-1905 */
    warTheaterThreshold: 3,
    /** Stability below which pandemic risk increases. @see FR-1905 */
    stabilityThreshold: 15,
    /** Global average biotech below which pandemic risk increases. @see FR-1905 */
    biotechThreshold: 30,
    /** Global GDP penalty per turn during pandemic (fraction). @see FR-1905 */
    gdpPenaltyPerTurn: -0.03,
    /** Turns to develop countermeasures with Biotech >= 50. @see FR-1905 */
    highBiotechRecoveryTurns: 2,
    /** Biotech level for accelerated recovery. @see FR-1905 */
    biotechRecoveryThreshold: 50,
    /** Turns to develop countermeasures with Biotech < 50. @see FR-1905 */
    lowBiotechRecoveryTurns: 4,
    /** GDP penalty from border closure (fraction). @see FR-1905 */
    borderClosureGDPPenalty: -0.05,
    /** Legitimacy gain from cooperative response. @see FR-1905 */
    cooperativeLegitimacyGain: 10,
    /** Legitimacy penalty from hoarding response. @see FR-1905 */
    hoardingLegitimacyPenalty: -10,
  },

  /** Environmental diplomacy tools. @see FR-1908 */
  environmentalDiplomacy: {
    /** Climate Accords legitimacy bonus for signatories. @see FR-1908 */
    accordsLegitimacyBonus: 5,
    /** Climate Accords GDP compliance cost (fraction). @see FR-1908 */
    accordsGDPComplianceCost: -0.02,
    /** Joint Disaster Response chemistry bonus. @see FR-1908 */
    jointResponseChemistryBonus: 10,
    /** Joint Disaster Response trust bonus. @see FR-1908 */
    jointResponseTrustBonus: 5,
    /** Pariah pressure: cumulative legitimacy penalty per turn of non-cooperation. @see FR-1908 */
    pariahLegitimacyPenaltyPerTurn: -2,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 12. PROXY WARS
  // ─────────────────────────────────────────────────────────

export const proxyConfig = {
  /** Discovery probability: 100 - deniability. @see FR-2001 */
  discovery: {
    /** Base value from which deniability is subtracted. @see FR-2001 */
    base: 100,
    /** Tension increase upon discovery. @see FR-2001 */
    tensionIncrease: 15,
    /** Legitimacy penalty upon discovery. @see FR-2001 */
    legitimacyPenalty: -10,
  },

  /** Arming a proxy group effects. @see FR-2002 */
  arming: {
    /** Proxy capability boost from arming. @see FR-2002 */
    capabilityBoost: 10,
    /** Deniability reduction from arming. @see FR-2002 */
    deniabilityReduction: -10,
    /** Treasury cost per arming action. @see FR-2002 */
    treasuryCost: -5,
  },

  /** Political campaign effects. @see FR-2002 */
  politicalCampaign: {
    /** Civil unrest increase in target nation. @see FR-2002 */
    civilUnrestIncrease: 5,
    /** DI cost per campaign. @see FR-2002 */
    diCost: -3,
    /** Deniability reduction from political campaigns. @see FR-2002 */
    deniabilityReduction: -5,
  },

  /** Autonomous operation thresholds. @see FR-2004 */
  autonomousOperation: {
    /** Autonomy level threshold for independent operations. @see FR-2004 */
    autonomyThreshold: 60,
    /** Chance per turn of autonomous operation. @see FR-2004 */
    operationChancePerTurn: 0.3,
  },

  /** Loyalty defection threshold. @see FR-2005 */
  loyaltyDefection: {
    /** Loyalty below this threshold triggers defection risk. @see FR-2005 */
    loyaltyThreshold: 30,
  },

  /** Independence thresholds. @see FR-2003 */
  independence: {
    /** Capability threshold for independence attempt. @see FR-2003 */
    capabilityThreshold: 80,
    /** Autonomy threshold for independence attempt. @see FR-2003 */
    autonomyThreshold: 80,
  },

  /** Terrorist proxy specifics. @see FR-2007 */
  terrorist: {
    /** Legitimacy penalty on discovery of terrorist proxy support. @see FR-2007 */
    discoveryLegitimacyPenalty: -20,
    /** TensionLevel increase with ALL nations on sponsor discovery. @see FR-2007 */
    sponsorDiscoveryTensionIncrease: 20,
    /** Legitimacy bonus from War on Terror campaign. @see FR-2007 */
    warOnTerrorLegitimacyBonus: 15,
  },

  /** Failed state exploitation details. @see FR-2005 */
  failedStateExploitation: {
    /** Legitimacy bonus for peacekeeping intervention. @see FR-2005 */
    peacekeepingLegitimacyBonus: 10,
    /** Legitimacy penalty for exploitation. @see FR-2005 */
    exploitationLegitimacyPenalty: -10,
    /** Turns of sustained effort required for stabilization. @see FR-2005 */
    stabilizationTurns: 6,
  },

  /** Escalation ladder capability bonuses. @see FR-2008 */
  escalationLadder: {
    /** Capability bonus at Level 2 (Acknowledged Support). @see FR-2008 */
    acknowledgedSupportCapabilityBonus: 15,
  },

  /** Deniability degradation rates by action type. @see FR-2006 */
  deniabilityDegradation: {
    /** Deniability loss from arming. @see FR-2004 */
    arming: -10,
    /** Deniability loss from directing operations. @see FR-2004 */
    directing: -5,
    /** Deniability loss from media exposure. @see FR-2004 */
    mediaExposure: -15,
    /** Deniability loss from HUMINT discovery. @see FR-2004 */
    humint: -20,
  },

  /** Escalation ladder tension level per rung. @see FR-2007 */
  escalationLadderTensionPerLevel: 15,

  /** Arms bazaar mechanics. @see FR-2008 */
  armsBazaar: {
    /** Price multiplier for sanctioned buyers. @see FR-2008 */
    sanctionedPriceMultiplier: 2.0,
    /** Delivery delay in turns for black market. @see FR-2008 */
    deliveryDelay: 2,
    /** Chance of receiving defective equipment. @see FR-2008 */
    defectiveChance: 0.2,
    /** Resale value of surplus weapons. @see FR-2008 */
    surplusValue: 0.5,
    /** Chance of weapons leaking to third parties. @see FR-2008 */
    weaponLeakChance: 0.1,
  },

  /** Failed state mechanics. @see FR-2008 */
  failedState: {
    /** Stability threshold below which a state is "failed". @see FR-2008 */
    stabilityThreshold: 10,
    /** Intelligence operation cost reduction in failed states. @see FR-2008 */
    intelCostReduction: 0.5,
    /** Proxy group spawn rate: 1 per N turns. @see FR-2008 */
    proxySpawnRateTurns: 3,
  },
} as const;

export const diplomacyConfig = {
  /** Bilateral agreement type definitions. @see FR-701 */
  agreements: {
    /** Non-Aggression Pact config. @see FR-701 */
    nap: {
      /** Minimum trust to propose. @see FR-1509 */
      minTrust: 20,
      /** DI cost for proposer. */
      diCost: 5,
      /** Stability bonus while active (per turn). */
      stabilityBonusPerTurn: 1,
      /** Tension reduction between signatories. */
      tensionReduction: -10,
      /** Default duration in turns (0 = indefinite until broken). */
      defaultDuration: 0,
    },
    /** Trade Deal config. @see FR-701 */
    tradeDeal: {
      /** Minimum trust to propose. */
      minTrust: 15,
      /** DI cost for proposer. */
      diCost: 8,
      /** GDP growth bonus per turn while active. */
      gdpBonusPerTurn: 0.005,
      /** Treasury income bonus per turn. */
      treasuryBonusPerTurn: 2,
      /** Default duration in turns. */
      defaultDuration: 10,
    },
    /** Defense Pact config. @see FR-701 */
    defensePact: {
      /** Minimum trust to propose. @see FR-1509 */
      minTrust: 40,
      /** DI cost for proposer. */
      diCost: 15,
      /** Military readiness bonus while active. */
      militaryReadinessBonus: 5,
      /** Credibility cost for breaking. */
      breachCredibilityPenalty: -30,
      /** Default duration in turns. */
      defaultDuration: 0,
    },
    /** Intelligence Sharing config. @see FR-701 */
    intelSharing: {
      /** Minimum trust to propose. @see FR-1509 */
      minTrust: 60,
      /** DI cost for proposer. */
      diCost: 12,
      /** Intel sub-score bonus to weaker partner. @see FR-905 */
      intelBonusMin: 10,
      /** Intel sub-score bonus to weaker partner max. @see FR-905 */
      intelBonusMax: 15,
      /** Default duration in turns. */
      defaultDuration: 8,
    },
  },

  /** AI utility evaluation weights for proposal acceptance. @see FR-701 */
  utility: {
    /** Weight of trust in utility calculation. */
    trustWeight: 0.3,
    /** Weight of leader chemistry in utility calculation. */
    chemistryWeight: 0.15,
    /** Weight of national interest alignment. */
    nationalInterestWeight: 0.25,
    /** Weight of military balance (power parity). */
    militaryBalanceWeight: 0.15,
    /** Weight of economic benefit. */
    economicBenefitWeight: 0.15,
    /** Base acceptance threshold (utility must exceed). */
    acceptanceThreshold: 0.5,
    /** Bonus to acceptance from shared enemies. */
    sharedEnemyBonus: 0.15,
    /** Penalty from ideological opposition. */
    ideologicalOppositionPenalty: -0.2,
    /** Maximum number of simultaneous active agreements per faction pair. */
    maxSimultaneousAgreements: 3,
  },

  /** Alliance Credibility system. @see FR-702 */
  credibility: {
    /** Initial credibility for all factions. */
    initialValue: 75,
    /** Minimum credibility value. */
    min: 0,
    /** Maximum credibility value. */
    max: 100,
    /** Credibility penalty for breaking a NAP. */
    napBreachPenalty: -15,
    /** Credibility penalty for breaking a Trade Deal. */
    tradeDealBreachPenalty: -10,
    /** Credibility penalty for breaking a Defense Pact. */
    defensePactBreachPenalty: -30,
    /** Credibility penalty for breaking Intel Sharing. */
    intelSharingBreachPenalty: -20,
    /** Passive credibility recovery per turn (if no breaches). */
    passiveRecoveryPerTurn: 1,
    /** Turns since last breach before recovery begins. */
    recoveryGracePeriod: 5,
    /** Credibility multiplier on future proposal acceptance. */
    acceptanceMultiplierPerPoint: 0.005,
    /** Credibility below which all proposals auto-rejected. */
    autoRejectThreshold: 20,
    /** Credibility threshold for "trusted ally" status. */
    trustedAllyThreshold: 80,
    /** Bonus acceptance probability at trusted ally level. */
    trustedAllyAcceptanceBonus: 0.2,
    /** DI penalty per breach event (global reputation). */
    breachDiPenalty: -5,
    /** Stability penalty from being betrayed. */
    betrayedStabilityPenalty: -5,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 19. UN RESOLUTIONS (FR-703)
  // ─────────────────────────────────────────────────────────

export const unResolutionsConfig = {
  /** Voting threshold: percentage of votes needed to pass. @see FR-703 */
  passingThreshold: 0.5,

  /** Sanctions resolution effects. @see FR-703 */
  sanctions: {
    /** GDP growth penalty applied to targeted nation. */
    gdpGrowthPenalty: -0.15,
    /** Trade volume reduction percentage. */
    tradeReduction: 0.2,
    /** Duration in turns before automatic expiry. */
    durationTurns: 12,
    /** Legitimacy penalty on targeted nation. */
    legitimacyPenalty: -10,
  },

  /** Peacekeeping resolution effects. @see FR-703 */
  peacekeeping: {
    /** Stability bonus to conflict zone. */
    stabilityBonus: 10,
    /** Civil unrest reduction in target nation. */
    civilUnrestReduction: -15,
    /** DI cost to proposing nation. */
    diCostToProposer: -5,
    /** Duration in turns. */
    durationTurns: 8,
  },

  /** Condemnation resolution effects. @see FR-703 */
  condemnation: {
    /** Legitimacy penalty on targeted nation. */
    legitimacyPenalty: -15,
    /** Diplomatic influence penalty on targeted nation. */
    diPenalty: -10,
    /** Duration in turns. */
    durationTurns: 6,
  },

  /** Utility weight factors for AI voting. @see FR-703 */
  votingWeights: {
    /** Weight of relationship with proposer. */
    relationshipWithProposer: 0.3,
    /** Weight of relationship with target. */
    relationshipWithTarget: 0.3,
    /** Weight of strategic interest alignment. */
    strategicInterest: 0.2,
    /** Weight of legitimacy impact on voter. */
    legitimacyImpact: 0.2,
  },
} as const;

