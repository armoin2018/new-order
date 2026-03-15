/**
 * Chaotic Events Engine — FR-7005
 *
 * Pure-function engine that generates and processes natural disasters
 * and chaotic events: earthquakes, tornados, viruses, floods, hurricanes,
 * tsunamis, volcanic eruptions, wildfires, droughts, blizzards.
 *
 * Events are randomly generated with configurable probability,
 * have severity-scaled economic/population/infrastructure impact,
 * and can be mitigated by disaster response spending.
 *
 * Viruses can spread to trade partners.
 */

import type { FactionId, TurnNumber } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';
import type {
  ChaoticEvent,
  ChaoticEventState,
  ChaoticEventType,
} from '@/data/types/economic-state.types';
import { chaoticEventsConfig } from './config/macro-economy';

// ─────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────

/** Create empty chaotic event state at game start. */
export function initChaoticEventState(): ChaoticEventState {
  return {
    activeEvents: [],
    historicalEvents: [],
    pandemicAlertLevel: 0,
    totalDisastersThisGame: 0,
  };
}

// ─────────────────────────────────────────────────────────
// Event Generation
// ─────────────────────────────────────────────────────────

const ALL_EVENT_TYPES: ChaoticEventType[] = [
  'earthquake', 'tornado', 'hurricane', 'flood', 'virus',
  'tsunami', 'volcanic_eruption', 'wildfire', 'drought', 'blizzard',
];

export interface EventGenerationContext {
  /** Current turn number. */
  turn: TurnNumber;
  /** Current chaotic event state. */
  currentState: ChaoticEventState;
  /** All faction IDs in play. */
  factions: readonly FactionId[];
  /** Random value 0–1 for each faction (deterministic). */
  factionRolls: Record<string, number>;
  /** Random value 0–1 for event type selection per faction. */
  typeRolls: Record<string, number>;
  /** Random value 0–1 for severity per faction. */
  severityRolls: Record<string, number>;
}

/** Generate name for a chaotic event. */
function generateEventName(type: ChaoticEventType, factionId: FactionId, turn: number): string {
  const factionNames: Record<string, string> = {
    us: 'American', china: 'Chinese', russia: 'Russian', japan: 'Japanese',
    iran: 'Iranian', dprk: 'North Korean', eu: 'European', syria: 'Syrian',
  };
  const adj = factionNames[factionId] ?? 'Unknown';

  const typeNames: Record<string, string> = {
    earthquake: 'Earthquake', tornado: 'Tornado Outbreak', hurricane: 'Hurricane',
    flood: 'Flooding Crisis', virus: 'Viral Outbreak', tsunami: 'Tsunami',
    volcanic_eruption: 'Volcanic Eruption', wildfire: 'Wildfires',
    drought: 'Severe Drought', blizzard: 'Blizzard',
  };

  return `${adj} ${typeNames[type] ?? type} (T${turn})`;
}

/**
 * Generate new chaotic events for this turn.
 * Returns newly generated events (not yet added to state).
 */
export function generateChaoticEvents(ctx: EventGenerationContext): ChaoticEvent[] {
  const { turn, currentState, factions, factionRolls, typeRolls, severityRolls } = ctx;
  const cfg = chaoticEventsConfig;

  // Check global cap
  if (currentState.activeEvents.length >= cfg.maxActiveEvents) return [];

  const newEvents: ChaoticEvent[] = [];

  // Probability increases over time
  const baseProbability = Math.min(
    cfg.maxProbability,
    cfg.baseProbabilityPerTurn + (turn as number) * cfg.probabilityIncreasePerTurn,
  );

  for (const fid of factions) {
    const roll = factionRolls[fid] ?? Math.random();
    if (roll >= baseProbability) continue;

    // Check per-faction cap: max 1 new event per faction per turn
    if (newEvents.some(e => e.targetNation === fid)) continue;

    // Select event type — weighted by regional vulnerability
    const vulnerability = cfg.regionalVulnerability[fid] ?? {};
    const typeRoll = typeRolls[fid] ?? Math.random();
    const selectedType = selectEventType(typeRoll, vulnerability);

    // Determine severity
    const eventDef = cfg.eventTypes[selectedType];
    if (!eventDef) continue;

    const severityRoll = severityRolls[fid] ?? Math.random();
    const severity = Math.round(
      eventDef.minSeverity + severityRoll * (eventDef.maxSeverity - eventDef.minSeverity),
    );

    const duration = Math.round(
      eventDef.minDuration + severityRoll * (eventDef.maxDuration - eventDef.minDuration),
    );

    const eventId = `chaos-${fid}-${selectedType}-${turn}`;

    newEvents.push({
      id: eventId,
      type: selectedType as ChaoticEventType,
      targetNation: fid,
      name: generateEventName(selectedType as ChaoticEventType, fid, turn as number),
      severity,
      turnFired: turn,
      duration,
      turnsRemaining: duration,
      active: true,
      economicDamage: 0, // accumulates over turns
      populationImpact: 0,
      infrastructureDamage: 0,
      responseActivated: false,
    });
  }

  return newEvents;
}

