/**
 * @module PsyOps
 * @description Psychological Operations engine for New Order.
 *
 * Implements three requirement families:
 *
 * - **FR-1512 PsyOps** — Four action types that target rival leader emotional
 *   states: Public Humiliation, Strategic Ambiguity, Diplomatic Ghosting, and
 *   Provocative Posturing. Each always lands (success = true) but may be
 *   discovered, triggering executor costs.
 *
 * - **FR-1513 Psychological Counter-Intelligence** — Three defensive measures:
 *   Media Counter-Narrative (blocks confidence loss), Emotional Discipline
 *   (blanket magnitude reduction when resolve is high), and Intelligence
 *   Inoculation (full nullification when HUMINT detected the incoming op).
 *
 * - **FR-1514 Observable Behavioral Changes** — Translates before/after
 *   emotional state snapshots into qualitative intelligence signals that a
 *   human or AI player can observe, with reliability scaled by HUMINT clarity.
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1512
 * @see FR-1513
 * @see FR-1514
 */

import { GAME_CONFIG } from '@/engine/config';
import { PsyOpType, CounterIntelType } from '@/data/types';
import type { LeaderId, FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * Configuration shape for the psychology sub-system, derived from
 * `GAME_CONFIG.psychology`. This ensures the engine stays in sync with
 * whatever the central config declares.
 *
 * @see FR-1512
 * @see FR-1513
 * @see FR-1514
 */
export type PsyOpsConfig = typeof GAME_CONFIG.psychology;

/**
 * Input required to execute a psychological operation against a rival leader.
 *
 * @see FR-1512
 */
export interface PsyOpInput {
  /** The type of PsyOp being executed. */
  readonly psyOpType: PsyOpType;
  /** Faction performing the operation. */
  readonly executingFaction: FactionId;
  /** Leader being targeted. */
  readonly targetLeader: LeaderId;
  /** Target leader's current paranoia level (0–100). */
  readonly targetParanoia: number;
  /** Target leader's current resolve level (0–100). */
  readonly targetResolve: number;
  /** Current game turn. */
  readonly currentTurn: TurnNumber;
  /** Deterministic discovery roll (0–1) for testability. */
  readonly discoveryRoll: number;
}

/**
 * Result of executing a PsyOp. PsyOps always land (`success` is always
 * `true`) but may be discovered, incurring costs on the executor.
 *
 * @see FR-1512
 */
export interface PsyOpResult {
  /** The type of PsyOp that was executed. */
  readonly psyOpType: PsyOpType;
  /** The targeted leader. */
  readonly targetLeader: LeaderId;
  /** Whether the operation succeeded (always `true`). */
  readonly success: boolean;
  /** Whether the target discovered the operation. */
  readonly discovered: boolean;
  /** Emotion dimension deltas applied to the target leader. */
  readonly emotionalEffects: Readonly<Record<string, number>>;
  /** Costs incurred by the executor. */
  readonly executorCosts: {
    readonly diPenalty: number;
    readonly readinessCost: number;
    readonly tensionIncrease: number;
  };
  /** Whether the operation triggered an accidental conflict (Provocative Posturing only). */
  readonly conflictTriggered: boolean;
  /** Human-readable explanation of outcome. */
  readonly reason: string;
}

/**
 * Input required to apply a counter-intelligence measure against incoming
 * PsyOp emotional effects.
 *
 * @see FR-1513
 */
export interface CounterIntelInput {
  /** The counter-intelligence type being applied. */
  readonly counterType: CounterIntelType;
  /** The leader deploying the counter-measure. */
  readonly targetLeader: LeaderId;
  /** Target leader's current resolve level (0–100). */
  readonly targetResolve: number;
  /** Incoming emotional effect deltas from a PsyOp. */
  readonly incomingEffects: Readonly<Record<string, number>>;
  /** Whether the incoming PsyOp was detected via HUMINT before landing. */
  readonly detected: boolean;
  /** Current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Result of applying a counter-intelligence measure.
 *
 * @see FR-1513
 */
export interface CounterIntelResult {
  /** The counter-intelligence type that was applied. */
  readonly counterType: CounterIntelType;
  /** Whether the counter-measure was successfully applied. */
  readonly applied: boolean;
  /** Emotional effect deltas after mitigation. */
  readonly modifiedEffects: Readonly<Record<string, number>>;
  /** Diplomatic-influence cost incurred. */
  readonly diCost: number;
  /** Nationalism boost granted. */
  readonly nationalismBoost: number;
  /** Human-readable explanation of outcome. */
  readonly reason: string;
}

/**
 * A single observable behavioural signal derived from comparing a leader's
 * previous and current emotional state.
 *
 * @see FR-1514
 */
export interface BehavioralSignal {
  /** The emotional dimension being observed. */
  readonly dimension: 'anger' | 'fear' | 'stress' | 'confidence' | 'resolve' | 'paranoia';
  /** Current value of the dimension. */
  readonly currentValue: number;
  /** Previous value of the dimension. */
  readonly previousValue: number;
  /** Direction of change. */
  readonly trend: 'rising' | 'falling' | 'stable';
  /** Magnitude of change. */
  readonly intensity: 'mild' | 'moderate' | 'severe';
}

/**
 * Emotional state snapshot used for behavioural assessment.
 *
 * @see FR-1514
 */
export interface EmotionalSnapshot {
  readonly stress: number;
  readonly confidence: number;
  readonly anger: number;
  readonly fear: number;
  readonly resolve: number;
}

/**
 * Input required to assess observable behavioural changes in a leader.
 *
 * @see FR-1514
 */
export interface BehavioralAssessmentInput {
  /** The leader being assessed. */
  readonly targetLeader: LeaderId;
  /** Previous turn's emotional state. */
  readonly previousEmotionalState: EmotionalSnapshot;
  /** Current turn's emotional state. */
  readonly currentEmotionalState: EmotionalSnapshot;
  /** HUMINT clarity on target (0–100). Higher = more reliable assessment. */
  readonly humintClarity: number;
}

/**
 * Result of a behavioural assessment — qualitative intelligence signals
 * derived from emotional state changes.
 *
 * @see FR-1514
 */
export interface BehavioralAssessmentResult {
  /** The leader being assessed. */
  readonly targetLeader: LeaderId;
  /** Non-stable behavioural signals detected. */
  readonly signals: readonly BehavioralSignal[];
  /** Overall shift classification. */
  readonly overallShift: 'stable' | 'destabilized' | 'volatile';
  /** Reliability of the assessment, scaled by HUMINT clarity (0–1). */
  readonly assessmentReliability: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Psychological Operations engine.
 *
 * Provides pure-function methods for executing PsyOps against rival leaders,
 * applying counter-intelligence defences, and assessing observable behavioural
 * changes from emotional state shifts.
 *
 * @see FR-1512
 * @see FR-1513
 * @see FR-1514
 */
export class PsyOpsEngine {
  private readonly cfg: PsyOpsConfig;

  constructor(cfg: PsyOpsConfig = GAME_CONFIG.psychology) {
    this.cfg = cfg;
  }

  // -----------------------------------------------------------------------
  // FR-1512 — PsyOp execution
  // -----------------------------------------------------------------------

  /**
   * Execute a psychological operation against a rival leader.
   *
   * PsyOps always land (`success` is always `true`). Discovery and secondary
   * effects depend on the operation type and the deterministic
   * `discoveryRoll`.
   *
   * @param input - PsyOp execution parameters.
   * @returns The outcome of the operation.
   *
   * @see FR-1512
   */
  executePsyOp(input: PsyOpInput): PsyOpResult {
    const { psyOpType, targetLeader, discoveryRoll } = input;

    switch (psyOpType) {
      case PsyOpType.PublicHumiliation: {
        const c = this.cfg.psyOps.publicHumiliation;
        const discovered = discoveryRoll < c.discoveryChance;
        return {
          psyOpType,
          targetLeader,
          success: true,
          discovered,
          emotionalEffects: {
            anger: c.targetAngerIncrease,
            confidence: c.targetConfidenceDecrease,
          },
          executorCosts: {
            diPenalty: discovered ? c.discoveredDiPenalty : 0,
            readinessCost: 0,
            tensionIncrease: 0,
          },
          conflictTriggered: false,
          reason: discovered
            ? `Public Humiliation landed — target anger +${c.targetAngerIncrease}, confidence ${c.targetConfidenceDecrease}. Operation was discovered; executor DI ${c.discoveredDiPenalty}.`
            : `Public Humiliation landed — target anger +${c.targetAngerIncrease}, confidence ${c.targetConfidenceDecrease}. Undetected.`,
        };
      }

      case PsyOpType.StrategicAmbiguity: {
        const c = this.cfg.psyOps.strategicAmbiguity;
        return {
          psyOpType,
          targetLeader,
          success: true,
          discovered: false,
          emotionalEffects: {
            fear: c.targetFearIncrease,
            stress: c.targetStressIncrease,
          },
          executorCosts: {
            diPenalty: 0,
            readinessCost: c.readinessCost,
            tensionIncrease: 0,
          },
          conflictTriggered: false,
          reason: `Strategic Ambiguity landed — target fear +${c.targetFearIncrease}, stress +${c.targetStressIncrease}. Executor readiness ${c.readinessCost}.`,
        };
      }

      case PsyOpType.DiplomaticGhosting: {
        const c = this.cfg.psyOps.diplomaticGhosting;
        return {
          psyOpType,
          targetLeader,
          success: true,
          discovered: false,
          emotionalEffects: {
            paranoia: c.targetParanoiaIncrease,
            anger: c.targetAngerIncrease,
          },
          executorCosts: {
            diPenalty: 0,
            readinessCost: 0,
            tensionIncrease: c.tensionIncrease,
          },
          conflictTriggered: false,
          reason: `Diplomatic Ghosting landed — target paranoia +${c.targetParanoiaIncrease}, anger +${c.targetAngerIncrease}. Tension +${c.tensionIncrease} for ${c.durationTurns} turns.`,
        };
      }

      case PsyOpType.ProvocativePosturing: {
        const c = this.cfg.psyOps.provocativePosturing;
        const conflictThreshold = c.conflictChancePerParanoia * input.targetParanoia;
        const conflictTriggered = discoveryRoll < conflictThreshold;
        return {
          psyOpType,
          targetLeader,
          success: true,
          discovered: false,
          emotionalEffects: {
            fear: c.targetFearIncrease,
          },
          executorCosts: {
            diPenalty: 0,
            readinessCost: 0,
            tensionIncrease: 0,
          },
          conflictTriggered,
          reason: conflictTriggered
            ? `Provocative Posturing landed — target fear +${c.targetFearIncrease}. Conflict triggered (roll ${discoveryRoll.toFixed(2)} < threshold ${conflictThreshold.toFixed(2)}).`
            : `Provocative Posturing landed — target fear +${c.targetFearIncrease}. No conflict triggered.`,
        };
      }

      default: {
        const _exhaustive: never = psyOpType;
        throw new Error(`Unknown PsyOpType: ${_exhaustive as string}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // FR-1513 — Counter-Intelligence
  // -----------------------------------------------------------------------

  /**
   * Apply a psychological counter-intelligence measure against incoming
   * PsyOp effects.
   *
   * @param input - Counter-intelligence parameters.
   * @returns The mitigated result.
   *
   * @see FR-1513
   */
  applyCounterIntel(input: CounterIntelInput): CounterIntelResult {
    const { counterType, incomingEffects } = input;

    switch (counterType) {
      case CounterIntelType.MediaCounterNarrative: {
        const diCost = this.cfg.counterIntel.mediaCounterNarrativeDiCost;
        const modifiedEffects: Record<string, number> = {};
        for (const [key, value] of Object.entries(incomingEffects)) {
          modifiedEffects[key] = key === 'confidence' ? 0 : value;
        }
        return {
          counterType,
          applied: true,
          modifiedEffects,
          diCost,
          nationalismBoost: 0,
          reason: `Media Counter-Narrative applied — confidence reduction zeroed. DI cost ${diCost}.`,
        };
      }

      case CounterIntelType.EmotionalDiscipline: {
        const threshold = this.cfg.counterIntel.emotionalDisciplineResolveThreshold;
        const reduction = this.cfg.counterIntel.emotionalDisciplineReduction;

        if (input.targetResolve < threshold) {
          return {
            counterType,
            applied: false,
            modifiedEffects: { ...incomingEffects },
            diCost: 0,
            nationalismBoost: 0,
            reason: `Emotional Discipline not applied — resolve ${input.targetResolve} below threshold ${threshold}.`,
          };
        }

        const modifiedEffects: Record<string, number> = {};
        for (const [key, value] of Object.entries(incomingEffects)) {
          modifiedEffects[key] = Math.round(value * (1 - reduction));
        }
        return {
          counterType,
          applied: true,
          modifiedEffects,
          diCost: 0,
          nationalismBoost: 0,
          reason: `Emotional Discipline applied — all effect magnitudes reduced by ${(reduction * 100).toFixed(4)}%.`,
        };
      }

      case CounterIntelType.IntelligenceInoculation: {
        const nationalismBoost = this.cfg.counterIntel.intelligenceInoculationNationalismBoost;

        if (!input.detected) {
          return {
            counterType,
            applied: false,
            modifiedEffects: { ...incomingEffects },
            diCost: 0,
            nationalismBoost: 0,
            reason: 'Intelligence Inoculation not applied — incoming PsyOp was not detected via HUMINT.',
          };
        }

        const modifiedEffects: Record<string, number> = {};
        for (const key of Object.keys(incomingEffects)) {
          modifiedEffects[key] = 0;
        }
        return {
          counterType,
          applied: true,
          modifiedEffects,
          diCost: 0,
          nationalismBoost,
          reason: `Intelligence Inoculation applied — all effects nullified. Nationalism +${nationalismBoost}.`,
        };
      }

      default: {
        const _exhaustive: never = counterType;
        throw new Error(`Unknown CounterIntelType: ${_exhaustive as string}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // FR-1514 — Behavioural Assessment
  // -----------------------------------------------------------------------

  /**
   * Assess observable behavioural changes in a leader by comparing their
   * previous and current emotional states.
   *
   * Only non-stable trends are reported. Assessment reliability is linearly
   * scaled by the observer's HUMINT clarity on the target.
   *
   * @param input - Behavioural assessment parameters.
   * @returns Qualitative intelligence signals with reliability rating.
   *
   * @see FR-1514
   */
  assessBehavior(input: BehavioralAssessmentInput): BehavioralAssessmentResult {
    const { targetLeader, previousEmotionalState, currentEmotionalState, humintClarity } = input;

    const dimensions = ['anger', 'fear', 'stress', 'confidence', 'resolve'] as const;

    const signals: BehavioralSignal[] = [];

    for (const dim of dimensions) {
      const prev = previousEmotionalState[dim];
      const curr = currentEmotionalState[dim];
      const delta = curr - prev;

      const trend: BehavioralSignal['trend'] =
        delta > 5 ? 'rising' : delta < -5 ? 'falling' : 'stable';

      if (trend === 'stable') continue;

      const absDelta = Math.abs(delta);
      const intensity: BehavioralSignal['intensity'] =
        absDelta >= 20 ? 'severe' : absDelta >= 10 ? 'moderate' : 'mild';

      signals.push({
        dimension: dim,
        currentValue: curr,
        previousValue: prev,
        trend,
        intensity,
      });
    }

    const overallShift: BehavioralAssessmentResult['overallShift'] =
      signals.length === 0 ? 'stable' : signals.length <= 2 ? 'destabilized' : 'volatile';

    const assessmentReliability = clamp(humintClarity / 100, 0, 1);

    const signalSummary =
      signals.length === 0
        ? 'No significant behavioural shifts detected.'
        : signals
            .map((s) => `${s.dimension} ${s.trend} (${s.intensity})`)
            .join(', ');

    return {
      targetLeader,
      signals,
      overallShift,
      assessmentReliability,
      reason: `Assessment: ${overallShift}. Reliability ${(assessmentReliability * 100).toFixed(4)}%. ${signalSummary}`,
    };
  }
}
