/**
 * Leader Expansion Engine — Phase 2 Leader Creation
 *
 * Extends the core leader creation system with full psychological slider
 * metadata, vulnerability event triggering / resolution, leader balance
 * assessment, and archetype deviation analysis.
 *
 * Provides the consistency check input consumed by `ai-perception-engine`
 * (FR-1204). All methods are pure functions — no mutation of inputs or
 * internal state.
 *
 * @see FR-1202 — Expanded psychological slider UI with all §5.1 dimensions
 * @see FR-1204 — AI perception model (consistency input provided here)
 * @see FR-1205 — Personal vulnerability selection and event triggering
 */

import type {
  LeaderPsychology,
  TurnNumber,
} from '@/data/types';

import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Config type alias
// ---------------------------------------------------------------------------

/**
 * Configuration sourced from the leader creation game constants.
 * @see FR-1202
 */
export type LeaderExpansionConfig = typeof GAME_CONFIG.leaderCreation;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 * @param value - The value to clamp.
 * @param min   - Lower bound.
 * @param max   - Upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** All numeric keys on LeaderPsychology that map to slider dimensions. */
const NUMERIC_PSYCHOLOGY_KEYS: ReadonlyArray<keyof LeaderPsychology> = [
  'riskTolerance',
  'paranoia',
  'narcissism',
  'pragmatism',
  'patience',
  'vengefulIndex',
] as const;

/** Human-readable labels for each numeric psychology dimension. */
const NUMERIC_SLIDER_LABELS: Readonly<Record<string, string>> = {
  riskTolerance: 'Risk Tolerance',
  paranoia: 'Paranoia',
  narcissism: 'Narcissism',
  pragmatism: 'Pragmatism',
  patience: 'Patience',
  vengefulIndex: 'Vengeful Index',
};

/** Human-readable descriptions for each numeric psychology dimension. */
const NUMERIC_SLIDER_DESCRIPTIONS: Readonly<Record<string, string>> = {
  riskTolerance: 'Appetite for bold moves. Higher values favour decisive action.',
  paranoia: 'Likelihood of seeing threats where none exist.',
  narcissism: 'Weight given to personal legacy vs. national interest.',
  pragmatism: 'Willingness to abandon ideology for survival.',
  patience: 'Tolerance for slow-burn strategies.',
  vengefulIndex: 'Memory for slights; likelihood of retaliatory action.',
};

// ---------------------------------------------------------------------------
// Exported Types / Interfaces
// ---------------------------------------------------------------------------

/**
 * Metadata for a single psychology slider dimension.
 *
 * Numeric sliders have `min`, `max`, `step`, and `defaultValue`.
 * Enum sliders have `allowedValues`.
 *
 * @see FR-1202
 */
export interface SliderMetadata {
  /** Dimension key (e.g. 'riskTolerance', 'decisionStyle'). */
  readonly key: string;
  /** Human-readable label. */
  readonly label: string;
  /** Descriptive tooltip text. */
  readonly description: string;
  /** Whether this dimension is a numeric slider or an enum selector. */
  readonly type: 'numeric' | 'enum';
  /** Minimum slider value (numeric only). */
  readonly min?: number;
  /** Maximum slider value (numeric only). */
  readonly max?: number;
  /** Slider step increment (numeric only). */
  readonly step?: number;
  /** Default value when no archetype is selected (numeric only). */
  readonly defaultValue?: number;
  /** Allowed string values (enum only). */
  readonly allowedValues?: readonly string[];
}

/**
 * Collection of all slider metadata entries.
 * @see FR-1202
 */
export interface SliderMetadataCollection {
  /** Ordered array of metadata for every psychology dimension. */
  readonly sliders: ReadonlyArray<SliderMetadata>;
}

/**
 * Result of computing a live slider preview given an archetype and overrides.
 * @see FR-1202
 */
export interface SliderPreviewResult {
  /** Final computed psychology values. */
  readonly psychology: LeaderPsychology;
  /** Whether the base came from an archetype preset or the neutral default. */
  readonly source: 'archetype' | 'neutral';
  /** Number of override dimensions the player explicitly changed. */
  readonly overridesApplied: number;
}