/** Select event type weighted by regional vulnerability. */
function selectEventType(
  roll: number,
  vulnerability: Record<string, number>,
): string {
  // Build weighted list
  const weights: { type: string; weight: number }[] = ALL_EVENT_TYPES.map(t => ({
    type: t,
    weight: vulnerability[t] ?? 1.0,
  }));

  const total = weights.reduce((s, w) => s + w.weight, 0);
  let acc = 0;
  for (const w of weights) {
    acc += w.weight / total;
    if (roll < acc) return w.type;
  }
  return weights[weights.length - 1]?.type ?? 'earthquake';
}

// ─────────────────────────────────────────────────────────
// Event Processing (per turn)
// ─────────────────────────────────────────────────────────

export interface ChaoticEventTurnResult {
  /** Updated chaotic event state. */
  state: ChaoticEventState;
  /** Per-faction economic damage this turn. */
  economicDamageByFaction: Record<string, number>;
  /** Per-faction stability impact. */
  stabilityImpactByFaction: Record<string, number>;
  /** Per-faction inflation impact. */
  inflationImpactByFaction: Record<string, number>;
  /** Per-faction GDP penalty (multiplier). */
  gdpPenaltyByFaction: Record<string, number>;
  /** Headlines generated by active events. */
  headlines: string[];
  /** New virus spread events (to be added next turn). */
  virusSpreadTargets: { from: FactionId; to: FactionId; severity: number }[];
}

export interface ProcessEventsInput {
  /** Current event state. */
  currentState: ChaoticEventState;
  /** Nation states for impact calculation. */
  nationStates: Record<string, NationState>;
  /** Trade partners per faction (for virus spread). */
  tradePartners: Record<string, FactionId[]>;
  /** Random values for virus spread rolls per faction. */
  spreadRolls: Record<string, number>;
  /** Current turn. */
  turn: TurnNumber;
}

/**
 * Process all active chaotic events for one turn.
 * Accumulates damage, decrements duration, resolves expired events.
 */
