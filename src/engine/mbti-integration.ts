/**
 * MBTI Integration Engine — CNFL-3002
 *
 * Bridges external MBTI type profiles and extended leader profiles into the
 * existing AI decision system. Derives decision weights from cognitive stacks,
 * computes leader compatibility, adjusts action scores based on personality,
 * and models stress-induced behavioural shifts.
 *
 * All methods are **pure** — no mutation of inputs, no side effects.
 *
 * @module engine/mbti-integration
 * @see CNFL-3002 — Integrate MBTI profiles into AI decision engine
 * @see FR-2100 — MBTI Type Profile (DR-141)
 * @see FR-301  — Utility Score evaluation
 * @see FR-302  — Scenario-tunable personality weights
 */

import type {
  FactionId,
  MBTITypeProfile,
  ExtendedLeaderProfile,
  CognitiveFunction,
} from '@/data/types';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * MBTI-derived weights that influence AI action evaluation.
 *
 * Each weight is a normalised modifier (typically 0–100) that scales the
 * utility of actions in the corresponding category.
 */
export interface MBTIDecisionWeights {
  /** How much to value alliance-building actions. */
  readonly allianceWeight: number;
  /** Willingness to pursue aggressive / confrontational actions. */
  readonly aggressionWeight: number;
  /** Preference for diplomatic solutions. */
  readonly diplomacyWeight: number;
  /** Focus on economic development and trade. */
  readonly economicWeight: number;
  /** Priority given to military posturing and readiness. */
  readonly militaryWeight: number;
  /** Drive toward technological and strategic innovation. */
  readonly innovationWeight: number;
  /** Risk tolerance coefficient (0 = risk-averse, 1 = risk-seeking). */
  readonly riskTolerance: number;
  /** Planning horizon preference. */
  readonly timeHorizon: 'short' | 'medium' | 'long';
}

/**
 * Combined leader + MBTI decision profile used by the AI evaluator to
 * personalise action scoring for a specific leader.
 */
export interface LeaderDecisionProfile {
  /** Unique leader identifier. */
  readonly leaderId: string;
  /** Faction this leader controls. */
  readonly factionId: FactionId;
  /** 4-letter MBTI type code. */
  readonly mbtiTypeCode: string;
  /** Derived decision weights from MBTI + leader psychology. */
  readonly decisionWeights: MBTIDecisionWeights;
  /** MBTI-driven cognitive bias adjustments (bias name → intensity modifier). */
  readonly biasModifiers: Record<string, number>;
  /** How the leader behaves under stress. */
  readonly stressResponse: {
    readonly behavior: string;
    readonly decisionSpeedChange: number;
    readonly riskToleranceChange: number;
  };
}

/**
 * Result of computing compatibility between two leaders based on their
 * MBTI cognitive stacks and decision tendencies.
 */
export interface CompatibilityResult {
  /** Leader A identifier (typeCode used as proxy). */
  readonly leaderA: string;
  /** Leader B identifier (typeCode used as proxy). */
  readonly leaderB: string;
  /** Overall compatibility score (−100 to +100). */
  readonly compatibilityScore: number;
  /** Bonus applied when the two leaders cooperate. */
  readonly cooperationBonus: number;
  /** Penalty applied when the two leaders conflict. */
  readonly conflictPenalty: number;
  /** Human-readable description of the compatibility dynamic. */
  readonly description: string;
}

/**
 * MBTI-adjusted action scoring result.
 */
