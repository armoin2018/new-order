/**
 * New Order: Psychological Journey Engine
 *
 * Implements the post-game Psychological Journey analysis defined by FR-1522.
 * After a game concludes the player is presented with a detailed breakdown of
 * how each leader's emotional state, personality traits, and grudge patterns
 * evolved across the full arc of the simulation.  This engine produces all the
 * data structures needed to render:
 *
 *   (a) Emotional-state chart over time for the player and key rivals
 *   (b) Personality-drift radar chart (before/after comparison)
 *   (c) Grudge timeline showing when grudges formed and influenced decisions
 *   (d) Key psychological turning points identified algorithmically
 *
 * All public methods are **pure functions**: they accept immutable inputs and
 * return new objects without mutating anything.  Config-driven thresholds and
 * multipliers are pulled from `GAME_CONFIG.postGameAnalysis` so that balance
 * tuning requires no code changes (NFR-204).
 *
 * @module psychological-journey-engine
 * @see FR-1522 — Post-game Psychological Journey analysis
 * @see NFR-204  — Config-driven formula tuning
 */

import type {
  LeaderId,
  TurnNumber,
  EmotionalStateSnapshot,
  LeaderPsychology,
  PersonalityDriftLog,
} from '@/data/types';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Derived config type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of `GAME_CONFIG.postGameAnalysis` extracted at the type level so that
 * consuming code can accept an arbitrary post-game analysis configuration
 * without importing the full game config object.
 *
 * @see NFR-204
 */
export type PsychologicalJourneyConfig = typeof GAME_CONFIG.postGameAnalysis;

// ─────────────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a number between `min` and `max` (inclusive). */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Emotional Timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single entry in the per-leader emotional timeline.
 *
 * Captures the five core emotional dimensions for one turn so that
 * a line/area chart can be rendered.
 *
 * @see FR-1522(a)
 */
export interface EmotionalTimelineEntry {
  /** The simulation turn this entry corresponds to. */
  readonly turn: TurnNumber;
  /** Stress level at the end of this turn. Range: 0–100. */
  readonly stress: number;
  /** Confidence level at the end of this turn. Range: 0–100. */
  readonly confidence: number;
  /** Anger level at the end of this turn. Range: 0–100. */
  readonly anger: number;
  /** Fear level at the end of this turn. Range: 0–100. */
  readonly fear: number;
  /** Resolve level at the end of this turn. Range: 0–100. */
  readonly resolve: number;
}

/**
 * Complete emotional-timeline result for one leader.
 *
 * @see FR-1522(a)
 */
