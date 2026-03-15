/**
 * New Order — Ai Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 4. AI DECISION ENGINE
  // ─────────────────────────────────────────────────────────

export const aiDecisionConfig = {
  /** Stability threshold below which AI enters Desperation Mode. @see FR-301 */
  desperationModeStabilityThreshold: 20,

  /** Difficulty scaling profiles. @see FR-305 */
  difficultyScaling: {
    /** Cautious difficulty profile — low aggression and risk. @see FR-305 */
    cautious: {
      /** Risk tolerance scalar. @see FR-305 */
      riskTolerance: 0.5,
      /** Aggression scalar. @see FR-305 */
      aggression: 0.5,
    },
    /** Balanced difficulty profile — default values. @see FR-305 */
    balanced: {
      /** Risk tolerance scalar. @see FR-305 */
      riskTolerance: 1.0,
      /** Aggression scalar. @see FR-305 */
      aggression: 1.0,
    },
    /** Aggressive difficulty profile — high aggression and risk. @see FR-305 */
    aggressive: {
      /** Risk tolerance scalar. @see FR-305 */
      riskTolerance: 1.5,
      /** Aggression scalar. @see FR-305 */
      aggression: 1.5,
    },
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 20. AI DIFFICULTY SCALING (FR-305)
  // ─────────────────────────────────────────────────────────

export const aiDifficultyConfig = {
  /** Cautious: low risk, low aggression. @see FR-305 */
  cautious: {
    riskToleranceMultiplier: 0.6,
    aggressionMultiplier: 0.5,
    economicFocusMultiplier: 1.3,
    diplomaticPreferenceMultiplier: 1.2,
  },
  /** Balanced: default scaling. @see FR-305 */
  balanced: {
    riskToleranceMultiplier: 1.0,
    aggressionMultiplier: 1.0,
    economicFocusMultiplier: 1.0,
    diplomaticPreferenceMultiplier: 1.0,
  },
  /** Aggressive: high risk, high aggression. @see FR-305 */
  aggressive: {
    riskToleranceMultiplier: 1.5,
    aggressionMultiplier: 1.8,
    economicFocusMultiplier: 0.7,
    diplomaticPreferenceMultiplier: 0.6,
  },
} as const;

export const leaderCreationConfig = {
  /**
   * Four preset archetype templates that pre-fill psychology sliders.
   * Players can pick one as a starting point and adjust from there.
   *
   * @see FR-1202
   */
  archetypes: {
    Hawk: {
      label: 'Hawk',
      description: 'Aggressive militarist who favors decisive force over diplomacy.',
      psychology: {
        decisionStyle: 'Intuitive' as const,
        stressResponse: 'Escalate' as const,
        riskTolerance: 80,
        paranoia: 60,
        narcissism: 55,
        pragmatism: 40,
        patience: 25,
        vengefulIndex: 75,
      },
    },
    Dove: {
      label: 'Dove',
      description: 'Diplomatic peacemaker who exhausts negotiation before considering force.',
      psychology: {
        decisionStyle: 'Analytical' as const,
        stressResponse: 'Consolidate' as const,
        riskTolerance: 25,
        paranoia: 30,
        narcissism: 20,
        pragmatism: 75,
        patience: 85,
        vengefulIndex: 15,
      },
    },
    Populist: {
      label: 'Populist',
      description: 'Charismatic leader who prioritizes domestic popularity over international norms.',
      psychology: {
        decisionStyle: 'Transactional' as const,
        stressResponse: 'Deflect' as const,
        riskTolerance: 65,
        paranoia: 70,
        narcissism: 80,
        pragmatism: 60,
        patience: 30,
        vengefulIndex: 65,
      },
    },
    Technocrat: {
      label: 'Technocrat',
      description: 'Data-driven strategist who values efficiency, institutions, and long-term planning.',
      psychology: {
        decisionStyle: 'Analytical' as const,
        stressResponse: 'Consolidate' as const,
        riskTolerance: 35,
        paranoia: 25,
        narcissism: 15,
        pragmatism: 85,
        patience: 80,
        vengefulIndex: 20,
      },
    },
  },

  /**
   * Personal vulnerability options available during leader creation.
   * Player must choose exactly 1.
   *
   * @see FR-1205
   */
  vulnerabilities: {
    HealthRisk: {
      label: 'Health Risk',
      description: 'Leader has a chronic health condition. May be incapacitated for 2 turns.',
      effect: 'incapacitation',
      /** Duration in turns if triggered. */
      durationTurns: 2,
      /** Probability of triggering per turn (once per game). */
      triggerChancePerTurn: 0.03,
    },
    ScandalExposure: {
      label: 'Scandal Exposure',
      description: 'Damaging personal information exists. If exposed, Popularity drops sharply.',
      effect: 'popularityDrop',
      /** Popularity penalty on trigger. */
      popularityDelta: -20,
      /** Probability of triggering per turn (once per game). */
      triggerChancePerTurn: 0.04,
    },
    SuccessionGap: {
      label: 'Succession Gap',
      description: 'No clear successor. If leader removed, faction suffers 5 turns of instability.',
      effect: 'instability',
      /** Duration of instability debuff in turns. */
      durationTurns: 5,
      /** Stability penalty per turn during instability. */
      stabilityPenaltyPerTurn: -5,
    },
    IdeologicalRigidity: {
      label: 'Ideological Rigidity',
      description: 'Cannot deviate from ideology without severe domestic backlash.',
      effect: 'backlash',
      /** Popularity penalty per inconsistent action. */
      inconsistencyPopularityPenalty: -8,
      /** Power base loyalty penalty per inconsistent action. */
      inconsistencyLoyaltyPenalty: -5,
    },
  },

  /**
   * Profile consistency configuration.
   * When a player's actions deviate from their psychological profile,
   * domestic media generates "Leader Contradicts Own Doctrine" headlines.
   *
   * @see FR-1203
   */
  consistency: {
    /** Turns of misalignment before inconsistency warning fires. */
    warningThresholdTurns: 3,
    /** Popularity penalty per inconsistency event. */
    popularityPenalty: -5,
    /** Advisory panel note text when inconsistency detected. */
    warningMessage: 'Your actions diverge from your stated leadership doctrine.',
  },

  /** Minimum and maximum values for psychology sliders. */
  sliderRange: {
    min: 0,
    max: 100,
  },

  /** Maximum number of custom red lines a player can define. */
  maxCustomRedLines: 3,

  /** AI perception model of player-leader. @see FR-1204 */
  aiPerception: {
    /** Starting perception accuracy for AI (0-100). @see FR-1204 */
    initialAccuracy: 70,
    /** Accuracy degradation per inconsistent action. @see FR-1204 */
    degradationPerInconsistency: 5,
    /** Accuracy recovery per consistent action. @see FR-1204 */
    recoveryPerConsistency: 2,
    /** Minimum accuracy floor. @see FR-1204 */
    minimumAccuracy: 20,
    /** Maximum accuracy ceiling. @see FR-1204 */
    maximumAccuracy: 95,
    /** Counter-strategy bonus for AI when accuracy is high (>70). @see FR-1204 */
    highAccuracyCounterBonus: 0.15,
  },

  /** Vulnerability event trigger parameters. @see FR-1205 */
  vulnerabilityEvents: {
    /** Minimum turn before vulnerability can fire. @see FR-1205 */
    earliestTriggerTurn: 5,
    /** Maximum times a vulnerability can fire (once per game). @see FR-1205 */
    maxTriggersPerGame: 1,
  },
} as const;

