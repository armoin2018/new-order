/**
 * Chokepoint Resource Disruption & Rare Earth Restriction Engine
 *
 * Models the cascading economic and military effects of strategic resource
 * disruptions (e.g. Strait of Hormuz blockade) and rare-earth export
 * restrictions (e.g. China → Japan).
 *
 * @module resource-disruption
 * @see CNFL-0500 — Chokepoint Resource Disruption
 * @see CNFL-0501 — Rare Earth Restriction
 * @see FR-601 — Chokepoint Cascading Decay
 * @see FR-602 — Rare Earth Restriction Mechanics
 * @see FR-603 — Hormuz Oil Disruption
 */

import type { FactionId, NationState } from '@/data/types';
import type { SpendResult } from './economic-engine';
import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Strategic resource categories tracked by the disruption system. */
export type StrategicResourceType =
  | 'oil'
  | 'rare-earth'
  | 'semiconductors'
  | 'food'
  | 'gas';

/** A disruption event for a strategic resource tied to a chokepoint. */
export interface ResourceDisruption {
  resourceType: StrategicResourceType;
  /** Identifier of the chokepoint causing the disruption. */
  sourceChokepointId: string;
  /** Severity of the disruption (0–100). */
  disruptionLevel: number;
  /** Number of full turns the disruption has been active. */
  turnsActive: number;
  /** Factions affected by this disruption. */
  affectedFactions: FactionId[];
}

/** Cascading decay deltas applied to a single nation for one turn. */
export interface CascadingDecayResult {
  factionId: FactionId;
  /** Military readiness change (negative). */
  militaryReadinessDelta: number;
  /** Industrial stability (techLevel proxy) change (negative). */
  industrialStabilityDelta: number;
  /** Stability change. */
  stabilityDelta: number;
  /** Inflation change. */
  inflationDelta: number;
}

/** State of a rare-earth export restriction between two factions. */
export interface RareEarthRestriction {
  /** Faction imposing the restriction (typically China). */
  imposer: FactionId;
  /** Faction targeted by the restriction (typically Japan). */
  target: FactionId;
  /** Number of full turns the restriction has been active. */
  turnsActive: number;
  /** Whether alternate sourcing has been initiated. */
  alternateSourceActive: boolean;
  /** Progress toward completing alternate sourcing (0 → alternateSourceTurns). */
  alternateSourceProgress: number;
  /** Faction providing the alternate source, if any. */
  alternateSourceProvider: FactionId | null;
}

/** Per-turn result of processing a rare-earth restriction. */
export interface RareEarthTurnResult {
  /** Tech level delta (negative while restriction active, 0 when mitigated). */
  techLevelDelta: number;
  /** Stability delta per turn (negative while restriction active). */
  stabilityDelta: number;
  /** Whether the alternate source has been fully established. */
  alternateSourceComplete: boolean;
  /** Whether sourcing is in progress (partial mitigation applied). */
  mitigated: boolean;
}

/** Hormuz-specific oil disruption calculation result. */
export interface HormuzDisruptionResult {
  /** Effective oil supply disruption level (0–100). */
  oilSupplyDisruption: number;
  /** Global inflation delta driven by disruption. */
  globalInflationDelta: number;
  /** Per-nation stability deltas driven by energy dependency and inflation. */
  perNationStabilityDeltas: Record<FactionId, number>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Manages active resource disruptions and rare-earth restrictions, computing
 * cascading economic and military effects each turn.
 *
 * @see FR-601 — Chokepoint Cascading Decay
 * @see FR-602 — Rare Earth Restriction Mechanics
 * @see FR-603 — Hormuz Oil Disruption
 */
export class ResourceDisruptionEngine {
  private readonly config: typeof GAME_CONFIG.economy;
  private activeDisruptions: ResourceDisruption[] = [];
  private activeRareEarthRestrictions: RareEarthRestriction[] = [];

  constructor(config: typeof GAME_CONFIG.economy) {
    this.config = config;
  }

  // ── Disruption CRUD ─────────────────────────────────────────────────────

  /**
   * Register a new resource disruption. Initialises `turnsActive` to 0.
   *
   * @param disruption Disruption descriptor (without turnsActive)
   */
  addDisruption(disruption: Omit<ResourceDisruption, 'turnsActive'>): void {
    this.activeDisruptions.push({ ...disruption, turnsActive: 0 });
  }