export interface EmotionalTimelineResult {
  /** The leader this timeline belongs to. */
  readonly leaderId: LeaderId;
  /** Ordered per-turn emotional entries. */
  readonly timeline: EmotionalTimelineEntry[];
  /** Turn where stress reached its highest value, or `null` if no snapshots. */
  readonly peakStressTurn: TurnNumber | null;
  /** Turn where anger reached its highest value, or `null` if no snapshots. */
  readonly peakAngerTurn: TurnNumber | null;
  /** Total number of turns covered by the timeline. */
  readonly totalTurns: number;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Personality Radar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One axis of the personality-drift radar chart.
 *
 * @see FR-1522(b)
 */
export interface RadarDimension {
  /** Dimension name (e.g. `"riskTolerance"`). */
  readonly name: string;
  /** Value at game start. Range: 0–100. */
  readonly original: number;
  /** Value at game end. Range: 0–100. */
  readonly current: number;
  /** Signed shift: `current − original`. */
  readonly delta: number;
}

/**
 * Complete radar-chart result for one leader.
 *
 * @see FR-1522(b)
 */
export interface PersonalityRadarResult {
  /** The leader this radar belongs to. */
  readonly leaderId: LeaderId;
  /** One entry per radar dimension defined in config. */
  readonly dimensions: RadarDimension[];
  /** Sum of absolute deltas across all dimensions. */
  readonly totalDriftMagnitude: number;
  /** Dimension name with the largest absolute shift. */
  readonly mostDriftedDimension: string;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Grudge Timeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for a single grudge to include in the timeline.
 *
 * Extends the core `Grudge` type with a decision-influence counter that is
 * computed by the caller (typically the grudge-ledger engine).
 *
 * @see FR-1522(c)
 */
export interface GrudgeTimelineInput {
  /** The leader who caused the offense. */
  readonly offender: LeaderId;
  /** Category of the perceived slight. */
  readonly offenseType: string;
  /** Original severity. */
  readonly severity: number;
  /** Turn when the grudge was recorded. */
  readonly turnCreated: TurnNumber;
  /** Whether the grudge has been resolved or avenged. */
  readonly resolved: boolean;
  /** How many AI decisions this grudge influenced. */
  readonly influencedDecisionCount: number;
}

/**
 * One row in the rendered grudge timeline.
 *
 * @see FR-1522(c)
 */
export interface GrudgeTimelineEntry {
  /** The leader who caused the offense. */
  readonly offender: LeaderId;
  /** Category of the perceived slight. */
  readonly offenseType: string;
  /** Original severity. */
  readonly severity: number;
  /** Turn when the grudge was recorded. */
  readonly turnCreated: TurnNumber;
  /** Whether the grudge has been resolved or avenged. */
  readonly resolved: boolean;
  /** How many AI decisions this grudge influenced. */
  readonly influencedDecisionCount: number;
}

/**
 * Complete grudge-timeline result for one leader.
 *
 * @see FR-1522(c)
 */
export interface GrudgeTimelineResult {
  /** The leader this timeline belongs to. */
  readonly leaderId: LeaderId;
  /** Grudge entries sorted by turn created, capped to config max. */
  readonly entries: GrudgeTimelineEntry[];
  /** Total number of grudges (before capping). */
  readonly totalGrudges: number;
  /** Count of grudges that remain unresolved. */
  readonly unresolvedCount: number;
  /** The grudge that influenced the most decisions, or `null` if none. */
  readonly mostInfluentialGrudge: GrudgeTimelineEntry | null;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Psychological Turning Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single algorithmically-detected psychological turning point.
 *
 * @see FR-1522(d)
 */
export interface PsychologicalTurningPoint {
  /** Turn where the turning point occurred. */
  readonly turn: TurnNumber;
  /** Emotional dimension that crossed the threshold. */
  readonly dimension: string;
  /** Value of the dimension on the previous turn. */
  readonly previousValue: number;
  /** Value of the dimension on this turn. */
  readonly newValue: number;
  /** Signed shift from previous to new (`newValue − previousValue`). */
  readonly delta: number;
  /** Human-readable narrative sentence describing the turning point. */
  readonly narrative: string;
}

/**
 * Complete turning-point detection result for one leader.
 *
 * @see FR-1522(d)
 */
export interface TurningPointResult {
  /** The leader this result belongs to. */
  readonly leaderId: LeaderId;
  /** All detected turning points, in chronological order. */
  readonly turningPoints: PsychologicalTurningPoint[];
  /** Number of turning points detected. */
  readonly totalDetected: number;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Drift Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compact summary of a single drift event for the summary view.
 *
 * @see FR-1522
 */
export interface DriftEventSummary {
  /** What caused the drift. */
  readonly trigger: string;
  /** Turn when the drift occurred. */
  readonly turn: TurnNumber;
  /** Which psychological dimension shifted. */
  readonly dimension: string;
  /** Magnitude and direction of the shift. */
  readonly delta: number;
}

/**
 * Aggregated drift summary for one leader.
 *
 * @see FR-1522
 */
export interface DriftSummaryResult {
  /** The leader this summary belongs to. */
  readonly leaderId: LeaderId;
  /** Total number of drift events recorded. */
  readonly totalEvents: number;
  /** Net drift per dimension (signed sum of all deltas for that dimension). */
  readonly netDriftByDimension: Record<string, number>;
  /** Current overall drift magnitude from the drift log. */
  readonly driftMagnitude: number;
  /** Turn when stress inoculation activated, or `null`. */
  readonly stressInoculationTurn: TurnNumber | null;
  /** The single drift event with the largest absolute delta, or `null`. */
  readonly mostImpactfulEvent: DriftEventSummary | null;
  /** Human-readable explanation of the result. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces — Journey Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * High-level narrative summary combining all psychological journey data.
 *
 * @see FR-1522
 */
export interface JourneySummaryResult {
  /** The leader this summary belongs to. */
  readonly leaderId: LeaderId;
  /** Total number of turns in the emotional timeline. */
  readonly totalTurns: number;
  /** Number of psychological turning points detected. */
  readonly turningPointCount: number;
  /** Total grudges recorded. */
  readonly grudgeCount: number;
  /** Overall personality-drift magnitude from the radar chart. */
  readonly driftMagnitude: number;
  /** Dimension that drifted the most. */
  readonly mostDriftedDimension: string;
  /** Full human-readable narrative paragraph. */
  readonly narrativeSummary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post-game Psychological Journey analysis engine.
 *
 * Produces all data structures needed to render the four-panel psychological
 * journey screen (emotional chart, radar chart, grudge timeline, and turning
 * points).  All methods are **pure** — no side-effects, no mutation.
 *
 * @see FR-1522
 * @see NFR-204
 */
export class PsychologicalJourneyEngine {
  private readonly config: PsychologicalJourneyConfig;

