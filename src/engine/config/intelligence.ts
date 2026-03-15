/**
 * New Order — Intelligence Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 6. INTELLIGENCE
  // ─────────────────────────────────────────────────────────

export const intelligenceConfig = {
  /** Intelligence sub-score composite weights. @see FR-901 */
  subScoreWeights: {
    humint: 0.3,
    sigint: 0.25,
    cyber: 0.25,
    covert: 0.2,
  },

  /** Fog of War clarity formula parameters. @see FR-902 */
  clarity: {
    /** Base clarity before intel modifiers. */
    base: 0,
    /** Clarity below which Ghost Unit probability rises. */
    ghostUnitThreshold: 30,
    /** Clarity below which headline reliability degrades. */
    headlineReliabilityThreshold: 40,
    /** Minimum clarity value. */
    min: 0,
    /** Maximum clarity value. */
    max: 100,
    /** Ghost Unit spawn probability per turn at low clarity. @see FR-902 */
    ghostUnitProbabilityBase: 0.3,
    /** Headline reliability reduction factor at low clarity. @see FR-902 */
    headlineReliabilityReduction: 0.25,
  },

  /** Intelligence operation parameters. @see FR-903 */
  operations: {
    /** Gather: increase clarity on target. */
    gather: {
      /** Primary sub-score used. */
      primarySubScore: 'sigint' as const,
      /** Base success probability (modified by sub-score). */
      baseSuccessProbability: 0.5,
      /** Clarity increase on success. */
      clarityIncrease: 10,
      /** DI cost to execute. */
      diCost: 3,
      /** Difficulty modifier for blowback. */
      difficultyModifier: 0.5,
    },
    /** Counterintel: reduce rival clarity on self. */
    counterintel: {
      primarySubScore: 'covert' as const,
      baseSuccessProbability: 0.6,
      /** Rival clarity decrease on success. */
      rivalClarityDecrease: 10,
      diCost: 4,
      difficultyModifier: 0.3,
    },
    /** Recruit Asset: plant long-term source. @see FR-903 */
    recruitAsset: {
      primarySubScore: 'humint' as const,
      baseSuccessProbability: 0.35,
      /** HUMINT bonus per turn while asset active. */
      humintBonusPerTurn: 5,
      /** Asset lifespan in turns (0 = until detected). */
      defaultLifespan: 0,
      diCost: 8,
      difficultyModifier: 0.8,
    },
    /** Sabotage: reduce target stat via CYBER or COVERT roll. @see FR-903 */
    sabotage: {
      primarySubScore: 'cyber' as const,
      baseSuccessProbability: 0.4,
      /** Target stat reduction on success. */
      targetStatReduction: -10,
      /** Possible target stats: stability, militaryReadiness, treasury. */
      validTargets: ['stability', 'militaryReadiness', 'treasury'] as const,
      diCost: 6,
      difficultyModifier: 1.0,
    },
  },

  /** Blowback formula: BlowbackChance = (100 - COVERT) * DifficultyModifier. @see FR-904 */
  blowback: {
    /** Base value from which COVERT is subtracted. @see FR-904 */
    base: 100,
    /** Default difficulty modifier applied to blowback chance. @see FR-904 */
    difficultyModifier: 1.0,
  },

  /** Blowback consequence magnitudes. @see FR-904 */
  blowbackConsequences: {
    /** Tension spike from blowback. @see FR-904 */
    tensionSpike: 15,
    /** Public scandal legitimacy penalty. @see FR-904 */
    publicScandal: -10,
    /** Diplomat expulsion DI penalty. @see FR-904 */
    diplomatExpulsion: -5,
  },

  /** Alliance intelligence sharing parameters. @see FR-905 */
  sharing: {
    /** Minimum bonus to weaker partner's lowest sub-score. @see FR-905 */
    bonusMin: 10,
    /** Maximum bonus to weaker partner's lowest sub-score. @see FR-905 */
    bonusMax: 15,
    /** Scaling factor: bonus = bonusMin + (strengthDiff / maxDiff) * (bonusMax - bonusMin). */
    maxStrengthDiff: 50,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 8c. INTELLIGENCE RELIABILITY (FR-202)
  // ─────────────────────────────────────────────────────────

export const intelReliabilityConfig = {
  /** Reliability threshold below which Ghost Units / False Pacts may spawn. @see FR-202 */
  ghostUnitReliabilityThreshold: 40,
  /** Probability of ghost unit spawn per turn when reliability < threshold. @see FR-202 */
  ghostUnitSpawnProbability: 0.3,
  /** Probability of false diplomatic pact spawn when reliability < threshold. @see FR-202 */
  falsePactSpawnProbability: 0.2,
  /** Ghost units disappear after this many turns. @see FR-202 */
  ghostUnitDecayTurns: 3,
  /** False pacts are flagged/revealed after this many turns. @see FR-202 */
  falsePactRevealTurns: 2,
  /** Base reliability for intelligence reports (0–100). @see FR-202 */
  baseReliability: 60,
  /** Reliability boost per DI point invested in a region. @see FR-204 */
  reliabilityBoostPerDI: 5,
  /** Maximum intelligence reliability achievable. @see FR-202 */
  maxReliability: 95,
  /** Minimum reliability floor (even with no investment). @see FR-202 */
  minReliability: 10,
} as const;


  // ─────────────────────────────────────────────────────────
  // 21. DOUBLE AGENT OPERATIONS (FR-906)
  // ─────────────────────────────────────────────────────────

export const doubleAgentConfig = {
  /** Detection probability: counterIntel * this multiplier. @see FR-906 */
  detectionMultiplier: 0.01,

  /** Minimum counter-intel score to attempt turning. @see FR-906 */
  minCounterIntelToTurn: 40,

  /** Turn success probability base (modified by COVERT score). @see FR-906 */
  turnSuccessBase: 0.5,

  /** COVERT bonus per point above 50. @see FR-906 */
  covertBonusPerPoint: 0.005,

  /** Duration (turns) that disinformation persists. @see FR-906 */
  disinformationDurationTurns: 4,

  /** Number of ghost units injected per successful turn. @see FR-906 */
  ghostUnitsPerTurn: 2,

  /** Number of false pacts injected per successful turn. @see FR-906 */
  falsePactsPerTurn: 1,

  /** Expulsion penalty: tension increase. @see FR-906 */
  expulsionTensionIncrease: 10,
} as const;