  /**
   * Remove a disruption identified by resource type and source chokepoint.
   *
   * @returns `true` if a matching disruption was found and removed
   */
  removeDisruption(
    resourceType: StrategicResourceType,
    sourceChokepointId: string,
  ): boolean {
    const idx = this.activeDisruptions.findIndex(
      (d) =>
        d.resourceType === resourceType &&
        d.sourceChokepointId === sourceChokepointId,
    );
    if (idx === -1) return false;
    this.activeDisruptions.splice(idx, 1);
    return true;
  }

  /** Return a read-only view of all active disruptions. */
  getActiveDisruptions(): readonly ResourceDisruption[] {
    return this.activeDisruptions;
  }

  // ── Cascading Decay ─────────────────────────────────────────────────────

  /**
   * For every nation affected by at least one disruption that has been active
   * longer than `cascadeDelayTurns`, accumulate military readiness and
   * industrial stability decay.
   *
   * @param disruptions Snapshot of active disruptions to evaluate
   * @param nations     Record of current nation states keyed by FactionId
   * @returns Array of per-nation decay deltas
   *
   * @see FR-601
   */
  calculateCascadingDecay(
    disruptions: readonly ResourceDisruption[],
    nations: Record<FactionId, NationState>,
  ): CascadingDecayResult[] {
    const { cascadeDelayTurns, militaryReadinessDecayPerTurn, industrialStabilityDecayPerTurn } =
      this.config.chokepointResources;

    // Accumulate per-faction deltas across all qualifying disruptions.
    const deltaMap = new Map<
      FactionId,
      { military: number; industrial: number }
    >();

    for (const disruption of disruptions) {
      if (disruption.turnsActive < cascadeDelayTurns) continue;

      const severity = disruption.disruptionLevel / 100;

      for (const fid of disruption.affectedFactions) {
        // Ensure the faction actually exists in the nations record.
        const nation = nations[fid];
        if (nation === undefined) continue;

        const existing = deltaMap.get(fid) ?? { military: 0, industrial: 0 };
        existing.military += militaryReadinessDecayPerTurn * severity;
        existing.industrial += industrialStabilityDecayPerTurn * severity;
        deltaMap.set(fid, existing);
      }
    }

    const results: CascadingDecayResult[] = [];
    for (const [factionId, deltas] of deltaMap) {
      results.push({
        factionId,
        militaryReadinessDelta: deltas.military,
        industrialStabilityDelta: deltas.industrial,
        stabilityDelta: 0,
        inflationDelta: 0,
      });
    }
    return results;
  }

  /** Advance all active disruptions by one turn. */
  advanceTurn(): void {
    for (const d of this.activeDisruptions) {
      d.turnsActive += 1;
    }
    for (const r of this.activeRareEarthRestrictions) {
      r.turnsActive += 1;
      if (r.alternateSourceActive && !this.isAlternateSourceComplete(r)) {
        r.alternateSourceProgress += 1;
      }
    }
  }

  // ── Hormuz Oil Disruption ───────────────────────────────────────────────

  /**
   * Calculate the oil supply disruption, global inflation delta, and
   * per-nation stability deltas resulting from the current Hormuz status.
   *
   * @param hormuzStatus        Current chokepoint status
   * @param transitFeePercent   Fee percentage when status is 'transit-fee'
   * @param nations             Current nation states
   * @param energyDependencies  Per-faction energy dependency (0–100)
   * @returns Hormuz disruption result
   *
   * @see FR-603
   */
  calculateHormuzDisruption(
    hormuzStatus: 'open' | 'transit-fee' | 'blockaded',
    transitFeePercent: number,
    nations: Record<FactionId, NationState>,
    energyDependencies: Record<FactionId, number>,
  ): HormuzDisruptionResult {
    // Determine raw disruption level.
    let oilSupplyDisruption: number;
    switch (hormuzStatus) {
      case 'open':
        oilSupplyDisruption = 0;
        break;
      case 'transit-fee':
        oilSupplyDisruption = Math.min(
          Math.max(transitFeePercent, 0),
          this.config.hormuzOil.maxDisruption,
        );
        break;
      case 'blockaded':
        oilSupplyDisruption = this.config.hormuzOil.maxDisruption;
        break;
    }

    const globalInflationDelta =
      this.config.hormuzOil.inflationCoefficient * oilSupplyDisruption;

    // Per-nation stability deltas based on energy dependency.
    const perNationStabilityDeltas: Record<FactionId, number> = {} as Record<
      FactionId,
      number
    >;

    const { penaltyThreshold } = this.config.inflationEffects;
    const { stabilityPenaltyPer10Inflation } = this.config.hormuzOil;

    for (const fid of Object.keys(nations) as FactionId[]) {
      const nation = nations[fid];
      if (nation === undefined) continue;

      const energyDep = energyDependencies[fid] ?? 0;
      const effectiveInflation =
        nation.inflation + globalInflationDelta * (energyDep / 100);

      if (effectiveInflation > penaltyThreshold) {
        const inflationExcess = effectiveInflation - penaltyThreshold;
        const penaltyUnits = Math.floor(inflationExcess / 10);
        perNationStabilityDeltas[fid] =
          penaltyUnits * stabilityPenaltyPer10Inflation;
      } else {
        perNationStabilityDeltas[fid] = 0;
      }
    }

    return {
      oilSupplyDisruption,
      globalInflationDelta,
      perNationStabilityDeltas,
    };
  }