export function processChaoticEvents(input: ProcessEventsInput): ChaoticEventTurnResult {
  const { currentState, tradePartners, spreadRolls } = input;
  const cfg = chaoticEventsConfig;

  const economicDamageByFaction: Record<string, number> = {};
  const stabilityImpactByFaction: Record<string, number> = {};
  const inflationImpactByFaction: Record<string, number> = {};
  const gdpPenaltyByFaction: Record<string, number> = {};
  const headlines: string[] = [];
  const virusSpreadTargets: { from: FactionId; to: FactionId; severity: number }[] = [];

  const updatedActive: ChaoticEvent[] = [];
  const newHistorical: ChaoticEvent[] = [...currentState.historicalEvents];

  for (const event of currentState.activeEvents) {
    if (!event.active) {
      newHistorical.push(event);
      continue;
    }

    const fid = event.targetNation;
    const eventDef = cfg.eventTypes[event.type];
    if (!eventDef) {
      newHistorical.push({ ...event, active: false });
      continue;
    }

    // Calculate per-turn damage
    const responseFactor = event.responseActivated ? (1 - cfg.responseEffectiveness) : 1;
    const econDamage = eventDef.economicDamagePerSeverity * event.severity * responseFactor;
    const popImpact = eventDef.populationPerSeverity * event.severity * responseFactor;
    const infraDamage = eventDef.infraPerSeverity * event.severity * responseFactor;

    // Accumulate per-faction
    economicDamageByFaction[fid] = (economicDamageByFaction[fid] ?? 0) + econDamage;
    stabilityImpactByFaction[fid] = (stabilityImpactByFaction[fid] ?? 0) +
      cfg.nationStateImpact.stabilityPerSeverity * event.severity * responseFactor;
    inflationImpactByFaction[fid] = (inflationImpactByFaction[fid] ?? 0) +
      cfg.nationStateImpact.inflationPerSeverity * event.severity * responseFactor;
    gdpPenaltyByFaction[fid] = (gdpPenaltyByFaction[fid] ?? 0) +
      cfg.nationStateImpact.gdpPenaltyPerSeverityPct * event.severity * responseFactor;

    // Virus spread check
    if (event.type === 'virus' && event.turnsRemaining > 1) {
      const partners = tradePartners[fid] ?? [];
      for (const partner of partners) {
        const spreadRoll = spreadRolls[partner] ?? Math.random();
        if (spreadRoll < cfg.virusSpreadProbability) {
          const spreadSeverity = Math.max(1, event.severity - cfg.virusSpreadSeverityReduction);
          virusSpreadTargets.push({ from: fid, to: partner, severity: spreadSeverity });
        }
      }
    }

    // Generate headline
    if (event.turnsRemaining === event.duration) {
      // New event headline
      headlines.push(`BREAKING: ${event.name} strikes — severity ${event.severity}/10`);
    } else if (event.turnsRemaining === 1) {
      headlines.push(`${event.name} subsiding after ${event.duration} turns of destruction`);
    }

    // Update event
    const remaining = event.turnsRemaining - 1;
    if (remaining <= 0) {
      newHistorical.push({
        ...event,
        active: false,
        turnsRemaining: 0,
        economicDamage: event.economicDamage + econDamage,
        populationImpact: event.populationImpact + popImpact,
        infrastructureDamage: Math.min(100, event.infrastructureDamage + infraDamage),
      });
    } else {
      updatedActive.push({
        ...event,
        turnsRemaining: remaining,
        economicDamage: event.economicDamage + econDamage,
        populationImpact: event.populationImpact + popImpact,
        infrastructureDamage: Math.min(100, event.infrastructureDamage + infraDamage),
      });
    }
  }

  // Update pandemic alert level
  const activeViruses = updatedActive.filter(e => e.type === 'virus');
  const pandemicAlertLevel = Math.min(100,
    activeViruses.reduce((sum, v) => sum + v.severity * 10, 0),
  );

  return {
    state: {
      activeEvents: updatedActive,
      historicalEvents: newHistorical,
      pandemicAlertLevel,
      totalDisastersThisGame: currentState.totalDisastersThisGame + headlines.filter(h => h.startsWith('BREAKING')).length,
    },
    economicDamageByFaction,
    stabilityImpactByFaction,
    inflationImpactByFaction,
    gdpPenaltyByFaction,
    headlines,
    virusSpreadTargets,
  };
}

// ─────────────────────────────────────────────────────────
// Disaster Response
// ─────────────────────────────────────────────────────────

/**
 * Activate disaster response for an event.
 * Returns updated event and the treasury cost.
 */
export function activateDisasterResponse(
  event: ChaoticEvent,
): { event: ChaoticEvent; cost: number } {
  if (event.responseActivated) return { event, cost: 0 };

  const cost = event.severity * chaoticEventsConfig.responseCostPerSeverity;
  return {
    event: { ...event, responseActivated: true },
    cost,
  };
}

/**
 * Get total active disaster severity for a specific faction.
 */
export function getActiveSeverityForFaction(
  state: ChaoticEventState,
  factionId: FactionId,
): number {
  return state.activeEvents
    .filter(e => e.targetNation === factionId && e.active)
    .reduce((sum, e) => sum + e.severity, 0);
}
