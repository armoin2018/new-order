/**
 * New Order — Information Warfare Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 8. INFORMATION WARFARE
  // ─────────────────────────────────────────────────────────

export const infoWarConfig = {
  /** Legitimacy threshold values. @see FR-1601 */
  legitimacy: {
    /** Legitimacy at-or-below which alliances are blocked. @see FR-1601 */
    blocksAlliances: 30,
    /** Legitimacy above which diplomatic effectiveness bonus applies. @see FR-1601 */
    diplomaticBonusThreshold: 70,
    /** Diplomatic effectiveness bonus at high legitimacy. @see FR-1601 */
    diplomaticEffectivenessBonus: 0.15,
  },

  /** Narrative campaign effect tables. @see FR-1602 */
  narrativeCampaigns: {
    /** Victimhood narrative effects. @see FR-1602 */
    victimhood: {
      /** Nationalism boost. @see FR-1602 */
      nationalismBoost: 10,
      /** International sympathy boost. @see FR-1602 */
      sympathyBoost: 5,
      /** Diplomatic Influence cost. @see FR-1602 */
      diCost: -5,
    },
    /** Liberation narrative effects. @see FR-1602 */
    liberation: {
      /** Legitimacy-loss reduction factor. @see FR-1602 */
      legitimacyLossReduction: 0.5,
      /** Backfire penalty if narrative fails. @see FR-1602 */
      backfirePenalty: -15,
    },
    /** Economic Justice narrative effects. @see FR-1602 */
    economicJustice: {
      /** Reduction to diplomatic penalties. @see FR-1602 */
      diplomaticPenaltyReduction: 0.3,
    },
    /** Historical Grievance narrative effects. @see FR-1602 */
    historicalGrievance: {
      /** Nationalism boost. @see FR-1602 */
      nationalismBoost: 15,
      /** Leader anger boost. @see FR-1602 */
      angerBoost: 10,
      /** Legitimacy penalty from grievance narrative. @see FR-1602 */
      legitimacyPenalty: -5,
    },
  },

  /** Virality factor bonuses. @see FR-1603 */
  viralityFactors: {
    /** Virality bonus for violence-related content. @see FR-1603 */
    violenceBonus: 20,
    /** Virality bonus for scandal-related content. @see FR-1603 */
    scandalBonus: 15,
    /** Virality bonus for triumph-related content. @see FR-1603 */
    triumphBonus: 10,
  },

  /** Censorship effectiveness by media system type. @see FR-1603 */
  censorshipEffectiveness: {
    /** Censorship effectiveness under free press. @see FR-1603 */
    freePress: 0.05,
    /** Censorship effectiveness under state media. @see FR-1603 */
    stateMedia: 0.7,
    /** Censorship effectiveness under closed system. @see FR-1603 */
    closedSystem: 0.95,
    /** Censorship effectiveness under fragmented media. @see FR-1603 */
    fragmented: 0.3,
  },

  /** Counter-narrative halves virality within this many turns. @see FR-1603 */
  counterNarrativeEffectTurns: 1,

  /** Narrative Battle formula. @see FR-1606 */
  narrativeBattle: {
    /** Weight of legitimacy in narrative battle. @see FR-1606 */
    legitimacyWeight: 0.4,
    /** Weight of media reach in narrative battle. @see FR-1606 */
    mediaReachWeight: 0.3,
    /** Weight of narrative investment in narrative battle. @see FR-1606 */
    narrativeInvestmentWeight: 0.3,
    /** Legitimacy gained by narrative battle winner. @see FR-1606 */
    winnerLegitimacyGain: 5,
    /** Legitimacy lost by narrative battle loser. @see FR-1606 */
    loserLegitimacyLoss: -5,
  },

  /** Whistleblower mechanics. @see FR-1607 */
  whistleblower: {
    /** Actions-vs-narrative divergence threshold that triggers whistleblower. @see FR-1607 */
    divergenceThreshold: 30,
    /** Legitimacy penalty from exposure. @see FR-1607 */
    exposureLegitimacyPenalty: -20,
    /** Legitimacy penalty from acknowledging wrongdoing. @see FR-1607 */
    acknowledgePenalty: -10,
    /** Risk reduction per 20 spent on security services. @see FR-1607 */
    securityServicesReductionPer20: 0.1,
  },

  /** Deepfake operation requirements. @see FR-1604 */
  deepfake: {
    /** Minimum cyber tech level required to create deepfakes. @see FR-1604 */
    cyberThreshold: 60,
    /** Treasury cost to create a deepfake. @see FR-1604 */
    treasuryCost: -10,
    /** Fabricate rival leader statements. @see FR-1604 */
    fabricateStatements: {
      /** Legitimacy penalty applied to target. @see FR-1604 */
      targetLegitimacyPenalty: -15,
    },
    /** Fake atrocity evidence. @see FR-1604 */
    fakeAtrocityEvidence: {
      /** Legitimacy penalty applied to target. @see FR-1604 */
      targetLegitimacyPenalty: -20,
      /** Civil unrest boost on target. @see FR-1604 */
      targetUnrestBoost: 10,
    },
    /** Synthetic intelligence planted in target pipeline. @see FR-1604 */
    syntheticIntelligence: {
      /** Turns the planted report persists before expiry. @see FR-1604 */
      persistenceTurns: 3,
    },
    /** Backfire penalties when deployer is detected. @see FR-1604 */
    detectionBackfire: {
      /** Deployer legitimacy penalty on detection. @see FR-1604 */
      deployerLegitimacyPenalty: -25,
      /** All-nation trust penalty on detection. @see FR-1604 */
      trustPenaltyAllNations: -15,
    },
  },

  /** Fog of Intent system. @see FR-1608 */
  fogOfIntent: {
    /** Default probability distribution for unknown intent (sums to 1.0). @see FR-1608 */
    defaultProbabilities: {
      defensive: 0.6,
      signal: 0.25,
      exercise: 0.1,
      attackPrep: 0.05,
    },
    /** HUMINT weight in accuracy calculation. @see FR-1608 */
    humintWeight: 0.6,
    /** Psychological profile weight in accuracy calculation. @see FR-1608 */
    psychProfileWeight: 0.4,
    /** HUMINT × PsychProfile product above which assessment is "high accuracy". @see FR-1608 */
    highAccuracyThreshold: 60,
    /** HUMINT × PsychProfile product below which assessment is "low accuracy". @see FR-1608 */
    lowAccuracyThreshold: 25,
    /** Maximum noise added to probabilities at low accuracy. @see FR-1608 */
    maxNoise: 0.25,
    /** Minimum noise added to probabilities at high accuracy. @see FR-1608 */
    minNoise: 0.03,
    /** Escalation risk multiplier when intent is misread. @see FR-1608 */
    misreadEscalationMultiplier: 1.5,
  },

  /** Media ecosystem modifiers per type. @see FR-1605 */
  mediaEcosystemDefaults: {
    freePress: {
      viralityMultiplier: 1.5,
      censorshipEffectiveness: 5,
      propagandaResistance: 70,
      narrativeControlScore: 20,
    },
    stateMedia: {
      viralityMultiplier: 0.6,
      censorshipEffectiveness: 70,
      propagandaResistance: 30,
      narrativeControlScore: 80,
    },
    closedSystem: {
      viralityMultiplier: 0.2,
      censorshipEffectiveness: 95,
      propagandaResistance: 15,
      narrativeControlScore: 95,
    },
    fragmented: {
      viralityMultiplier: 1.2,
      censorshipEffectiveness: 30,
      propagandaResistance: 40,
      narrativeControlScore: 35,
    },
  },

  /** UN Resolution condemning a nation. @see FR-1601 */
  unResolutionPenalty: -10,

  /** Platform penetration per faction (0.0–1.0). @see FR-1603 */
  platformPenetration: {
    us: 0.9,
    china: 0.3,
    russia: 0.5,
    japan: 0.8,
    iran: 0.4,
    dprk: 0.05,
    eu: 0.85,
    syria: 0.35,
  } as Record<string, number>,

  /** Virality score decay per turn (absolute). @see FR-1603 */
  viralityDecayPerTurn: 15,

  /** Counter-narrative virality reduction factor (0.0–1.0). @see FR-1603 */
  counterNarrativeReductionFactor: 0.5,

  /** Whistleblower cascade risk when suppressing. @see FR-1607 */
  whistleblowerCascade: {
    /** Additional exposure risk per suppression attempt. @see FR-1607 */
    additionalExposureRisk: 0.15,
    /** Max covert ops exposed per whistleblower event. @see FR-1607 */
    maxOpsExposed: 3,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 8b. HEADLINES & PERCEPTION (FR-200)
  // ─────────────────────────────────────────────────────────

export const headlinesConfig = {
  /** Minimum events required to generate headlines for a turn. @see FR-201 */
  minEventsForHeadlines: 1,

  /**
   * Event-category weight tables per perspective.
   * Higher weight → more likely to be selected as headline topic.
   * @see FR-201
   */
  perspectiveBias: {
    /** Western Press: emphasises diplomacy & economics. @see FR-201 */
    westernPress: {
      diplomaticWeight: 0.35,
      militaryWeight: 0.25,
      economicWeight: 0.30,
      intelligenceWeight: 0.05,
      domesticWeight: 0.05,
    },
    /** State Propaganda: emphasises domestic narrative & military. @see FR-201 */
    statePropaganda: {
      diplomaticWeight: 0.15,
      militaryWeight: 0.30,
      economicWeight: 0.10,
      intelligenceWeight: 0.05,
      domesticWeight: 0.40,
    },
    /** Intelligence: emphasises military & intelligence signals. @see FR-201 */
    intelligence: {
      diplomaticWeight: 0.15,
      militaryWeight: 0.30,
      economicWeight: 0.10,
      intelligenceWeight: 0.35,
      domesticWeight: 0.10,
    },
  },

  /** Headline framing tone multipliers per perspective. @see FR-201 */
  toneMultipliers: {
    /** Western press amplifies diplomatic/economic events. */
    westernPressDramaBoost: 1.2,
    /** State propaganda amplifies domestic/military events. */
    statePropagandaDramaBoost: 1.4,
    /** Intelligence reports are more factual, less dramatic. */
    intelligenceDramaBoost: 0.8,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 8e. GREY ZONE OPERATIONS (FR-400)
  // ─────────────────────────────────────────────────────────

export const greyZoneConfig = {
  /** Covert insurgency funding mechanics. @see FR-401 */
  insurgency: {
    /** Treasury cost to fund an insurgency per turn. @see FR-401 */
    treasuryCostPerTurn: 15,
    /** Target stability reduction per turn while funded. @see FR-401 */
    stabilityReductionPerTurn: 3,
    /** Maximum concurrent insurgencies a faction can fund. @see FR-401 */
    maxConcurrentInsurgencies: 3,
    /** Minimum DI required to initiate an insurgency. @see FR-401 */
    minDIToInitiate: 20,
    /** Turns before insurgency takes effect (ramp-up). @see FR-401 */
    rampUpTurns: 1,
    /** Base discovery chance per turn (0–1). @see FR-401 */
    baseDiscoveryChance: 0.15,
  },

  /** Maritime militia blockade mechanics. @see FR-402 */
  maritimeMilitia: {
    /** Trade disruption percentage from fishing fleet blockade. @see FR-402 */
    tradeDisruptionPercent: 0.25,
    /** Maximum fishing fleet units deployable per blockade. @see FR-402 */
    maxFleetUnits: 5,
    /** Tension increase per turn of active blockade. @see FR-402 */
    tensionIncreasePerTurn: 3,
    /** Factions whose war-state is NOT triggered by fishing fleet blockades. @see FR-402 */
    noWarTriggerThreshold: true,
    /** Treasury cost per turn to maintain blockade. @see FR-402 */
    treasuryCostPerTurn: 10,
  },

  /** Cyber operations mechanics. @see FR-403 */
  cyberOps: {
    /** Military readiness reduction from cyber attack. @see FR-403 */
    militaryReadinessReduction: 8,
    /** GDP growth reduction from cyber attack. @see FR-403 */
    gdpGrowthReduction: 0.02,
    /** Duration of cyber ops effect in turns. @see FR-403 */
    effectDurationTurns: 3,
    /** Minimum cyber capability (0–100) required to launch. @see FR-403 */
    minCyberCapability: 30,
    /** Treasury cost to launch a cyber operation. @see FR-403 */
    treasuryCost: 20,
    /** Maximum concurrent cyber ops per faction. @see FR-403 */
    maxConcurrentOps: 2,
  },

  /** Discovery probability mechanics. @see FR-404 */
  discovery: {
    /**
     * Base discovery chance. Actual = base + (100 - covert) × covertModifier.
     * @see FR-404
     */
    baseChance: 0.1,
    /** Modifier applied to (100 - covert) for discovery calculation. @see FR-404 */
    covertModifier: 0.005,
    /** Tension increase on discovery. @see FR-404 */
    tensionSpikeOnDiscovery: 15,
    /** Legitimacy penalty on discovery. @see FR-404 */
    legitimacyPenaltyOnDiscovery: -10,
    /** Stability boost to target (rally-around-flag effect). @see FR-404 */
    targetStabilityBoostOnDiscovery: 3,
  },
} as const;