  // ── Rare Earth Restrictions ─────────────────────────────────────────────

  /**
   * Impose a new rare-earth export restriction.
   *
   * @param imposer Faction imposing the restriction
   * @param target  Faction targeted by the restriction
   */
  imposeRareEarthRestriction(imposer: FactionId, target: FactionId): void {
    this.activeRareEarthRestrictions.push({
      imposer,
      target,
      turnsActive: 0,
      alternateSourceActive: false,
      alternateSourceProgress: 0,
      alternateSourceProvider: null,
    });
  }

  /**
   * Initiate alternate sourcing for a targeted faction. Validates that the
   * target can afford the cost before proceeding.
   *
   * @param target   Faction seeking alternate sourcing
   * @param provider Faction providing the alternate source
   * @param treasury Current treasury of the target faction
   * @returns SpendResult indicating success/failure and remaining treasury
   *
   * @see FR-602
   */
  beginAlternateSourcing(
    target: FactionId,
    provider: FactionId,
    treasury: number,
  ): SpendResult {
    const cost = this.config.rareEarth.alternateSourceCost;

    if (treasury < cost) {
      return {
        success: false,
        remainingTreasury: treasury,
        shortfall: cost - treasury,
      };
    }

    const restriction = this.activeRareEarthRestrictions.find(
      (r) => r.target === target,
    );
    if (restriction) {
      restriction.alternateSourceActive = true;
      restriction.alternateSourceProgress = 0;
      restriction.alternateSourceProvider = provider;
    }

    return {
      success: true,
      remainingTreasury: treasury - cost,
      shortfall: 0,
    };
  }

  /**
   * Process one turn of a rare-earth restriction, returning the deltas to
   * apply to the target nation.
   *
   * - If alternate sourcing is complete → no penalties.
   * - If sourcing is in progress → penalties reduced by `sourcingMitigationFactor`.
   * - Otherwise → full penalties.
   *
   * @param restriction The restriction state to process
   * @returns Turn result with tech-level delta, stability delta, and status flags
   *
   * @see FR-602
   */
  processRareEarthTurn(restriction: RareEarthRestriction): RareEarthTurnResult {
    const {
      techProductionPenalty,
      stabilityDecayPerTurn,
      sourcingMitigationFactor,
    } = this.config.rareEarth;

    const alternateComplete = this.isAlternateSourceComplete(restriction);

    if (alternateComplete) {
      return {
        techLevelDelta: 0,
        stabilityDelta: 0,
        alternateSourceComplete: true,
        mitigated: false,
      };
    }

    if (restriction.alternateSourceActive) {
      return {
        techLevelDelta: techProductionPenalty * sourcingMitigationFactor,
        stabilityDelta: stabilityDecayPerTurn * sourcingMitigationFactor,
        alternateSourceComplete: false,
        mitigated: true,
      };
    }

    return {
      techLevelDelta: techProductionPenalty,
      stabilityDelta: stabilityDecayPerTurn,
      alternateSourceComplete: false,
      mitigated: false,
    };
  }

  /** Return a read-only view of all active rare-earth restrictions. */
  getRareEarthRestrictions(): readonly RareEarthRestriction[] {
    return this.activeRareEarthRestrictions;
  }

  /**
   * Check whether a faction is currently under any rare-earth restriction.
   *
   * @param target Faction to check
   */
  isRareEarthRestricted(target: FactionId): boolean {
    return this.activeRareEarthRestrictions.some((r) => r.target === target);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Determine whether a restriction's alternate sourcing has reached
   * the required number of turns.
   */
  private isAlternateSourceComplete(restriction: RareEarthRestriction): boolean {
    return (
      restriction.alternateSourceActive &&
      restriction.alternateSourceProgress >= this.config.rareEarth.alternateSourceTurns
    );
  }
}