  constructor(config: PsychologicalJourneyConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 1 — Emotional Timeline   (FR-1522a)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build an ordered emotional timeline for a single leader.
   *
   * Extracts the five radial emotional indicators per turn from the full
   * {@link EmotionalStateSnapshot} array and identifies the peak-stress and
   * peak-anger turns.
   *
   * @param params.leaderId  — The leader to build the timeline for.
   * @param params.snapshots — All emotional-state snapshots for this leader,
   *                           in any order (will be sorted by turn).
   * @returns An {@link EmotionalTimelineResult} with ordered entries and peak
   *          metadata.
   *
   * @see FR-1522(a)
   */
  buildEmotionalTimeline(params: {
    readonly leaderId: LeaderId;
    readonly snapshots: readonly EmotionalStateSnapshot[];
  }): EmotionalTimelineResult {
    const { leaderId, snapshots } = params;

    if (snapshots.length === 0) {
      return {
        leaderId,
        timeline: [],
        peakStressTurn: null,
        peakAngerTurn: null,
        totalTurns: 0,
        reason: 'No emotional snapshots available for this leader.',
      };
    }

    const sorted = [...snapshots].sort((a, b) => (a.turn as number) - (b.turn as number));

    let peakStress = -1;
    let peakStressTurn: TurnNumber | null = null;
    let peakAnger = -1;
    let peakAngerTurn: TurnNumber | null = null;

    const timeline: EmotionalTimelineEntry[] = sorted.map((snap) => {
      if (snap.stress > peakStress) {
        peakStress = snap.stress;
        peakStressTurn = snap.turn;
      }
      if (snap.anger > peakAnger) {
        peakAnger = snap.anger;
        peakAngerTurn = snap.turn;
      }

      return {
        turn: snap.turn,
        stress: clamp(snap.stress, 0, 100),
        confidence: clamp(snap.confidence, 0, 100),
        anger: clamp(snap.anger, 0, 100),
        fear: clamp(snap.fear, 0, 100),
        resolve: clamp(snap.resolve, 0, 100),
      };
    });

    return {
      leaderId,
      timeline,
      peakStressTurn,
      peakAngerTurn,
      totalTurns: timeline.length,
      reason:
        `Built emotional timeline spanning ${String(timeline.length)} turn(s). ` +
        `Peak stress on turn ${String(peakStressTurn as number)}, ` +
        `peak anger on turn ${String(peakAngerTurn as number)}.`,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 2 — Personality Radar   (FR-1522b)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute before/after radar-chart data for a leader's personality profile.
   *
   * Uses the `radarDimensions` array from
   * `GAME_CONFIG.postGameAnalysis` to determine which axes to include.
   * `totalDriftMagnitude` is the sum of absolute deltas.
   * `mostDriftedDimension` is the dimension with the largest |delta|.
   *
   * @param params.leaderId        — The leader to compute the radar for.
   * @param params.originalProfile — The leader's psychology at game start.
   * @param params.currentProfile  — The leader's psychology at game end.
   * @returns A {@link PersonalityRadarResult} with per-dimension data.
   *
   * @see FR-1522(b)
   */
  computePersonalityRadar(params: {
    readonly leaderId: LeaderId;
    readonly originalProfile: LeaderPsychology;
    readonly currentProfile: LeaderPsychology;
  }): PersonalityRadarResult {
    const { leaderId, originalProfile, currentProfile } = params;

    let totalDriftMagnitude = 0;
    let mostDriftedDimension = '';
    let largestAbsDelta = -1;

    const dimensions: RadarDimension[] = this.config.radarDimensions.map((dim) => {
      const original = originalProfile[dim] as number;
      const current = currentProfile[dim] as number;
      const delta = current - original;
      const absDelta = Math.abs(delta);

      totalDriftMagnitude += absDelta;

      if (absDelta > largestAbsDelta) {
        largestAbsDelta = absDelta;
        mostDriftedDimension = dim;
      }

      return { name: dim, original, current, delta };
    });

    return {
      leaderId,
      dimensions,
      totalDriftMagnitude,
      mostDriftedDimension,
      reason:
        `Radar computed across ${String(dimensions.length)} dimension(s). ` +
        `Total drift magnitude: ${String(totalDriftMagnitude)}. ` +
        `Most drifted: ${mostDriftedDimension} (|Δ| = ${String(largestAbsDelta)}).`,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 3 — Grudge Timeline   (FR-1522c)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build a chronological grudge timeline for a single leader.
   *
   * Grudges are sorted by `turnCreated` and capped at
   * `grudgeTimelineMaxEntries`.  The most influential grudge is the one with
   * the highest `influencedDecisionCount`.
   *
   * @param params.leaderId — The leader whose grudges to summarise.
   * @param params.grudges  — All grudge inputs (any order).
   * @returns A {@link GrudgeTimelineResult} with capped, sorted entries.
   *
   * @see FR-1522(c)
   */
  buildGrudgeTimeline(params: {
    readonly leaderId: LeaderId;
    readonly grudges: readonly GrudgeTimelineInput[];
  }): GrudgeTimelineResult {
    const { leaderId, grudges } = params;

    if (grudges.length === 0) {
      return {
        leaderId,
        entries: [],
        totalGrudges: 0,
        unresolvedCount: 0,
        mostInfluentialGrudge: null,
        reason: 'No grudges recorded for this leader.',
      };
    }

    const sorted = [...grudges].sort(
      (a, b) => (a.turnCreated as number) - (b.turnCreated as number),
    );

    const capped = sorted.slice(0, this.config.grudgeTimelineMaxEntries);

    const entries: GrudgeTimelineEntry[] = capped.map((g) => ({
      offender: g.offender,
      offenseType: g.offenseType,
      severity: g.severity,
      turnCreated: g.turnCreated,
      resolved: g.resolved,
      influencedDecisionCount: g.influencedDecisionCount,
    }));

    const unresolvedCount = grudges.filter((g) => !g.resolved).length;

    let mostInfluentialGrudge: GrudgeTimelineEntry | null = null;
    let highestInfluence = -1;

    for (const entry of entries) {
      if (entry.influencedDecisionCount > highestInfluence) {
        highestInfluence = entry.influencedDecisionCount;
        mostInfluentialGrudge = entry;
      }
    }

    return {
      leaderId,
      entries,
      totalGrudges: grudges.length,
      unresolvedCount,
      mostInfluentialGrudge,
      reason:
        `Grudge timeline contains ${String(entries.length)} of ${String(grudges.length)} total grudge(s). ` +
        `${String(unresolvedCount)} unresolved. ` +
        (mostInfluentialGrudge
          ? `Most influential grudge against ${mostInfluentialGrudge.offender as string} ` +
            `(${String(highestInfluence)} decision(s) influenced).`
          : 'No influential grudge identified.'),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 4 — Psychological Turning Points   (FR-1522d)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Algorithmically detect psychological turning points in an emotional
   * timeline.
   *
   * **Algorithm:** For each consecutive pair of turns, check each emotional
   * dimension (`stress`, `confidence`, `anger`, `fear`, `resolve`).  If the
   * new value ≥ `psychologicalTurningPointThreshold` **and** |delta| ≥
   * `psychologicalShiftMinDelta`, the pair is recorded as a turning point.
   *
   * @param params.leaderId          — The leader to analyse.
   * @param params.emotionalTimeline — Ordered timeline entries from
   *                                   {@link buildEmotionalTimeline}.
   * @param params.threshold         — Optional override for the emotion
   *                                   threshold (defaults to config value).
   * @returns A {@link TurningPointResult} with all detected turning points.
   *
   * @see FR-1522(d)
   */
  detectPsychologicalTurningPoints(params: {
    readonly leaderId: LeaderId;
    readonly emotionalTimeline: readonly EmotionalTimelineEntry[];
    readonly threshold?: number;
  }): TurningPointResult {
    const { leaderId, emotionalTimeline, threshold } = params;

    const effectiveThreshold =
      threshold ?? this.config.psychologicalTurningPointThreshold;
    const minDelta = this.config.psychologicalShiftMinDelta;

    const emotionalDimensions = [
      'stress',
      'confidence',
      'anger',
      'fear',
      'resolve',
    ] as const;

    const turningPoints: PsychologicalTurningPoint[] = [];

    for (let i = 1; i < emotionalTimeline.length; i++) {
      const prev = emotionalTimeline[i - 1]!;
      const curr = emotionalTimeline[i]!;

      for (const dim of emotionalDimensions) {
        const previousValue = prev[dim];
        const newValue = curr[dim];
        const delta = newValue - previousValue;

        if (newValue >= effectiveThreshold && Math.abs(delta) >= minDelta) {
          const sign = delta >= 0 ? '+' : '';
          turningPoints.push({
            turn: curr.turn,
            dimension: dim,
            previousValue,
            newValue,
            delta,
            narrative:
              `Turn ${String(curr.turn as number)}: Leader's ${dim} exceeded ` +
              `${String(effectiveThreshold)} (delta: ${sign}${String(delta)}).`,
          });
        }
      }
    }

    return {
      leaderId,
      turningPoints,
      totalDetected: turningPoints.length,
      reason:
        turningPoints.length > 0
          ? `Detected ${String(turningPoints.length)} psychological turning point(s) ` +
            `across ${String(emotionalTimeline.length)} turn(s).`
          : 'No psychological turning points detected.',
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 5 — Drift Summary   (FR-1522)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute an aggregated personality-drift summary from a leader's drift log.
   *
   * Aggregates drift events by dimension (signed net), and identifies the
   * single event with the largest absolute delta.
   *
   * @param params.leaderId — The leader to summarise.
   * @param params.driftLog — The full {@link PersonalityDriftLog} for the leader.
   * @returns A {@link DriftSummaryResult} with aggregated data.
   *
   * @see FR-1522
   */
  computeDriftSummary(params: {
    readonly leaderId: LeaderId;
    readonly driftLog: PersonalityDriftLog;
  }): DriftSummaryResult {
    const { leaderId, driftLog } = params;
    const { driftEvents, currentDriftMagnitude, stressInoculationTurn } = driftLog;

    const netDriftByDimension: Record<string, number> = {};
    let mostImpactfulEvent: DriftEventSummary | null = null;
    let largestAbsDelta = -1;

    for (const evt of driftEvents) {
      const dimKey = evt.dimension as string;
      netDriftByDimension[dimKey] =
        (netDriftByDimension[dimKey] ?? 0) + evt.delta;

      const absDelta = Math.abs(evt.delta);
      if (absDelta > largestAbsDelta) {
        largestAbsDelta = absDelta;
        mostImpactfulEvent = {
          trigger: evt.trigger,
          turn: evt.turn,
          dimension: dimKey,
          delta: evt.delta,
        };
      }
    }

    return {
      leaderId,
      totalEvents: driftEvents.length,
      netDriftByDimension,
      driftMagnitude: currentDriftMagnitude,
      stressInoculationTurn,
      mostImpactfulEvent,
      reason:
        `Drift summary aggregated ${String(driftEvents.length)} event(s) across ` +
        `${String(Object.keys(netDriftByDimension).length)} dimension(s). ` +
        `Overall drift magnitude: ${String(currentDriftMagnitude)}.` +
        (mostImpactfulEvent
          ? ` Most impactful: "${mostImpactfulEvent.trigger}" on turn ` +
            `${String(mostImpactfulEvent.turn as number)} ` +
            `(${mostImpactfulEvent.dimension}, Δ = ${String(mostImpactfulEvent.delta)}).`
          : ''),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Method 6 — Journey Summary   (FR-1522)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a high-level narrative summary combining all psychological
   * journey data for one leader.
   *
   * Intended to be rendered as a concluding paragraph on the post-game
   * Psychological Journey screen.
   *
   * @param params.leaderId          — The leader to summarise.
   * @param params.emotionalTimeline — Ordered emotional timeline entries.
   * @param params.radar             — Personality radar result.
   * @param params.grudgeTimeline    — Grudge timeline result.
   * @param params.turningPoints     — Detected turning points.
   * @returns A {@link JourneySummaryResult} with a narrative paragraph.
   *
   * @see FR-1522
   */
  generateJourneySummary(params: {
    readonly leaderId: LeaderId;
    readonly emotionalTimeline: readonly EmotionalTimelineEntry[];
    readonly radar: PersonalityRadarResult;
    readonly grudgeTimeline: GrudgeTimelineResult;
    readonly turningPoints: readonly PsychologicalTurningPoint[];
  }): JourneySummaryResult {
    const { leaderId, emotionalTimeline, radar, grudgeTimeline, turningPoints } =
      params;

    const totalTurns = emotionalTimeline.length;
    const turningPointCount = turningPoints.length;
    const grudgeCount = grudgeTimeline.totalGrudges;
    const { totalDriftMagnitude: driftMagnitude, mostDriftedDimension } = radar;

    // ── Build narrative sentences ──
    const sentences: string[] = [];

    sentences.push(
      `Over ${String(totalTurns)} turn(s), this leader underwent ` +
        `${String(turningPointCount)} psychological turning point(s).`,
    );

    if (grudgeCount > 0) {
      sentences.push(
        `They accumulated ${String(grudgeCount)} grudge(s)` +
          (grudgeTimeline.unresolvedCount > 0
            ? `, ${String(grudgeTimeline.unresolvedCount)} of which remain unresolved.`
            : ', all of which were resolved.'),
      );
    } else {
      sentences.push('They held no grudges throughout the simulation.');
    }

    if (driftMagnitude > 0) {
      sentences.push(
        `Their personality drifted by a total magnitude of ${String(driftMagnitude)}, ` +
          `with ${mostDriftedDimension} shifting the most.`,
      );
    } else {
      sentences.push('Their personality remained remarkably stable.');
    }

    if (grudgeTimeline.mostInfluentialGrudge) {
      const mig = grudgeTimeline.mostInfluentialGrudge;
      sentences.push(
        `The most influential grudge was against ${mig.offender as string} ` +
          `(${mig.offenseType}), which influenced ${String(mig.influencedDecisionCount)} decision(s).`,
      );
    }

    if (turningPointCount > 0) {
      const first = turningPoints[0]!;
      sentences.push(
        `The first turning point occurred on turn ${String(first.turn as number)} ` +
          `when ${first.dimension} shifted by ${String(first.delta)}.`,
      );
    }

    const narrativeSummary = sentences.join(' ');

    return {
      leaderId,
      totalTurns,
      turningPointCount,
      grudgeCount,
      driftMagnitude,
      mostDriftedDimension,
      narrativeSummary,
    };
  }
}