export interface ActionEvaluation {
  /** Identifier of the evaluated action. */
  readonly actionId: string;
  /** Original score before MBTI adjustment. */
  readonly baseScore: number;
  /** Additive modifier derived from MBTI weights. */
  readonly mbtiAdjustment: number;
  /** Final score after adjustment (clamped to 0–100). */
  readonly finalScore: number;
  /** Human-readable reasoning for the adjustment. */
  readonly reasoning: string;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map of cognitive functions to the weight domains they primarily influence.
 *
 * - Te / Ti → economic & innovation (Thinking = systems, efficiency)
 * - Fe / Fi → diplomacy & alliance (Feeling = relationships, values)
 * - Se / Si → military & stability (Sensing = concrete, tactical)
 * - Ne / Ni → innovation & riskTolerance (Intuition = vision, patterns)
 */
const FUNCTION_WEIGHT_MAP: Record<CognitiveFunction, {
  primary: keyof Omit<MBTIDecisionWeights, 'riskTolerance' | 'timeHorizon'>;
  secondary: keyof Omit<MBTIDecisionWeights, 'riskTolerance' | 'timeHorizon'>;
}> = {
  Te: { primary: 'economicWeight', secondary: 'innovationWeight' },
  Ti: { primary: 'innovationWeight', secondary: 'economicWeight' },
  Fe: { primary: 'diplomacyWeight', secondary: 'allianceWeight' },
  Fi: { primary: 'allianceWeight', secondary: 'diplomacyWeight' },
  Se: { primary: 'militaryWeight', secondary: 'aggressionWeight' },
  Si: { primary: 'militaryWeight', secondary: 'economicWeight' },
  Ne: { primary: 'innovationWeight', secondary: 'allianceWeight' },
  Ni: { primary: 'innovationWeight', secondary: 'militaryWeight' },
};

/**
 * Position multipliers for cognitive stack slots.
 * Dominant (index 0) has the greatest influence, inferior (index 3) the least.
 */
const STACK_POSITION_MULTIPLIERS: readonly number[] = [1.0, 0.6, 0.3, 0.15];

/**
 * Maps an action category string to the corresponding weight field on
 * `MBTIDecisionWeights`.
 */
const CATEGORY_WEIGHT_KEY: Record<string, keyof Omit<MBTIDecisionWeights, 'riskTolerance' | 'timeHorizon'>> = {
  military: 'militaryWeight',
  diplomatic: 'diplomacyWeight',
  economic: 'economicWeight',
  intelligence: 'innovationWeight',
  technology: 'innovationWeight',
  domestic: 'allianceWeight',
};

/**
 * Complementary function pairs — when both leaders have these in their
 * top-2 stack positions the pairing is considered synergistic.
 */
const COMPLEMENTARY_PAIRS: ReadonlyArray<readonly [CognitiveFunction, CognitiveFunction]> = [
  ['Te', 'Fi'],
  ['Ti', 'Fe'],
  ['Se', 'Ni'],
  ['Si', 'Ne'],
];

/**
 * Conflicting function pairs — when both leaders lead with the same
 * judging or perceiving axis they tend to clash.
 */
const CONFLICTING_PAIRS: ReadonlyArray<readonly [CognitiveFunction, CognitiveFunction]> = [
  ['Te', 'Te'],
  ['Fe', 'Fe'],
  ['Ti', 'Ti'],
  ['Fi', 'Fi'],
];

/**
 * Determine the time horizon from Ni/Ne stack presence.
 * Ni in top 2 → long, Ne in top 2 → medium, else short.
 */
function deriveTimeHorizon(stack: readonly CognitiveFunction[]): 'short' | 'medium' | 'long' {
  const topTwo = stack.slice(0, 2);
  if (topTwo.includes('Ni')) return 'long';
  if (topTwo.includes('Ne')) return 'medium';
  return 'short';
}

/**
 * Check whether a cognitive function is an extraverted function.
 */
function isExtraverted(fn: CognitiveFunction): boolean {
  return fn === 'Te' || fn === 'Fe' || fn === 'Se' || fn === 'Ne';
}

/**
 * Derive a base risk tolerance from the cognitive stack.
 * Se-dominant types are most risk-tolerant, Si-dominant least.
 * Ne adds moderate risk tolerance, Ni adds slight.
 * Perceiving (P) types get a small boost.
 */
function deriveBaseRiskTolerance(stack: readonly CognitiveFunction[]): number {
  let risk = 0.5; // baseline

  const dominant = stack[0];
  const auxiliary = stack[1];

  // Perceiving functions in dominant position boost risk tolerance
  if (dominant === 'Se') risk += 0.25;
  else if (dominant === 'Ne') risk += 0.2;
  else if (dominant === 'Ni') risk += 0.05;
  else if (dominant === 'Si') risk -= 0.15;

  // Auxiliary perceiving functions contribute less
  if (auxiliary === 'Se') risk += 0.1;
  else if (auxiliary === 'Ne') risk += 0.1;
  else if (auxiliary === 'Si') risk -= 0.05;

  // Thinking functions slightly reduce pure risk-taking (more calculated)
  if (dominant === 'Te' || dominant === 'Ti') risk -= 0.05;

  return clamp(risk, 0, 1);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that integrates MBTI personality profiles into the
 * AI decision pipeline. All methods are pure functions.
 *
 * @see CNFL-3002
 * @see FR-2100  — MBTI Type Profile
 * @see FR-301   — Utility Score evaluation
 */
export class MBTIIntegrationEngine {
  // ── Decision Weights ────────────────────────────────────────────────────

  /**
   * Derive decision weights from an MBTI cognitive stack and gameplay
   * modifiers.
   *
   * The algorithm assigns weight to each category based on:
   * 1. Cognitive function mapping (Te→economic, Fe→diplomacy, etc.)
   * 2. Stack position multiplier (dominant = 1.0 … inferior = 0.15)
   * 3. `gameplayModifiers` from the MBTI profile JSON (additive tweaks)
   *
   * @param mbtiProfile - The MBTI type profile to derive weights from.
   * @returns Decision weights normalised to 0–100.
   */
  computeDecisionWeights(mbtiProfile: MBTITypeProfile): MBTIDecisionWeights {
    // Accumulate raw weights from cognitive stack positions
    const rawWeights = {
      allianceWeight: 50,
      aggressionWeight: 50,
      diplomacyWeight: 50,
      economicWeight: 50,
      militaryWeight: 50,
      innovationWeight: 50,
    };

    const stack = mbtiProfile.cognitiveStack;
    for (let i = 0; i < stack.length; i++) {
      const fn = stack[i] as CognitiveFunction;
      const multiplier = STACK_POSITION_MULTIPLIERS[i] ?? 0;
      const mapping = FUNCTION_WEIGHT_MAP[fn];
      if (!mapping) continue;

      // Primary domain gets a large boost, secondary gets a moderate boost
      rawWeights[mapping.primary] += 20 * multiplier;
      rawWeights[mapping.secondary] += 10 * multiplier;
    }

    // Conflict response influences aggression
    switch (mbtiProfile.conflictResponse) {
      case 'dominate':
      case 'escalate':
        rawWeights['aggressionWeight'] += 15;
        break;
      case 'compromise':
      case 'collaborate':
        rawWeights['diplomacyWeight'] += 10;
        rawWeights['aggressionWeight'] -= 10;
        break;
      case 'avoid':
      case 'accommodate':
        rawWeights['aggressionWeight'] -= 15;
        rawWeights['diplomacyWeight'] += 5;
        break;
    }

    // Leadership style adjustments
    switch (mbtiProfile.leadershipStyle) {
      case 'commanding':
        rawWeights['militaryWeight'] += 8;
        rawWeights['aggressionWeight'] += 5;
        break;
      case 'visionary':
        rawWeights['innovationWeight'] += 10;
        break;
      case 'diplomatic':
        rawWeights['diplomacyWeight'] += 10;
        rawWeights['allianceWeight'] += 5;
        break;
      case 'analytical':
        rawWeights['economicWeight'] += 8;
        rawWeights['innovationWeight'] += 5;
        break;
      case 'servant':
        rawWeights['allianceWeight'] += 10;
        rawWeights['diplomacyWeight'] += 5;
        break;
      case 'charismatic':
        rawWeights['diplomacyWeight'] += 8;
        rawWeights['allianceWeight'] += 8;
        break;
      case 'strategic':
        rawWeights['militaryWeight'] += 5;
        rawWeights['innovationWeight'] += 8;
        break;
      case 'adaptive':
        rawWeights['diplomacyWeight'] += 5;
        rawWeights['economicWeight'] += 5;
        break;
    }

    // Apply gameplayModifiers (direct additive tweaks from the JSON)
    const mods = mbtiProfile.gameplayModifiers;
    if (mods) {
      rawWeights['allianceWeight'] += mods.alliancePreference ?? 0;
      rawWeights['innovationWeight'] += mods.noveltyPreference ?? 0;

      // outcomeTypeWeight.measurable boosts economic
      // outcomeTypeWeight.humanitarian boosts diplomacy/alliance
      // outcomeTypeWeight.legitimacy boosts diplomacy
      const outcomes = mods.outcomeTypeWeight;
      if (outcomes) {
        rawWeights['economicWeight'] += (outcomes['measurable'] ?? 0) * 0.5;
        rawWeights['diplomacyWeight'] += (outcomes['humanitarian'] ?? 0) * 0.4;
        rawWeights['allianceWeight'] += (outcomes['humanitarian'] ?? 0) * 0.3;
        rawWeights['diplomacyWeight'] += (outcomes['legitimacy'] ?? 0) * 0.5;
      }

      // commitmentTiming: positive (J types) = higher military/economic
      // negative (P types) = higher innovation/diplomacy
      const ct = mods.commitmentTiming ?? 0;
      if (ct > 0) {
        rawWeights['militaryWeight'] += ct * 0.3;
        rawWeights['economicWeight'] += ct * 0.2;
      } else {
        rawWeights['innovationWeight'] += Math.abs(ct) * 0.3;
        rawWeights['diplomacyWeight'] += Math.abs(ct) * 0.2;
      }
    }

    // Clamp all category weights to 0–100
    const clamped = (key: keyof typeof rawWeights): number => clamp(rawWeights[key], 0, 100);

    return {
      allianceWeight: clamped('allianceWeight'),
      aggressionWeight: clamped('aggressionWeight'),
      diplomacyWeight: clamped('diplomacyWeight'),
      economicWeight: clamped('economicWeight'),
      militaryWeight: clamped('militaryWeight'),
      innovationWeight: clamped('innovationWeight'),
      riskTolerance: deriveBaseRiskTolerance(stack),
      timeHorizon: deriveTimeHorizon(stack),
    };
  }

  // ── Leader Decision Profile ─────────────────────────────────────────────

  /**
   * Build a complete leader decision profile by combining an extended
   * leader profile with its matching MBTI type profile.
   *
   * The leader's `psychology` fields (riskTolerance, paranoia, etc.)
   * blend with MBTI-derived weights to produce a nuanced profile that
   * the AI evaluator can consume directly.
   *
   * @param leader      - The extended leader profile from `models/leaders/`.
   * @param mbtiProfile - The MBTI type profile from `models/leaders/mbti/`.
   * @param factionId   - The faction this leader belongs to.
   * @returns A ready-to-use leader decision profile.
   */
  buildLeaderDecisionProfile(
    leader: ExtendedLeaderProfile,
    mbtiProfile: MBTITypeProfile,
    factionId: FactionId,
  ): LeaderDecisionProfile {
    const baseWeights = this.computeDecisionWeights(mbtiProfile);

    // Blend leader psychology into the MBTI-derived weights
    const psych = leader.psychology;

    // riskTolerance from leader psychology (0–100) is normalised to 0–1 and
    // averaged with the MBTI-derived value for a balanced result.
    const blendedRiskTolerance = clamp(
      (baseWeights.riskTolerance + psych.riskTolerance / 100) / 2,
      0,
      1,
    );

    // Paranoia boosts military and reduces diplomacy
    const paranoiaShift = (psych.paranoia - 50) / 100;

    // Pragmatism boosts economic, reduces ideological rigidity effects
    const pragmatismShift = (psych.pragmatism - 50) / 100;

    // Patience influences time horizon: very patient leaders think longer-term
    const adjustedTimeHorizon = this.deriveBlendedTimeHorizon(
      baseWeights.timeHorizon,
      psych.patience,
    );

    // Narcissism boosts aggression slightly (self-aggrandising moves)
    const narcissismShift = (psych.narcissism - 50) / 200;

    const adjustedWeights: MBTIDecisionWeights = {
      allianceWeight: clamp(
        baseWeights.allianceWeight - paranoiaShift * 10 + pragmatismShift * 5,
        0,
        100,
      ),
      aggressionWeight: clamp(
        baseWeights.aggressionWeight + paranoiaShift * 15 + narcissismShift * 10,
        0,
        100,
      ),
      diplomacyWeight: clamp(
        baseWeights.diplomacyWeight - paranoiaShift * 10 + pragmatismShift * 8,
        0,
        100,
      ),
      economicWeight: clamp(
        baseWeights.economicWeight + pragmatismShift * 12,
        0,
        100,
      ),
      militaryWeight: clamp(
        baseWeights.militaryWeight + paranoiaShift * 12,
        0,
        100,
      ),
      innovationWeight: clamp(
        baseWeights.innovationWeight + pragmatismShift * 5,
        0,
        100,
      ),
      riskTolerance: blendedRiskTolerance,
      timeHorizon: adjustedTimeHorizon,
    };

    return {
      leaderId: leader.leaderId,
      factionId,
      mbtiTypeCode: mbtiProfile.typeCode,
      decisionWeights: adjustedWeights,
      biasModifiers: this.computeBiasModifiers(mbtiProfile),
      stressResponse: this.getStressResponse(mbtiProfile, 50),
    };
  }

  // ── Action Evaluation ───────────────────────────────────────────────────

  /**
   * Adjust a single action's score based on MBTI decision weights and the
   * action's category.
   *
   * The adjustment formula:
   * 1. Look up the weight for the action's category.
   * 2. Compute a signed modifier: `(categoryWeight - 50) / 50 * 15`
   *    — actions in high-weight categories gain up to +15, low-weight lose up to −15.
   * 3. Apply a risk adjustment: high-risk actions are penalised for low
   *    riskTolerance leaders and boosted for high riskTolerance leaders.
   * 4. Final score is clamped to 0–100.
   *
   * @param actionId       - Unique action identifier.
   * @param baseScore      - Pre-MBTI utility score (0–100).
   * @param weights        - MBTI decision weights for the evaluating leader.
   * @param actionCategory - Category string (e.g., 'military', 'diplomatic').
   * @returns The evaluation result with reasoning.
   */
  evaluateAction(
    actionId: string,
    baseScore: number,
    weights: MBTIDecisionWeights,
    actionCategory: string,
  ): ActionEvaluation {
    const weightKey = CATEGORY_WEIGHT_KEY[actionCategory];
    const categoryWeight = weightKey ? weights[weightKey] : 50;

    // Category preference modifier: positive when weight > 50, negative when < 50
    const categoryModifier = ((categoryWeight as number) - 50) / 50 * 15;

    // Risk modifier: categories like 'military' and 'intelligence' carry inherent risk
    const inherentRisk = this.getInherentCategoryRisk(actionCategory);
    const riskModifier = (weights.riskTolerance - 0.5) * inherentRisk * 10;

    // Time horizon bonus: long-horizon leaders slightly prefer technology/economic
    const horizonBonus = this.getTimeHorizonBonus(weights.timeHorizon, actionCategory);

    const totalAdjustment = categoryModifier + riskModifier + horizonBonus;
    const finalScore = clamp(baseScore + totalAdjustment, 0, 100);

    const parts: string[] = [];
    if (Math.abs(categoryModifier) >= 0.5) {
      parts.push(`${actionCategory} preference ${categoryModifier > 0 ? '+' : ''}${categoryModifier.toFixed(1)}`);
    }
    if (Math.abs(riskModifier) >= 0.5) {
      parts.push(`risk attitude ${riskModifier > 0 ? '+' : ''}${riskModifier.toFixed(1)}`);
    }
    if (Math.abs(horizonBonus) >= 0.5) {
      parts.push(`time horizon ${horizonBonus > 0 ? '+' : ''}${horizonBonus.toFixed(1)}`);
    }

    const reasoning = parts.length > 0
      ? `MBTI adjustments: ${parts.join(', ')}`
      : 'No significant MBTI adjustment';

    return {
      actionId,
      baseScore,
      mbtiAdjustment: totalAdjustment,
      finalScore,
      reasoning,
    };
  }

  // ── Compatibility ───────────────────────────────────────────────────────

  /**
   * Compute compatibility between two leaders based on their MBTI cognitive
   * stacks.
   *
   * Scoring rules:
   * - Complementary function pairs (Te↔Fi, Se↔Ni, etc.) in top-2 → +20 each
   * - Conflicting same-function pairs in dominant slot → −15 each
   * - Shared perceiving axis (both Ni-dom or both Se-dom) → +10 (shared worldview)
   * - Introvert–Extravert pairing in same function → +8 (balance)
   * - Both types share the same dominant function → −10 (competition)
   * - Leadership style compatibility adds ±5
   * - Optional overrides are applied additively.
   * - Final score is clamped to −100 … +100.
   *
   * @param profileA  - First leader's MBTI profile.
   * @param profileB  - Second leader's MBTI profile.
   * @param overrides - Optional score overrides keyed by aspect name.
   * @returns Compatibility result.
   */
  computeCompatibility(
    profileA: MBTITypeProfile,
    profileB: MBTITypeProfile,
    overrides?: Record<string, number>,
  ): CompatibilityResult {
    let score = 0;

    const stackA = profileA.cognitiveStack;
    const stackB = profileB.cognitiveStack;
    const topTwoA = stackA.slice(0, 2) as CognitiveFunction[];
    const topTwoB = stackB.slice(0, 2) as CognitiveFunction[];

    // Check complementary pairs in top-2 positions
    for (const [fnX, fnY] of COMPLEMENTARY_PAIRS) {
      if (
        (topTwoA.includes(fnX) && topTwoB.includes(fnY)) ||
        (topTwoA.includes(fnY) && topTwoB.includes(fnX))
      ) {
        score += 20;
      }
    }

    // Check conflicting same-function dominance
    for (const [fnX] of CONFLICTING_PAIRS) {
      if (stackA[0] === fnX && stackB[0] === fnX) {
        score -= 15;
      }
    }

    // Shared perceiving axis in dominant position
    const perceivingFunctions: CognitiveFunction[] = ['Se', 'Si', 'Ne', 'Ni'];
    if (
      perceivingFunctions.includes(stackA[0]) &&
      stackA[0] === stackB[0]
    ) {
      score += 10;
    }

    // Introvert-Extravert balance on same functional axis
    // e.g., Te+Ti or Fe+Fi in top-2 = balanced judging
    const judgeAxes: ReadonlyArray<readonly [CognitiveFunction, CognitiveFunction]> = [
      ['Te', 'Ti'], ['Fe', 'Fi'], ['Se', 'Si'], ['Ne', 'Ni'],
    ];
    for (const [extFn, intFn] of judgeAxes) {
      if (
        (topTwoA.includes(extFn) && topTwoB.includes(intFn)) ||
        (topTwoA.includes(intFn) && topTwoB.includes(extFn))
      ) {
        score += 8;
      }
    }

    // Same dominant function = competition
    if (stackA[0] === stackB[0] && !perceivingFunctions.includes(stackA[0])) {
      score -= 10;
    }

    // Leadership style compatibility
    score += this.getLeadershipStyleCompatibility(
      profileA.leadershipStyle,
      profileB.leadershipStyle,
    );

    // Diplomatic approach synergy
    score += this.getDiplomaticApproachSynergy(
      profileA.diplomaticApproach,
      profileB.diplomaticApproach,
    );

    // Apply optional overrides
    if (overrides) {
      for (const value of Object.values(overrides)) {
        score += value;
      }
    }

    const clampedScore = clamp(Math.round(score), -100, 100);

    // Derive cooperation bonus and conflict penalty from score
    const cooperationBonus = clampedScore > 0
      ? Math.round(clampedScore * 0.3)
      : 0;
    const conflictPenalty = clampedScore < 0
      ? Math.round(Math.abs(clampedScore) * 0.25)
      : 0;

    const description = this.describeCompatibility(
      profileA.typeCode,
      profileB.typeCode,
      clampedScore,
    );

    return {
      leaderA: profileA.typeCode,
      leaderB: profileB.typeCode,
      compatibilityScore: clampedScore,
      cooperationBonus,
      conflictPenalty,
      description,
    };
  }

  // ── Stress Response ─────────────────────────────────────────────────────

  /**
   * Compute stress effects on a leader based on their MBTI profile and
   * current stress level.
   *
   * Grip type behaviour: under stress the inferior function takes over,
   * producing inverse behaviour patterns.
   * - Extraverts become withdrawn (decision speed drops, risk aversion rises)
   * - Introverts become impulsively reactive (decision speed spikes, risk rises)
   * - Grip pattern: dominant function collapses into inferior shadow
   * - Loop pattern: dominant + tertiary create an unhealthy feedback loop
   * - Shadow pattern: the four shadow functions emerge
   * - Regression pattern: revert to earlier developmental stage
   *
   * @param mbtiProfile - The MBTI type profile.
   * @param stressLevel - Current stress level (0–100). 0 = relaxed, 100 = extreme.
   * @returns Stress response descriptor.
   */
  getStressResponse(
    mbtiProfile: MBTITypeProfile,
    stressLevel: number,
  ): { behavior: string; decisionSpeedChange: number; riskToleranceChange: number } {
    const clampedStress = clamp(stressLevel, 0, 100);
    const stressIntensity = clampedStress / 100;
    const dominant = mbtiProfile.cognitiveStack[0];
    const inferior = mbtiProfile.cognitiveStack[3];
    const isDominantExtraverted = isExtraverted(dominant);

    let behavior: string;
    let decisionSpeedChange: number;
    let riskToleranceChange: number;

    switch (mbtiProfile.stressPattern) {
      case 'grip': {
        // Grip: inferior function seizes control
        if (isDominantExtraverted) {
          // Extraverted dominant under grip → withdrawal, brooding, loss of confidence
          behavior = `Grip stress: ${dominant} collapses → ${inferior} takes over. `
            + `Leader becomes withdrawn, indecisive, and hypersensitive to criticism.`;
          decisionSpeedChange = -20 * stressIntensity;
          riskToleranceChange = -0.25 * stressIntensity;
        } else {
          // Introverted dominant under grip → impulsive, reckless external action
          behavior = `Grip stress: ${dominant} collapses → ${inferior} takes over. `
            + `Leader becomes impulsively reactive, seeking external stimulation.`;
          decisionSpeedChange = 15 * stressIntensity;
          riskToleranceChange = 0.2 * stressIntensity;
        }
        break;
      }

      case 'loop': {
        // Loop: dominant + tertiary bypass auxiliary, creating obsessive patterns
        const tertiary = mbtiProfile.cognitiveStack[2];
        behavior = `Loop stress: ${dominant}–${tertiary} loop. `
          + `Leader becomes fixated on narrow solutions, ignoring auxiliary perspective.`;
        decisionSpeedChange = 5 * stressIntensity;
        riskToleranceChange = -0.1 * stressIntensity;
        break;
      }

      case 'shadow': {
        // Shadow: all four shadow functions emerge, creating oppositional behaviour
        behavior = `Shadow stress: oppositional shadow functions emerge. `
          + `Leader becomes contrarian, paranoid, and destructive toward allies.`;
        decisionSpeedChange = -10 * stressIntensity;
        riskToleranceChange = 0.15 * stressIntensity;
        break;
      }

      case 'regression': {
        // Regression: revert to earlier patterns, loss of developed skills
        behavior = `Regression stress: leader reverts to primitive coping mechanisms. `
          + `Sophisticated strategy breaks down to basic survival instincts.`;
        decisionSpeedChange = -15 * stressIntensity;
        riskToleranceChange = -0.15 * stressIntensity;
        break;
      }
    }

    return {
      behavior,
      decisionSpeedChange: Math.round(decisionSpeedChange * 10) / 10,
      riskToleranceChange: Math.round(riskToleranceChange * 1000) / 1000,
    };
  }

  // ── Bias Modifiers ──────────────────────────────────────────────────────

  /**
   * Compute MBTI-driven cognitive bias intensity modifiers.
   *
   * The dominant and auxiliary functions shape which biases a leader is
   * predisposed to:
   *
   * - Te dominant → ConfirmationBias toward data (+15), SunkCost (+10)
   * - Ti dominant → ConfirmationBias toward internal models (+12), DunningKruger (+8)
   * - Fe dominant → Anchoring toward group consensus (+18), Groupthink (+15)
   * - Fi dominant → Anchoring toward personal values (+14), LossAversion (+12)
   * - Se dominant → Recency (+15), AvailabilityHeuristic (+12)
   * - Si dominant → SunkCost (+18), Anchoring (+10)
   * - Ne dominant → Optimism (+15), DunningKruger (+8)
   * - Ni dominant → ConfirmationBias (+12), EscalationOfCommitment (+10)
   *
   * @param mbtiProfile - The MBTI type profile.
   * @returns Record mapping bias type names to intensity modifiers.
   */
  computeBiasModifiers(mbtiProfile: MBTITypeProfile): Record<string, number> {
    const biases = {
      SunkCost: 0,
      ConfirmationBias: 0,
      Groupthink: 0,
      Anchoring: 0,
      LossAversion: 0,
      Optimism: 0,
      AvailabilityHeuristic: 0,
      DunningKruger: 0,
      Recency: 0,
      EscalationOfCommitment: 0,
    };

    const stack = mbtiProfile.cognitiveStack;

    // Dominant function (index 0) — strongest influence
    switch (stack[0]) {
      case 'Te':
        biases['ConfirmationBias'] += 15;
        biases['SunkCost'] += 10;
        break;
      case 'Ti':
        biases['ConfirmationBias'] += 12;
        biases['DunningKruger'] += 8;
        break;
      case 'Fe':
        biases['Anchoring'] += 18;
        biases['Groupthink'] += 15;
        break;
      case 'Fi':
        biases['Anchoring'] += 14;
        biases['LossAversion'] += 12;
        break;
      case 'Se':
        biases['Recency'] += 15;
        biases['AvailabilityHeuristic'] += 12;
        break;
      case 'Si':
        biases['SunkCost'] += 18;
        biases['Anchoring'] += 10;
        break;
      case 'Ne':
        biases['Optimism'] += 15;
        biases['DunningKruger'] += 8;
        break;
      case 'Ni':
        biases['ConfirmationBias'] += 12;
        biases['EscalationOfCommitment'] += 10;
        break;
    }

    // Auxiliary function (index 1) — moderate influence
    switch (stack[1]) {
      case 'Te':
        biases['ConfirmationBias'] += 8;
        biases['SunkCost'] += 5;
        break;
      case 'Ti':
        biases['ConfirmationBias'] += 6;
        biases['DunningKruger'] += 5;
        break;
      case 'Fe':
        biases['Anchoring'] += 10;
        biases['Groupthink'] += 8;
        break;
      case 'Fi':
        biases['Anchoring'] += 8;
        biases['LossAversion'] += 6;
        break;
      case 'Se':
        biases['Recency'] += 8;
        biases['AvailabilityHeuristic'] += 6;
        break;
      case 'Si':
        biases['SunkCost'] += 10;
        biases['Anchoring'] += 5;
        break;
      case 'Ne':
        biases['Optimism'] += 8;
        biases['DunningKruger'] += 5;
        break;
      case 'Ni':
        biases['ConfirmationBias'] += 6;
        biases['EscalationOfCommitment'] += 5;
        break;
    }

    // Tertiary function (index 2) — minor influence
    switch (stack[2]) {
      case 'Te': biases['SunkCost'] += 3; break;
      case 'Ti': biases['DunningKruger'] += 3; break;
      case 'Fe': biases['Groupthink'] += 4; break;
      case 'Fi': biases['LossAversion'] += 4; break;
      case 'Se': biases['Recency'] += 4; break;
      case 'Si': biases['SunkCost'] += 4; break;
      case 'Ne': biases['Optimism'] += 4; break;
      case 'Ni': biases['EscalationOfCommitment'] += 3; break;
    }

    // Adaptability reduces groupthink; low adaptability increases anchoring
    const adaptMod = (mbtiProfile.adaptability - 50) / 100;
    biases['Groupthink'] -= adaptMod * 5;
    biases['Anchoring'] += adaptMod < 0 ? Math.abs(adaptMod) * 5 : 0;

    // Clamp all biases to 0–50 range (they are intensity modifiers, not absolute)
    for (const key of Object.keys(biases) as Array<keyof typeof biases>) {
      biases[key] = clamp(Math.round(biases[key]), 0, 50);
    }

    return biases;
  }

  // ── Batch Action Evaluation ─────────────────────────────────────────────

  /**
   * Batch-evaluate an array of candidate actions against MBTI decision
   * weights. Returns evaluations sorted by `finalScore` descending.
   *
   * @param actions - Array of actions with id, score, and category.
   * @param weights - MBTI decision weights for the evaluating leader.
   * @returns Sorted array of action evaluations.
   */
  adjustForPersonality(
    actions: Array<{ id: string; score: number; category: string }>,
    weights: MBTIDecisionWeights,
  ): ActionEvaluation[] {
    const evaluations = actions.map((action) =>
      this.evaluateAction(action.id, action.score, weights, action.category),
    );

    // Sort by finalScore descending (highest utility first)
    return evaluations.sort((a, b) => b.finalScore - a.finalScore);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Get the inherent risk level associated with an action category.
   * Military and intelligence actions carry higher inherent risk.
   *
   * @param category - Action category string.
   * @returns Risk factor (0–1).
   */
  private getInherentCategoryRisk(category: string): number {
    switch (category) {
      case 'military':      return 0.8;
      case 'intelligence':  return 0.6;
      case 'technology':    return 0.3;
      case 'economic':      return 0.2;
      case 'diplomatic':    return 0.15;
      case 'domestic':      return 0.1;
      default:              return 0.3;
    }
  }

  /**
   * Compute a small bonus/penalty based on time horizon preference and action
   * category.
   *
   * Long-horizon leaders prefer technology and economic investment;
   * short-horizon leaders prefer military and domestic actions.
   *
   * @param horizon  - Time horizon preference.
   * @param category - Action category string.
   * @returns Bonus value (positive or negative).
   */
  private getTimeHorizonBonus(
    horizon: 'short' | 'medium' | 'long',
    category: string,
  ): number {
    const longTermCategories = ['technology', 'economic'];
    const shortTermCategories = ['military', 'domestic'];

    if (horizon === 'long') {
      if (longTermCategories.includes(category)) return 3;
      if (shortTermCategories.includes(category)) return -2;
    } else if (horizon === 'short') {
      if (shortTermCategories.includes(category)) return 3;
      if (longTermCategories.includes(category)) return -2;
    }
    // Medium horizon is neutral
    return 0;
  }

  /**
   * Blend the MBTI-derived time horizon with the leader's patience score.
   *
   * @param mbtiHorizon - Time horizon from MBTI stack analysis.
   * @param patience    - Leader patience score (0–100).
   * @returns Adjusted time horizon.
   */
  private deriveBlendedTimeHorizon(
    mbtiHorizon: 'short' | 'medium' | 'long',
    patience: number,
  ): 'short' | 'medium' | 'long' {
    // Map horizon to numeric value for blending
    const horizonMap = { short: 0, medium: 1, long: 2 } as const;
    const reverseMap = ['short', 'medium', 'long'] as const;

    const mbtiValue = horizonMap[mbtiHorizon] ?? 1;
    // patience 0–33 → short bias, 34–66 → neutral, 67–100 → long bias
    const patienceValue = patience < 34 ? 0 : patience > 66 ? 2 : 1;

    const blended = Math.round((mbtiValue + patienceValue) / 2);
    return reverseMap[blended] as 'short' | 'medium' | 'long';
  }

  /**
   * Compute a compatibility modifier based on leadership style pairing.
   *
   * @param styleA - First leader's style.
   * @param styleB - Second leader's style.
   * @returns Modifier value (−5 to +5).
   */
  private getLeadershipStyleCompatibility(
    styleA: string,
    styleB: string,
  ): number {
    // Complementary pairings
    const synergies: Record<string, string[]> = {
      commanding: ['strategic', 'analytical'],
      visionary: ['diplomatic', 'charismatic'],
      diplomatic: ['visionary', 'servant'],
      analytical: ['commanding', 'strategic'],
      servant: ['diplomatic', 'charismatic'],
      charismatic: ['visionary', 'servant'],
      strategic: ['commanding', 'analytical'],
      adaptive: ['diplomatic', 'strategic'],
    };

    // Conflicting pairings
    const conflicts: Record<string, string[]> = {
      commanding: ['servant', 'adaptive'],
      visionary: ['analytical'],
      diplomatic: ['commanding'],
      analytical: ['charismatic'],
      servant: ['commanding'],
      charismatic: ['analytical'],
      strategic: ['adaptive'],
      adaptive: ['commanding', 'strategic'],
    };

    if (synergies[styleA]?.includes(styleB) || synergies[styleB]?.includes(styleA)) {
      return 5;
    }
    if (conflicts[styleA]?.includes(styleB) || conflicts[styleB]?.includes(styleA)) {
      return -5;
    }
    // Same style: mild friction from overlap
    if (styleA === styleB) {
      return -2;
    }
    return 0;
  }

  /**
   * Compute a compatibility modifier based on diplomatic approach pairing.
   *
   * @param approachA - First leader's diplomatic approach.
   * @param approachB - Second leader's diplomatic approach.
   * @returns Modifier value (−5 to +5).
   */
  private getDiplomaticApproachSynergy(
    approachA: string,
    approachB: string,
  ): number {
    // Highly compatible
    const synergies: Record<string, string[]> = {
      transactional: ['pragmatic'],
      relational: ['collaborative'],
      principled: ['collaborative', 'relational'],
      pragmatic: ['transactional', 'collaborative'],
      confrontational: [], // confrontational doesn't naturally pair well
      collaborative: ['relational', 'principled', 'pragmatic'],
    };

    // Conflicting
    const conflicts: Record<string, string[]> = {
      transactional: ['principled'],
      relational: ['confrontational'],
      principled: ['transactional', 'confrontational'],
      pragmatic: ['confrontational'],
      confrontational: ['relational', 'principled', 'pragmatic', 'collaborative'],
      collaborative: ['confrontational'],
    };

    if (synergies[approachA]?.includes(approachB) || synergies[approachB]?.includes(approachA)) {
      return 5;
    }
    if (conflicts[approachA]?.includes(approachB) || conflicts[approachB]?.includes(approachA)) {
      return -5;
    }
    if (approachA === approachB) {
      return 2; // shared approach = mutual understanding
    }
    return 0;
  }

  /**
   * Generate a human-readable description of the compatibility between two
   * MBTI types.
   *
   * @param typeA - First type code.
   * @param typeB - Second type code.
   * @param score - Computed compatibility score.
   * @returns Description string.
   */
  private describeCompatibility(typeA: string, typeB: string, score: number): string {
    if (score >= 40) {
      return `${typeA} and ${typeB} share strong complementary functions — `
        + `natural allies with high mutual understanding and cooperation potential.`;
    }
    if (score >= 15) {
      return `${typeA} and ${typeB} have moderate compatibility — `
        + `can work together effectively with some effort to bridge differences.`;
    }
    if (score >= -15) {
      return `${typeA} and ${typeB} have neutral compatibility — `
        + `neither natural allies nor opponents; outcomes depend heavily on context.`;
    }
    if (score >= -40) {
      return `${typeA} and ${typeB} have moderate friction — `
        + `differing cognitive approaches create misunderstanding and tension.`;
    }
    return `${typeA} and ${typeB} have high conflict potential — `
      + `fundamentally opposed decision-making styles lead to persistent clashes.`;
  }
}