/**
 * Result of checking whether a vulnerability event should trigger this turn.
 * @see FR-1205
 */
export interface VulnerabilityTriggerResult {
  /** Whether the vulnerability event fires this turn. */
  readonly triggered: boolean;
  /** The vulnerability type that was checked. */
  readonly vulnerabilityType: string;
  /** Human-readable reason explaining the outcome. */
  readonly reason: string;
}

/**
 * Immediate effects produced when a vulnerability event triggers.
 * @see FR-1205
 */
export interface VulnerabilityEffectResult {
  /** The vulnerability type that triggered. */
  readonly vulnerabilityType: string;
  /** Effect category (e.g. 'incapacitation', 'popularityDrop'). */
  readonly effectType: string;
  /** Instant popularity change (0 when not applicable). */
  readonly popularityDelta: number;
  /** Per-turn stability penalty (0 when not applicable). */
  readonly stabilityPenaltyPerTurn: number;
  /** Whether the leader is incapacitated. */
  readonly incapacitated: boolean;
  /** Duration in turns of any ongoing effect (0 if instant). */
  readonly durationTurns: number;
  /** Per-action loyalty penalty (0 when not applicable). */
  readonly loyaltyPenalty: number;
  /** Turn on which the vulnerability triggered. */
  readonly turnTriggered: TurnNumber;
}

/**
 * Ongoing status of a duration-based vulnerability effect.
 * @see FR-1205
 */
export interface OngoingVulnerabilityResult {
  /** Whether the effect is still active. */
  readonly active: boolean;
  /** Turns remaining until the effect expires. */
  readonly remainingTurns: number;
  /** Per-turn stability penalty while active (0 otherwise). */
  readonly stabilityPenaltyPerTurn: number;
  /** Whether the leader is currently incapacitated. */
  readonly incapacitated: boolean;
}

/**
 * Assessment of how balanced or extreme a leader's psychology is.
 * @see FR-1202
 */
export interface LeaderBalanceAssessment {
  /** Overall rating based on the number of extreme dimensions. */
  readonly rating: 'Balanced' | 'Moderate' | 'Extreme' | 'Radical';
  /** Count of numeric dimensions in extreme range (0-15 or 85-100). */
  readonly extremeCount: number;
  /** Average of all numeric psychology dimension values. */
  readonly averageValue: number;
  /** Standard deviation of numeric psychology dimension values. */
  readonly standardDeviation: number;
}

/**
 * Per-dimension delta and total deviation from an archetype preset.
 * @see FR-1202
 */
export interface ArchetypeDeviationResult {
  /** The archetype being compared against. */
  readonly archetype: string;
  /** Sum of absolute deltas across all numeric dimensions. */
  readonly totalDeviation: number;
  /** Per-dimension breakdown of signed deltas. */
  readonly perDimensionDeltas: ReadonlyArray<{
    readonly dimension: string;
    readonly delta: number;
  }>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Leader Expansion Engine — Phase 2.
 *
 * Provides full psychological slider metadata, vulnerability event
 * triggering / resolution, leader balance assessment, and archetype
 * deviation analysis. All methods are pure functions.
 *
 * @see FR-1202 — Expanded psychology slider UI
 * @see FR-1204 — AI perception consistency input
 * @see FR-1205 — Personal vulnerability events
 */
export class LeaderExpansionEngine {
  private readonly config: LeaderExpansionConfig;

