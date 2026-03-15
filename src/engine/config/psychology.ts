/**
 * New Order — Psychology Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 7. PSYCHOLOGICAL ENGINE
  // ─────────────────────────────────────────────────────────

export const psychologyConfig = {
  /** Emotional state modifiers on utility calculations. @see FR-1502 */
  emotionalModifiers: {
    /** High anger modifiers (anger ≥ 60). @see FR-1502 */
    highAnger: {
      /** Anger threshold. @see FR-1502 */
      threshold: 60,
      /** Bonus weight to aggressive actions. @see FR-1502 */
      aggressiveActionWeightBonus: 0.2,
    },
    /** High fear modifiers (fear ≥ 60). @see FR-1502 */
    highFear: {
      /** Fear threshold. @see FR-1502 */
      threshold: 60,
      /** Bonus weight to defensive actions. @see FR-1502 */
      defensiveActionWeightBonus: 0.15,
    },
    /** High stress modifiers (stress ≥ 70). @see FR-1503 */
    highStress: {
      /** Stress threshold for noise introduction. @see FR-1503 */
      threshold: 70,
      /** ±perturbation range applied to decision utility. @see FR-1503 */
      decisionNoiseRange: 0.15,
    },
    /** High confidence modifiers (confidence ≥ 70). @see FR-1502 */
    highConfidence: {
      /** Confidence threshold. @see FR-1502 */
      threshold: 70,
      /** Risk tolerance boost when confidence is high. @see FR-1502 */
      riskToleranceBoost: 15,
    },
    /** High resolve modifiers (resolve ≥ 70). @see FR-1502 */
    highResolve: {
      /** Resolve threshold. @see FR-1502 */
      threshold: 70,
      /** Stress gain reduction multiplier when resolve is high. @see FR-1502 */
      stressGainReduction: 0.5,
    },
  },

  /** Decision fatigue mechanics. @see FR-1503 */
  decisionFatigue: {
    /** Fatigue level threshold that activates negative effects. @see FR-1503 */
    threshold: 60,
    /** Chance of defaulting to previous decision. @see FR-1503 */
    defaultingChance: 0.3,
    /** Chance of deferring decision entirely. @see FR-1503 */
    deferralChance: 0.2,
    /** Chance of impulsive (sub-optimal) decision. @see FR-1503 */
    impulsivityChance: 0.1,
    /** Peacetime fatigue reset per turn. @see FR-1503 */
    peacetimeResetPerTurn: -20,
  },

  /** Cognitive bias intensity parameters. @see FR-1505 */
  cognitiveBiases: {
    /** Sunk Cost bias. @see FR-1505 */
    sunkCost: {
      /** Weight bonus to continuing current strategy. @see FR-1505 */
      continuingWeightBonus: 0.3,
      /** Number of turns invested before bias triggers. @see FR-1505 */
      triggerTurns: 3,
    },
    /** Confirmation Bias. @see FR-1505 */
    confirmationBias: {
      /** Weight bonus to intelligence aligned with existing beliefs. @see FR-1505 */
      alignedIntelWeightBonus: 0.25,
    },
    /** Groupthink bias. @see FR-1515 */
    groupthink: {
      /** Utility bonus for faction-aligned options. @see FR-1515 */
      factionAlignedBonus: 0.2,
      /** Utility penalty for options opposed by faction. @see FR-1515 */
      opposedPenalty: -0.4,
    },
    /** Anchoring bias. @see FR-1505 */
    anchoring: {
      /** Weight bonus to first-encountered event assessment. @see FR-1505 */
      firstEventWeightBonus: 0.25,
    },
    /** Loss Aversion bias. @see FR-1505 */
    lossAversion: {
      /** Multiplier on defensive option utility. @see FR-1505 */
      defensiveWeightMultiplier: 2.0,
      /** Penalty to offensive option utility. @see FR-1505 */
      offensivePenalty: -0.3,
    },
    /** Optimism bias. @see FR-1505 */
    optimism: {
      /** Degree to which risk is underestimated. @see FR-1505 */
      riskUnderestimate: 0.2,
    },
    /** Availability Heuristic. @see FR-1505 */
    availabilityHeuristic: {
      /** Threat bonus for recently experienced events. @see FR-1505 */
      recentEventThreatBonus: 0.4,
      /** Number of turns an event remains "recent". @see FR-1505 */
      recencyWindow: 3,
    },
    /** Escalation of Commitment. @see FR-1505 */
    escalationOfCommitment: {
      /** Nuclear threshold that triggers escalation commitment. @see FR-1505 */
      nuclearThresholdTrigger: 50,
      /** Penalty to de-escalation option utility. @see FR-1505 */
      deescalationPenalty: -0.25,
    },
    /** Dunning-Kruger effect. @see FR-1505 */
    dunningKruger: {
      /** Overconfidence bonus applied when competence is low. @see FR-1505 */
      overconfidenceBonus: 0.15,
      /** Competence threshold below which effect activates. @see FR-1505 */
      competenceThreshold: 30,
    },
    /** Recency bias. @see FR-1505 */
    recency: {
      /** Weight bonus to most recent events. @see FR-1505 */
      recentWeightBonus: 0.2,
      /** Window of turns considered "recent". @see FR-1505 */
      recencyWindow: 2,
    },
  },

  /** Trauma response modifiers. @see FR-1506 */
  traumaResponse: {
    /** Trauma from a nuclear strike event. @see FR-1506 */
    nuclearStrike: {
      /** Permanent minimum fear level after nuclear strike. @see FR-1506 */
      fearPermanentMin: 70,
      /** Chance the leader escalates further. @see FR-1506 */
      escalateChance: 0.8,
      /** Chance the leader retreats/capitulates. @see FR-1506 */
      retreatChance: 0.2,
    },
    /** Trauma from an assassination attempt. @see FR-1506 */
    assassinationAttempt: {
      /** Paranoia boost from assassination attempt. @see FR-1506 */
      paranoiaBoost: 25,
      /** Security power-base boost. @see FR-1506 */
      securityPowerBaseBoost: 10,
      /** Public power-base penalty. @see FR-1506 */
      publicPowerBasePenalty: -5,
    },
    /** Trauma from a capital siege. @see FR-1506 */
    capitalSiege: {
      /** All emotional dimensions spike to this value. @see FR-1506 */
      emotionalSpikeTo: 80,
      /** Fatigue accumulation multiplier during siege. @see FR-1506 */
      fatigueMultiplier: 3,
      /** Duration in turns the fatigue multiplier persists. @see FR-1506 */
      fatigueMultiplierDuration: 6,
    },
  },

  /** Stress inoculation mechanics. @see FR-1507 */
  stressInoculation: {
    /** Turns at high stress required to trigger inoculation. @see FR-1507 */
    turnsRequired: 20,
    /** Minimum stress level that counts toward inoculation. @see FR-1507 */
    stressThreshold: 50,
    /** Stress gain reduction after inoculation. @see FR-1507 */
    stressGainReduction: -0.2,
    /** Pragmatism personality boost after inoculation. @see FR-1507 */
    pragmatismBoost: 10,
    /** Ideology personality reduction after inoculation. @see FR-1507 */
    ideologyReduction: -10,
  },

  /** Leader chemistry modifiers. @see FR-1508 */
  chemistry: {
    /** Agreement acceptance bonus from positive chemistry. @see FR-1508 */
    agreementAcceptanceBonus: 0.1,
    /** Tension reduction per positive chemistry point. @see FR-1508 */
    tensionReductionPerPositive: -5,
    /** Agreement acceptance penalty from negative chemistry. @see FR-1508 */
    agreementAcceptancePenalty: -0.1,
    /** Tension increase per negative chemistry point. @see FR-1508 */
    tensionIncreasePerNegative: 5,
  },

  /** Trust formula multipliers. @see FR-1509 */
  trust: {
    /** Multiplier for promises kept. @see FR-1509 */
    promisesKeptMultiplier: 2,
    /** Multiplier for promises broken. @see FR-1509 */
    promisesBrokenMultiplier: -5,
    /** Multiplier for ideological alignment. @see FR-1509 */
    ideologicalAlignmentMultiplier: 0.5,
    /** Multiplier for past betrayals. @see FR-1509 */
    pastBetrayalMultiplier: -10,
  },

  /** Trust thresholds for agreement tiers. @see FR-1509 */
  trustThresholds: {
    /** Trust required for Non-Aggression Pact. @see FR-1509 */
    NAP: 20,
    /** Trust required for Defense Pact. @see FR-1509 */
    defensePact: 40,
    /** Trust required for Intelligence Sharing. @see FR-1509 */
    intelligenceSharing: 60,
    /** Red Telephone DI cost discount at max trust. @see FR-1509 */
    redTelephoneDiscount: 0.5,
  },

  /** Grudge mechanics. @see FR-1510 */
  grudge: {
    /** Grudge severity decay per turn. @see FR-1510 */
    decayPerTurn: -0.5,
    /** Minimum grudge severity before it is removed. @see FR-1510 */
    minimumSeverity: 1,
    /** Utility multiplier for retaliatory actions. @see FR-1510 */
    retaliationUtilityMultiplier: 2,
    /** Vengeful personality reduces grudge decay by this factor. @see FR-1510 */
    vengefulDecayReduction: 0.5,
  },

  /** Diplomatic encounter formula weights. @see FR-1511 */
  diplomaticEncounter: {
    /** Weight of chemistry in encounter outcome. @see FR-1511 */
    chemistryWeight: 0.3,
    /** Weight of trust in encounter outcome. @see FR-1511 */
    trustWeight: 0.3,
    /** Weight of relative power in encounter outcome. @see FR-1511 */
    relativePowerWeight: 0.2,
    /** Weight of emotional alignment in encounter outcome. @see FR-1511 */
    emotionalAlignmentWeight: 0.2,
    /** Coercion bonus added to encounter score. @see FR-1511 */
    coercionBonus: 0.1,
  },

  /** Echo chamber mechanics. @see FR-1515 */
  echoChamber: {
    /** Power-base faction dominance threshold to enter echo chamber. @see FR-1515 */
    powerBaseThreshold: 80,
    /** Power-base threshold to exit echo chamber. @see FR-1515 */
    exitThreshold: 70,
    /** Intelligence reliability penalty while in echo chamber. @see FR-1515 */
    intelligenceReliabilityPenalty: -0.3,
    /** Utility penalty for opposed-to-faction options. @see FR-1515 */
    opposedUtilityPenalty: -0.4,
    /** Utility bonus for faction-aligned options. @see FR-1515 */
    factionUtilityBonus: 0.25,
    /** Bias intensity increase while in echo chamber. @see FR-1515 */
    biasIntensification: 20,
  },

  /** Sycophancy mechanics. @see FR-1516 */
  sycophancy: {
    /** Security services power-base threshold that enables sycophancy. @see FR-1516 */
    securityThreshold: 80,
    /** Paranoia threshold that enables sycophancy. @see FR-1516 */
    paranoiaThreshold: 70,
    /** Reliability inflation (false positives). @see FR-1516 */
    reliabilityInflation: 15,
    /** Bad news delivery delay in turns. @see FR-1516 */
    newsDelay: 1,
    /** Civil unrest warning delay in turns. @see FR-1516 */
    unrestWarningDelay: 2,
  },

  /** Emotional contagion mechanics. @see FR-1518 */
  emotionalContagion: {
    /** Rate at which leader emotions spread to population. @see FR-1518 */
    leaderToPopulationRate: 0.1,
    /** Divergence between leader and population moods that triggers stress. @see FR-1518 */
    populationDivergenceThreshold: 40,
    /** Number of turns divergence must persist to trigger penalty. @see FR-1518 */
    divergenceTurns: 3,
    /** Stress penalty per turn from mood divergence. @see FR-1518 */
    stressPenaltyPerTurn: 5,
    /** Contagion rate in autocratic systems. @see FR-1518 */
    autocracyContagionRate: 0.5,
    /** Contagion rate in democratic systems. @see FR-1518 */
    democracyContagionRate: 1.0,
  },

  /** War weariness mechanics. @see FR-1519 */
  warWeariness: {
    /** Weariness increase per turn during active conflict. @see FR-1519 */
    activeConflictPerTurn: 3,
    /** Weariness increase per turn during grey-zone operations. @see FR-1519 */
    greyZonePerTurn: 1,
    /** Weariness decay per turn during peacetime. @see FR-1519 */
    peacetimeDecayPerTurn: -2,
    /** Weariness threshold at which negative effects begin. @see FR-1519 */
    effectsThreshold: 70,
    /** Civil unrest bonus per turn when weariness exceeds threshold. @see FR-1519 */
    civilUnrestBonus: 5,
    /** Treasury cost multiplier when weariness exceeds threshold. @see FR-1519 */
    treasuryCostMultiplier: 1.25,
    /** Popularity decay per turn when weariness exceeds threshold. @see FR-1519 */
    popularityDecayPerTurn: -3,
    /** Nationalism level above which weariness effects are resisted. @see FR-1519 */
    nationalismResistanceThreshold: 60,
    /** Weariness reduction per turn from nationalism resistance. @see FR-1519 */
    nationalismResistanceReduction: -1,
  },

  /** Personality drift mechanics. @see FR-1505 */
  personalityDrift: {
    /** Consecutive turns with stress above threshold to trigger drift. @see FR-1505 */
    stressDriftTurns: 6,
    /** Stress threshold that counts toward drift. @see FR-1505 */
    stressDriftThreshold: 60,
    /** Risk-tolerance shift magnitude from stress drift. @see FR-1505 */
    riskToleranceShift: 10,
    /** Paranoia increase from ally betrayal. @see FR-1505 */
    betrayalParanoiaIncrease: 15,
    /** Confidence boost from major victory. @see FR-1505 */
    victoryConfidenceBoost: 10,
    /** Narcissism boost from major victory. @see FR-1505 */
    victoryNarcissismBoost: 5,
    /** Resolve boost from near-loss recovery. @see FR-1505 */
    nearLossResolveBoost: 10,
    /** Pragmatism boost from near-loss recovery. @see FR-1505 */
    nearLossPragmatismBoost: 10,
    /** Stability threshold below which constitutes a "near loss". @see FR-1505 */
    nearLossStabilityThreshold: 10,
  },

  /** Psychological operations. @see FR-1512 */
  psyOps: {
    /** Public Humiliation effects. @see FR-1512 */
    publicHumiliation: {
      /** Anger increase on target leader. @see FR-1512 */
      targetAngerIncrease: 20,
      /** Confidence decrease on target leader. @see FR-1512 */
      targetConfidenceDecrease: -15,
      /** DI penalty if discovered by target. @see FR-1512 */
      discoveredDiPenalty: -10,
      /** Base chance of discovery (0–1). @see FR-1512 */
      discoveryChance: 0.3,
    },
    /** Strategic Ambiguity effects. @see FR-1512 */
    strategicAmbiguity: {
      /** Fear increase on target leader. @see FR-1512 */
      targetFearIncrease: 15,
      /** Stress increase on target leader. @see FR-1512 */
      targetStressIncrease: 10,
      /** Own military readiness cost. @see FR-1512 */
      readinessCost: -5,
    },
    /** Diplomatic Ghosting effects. @see FR-1512 */
    diplomaticGhosting: {
      /** Paranoia increase on target leader. @see FR-1512 */
      targetParanoiaIncrease: 10,
      /** Anger increase on target leader. @see FR-1512 */
      targetAngerIncrease: 10,
      /** Tension level increase. @see FR-1512 */
      tensionIncrease: 15,
      /** Duration in turns of communication refusal. @see FR-1512 */
      durationTurns: 3,
    },
    /** Provocative Posturing effects. @see FR-1512 */
    provocativePosturing: {
      /** Fear increase on target leader. @see FR-1512 */
      targetFearIncrease: 10,
      /** Per-point paranoia conflict chance (multiplied by target paranoia). @see FR-1512 */
      conflictChancePerParanoia: 0.05,
    },
  },

  /** Psychological counterintelligence. @see FR-1513 */
  counterIntel: {
    /** Media Counter-Narrative DI cost. @see FR-1513 */
    mediaCounterNarrativeDiCost: -5,
    /** Resolve threshold for automatic emotional discipline. @see FR-1513 */
    emotionalDisciplineResolveThreshold: 70,
    /** Effect reduction from emotional discipline (0–1). @see FR-1513 */
    emotionalDisciplineReduction: 0.3,
    /** Nationalism boost from intelligence inoculation. @see FR-1513 */
    intelligenceInoculationNationalismBoost: 5,
  },

  /** Mass psychology effects on national metrics. @see FR-1517 */
  massPsychologyEffects: {
    /** Anger + low hope unrest bonus per turn. @see FR-1517 */
    angerLowHopeUnrestPerTurn: 10,
    /** Hope threshold below which anger triggers unrest. @see FR-1517 */
    lowHopeThreshold: 30,
    /** High anger threshold. @see FR-1517 */
    highAngerThreshold: 60,
    /** Nationalism dampening of unrest per turn. @see FR-1517 */
    nationalismUnrestDampening: -5,
    /** Nationalism threshold for dampening. @see FR-1517 */
    highNationalismThreshold: 60,
    /** Recruitment bonus from high nationalism + low weariness. @see FR-1517 */
    recruitmentBonus: 0.15,
    /** Recruitment penalty from high war weariness. @see FR-1517 */
    recruitmentPenalty: -0.2,
    /** Desertion rate from high war weariness. @see FR-1517 */
    desertionRate: 0.1,
    /** War weariness threshold for recruitment/desertion effects. @see FR-1517 */
    wearinessEffectThreshold: 60,
    /** Treasury income bonus from fear + nationalism. @see FR-1517 */
    warBondBonus: 0.1,
    /** Treasury income penalty from low hope. @see FR-1517 */
    lowHopeTreasuryPenalty: -0.1,
  },
} as const;