  constructor(config: LeaderExpansionConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // 1. generateSliderMetadata
  // -----------------------------------------------------------------------

  /**
   * Return metadata for all 8 psychology dimensions.
   *
   * Numeric sliders (`riskTolerance`, `paranoia`, `narcissism`, `pragmatism`,
   * `patience`, `vengefulIndex`) include `min`, `max`, `step`, and
   * `defaultValue`. Enum dimensions (`decisionStyle`, `stressResponse`)
   * include the list of allowed string values.
   *
   * @returns A collection of slider metadata entries.
   * @see FR-1202
   */
  generateSliderMetadata(): SliderMetadataCollection {
    const { min, max } = this.config.sliderRange;

    const sliders: SliderMetadata[] = [];

    // Enum dimension: decisionStyle
    sliders.push({
      key: 'decisionStyle',
      label: 'Decision Style',
      description: 'How the leader approaches decisions — analytical, intuitive, transactional, or ideological.',
      type: 'enum',
      allowedValues: ['Transactional', 'Analytical', 'Intuitive', 'Ideological'] as const,
    });

    // Enum dimension: stressResponse
    sliders.push({
      key: 'stressResponse',
      label: 'Stress Response',
      description: 'How the leader responds under pressure — escalate, consolidate, deflect, or retreat.',
      type: 'enum',
      allowedValues: ['Escalate', 'Consolidate', 'Deflect', 'Retreat'] as const,
    });

    // Numeric dimensions
    for (const key of NUMERIC_PSYCHOLOGY_KEYS) {
      sliders.push({
        key: String(key),
        label: NUMERIC_SLIDER_LABELS[key] ?? String(key),
        description: NUMERIC_SLIDER_DESCRIPTIONS[key] ?? '',
        type: 'numeric',
        min,
        max,
        step: 1,
        defaultValue: 50,
      });
    }

    return { sliders };
  }

  // -----------------------------------------------------------------------
  // 2. computeSliderPreview
  // -----------------------------------------------------------------------

  /**
   * Compute a live preview of the leader's psychology given an optional
   * archetype and player overrides.
   *
   * Resolution order:
   * 1. If `archetype` is provided and valid, start from that preset.
   *    Otherwise start from neutral defaults (50 for numerics,
   *    `'Analytical'` / `'Consolidate'` for enums).
   * 2. Apply `overrides` on top.
   * 3. Clamp all numeric values to the configured slider range.
   *
   * @param archetype - Archetype key or `null` for neutral base.
   * @param overrides - Partial psychology overrides from the player.
   * @returns The preview result with final psychology and metadata.
   * @see FR-1202
   */
  computeSliderPreview(
    archetype: string | null,
    overrides: Partial<LeaderPsychology>,
  ): SliderPreviewResult {
    const { min, max } = this.config.sliderRange;

    // Determine base psychology
    let base: LeaderPsychology;
    let source: 'archetype' | 'neutral';

    if (
      archetype !== null &&
      archetype in this.config.archetypes
    ) {
      const preset =
        this.config.archetypes[archetype as keyof typeof this.config.archetypes];
      base = { ...preset.psychology };
      source = 'archetype';
    } else {
      // Neutral defaults
      base = {
        decisionStyle: 'Analytical' as const,
        stressResponse: 'Consolidate' as const,
        riskTolerance: 50,
        paranoia: 50,
        narcissism: 50,
        pragmatism: 50,
        patience: 50,
        vengefulIndex: 50,
      };
      source = 'neutral';
    }

    // Apply overrides
    const merged: LeaderPsychology = { ...base, ...overrides };

    // Count how many fields were actually overridden
    let overridesApplied = 0;
    const overrideKeys = Object.keys(overrides) as Array<keyof LeaderPsychology>;
    for (const key of overrideKeys) {
      if (overrides[key] !== undefined) {
        overridesApplied += 1;
      }
    }

    // Clamp numeric dimensions
    const clamped: LeaderPsychology = { ...merged };
    for (const key of NUMERIC_PSYCHOLOGY_KEYS) {
      const raw = clamped[key];
      if (typeof raw === 'number') {
        (clamped as unknown as Record<string, unknown>)[key] = clamp(raw, min, max);
      }
    }

    return {
      psychology: clamped,
      source,
      overridesApplied,
    };
  }

  // -----------------------------------------------------------------------
  // 3. checkVulnerabilityTrigger
  // -----------------------------------------------------------------------

  /**
   * Determine whether a personal vulnerability event should fire this turn.
   *
   * Preconditions (all must be true for a trigger):
   * - `currentTurn` ≥ `config.vulnerabilityEvents.earliestTriggerTurn`
   * - `triggersFired` < `config.vulnerabilityEvents.maxTriggersPerGame`
   * - The vulnerability uses random per-turn triggering (IdeologicalRigidity
   *   does NOT — it fires on inconsistent actions, not randomly).
   * - `deterministicRoll` (0–1) < configured `triggerChancePerTurn`.
   *
   * @param vulnerabilityType  - The vulnerability key.
   * @param currentTurn        - Current game turn.
   * @param triggersFired      - How many times this vulnerability has already fired.
   * @param deterministicRoll  - A pre-generated random value in [0, 1).
   * @returns Whether the event triggers and why.
   * @see FR-1205
   */
  checkVulnerabilityTrigger(
    vulnerabilityType: string,
    currentTurn: TurnNumber,
    triggersFired: number,
    deterministicRoll: number,
  ): VulnerabilityTriggerResult {
    const { earliestTriggerTurn, maxTriggersPerGame } =
      this.config.vulnerabilityEvents;

    // IdeologicalRigidity is action-based, not random.
    if (vulnerabilityType === 'IdeologicalRigidity') {
      return {
        triggered: false,
        vulnerabilityType,
        reason:
          'IdeologicalRigidity triggers on inconsistent actions, not via random per-turn rolls.',
      };
    }

    // Unknown vulnerability type guard
    if (!(vulnerabilityType in this.config.vulnerabilities)) {
      return {
        triggered: false,
        vulnerabilityType,
        reason: `Unknown vulnerability type: ${vulnerabilityType}.`,
      };
    }

    // Check earliest turn constraint
    if (currentTurn < earliestTriggerTurn) {
      return {
        triggered: false,
        vulnerabilityType,
        reason:
          `Current turn (${String(currentTurn)}) is before the earliest trigger turn (${String(earliestTriggerTurn)}).`,
      };
    }

    // Check max triggers per game constraint
    if (triggersFired >= maxTriggersPerGame) {
      return {
        triggered: false,
        vulnerabilityType,
        reason:
          `Maximum triggers per game (${String(maxTriggersPerGame)}) already reached (fired: ${String(triggersFired)}).`,
      };
    }

    // Look up trigger chance
    const vulnConfig =
      this.config.vulnerabilities[
        vulnerabilityType as keyof typeof this.config.vulnerabilities
      ];

    // Only HealthRisk, ScandalExposure, and SuccessionGap have triggerChancePerTurn
    const triggerChance =
      'triggerChancePerTurn' in vulnConfig
        ? (vulnConfig as { triggerChancePerTurn: number }).triggerChancePerTurn
        : 0;

    if (triggerChance <= 0) {
      return {
        triggered: false,
        vulnerabilityType,
        reason: `Vulnerability "${vulnerabilityType}" has no random trigger chance configured.`,
      };
    }

    // Roll against chance
    const triggered = deterministicRoll < triggerChance;

    return {
      triggered,
      vulnerabilityType,
      reason: triggered
        ? `Roll ${String(deterministicRoll.toFixed(4))} < chance ${String(triggerChance)} — vulnerability triggered.`
        : `Roll ${String(deterministicRoll.toFixed(4))} >= chance ${String(triggerChance)} — no trigger.`,
    };
  }

  // -----------------------------------------------------------------------
  // 4. resolveVulnerabilityEffect
  // -----------------------------------------------------------------------

  /**
   * Compute the immediate effects of a triggered vulnerability event.
   *
   * - **HealthRisk**: Leader incapacitated for 2 turns.
   * - **ScandalExposure**: Popularity drops by −20.
   * - **SuccessionGap**: 5 turns of instability with −5 Stability/turn.
   * - **IdeologicalRigidity**: Per-action penalties (Popularity −8, Loyalty −5).
   *
   * @param vulnerabilityType - The vulnerability key that triggered.
   * @param currentTurn       - The turn on which the event fires.
   * @returns The full effect descriptor.
   * @see FR-1205
   */
  resolveVulnerabilityEffect(
    vulnerabilityType: string,
    currentTurn: TurnNumber,
  ): VulnerabilityEffectResult {
    switch (vulnerabilityType) {
      case 'HealthRisk': {
        const cfg = this.config.vulnerabilities.HealthRisk;
        return {
          vulnerabilityType,
          effectType: cfg.effect,
          popularityDelta: 0,
          stabilityPenaltyPerTurn: 0,
          incapacitated: true,
          durationTurns: cfg.durationTurns,
          loyaltyPenalty: 0,
          turnTriggered: currentTurn,
        };
      }

      case 'ScandalExposure': {
        const cfg = this.config.vulnerabilities.ScandalExposure;
        return {
          vulnerabilityType,
          effectType: cfg.effect,
          popularityDelta: cfg.popularityDelta,
          stabilityPenaltyPerTurn: 0,
          incapacitated: false,
          durationTurns: 0,
          loyaltyPenalty: 0,
          turnTriggered: currentTurn,
        };
      }

      case 'SuccessionGap': {
        const cfg = this.config.vulnerabilities.SuccessionGap;
        return {
          vulnerabilityType,
          effectType: cfg.effect,
          popularityDelta: 0,
          stabilityPenaltyPerTurn: cfg.stabilityPenaltyPerTurn,
          incapacitated: false,
          durationTurns: cfg.durationTurns,
          loyaltyPenalty: 0,
          turnTriggered: currentTurn,
        };
      }

      case 'IdeologicalRigidity': {
        const cfg = this.config.vulnerabilities.IdeologicalRigidity;
        return {
          vulnerabilityType,
          effectType: cfg.effect,
          popularityDelta: cfg.inconsistencyPopularityPenalty,
          stabilityPenaltyPerTurn: 0,
          incapacitated: false,
          durationTurns: 0,
          loyaltyPenalty: cfg.inconsistencyLoyaltyPenalty,
          turnTriggered: currentTurn,
        };
      }

      default: {
        // Unknown vulnerability — return inert result.
        return {
          vulnerabilityType,
          effectType: 'none',
          popularityDelta: 0,
          stabilityPenaltyPerTurn: 0,
          incapacitated: false,
          durationTurns: 0,
          loyaltyPenalty: 0,
          turnTriggered: currentTurn,
        };
      }
    }
  }

  // -----------------------------------------------------------------------
  // 5. computeOngoingVulnerabilityEffect
  // -----------------------------------------------------------------------

  /**
   * For duration-based vulnerabilities (`HealthRisk`, `SuccessionGap`),
   * check whether the effect is still active and compute per-turn effects.
   *
   * - **HealthRisk**: Active for `durationTurns` (2). Leader is incapacitated
   *   while active.
   * - **SuccessionGap**: Active for `durationTurns` (5). Stability penalty
   *   of −5 per turn while active.
   * - All other types return an inactive result (no ongoing component).
   *
   * @param vulnerabilityType    - The vulnerability key.
   * @param turnsSinceTriggered  - Number of turns elapsed since the event fired.
   * @returns Whether the effect is still active and its per-turn impact.
   * @see FR-1205
   */
  computeOngoingVulnerabilityEffect(
    vulnerabilityType: string,
    turnsSinceTriggered: number,
  ): OngoingVulnerabilityResult {
    switch (vulnerabilityType) {
      case 'HealthRisk': {
        const cfg = this.config.vulnerabilities.HealthRisk;
        const remaining = Math.max(0, cfg.durationTurns - turnsSinceTriggered);
        const active = remaining > 0;
        return {
          active,
          remainingTurns: remaining,
          stabilityPenaltyPerTurn: 0,
          incapacitated: active,
        };
      }

      case 'SuccessionGap': {
        const cfg = this.config.vulnerabilities.SuccessionGap;
        const remaining = Math.max(0, cfg.durationTurns - turnsSinceTriggered);
        const active = remaining > 0;
        return {
          active,
          remainingTurns: remaining,
          stabilityPenaltyPerTurn: active ? cfg.stabilityPenaltyPerTurn : 0,
          incapacitated: false,
        };
      }

      // ScandalExposure and IdeologicalRigidity have no ongoing duration.
      default:
        return {
          active: false,
          remainingTurns: 0,
          stabilityPenaltyPerTurn: 0,
          incapacitated: false,
        };
    }
  }

  // -----------------------------------------------------------------------
  // 6. evaluateLeaderBalance
  // -----------------------------------------------------------------------

  /**
   * Assess whether a leader's psychology is balanced or extreme.
   *
   * Examines all 6 numeric dimensions. A dimension is "extreme" if its
   * value falls in `[0, 15]` or `[85, 100]`. Rating scale:
   * - 0 extremes  → `'Balanced'`
   * - 1–2 extremes → `'Moderate'`
   * - 3–4 extremes → `'Extreme'`
   * - 5–6 extremes → `'Radical'`
   *
   * Also computes the average and standard deviation of all numeric
   * dimension values.
   *
   * @param psychology - The leader's current psychological profile.
   * @returns Balance assessment with statistics.
   * @see FR-1202
   */
  evaluateLeaderBalance(psychology: LeaderPsychology): LeaderBalanceAssessment {
    const values: number[] = NUMERIC_PSYCHOLOGY_KEYS.map(
      (key) => psychology[key] as number,
    );

    // Count extremes (0-15 or 85-100)
    let extremeCount = 0;
    for (const v of values) {
      if (v <= 15 || v >= 85) {
        extremeCount += 1;
      }
    }

    // Average
    const sum = values.reduce((acc, v) => acc + v, 0);
    const averageValue = values.length > 0 ? sum / values.length : 0;

    // Standard deviation (population)
    const squaredDiffs = values.map((v) => (v - averageValue) ** 2);
    const variance =
      squaredDiffs.length > 0
        ? squaredDiffs.reduce((acc, v) => acc + v, 0) / squaredDiffs.length
        : 0;
    const standardDeviation = Math.sqrt(variance);

    // Determine rating
    let rating: 'Balanced' | 'Moderate' | 'Extreme' | 'Radical';
    if (extremeCount === 0) {
      rating = 'Balanced';
    } else if (extremeCount <= 2) {
      rating = 'Moderate';
    } else if (extremeCount <= 4) {
      rating = 'Extreme';
    } else {
      rating = 'Radical';
    }

    return {
      rating,
      extremeCount,
      averageValue: Math.round(averageValue * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
    };
  }

  // -----------------------------------------------------------------------
  // 7. computeArchetypeDeviation
  // -----------------------------------------------------------------------

  /**
   * Calculate how far the current psychology has deviated from an archetype
   * preset.
   *
   * For each numeric dimension, the signed delta is
   * `current - archetypePreset`. The `totalDeviation` is the sum of the
   * absolute values of all per-dimension deltas. A high total deviation
   * means the player has substantially customised away from the archetype.
   *
   * If the archetype key is invalid, all deltas are 0 and total deviation
   * is 0.
   *
   * @param psychology - The leader's current psychological profile.
   * @param archetype  - The archetype key to compare against.
   * @returns Per-dimension deltas and aggregate deviation score.
   * @see FR-1202
   */
  computeArchetypeDeviation(
    psychology: LeaderPsychology,
    archetype: string,
  ): ArchetypeDeviationResult {
    // Guard against unknown archetype
    if (!(archetype in this.config.archetypes)) {
      return {
        archetype,
        totalDeviation: 0,
        perDimensionDeltas: NUMERIC_PSYCHOLOGY_KEYS.map((key) => ({
          dimension: String(key),
          delta: 0,
        })),
      };
    }

    const preset =
      this.config.archetypes[archetype as keyof typeof this.config.archetypes];

    const perDimensionDeltas: Array<{ dimension: string; delta: number }> = [];
    let totalDeviation = 0;

    for (const key of NUMERIC_PSYCHOLOGY_KEYS) {
      const current = psychology[key] as number;
      const base = preset.psychology[key] as number;
      const delta = current - base;
      perDimensionDeltas.push({ dimension: String(key), delta });
      totalDeviation += Math.abs(delta);
    }

    return {
      archetype,
      totalDeviation,
      perDimensionDeltas,
    };
  }
}
